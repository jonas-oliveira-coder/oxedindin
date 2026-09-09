import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';

interface AuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    auditLog: (input: AuditLogInput) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorate('auditLog', async (input: AuditLogInput) => {
    try {
      await app.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldData: input.oldData as Prisma.InputJsonValue | undefined,
          newData: input.newData as Prisma.InputJsonValue | undefined,
          ip: input.ip,
          userAgent: input.userAgent,
        },
      });
    } catch (err) {
      app.log.error({ err, input }, 'Failed to write audit log');
    }
  });

  app.addHook('onRequest', async (request) => {
    (request as any).auditData = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  });
});