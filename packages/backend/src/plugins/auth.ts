import fp from 'fastify-plugin';
import { user, session } from '../db/schema/tables.js';
import { eq } from 'drizzle-orm';

type User = typeof user.$inferSelect;
type Session = typeof session.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: (User & { session?: Session }) | null;
  }
}

export default fp(async (app) => {
  app.decorateRequest('authUser', null);

  const authenticate = async (request: any, reply: any) => {
    try {
      const token = request.cookies?.accessToken || request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw app.httpErrors.unauthorized('Autenticação necessária.');
      }

      const decoded = (await request.jwtVerify()) as { sub: string; sessionId: string };

      const sessionRecord = await app.db.select({
        session: session,
        user: user,
      })
        .from(session)
        .innerJoin(user, eq(session.userId, user.id))
        .where(eq(session.id, decoded.sessionId))
        .limit(1);

      const row = sessionRecord[0];

      if (!row || row.session.revokedAt || row.session.expiresAt < new Date()) {
        throw app.httpErrors.unauthorized('Sessão expirada ou revogada.');
      }

      request.authUser = row.user;
      request.authUser.session = row.session;
    } catch (err: any) {
      if (err.statusCode === 401) throw err;
      throw app.httpErrors.unauthorized('Token inválido.');
    }
  };

  app.decorate('authenticate', authenticate);

  app.addHook('preHandler', async (request: any, reply: any) => {
    const publicPaths = [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/csrf',
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

    await authenticate(request, reply);
  });
});