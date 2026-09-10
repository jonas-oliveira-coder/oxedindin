import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, gt, isNull, desc, count, sql, ilike } from 'drizzle-orm';
import { paginationSchema } from '../../types/schemas.js';
import { auditLog, session } from '../../db/schema/index.js';

const securityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/audit-log', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        action: z.string().optional(),
        entityType: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, action, entityType, startDate, endDate } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(auditLog.userId, userId)];
    if (action) conditions.push(ilike(auditLog.action, `%${action}%`));
    if (entityType) conditions.push(eq(auditLog.entityType, entityType));
    if (startDate) conditions.push(gte(auditLog.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(auditLog.createdAt, new Date(endDate)));

    const [logs, totalResult] = await Promise.all([
      app.db.select().from(auditLog)
        .where(and(...conditions))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(auditLog).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/devices', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const sessions = await app.db.select().from(session)
      .where(and(
        eq(session.userId, request.authUser!.id),
        isNull(session.revokedAt),
        gt(session.expiresAt, new Date())
      ))
      .orderBy(desc(session.createdAt));

    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName || 'Dispositivo desconhecido',
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === request.authUser!.session?.id,
    }));
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
    const { length, uppercase, lowercase, numbers, symbols } = request.body;

    let charset = '';
    if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) throw app.httpErrors.badRequest('At least one character type must be selected');

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

    return { password };
  });
};

export default securityRoutes;