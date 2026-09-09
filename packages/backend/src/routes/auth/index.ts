import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../../types/schemas.js';

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const authService = app.authService;

  app.post('/register', {
    schema: registerSchema,
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof registerSchema.shape.body>;
    const { email, password, name } = body;

    const existingUser = await app.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw app.httpErrors.conflict('Email already registered');
    }

    const passwordHash = await authService.hashPassword(password);

    const user = await app.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    await app.auditLog({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const { session, accessToken, refreshToken } = await authService.createSession(
      user.id,
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
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    });
  });

  app.post('/login', {
    schema: loginSchema,
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof loginSchema.shape.body>;
    const { email, password } = body;

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw app.httpErrors.unauthorized('Invalid credentials');
    }

    const valid = await authService.verifyPassword(password, user.passwordHash);
    if (!valid) {
      await app.auditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      throw app.httpErrors.unauthorized('Invalid credentials');
    }

    const { session, accessToken, refreshToken } = await authService.createSession(
      user.id,
      request.ip,
      request.headers['user-agent'],
      'Password login'
    );

    await app.auditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
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
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    };
  });

  app.post('/logout', async (request, reply) => {
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

  app.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken || request.headers.authorization?.replace('Bearer ', '');

    if (!refreshToken) {
      throw app.httpErrors.unauthorized('Refresh token required');
    }

    try {
      const decoded = await request.jwtVerify<{ sub: string; sessionId: string; type: string }>(refreshToken, { key: app.config.env.JWT_REFRESH_SECRET });

      if (decoded.type !== 'refresh') {
        throw app.httpErrors.unauthorized('Invalid token type');
      }

      const session = await app.prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true },
      });

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw app.httpErrors.unauthorized('Session expired or revoked');
      }

      const { session: newSession, accessToken: newAccessToken, refreshToken: newRefreshToken } = await authService.createSession(
        session.userId,
        request.ip,
        request.headers['user-agent'],
        'Token refresh'
      );

      await authService.revokeSession(session.id);

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
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          emailVerified: session.user.emailVerified,
        },
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err) {
      throw app.httpErrors.unauthorized('Invalid refresh token');
    }
  });

  app.post('/password/change', {
    schema: changePasswordSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof changePasswordSchema.shape.body>;
    const { currentPassword, newPassword } = body;
    const userId = request.authUser!.id;

    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw app.httpErrors.notFound('User not found');
    }

    const valid = await authService.verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw app.httpErrors.unauthorized('Current password is incorrect');
    }

    const newPasswordHash = await authService.hashPassword(newPassword);
    await app.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

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
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof forgotPasswordSchema.shape.body>;
    const { email } = body;

    const user = await app.prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await app.prisma.user.update({
        where: { id: user.id },
        data: { settings: { resetToken, resetTokenExpiresAt: expiresAt.toISOString() } },
      });

      await app.auditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      app.log.info({ email }, 'Password reset requested');
    }

    return { success: true };
  });

  app.post('/password/reset', {
    schema: resetPasswordSchema,
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof resetPasswordSchema.shape.body>;
    const { token, password } = body;

    const user = await app.prisma.user.findFirst({
      where: {
        settings: {
          path: ['resetToken'],
          equals: token,
        },
      },
    });

    if (!user) {
      throw app.httpErrors.badRequest('Invalid or expired reset token');
    }

    const settings = user.settings as any;
    if (!settings.resetTokenExpiresAt || new Date(settings.resetTokenExpiresAt) < new Date()) {
      throw app.httpErrors.badRequest('Reset token expired');
    }

    const passwordHash = await authService.hashPassword(password);
    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        settings: { resetToken: null, resetTokenExpiresAt: null },
      },
    });

    await authService.revokeAllSessions(user.id);

    await app.auditLog({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/passkey/register/start', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const options = await authService.registerPasskeyStart(request.authUser!.id);
    return options;
  });

  app.post('/passkey/register/finish', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const credential = request.body as any;
    const result = await authService.registerPasskeyFinish(request.authUser!.id, credential);
    return result;
  });

  app.post('/passkey/login/start', async (request, reply) => {
    const body = request.body as { userId?: string };
    const { userId } = body;
    const options = await authService.authenticatePasskeyStart(userId);
    return options;
  });

  app.post('/passkey/login/finish', async (request, reply) => {
    const credential = request.body as any;
    const { verified, user } = await authService.authenticatePasskeyFinish(credential);

    if (!verified || !user) {
      throw app.httpErrors.unauthorized('Passkey verification failed');
    }

    const { session, accessToken, refreshToken } = await authService.createSession(
      user.id,
      request.ip,
      request.headers['user-agent'],
      'Passkey login'
    );

    await app.auditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
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
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    };
  });

  app.get('/passkeys', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
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
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const params = request.params as { id: string };
    await authService.revokePasskey(request.authUser!.id, params.id);
    return { success: true };
  });

  app.get('/sessions', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
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
      params: z.object({ id: z.string().cuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
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
  }, async (request, reply) => {
    const body = request.body as { length?: number; uppercase?: boolean; lowercase?: boolean; numbers?: boolean; symbols?: boolean };
    const password = await authService.generateSecurePassword(body);
    return { password };
  });
};

export default authRoutes;