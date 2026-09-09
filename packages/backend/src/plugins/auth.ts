import fp from 'fastify-plugin';
import { User, Session } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: (User & { session?: Session }) | null;
  }
}

export default fp(async (app) => {
  app.decorateRequest('authUser', null);

  app.addHook('preHandler', async (request, reply) => {
    const publicPaths = [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/passkey/register/start',
      '/api/v1/auth/passkey/register/finish',
      '/api/v1/auth/passkey/login/start',
      '/api/v1/auth/passkey/login/finish',
      '/api/v1/auth/password/forgot',
      '/api/v1/auth/password/reset',
      '/health',
      '/docs',
    ];

    if (publicPaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    try {
      const token = request.cookies?.accessToken || request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw app.httpErrors.unauthorized('Authentication required');
      }

      // @ts-ignore - jwtVerify accepts token string at runtime
      const decoded = await request.jwtVerify<{ sub: string; sessionId: string }>(token);

      const session = await app.prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true },
      });

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw app.httpErrors.unauthorized('Session expired or revoked');
      }

      request.authUser = session.user;
      (request.authUser as any).session = session;
    } catch (err: any) {
      if (err.statusCode === 401) throw err;
      throw app.httpErrors.unauthorized('Invalid token');
    }
  });
});