import { hash, verify } from '@node-rs/argon2';
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { user, session, passkey } from '../db/schema/index.js';
import { eq, and, gt, isNull, desc, not } from 'drizzle-orm';
import { env } from '../utils/env.js';

type User = typeof user.$inferSelect;
type Session = typeof session.$inferSelect;
type Passkey = typeof passkey.$inferSelect;

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

    const currentSettings = (userData.settings as Record<string, unknown>) || {};
    await db.update(user)
      .set({ settings: { ...currentSettings, passkeyChallenge: options.challenge } })
      .where(eq(user.id, userId));

    return options;
  }

  async registerPasskeyFinish(userId: string, credential: any) {
    const userRecord = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!userRecord[0]) throw new Error('User not found');
    const userData = userRecord[0];

    const storedChallenge = (userData.settings as Record<string, unknown>)?.passkeyChallenge;
    if (!storedChallenge || typeof storedChallenge !== 'string') throw new Error('No challenge found');

    const expectedOrigin = env.WEB_AUTHN_ORIGIN;
    const expectedRPID = env.WEB_AUTHN_RP_ID;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: storedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Passkey verification failed');
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
    let allowCredentials: any[] = [];

    if (userId) {
      const passkeys = await db.select().from(passkey).where(eq(passkey.userId, userId));
      allowCredentials = passkeys.map((pk) => ({
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

    if (userId) {
      const userRecord = await db.select().from(user).where(eq(user.id, userId)).limit(1);
      if (userRecord[0]) {
        const currentSettings = (userRecord[0].settings as Record<string, unknown>) || {};
        await db.update(user)
          .set({ settings: { ...currentSettings, passkeyChallenge: options.challenge } })
          .where(eq(user.id, userId));
      }
    } else {
      // For discoverable credentials, update all users' challenge
      const users = await db.select().from(user);
      for (const u of users) {
        const currentSettings = (u.settings as Record<string, unknown>) || {};
        await db.update(user)
          .set({ settings: { ...currentSettings, passkeyChallenge: options.challenge } })
          .where(eq(user.id, u.id));
      }
    }

    return options;
  }

  async authenticatePasskeyFinish(credential: any) {
    const passkeys = await db.select().from(passkey).where(eq(passkey.credentialId, credential.id));
    if (!passkeys[0]) throw new Error('Passkey not found');
    const passkeyData = passkeys[0];

    const userRecord = await db.select().from(user).where(eq(user.id, passkeyData.userId)).limit(1);
    if (!userRecord[0]) throw new Error('User not found');
    const userData = userRecord[0];

    const storedChallenge = (userData.settings as Record<string, unknown>)?.passkeyChallenge;
    if (!storedChallenge || typeof storedChallenge !== 'string') throw new Error('No challenge found');

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge,
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
      throw new Error('Passkey verification failed');
    }

    await db.update(passkey)
      .set({ 
        counter: BigInt(verification.authenticationInfo?.newCounter || 0), 
        lastUsedAt: new Date() 
      })
      .where(eq(passkey.id, passkeyData.id));

    return { verified: true, user: userData };
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

    let charset = '';
    if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) throw new Error('At least one character type must be selected');

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }

    if (uppercase && !/[A-Z]/.test(password)) password = password.slice(0, -1) + charset[array[0] % 26];
    if (lowercase && !/[a-z]/.test(password)) password = password.slice(0, -1) + charset[array[1] % 26 + 26];
    if (numbers && !/[0-9]/.test(password)) password = password.slice(0, -1) + charset[array[2] % 10 + 52];
    if (symbols && !/[!@#$%^&*()_+\-=[]{}|;:,.<>?]/.test(password)) password = password.slice(0, -1) + charset[array[3] % 32 + 62];

    return password;
  }
}