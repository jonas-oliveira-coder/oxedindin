import { hash, verify } from '@node-rs/argon2';
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { PrismaClient, User, Session, Passkey } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { env } from '../utils/env.js';

export class AuthService {
  constructor(private app: FastifyInstance, private prisma: PrismaClient) {}

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
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: await this.hashToken(crypto.randomUUID()),
        ip,
        userAgent,
        deviceName,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = this.app.jwt.sign({ sub: userId, sessionId: session.id }, { expiresIn: '15m' });
    const refreshToken = this.app.jwt.sign({ sub: userId, sessionId: session.id, type: 'refresh' }, { expiresIn: '7d', key: env.JWT_REFRESH_SECRET });

    return { session, accessToken, refreshToken };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const existingPasskeys = await this.prisma.passkey.findMany({ where: { userId } });

    const options = generateRegistrationOptions({
      rpName: env.WEB_AUTHN_RP_NAME,
      rpID: env.WEB_AUTHN_RP_ID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name,
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: { passkeyChallenge: options.challenge } },
    });

    return options;
  }

  async registerPasskeyFinish(userId: string, credential: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const storedChallenge = (user.settings as any)?.passkeyChallenge;
    if (!storedChallenge) throw new Error('No challenge found');

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

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    const passkey = await this.prisma.passkey.create({
      data: {
        userId,
        credentialId: credentialID,
        publicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter: BigInt(counter),
        name: `Passkey ${new Date().toLocaleDateString('pt-BR')}`,
      },
    });

    await this.app.auditLog({
      userId,
      action: 'PASSKEY_REGISTERED',
      entityType: 'Passkey',
      entityId: passkey.id,
      newData: { name: passkey.name },
    });

    return { verified: true, passkey };
  }

  async authenticatePasskeyStart(userId?: string) {
    let allowCredentials: any[] = [];

    if (userId) {
      const passkeys = await this.prisma.passkey.findMany({ where: { userId } });
      allowCredentials = passkeys.map((pk) => ({
        id: pk.credentialId,
        type: 'public-key' as const,
        transports: ['internal', 'hybrid'] as const,
      }));
    }

    const options = generateAuthenticationOptions({
      rpID: env.WEB_AUTHN_RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'required',
      timeout: 60000,
    });

    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { settings: { passkeyChallenge: options.challenge } },
      });
    } else {
      await this.prisma.user.updateMany({
        data: { settings: { passkeyChallenge: options.challenge } },
      });
    }

    return options;
  }

  async authenticatePasskeyFinish(credential: any) {
    const user = await this.prisma.user.findFirst({
      where: {
        passkeys: { some: { credentialId: credential.id } },
      },
      include: { passkeys: true },
    });

    if (!user) throw new Error('User not found');

    const passkey = user.passkeys.find((pk) => pk.credentialId === credential.id);
    if (!passkey) throw new Error('Passkey not found');

    const storedChallenge = (user.settings as any)?.passkeyChallenge;
    if (!storedChallenge) throw new Error('No challenge found');

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge,
      expectedOrigin: env.WEB_AUTHN_ORIGIN,
      expectedRPID: env.WEB_AUTHN_RP_ID,
      authenticator: {
        credentialID: passkey.credentialId,
        credentialPublicKey: Buffer.from(passkey.publicKey, 'base64'),
        counter: Number(passkey.counter),
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw new Error('Passkey verification failed');
    }

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo?.newCounter || 0), lastUsedAt: new Date() },
    });

    return { verified: true, user };
  }

  async listPasskeys(userId: string): Promise<Passkey[]> {
    return this.prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokePasskey(userId: string, passkeyId: string): Promise<void> {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) throw new Error('Passkey not found');

    await this.prisma.passkey.delete({ where: { id: passkeyId } });

    await this.app.auditLog({
      userId,
      action: 'PASSKEY_REVOKED',
      entityType: 'Passkey',
      entityId: passkeyId,
      oldData: { name: passkey.name },
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
    if (symbols && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) password = password.slice(0, -1) + charset[array[3] % 32 + 62];

    return password;
  }
}