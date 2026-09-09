import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { paginationSchema } from '../../types/schemas.js';

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
  }, async (request, reply) => {
    const { page, limit, action, entityType, startDate, endDate } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      app.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/devices', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const sessions = await app.prisma.session.findMany({
      where: { userId: request.authUser!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

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
  }, async (request, reply) => {
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