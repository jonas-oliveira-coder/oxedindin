import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.authUser!;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      settings: user.settings,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  });

  app.patch('/me', {
    schema: {
      body: z.object({
        name: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().url().nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = await app.prisma.user.update({
      where: { id: request.authUser!.id },
      data: request.body,
    });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      settings: user.settings,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  });

  app.delete('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.user.delete({ where: { id: request.authUser!.id } });

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: request.authUser!.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });

    return { success: true };
  });

  app.get('/me/export', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;

    const [
      accounts,
      cards,
      transactions,
      installmentPlans,
      recurringBills,
      bills,
      debts,
      owedDebts,
      people,
      categories,
      notifications,
      passkeys,
      sessions,
      auditLogs,
    ] = await Promise.all([
      app.prisma.bankAccount.findMany({ where: { userId } }),
      app.prisma.creditCard.findMany({ where: { userId } }),
      app.prisma.transaction.findMany({ where: { userId } }),
      app.prisma.installmentPlan.findMany({ where: { userId } }),
      app.prisma.recurringBill.findMany({ where: { userId } }),
      app.prisma.bill.findMany({ where: { userId } }),
      app.prisma.debt.findMany({ where: { userId } }),
      app.prisma.debt.findMany({ where: { relatedPerson: { userId } } }),
      app.prisma.person.findMany({ where: { userId } }),
      app.prisma.category.findMany({ where: { userId } }),
      app.prisma.notification.findMany({ where: { userId } }),
      app.prisma.passkey.findMany({ where: { userId } }),
      app.prisma.session.findMany({ where: { userId } }),
      app.prisma.auditLog.findMany({ where: { userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      accounts,
      cards,
      transactions,
      installmentPlans,
      recurringBills,
      bills,
      debts,
      owedDebts,
      people,
      categories,
      notifications,
      passkeys: passkeys.map((pk) => ({ ...pk, publicKey: '[REDACTED]' })),
      sessions,
      auditLogs,
    };
  });
};

export default userRoutes;