import { hash, verify } from '@node-rs/argon2';
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { user, session, passkey } from '../db/schema/index.js';
import { eq, and, gt, isNull, desc, not } from 'drizzle-orm';
import { env } from '../utils/env.js';

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Passkey = typeof passkey.$inferSelect;

interface ChallengeRecord {
  challenge: string;
  type: 'registration' | 'authentication';
  userId?: string;
  expiresAt?: number;
}

export class AuthService {
  constructor(private app: FastifyInstance) {}

  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      outputLen: 32,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return verify(hash, password);
  }

  async createSession(userId: string, ip?: string, userAgent?: string, deviceName?: string): Promise<{ session: Session; accessToken: string; refreshToken: string }> {
    const tokenHash = await this.hashToken(crypto.randomUUID());
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const [newSession] = await db.insert(session).values({
      userId,
      tokenHash,
      ip,
      userAgent,
      deviceName,
      expiresAt,
    }).returning();

    const accessToken = this.app.jwt.sign({ sub: userId, sessionId: newSession.id }, { expiresIn: '15m' });
    const refreshToken = this.app.jwt.sign({ sub: userId, sessionId: newSession.id, type: 'refresh' }, { expiresIn: '7d', key: env.JWT_REFRESH_SECRET });

    return { session: newSession, accessToken, refreshToken };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await db.update(session)
      .set({ revokedAt: new Date() })
      .where(eq(session.id, sessionId));
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const conditions = [
      eq(session.userId, userId),
      isNull(session.revokedAt),
    ];
    if (exceptSessionId) {
      conditions.push(not(eq(session.id, exceptSessionId)));
    }
    await db.update(session)
      .set({ revokedAt: new Date() })
      .where(and(...conditions));
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return db.select()
      .from(session)
      .where(and(
        eq(session.userId, userId),
        isNull(session.revokedAt),
        gt(session.expiresAt, new Date())
      ))
      .orderBy(desc(session.createdAt));
  }

  private async hashToken(token: string): Promise<string> {
    return hash(token, {
      memoryCost: 32768,
      timeCost: 2,
      parallelism: 2,
      outputLen: 32,
    });
  }

  async verifyTokenHash(token: string, hash: string): Promise<boolean> {
    return verify(hash, token);
  }

  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly CHALLENGE_TTL_SECONDS = 300;

  private async setChallenge(challenge: string, type: 'registration' | 'authentication', userId?: string): Promise<string> {
    const id = crypto.randomUUID();
    const record: ChallengeRecord = { challenge, type, userId };
    if (this.app.redis) {
      await this.app.redis.set(`passkey:challenge:${id}`, JSON.stringify(record), 'EX', this.CHALLENGE_TTL_SECONDS);
      return id;
    }
    this.challenges.set(id, { ...record, expiresAt: Date.now() + this.CHALLENGE_TTL_SECONDS * 1000 });
    return id;
  }

  private async takeChallenge(id: string): Promise<ChallengeRecord | null> {
    if (this.app.redis) {
      const raw = await this.app.redis.get(`passkey:challenge:${id}`);
      if (!raw) return null;
      await this.app.redis.del(`passkey:challenge:${id}`);
      try {
        return JSON.parse(raw) as ChallengeRecord;
      } catch {
        return null;
      }
    }

    const record = this.challenges.get(id);
    if (!record) return null;
    this.challenges.delete(id);
    if (record.expiresAt !== undefined && record.expiresAt < Date.now()) return null;
    return record;
  }

  async registerPasskeyStart(userId: string) {
    const userRecord = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!userRecord[0]) throw new Error('User not found');
    const userData = userRecord[0];

    const existingPasskeys = await db.select().from(passkey).where(eq(passkey.userId, userId));

    const options = await generateRegistrationOptions({
      rpName: env.WEB_AUTHN_RP_NAME,
      rpID: env.WEB_AUTHN_RP_ID,
      userID: new TextEncoder().encode(userData.id),
      userName: userData.email,
      userDisplayName: userData.name,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId,
        type: 'public-key' as const,
        transports: ['internal', 'hybrid'] as const,
      })),
      timeout: 60000,
    });

    const challengeId = await this.setChallenge(options.challenge, 'registration', userId);
    return { ...options, timeout: 60000, challengeId };
  }

  async registerPasskeyFinish(userId: string, challengeId: string, credential: RegistrationResponseJSON) {
    const challengeRecord = await this.takeChallenge(challengeId);
    if (!challengeRecord || challengeRecord.type !== 'registration') {
      throw new Error('Challenge expirado ou inválido');
    }
    if (challengeRecord.userId && challengeRecord.userId !== userId) {
      throw new Error('Challenge inválido');
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: env.WEB_AUTHN_ORIGIN,
      expectedRPID: env.WEB_AUTHN_RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Falha na verificação da passkey');
    }

    const registrationInfo = verification.registrationInfo;

    const [newPasskey] = await db.insert(passkey).values({
      userId,
      credentialId: registrationInfo.credential.id,
      publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64'),
      counter: BigInt(registrationInfo.credential.counter),
      name: `Passkey ${new Date().toLocaleDateString('pt-BR')}`,
    }).returning();

    await this.app.auditLog({
      userId,
      action: 'PASSKEY_REGISTERED',
      entityType: 'Passkey',
      entityId: newPasskey.id,
      newData: { name: newPasskey.name },
    });

    return { verified: true, passkey: newPasskey };
  }

  async authenticatePasskeyStart(userId?: string) {
    let allowCredentials: Array<{ id: string; type: 'public-key'; transports: Array<'internal' | 'hybrid'> }> = [];

    if (userId) {
      const userPasskeys = await db.select().from(passkey).where(eq(passkey.userId, userId));
      allowCredentials = userPasskeys.map((pk) => ({
        id: pk.credentialId,
        type: 'public-key' as const,
        transports: ['internal', 'hybrid'] as const,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: env.WEB_AUTHN_RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'required',
      timeout: 60000,
    });

    const challengeId = await this.setChallenge(options.challenge, 'authentication', userId);
    return { ...options, timeout: 60000, challengeId };
  }

  async authenticatePasskeyFinish(challengeId: string, credential: AuthenticationResponseJSON) {
    const challengeRecord = await this.takeChallenge(challengeId);
    if (!challengeRecord || challengeRecord.type !== 'authentication') {
      throw new Error('Challenge expirado ou inválido');
    }

    const passkeys = await db.select().from(passkey).where(eq(passkey.credentialId, credential.id));
    if (!passkeys[0]) throw new Error('Passkey não encontrada');
    const passkeyData = passkeys[0];

    if (challengeRecord.userId && challengeRecord.userId !== passkeyData.userId) {
      throw new Error('Challenge inválido');
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: env.WEB_AUTHN_ORIGIN,
      expectedRPID: env.WEB_AUTHN_RP_ID,
      credential: {
        id: passkeyData.credentialId,
        publicKey: new Uint8Array(Buffer.from(passkeyData.publicKey, 'base64')),
        counter: Number(passkeyData.counter),
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw new Error('Falha na verificação da passkey');
    }

    await db.update(passkey)
      .set({
        counter: BigInt(verification.authenticationInfo?.newCounter || 0),
        lastUsedAt: new Date(),
      })
      .where(eq(passkey.id, passkeyData.id));

    const userRecord = await db.select().from(user).where(eq(user.id, passkeyData.userId)).limit(1);
    if (!userRecord[0]) throw new Error('Usuário não encontrado');

    return { verified: true, user: userRecord[0] };
  }

  async listPasskeys(userId: string): Promise<Passkey[]> {
    return db.select()
      .from(passkey)
      .where(eq(passkey.userId, userId))
      .orderBy(desc(passkey.createdAt));
  }

  async revokePasskey(userId: string, passkeyId: string): Promise<void> {
    const passkeyRecord = await db.select().from(passkey)
      .where(and(eq(passkey.id, passkeyId), eq(passkey.userId, userId)))
      .limit(1);

    if (!passkeyRecord[0]) throw new Error('Passkey not found');

    await db.delete(passkey).where(eq(passkey.id, passkeyId));

    await this.app.auditLog({
      userId,
      action: 'PASSKEY_REVOKED',
      entityType: 'Passkey',
      entityId: passkeyId,
      oldData: { name: passkeyRecord[0].name },
    });
  }

  async generateSecurePassword(options: {
    length?: number;
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}): Promise<string> {
    const { length = 16, uppercase = true, lowercase = true, numbers = true, symbols = true } = options;

    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const NUMBERS = '0123456789';
    const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = '';
    if (uppercase) charset += UPPER;
    if (lowercase) charset += LOWER;
    if (numbers) charset += NUMBERS;
    if (symbols) charset += SYMBOLS;

    if (!charset) throw new Error('At least one character type must be selected');
    const requiredCharsets = [
      uppercase ? UPPER : '',
      lowercase ? LOWER : '',
      numbers ? NUMBERS : '',
      symbols ? SYMBOLS : '',
    ].filter(Boolean);

    if (length < requiredCharsets.length) {
      throw new Error('Password length is too short for the selected character types');
    }

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    const characters = requiredCharsets.map((characterSet, index) => characterSet[array[index] % characterSet.length]);
    for (let i = requiredCharsets.length; i < length; i++) {
      characters.push(charset[array[i] % charset.length]);
    }

    for (let i = characters.length - 1; i > 0; i--) {
      const swapIndex = array[i] % (i + 1);
      [characters[i], characters[swapIndex]] = [characters[swapIndex], characters[i]];
    }

    return characters.join('');
  }
}