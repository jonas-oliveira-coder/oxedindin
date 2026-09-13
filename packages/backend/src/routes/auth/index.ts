import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../../types/schemas.js';
import { user, session } from '../../db/schema/index.js';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { webAuthnCredentialSchema } from '@oxedindin/shared';

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const authService = app.authService;

  app.get('/csrf', async (request: any, reply: any) => {
    const csrfToken = reply.generateCsrf();
    return { csrfToken };
  });

  app.post('/register', {
    schema: registerSchema,
  }, async (request: any, reply: any) => {
    const body = request.body as z.infer<typeof registerSchema.shape.body>;
    const { email, password, name } = body;

    const existingUser = await app.db.select().from(user).where(eq(user.email, email)).limit(1);
    if (existingUser[0]) {
      throw app.httpErrors.conflict('Este email já está cadastrado.');
    }

    const passwordHash = await authService.hashPassword(password);

    const [newUser] = await app.db.insert(user).values({
      email,
      passwordHash,
      name,
    }).returning();

    await app.auditLog({
      userId: newUser.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: newUser.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const { session: newSession, accessToken, refreshToken } = await authService.createSession(
      newUser.id,
      request.ip,
      request.headers['user-agent'],
      'Initial session'
    );

    reply.setCookie('accessToken', accessToken, {
      httpOnly: true,
      secure: app.config.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60,
    });

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: app.config.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.status(201).send({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        emailVerified: newUser.emailVerified,
      },
      accessToken,
      refreshToken,
    });
  });

  app.post('/login', {
    schema: loginSchema,
  }, async (request: any, reply: any) => {
    const body = request.body as z.infer<typeof loginSchema.shape.body>;
    const { email, password } = body;

    const userRecord = await app.db.select().from(user).where(eq(user.email, email)).limit(1);
    const userData = userRecord[0];
    if (!userData || !userData.passwordHash) {
      throw app.httpErrors.unauthorized('Credenciais inválidas.');
    }

    const valid = await authService.verifyPassword(password, userData.passwordHash);
    if (!valid) {
      await app.auditLog({
        userId: userData.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: userData.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      throw app.httpErrors.unauthorized('Credenciais inválidas.');
    }

    const { session: newSession, accessToken, refreshToken } = await authService.createSession(
      userData.id,
      request.ip,
      request.headers['user-agent'],
      'Password login'
    );

    await app.auditLog({
      userId: userData.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: userData.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    reply.setCookie('accessToken', accessToken, {
      httpOnly: true,
      secure: app.config.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60,
    });

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: app.config.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        emailVerified: userData.emailVerified,
      },
      accessToken,
      refreshToken,
    };
  });

  app.post('/logout', async (request: any, reply: any) => {
    const user = request.authUser;
    if (user?.session) {
      await authService.revokeSession(user.session.id);
      await app.auditLog({
        userId: user.id,
        action: 'LOGOUT',
        entityType: 'Session',
        entityId: user.session.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    }

    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });

    return { success: true };
  });

  app.post('/refresh', async (request: any, reply: any) => {
    const refreshToken = request.cookies?.refreshToken || request.headers.authorization?.replace('Bearer ', '');

    if (!refreshToken) {
      throw app.httpErrors.unauthorized('Token de renovação obrigatório.');
    }

    try {
      const decoded = app.jwt.verify(refreshToken, { key: app.config.env.JWT_REFRESH_SECRET }) as { sub: string; sessionId: string; type?: string };

      if (decoded.type !== 'refresh') {
        throw app.httpErrors.unauthorized('Tipo de token inválido.');
      }

      const sessionRecord = await app.db.select({
        session: session,
        user: user,
      })
        .from(session)
        .innerJoin(user, eq(session.userId, user.id))
        .where(and(
          eq(session.id, decoded.sessionId),
          isNull(session.revokedAt),
          gt(session.expiresAt, new Date())
        ))
        .limit(1);

      const sessionData = sessionRecord[0];
      if (!sessionData) {
        throw app.httpErrors.unauthorized('Sessão expirada ou revogada.');
      }

      const { session: newSession, accessToken: newAccessToken, refreshToken: newRefreshToken } = await authService.createSession(
        sessionData.session.userId,
        request.ip,
        request.headers['user-agent'],
        'Token refresh'
      );

      await authService.revokeSession(sessionData.session.id);

      reply.setCookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: app.config.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 15 * 60,
      });

      reply.setCookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: app.config.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return {
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
          emailVerified: sessionData.user.emailVerified,
        },
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err) {
      throw app.httpErrors.unauthorized('Token de renovação inválido.');
    }
  });

  app.post('/password/change', {
    schema: changePasswordSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const body = request.body as z.infer<typeof changePasswordSchema.shape.body>;
    const { currentPassword, newPassword } = body;
    const userId = request.authUser!.id;

    const userRecord = await app.db.select().from(user).where(eq(user.id, userId)).limit(1);
    const userData = userRecord[0];
    if (!userData || !userData.passwordHash) {
      throw app.httpErrors.notFound('Usuário não encontrado.');
    }

    const valid = await authService.verifyPassword(currentPassword, userData.passwordHash);
    if (!valid) {
      throw app.httpErrors.unauthorized('A senha atual está incorreta.');
    }

    const newPasswordHash = await authService.hashPassword(newPassword);
    await app.db.update(user)
      .set({ passwordHash: newPasswordHash })
      .where(eq(user.id, userId));

    await authService.revokeAllSessions(userId, request.authUser!.session?.id);

    await app.auditLog({
      userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/password/forgot', {
    schema: forgotPasswordSchema,
  }, async (request: any, reply: any) => {
    const body = request.body as z.infer<typeof forgotPasswordSchema.shape.body>;
    const { email } = body;

    const userRecord = await app.db.select().from(user).where(eq(user.email, email)).limit(1);
    const userData = userRecord[0];

    if (userData) {
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      const currentSettings = (userData.settings as Record<string, unknown>) || {};
      await app.db.update(user)
        .set({ settings: { ...currentSettings, resetToken, resetTokenExpiresAt: expiresAt.toISOString() } })
        .where(eq(user.id, userData.id));

      await app.auditLog({
        userId: userData.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: userData.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      app.log.info({ email }, 'Password reset requested');
    }

    return { success: true };
  });

  app.post('/password/reset', {
    schema: resetPasswordSchema,
  }, async (request: any, reply: any) => {
    const body = request.body as z.infer<typeof resetPasswordSchema.shape.body>;
    const { token, password } = body;

    const userRecord = await app.db.select().from(user).limit(100);
    const foundUser = userRecord.find(u => (u.settings as Record<string, unknown>)?.resetToken === token);

    if (!foundUser) {
      throw app.httpErrors.badRequest('Token de redefinição inválido ou expirado.');
    }

    const settings = foundUser.settings as Record<string, unknown>;
    if (!settings.resetTokenExpiresAt || new Date(settings.resetTokenExpiresAt as string) < new Date()) {
      throw app.httpErrors.badRequest('Token de redefinição expirado.');
    }

    const passwordHash = await authService.hashPassword(password);
    await app.db.update(user)
      .set({ 
        passwordHash,
        settings: { ...settings, resetToken: null, resetTokenExpiresAt: null } 
      })
      .where(eq(user.id, foundUser.id));

    await authService.revokeAllSessions(foundUser.id);

    await app.auditLog({
      userId: foundUser.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: foundUser.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/passkey/register/start', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const options = await authService.registerPasskeyStart(request.authUser!.id);
    return options;
  });

  app.post('/passkey/register/finish', {
    schema: {
      body: z.object({
        challengeId: z.string().min(1, 'Identificador de desafio inválido.'),
        credential: webAuthnCredentialSchema,
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { challengeId, credential } = request.body;
    const result = await authService.registerPasskeyFinish(
      request.authUser!.id,
      challengeId,
      credential as any,
    );
    return { verified: result.verified, passkey: { id: result.passkey.id, name: result.passkey.name, createdAt: result.passkey.createdAt } };
  });

  app.post('/passkey/login/start', async (request: any, reply: any) => {
    const body = request.body as { userId?: string };
    const { userId } = body;
    const options = await authService.authenticatePasskeyStart(userId);
    return options;
  });

  app.post('/passkey/login/finish', {
    schema: {
      body: z.object({
        challengeId: z.string().min(1, 'Identificador de desafio inválido.'),
        credential: webAuthnCredentialSchema,
      }),
    },
  }, async (request: any, reply: any) => {
    const { challengeId, credential } = request.body;
    const { verified, user: passkeyUser } = await authService.authenticatePasskeyFinish(challengeId, credential as any);

    if (!verified || !passkeyUser) {
      throw app.httpErrors.unauthorized('Falha na verificação da passkey');
    }

    const { session: newSession, accessToken, refreshToken } = await authService.createSession(
      passkeyUser.id,
      request.ip,
      request.headers['user-agent'],
      'Passkey login'
    );

    await app.auditLog({
      userId: passkeyUser.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: passkeyUser.id,
      newData: { method: 'passkey' },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    reply.setCookie('accessToken', accessToken, {
      httpOnly: true,
      secure: app.config.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60,
    });

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: app.config.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      user: {
        id: passkeyUser.id,
        email: passkeyUser.email,
        name: passkeyUser.name,
        emailVerified: passkeyUser.emailVerified,
      },
      accessToken,
      refreshToken,
    };
  });

  app.get('/passkeys', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const passkeys = await authService.listPasskeys(request.authUser!.id);
    return passkeys.map((pk) => ({
      id: pk.id,
      name: pk.name,
      createdAt: pk.createdAt.toISOString(),
      lastUsedAt: pk.lastUsedAt?.toISOString(),
    }));
  });

  app.delete('/passkeys/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const params = request.params as { id: string };
    await authService.revokePasskey(request.authUser!.id, params.id);
    return { success: true };
  });

  app.get('/sessions', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const sessions = await authService.getUserSessions(request.authUser!.id);
    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === request.authUser!.session?.id,
    }));
  });

  app.delete('/sessions/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const params = request.params as { id: string };
    await authService.revokeSession(params.id);
    return { success: true };
  });

  app.post('/password/generate', {
    schema: {
      body: z.object({
        length: z.number().int().min(8).max(128).default(16),
        uppercase: z.boolean().default(true),
        lowercase: z.boolean().default(true),
        numbers: z.boolean().default(true),
        symbols: z.boolean().default(true),
      }),
    },
  }, async (request: any, reply: any) => {
    const body = request.body as { length?: number; uppercase?: boolean; lowercase?: boolean; numbers?: boolean; symbols?: boolean };
    const password = await authService.generateSecurePassword(body);
    return { password };
  });
};

export default authRoutes;