import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  user, bankAccount, creditCard, transaction, installmentPlan,
  recurringBill, bill, debt, person, category, notification,
  passkey, session, auditLog
} from '../../db/schema/index.js';

const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userData = request.authUser!;
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.avatarUrl,
      emailVerified: userData.emailVerified,
      twoFactorEnabled: userData.twoFactorEnabled,
      settings: userData.settings,
      createdAt: userData.createdAt.toISOString(),
      updatedAt: userData.updatedAt.toISOString(),
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
  }, async (request: any, reply: any) => {
    const [updatedUser] = await app.db.update(user)
      .set(request.body)
      .where(eq(user.id, request.authUser!.id))
      .returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updatedUser.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
      emailVerified: updatedUser.emailVerified,
      twoFactorEnabled: updatedUser.twoFactorEnabled,
      settings: updatedUser.settings,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
  });

  app.delete('/me', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    await app.db.delete(user).where(eq(user.id, request.authUser!.id));

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
  }, async (request: any, reply: any) => {
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
      app.db.select().from(bankAccount).where(eq(bankAccount.userId, userId)),
      app.db.select().from(creditCard).where(eq(creditCard.userId, userId)),
      app.db.select().from(transaction).where(eq(transaction.userId, userId)),
      app.db.select().from(installmentPlan).where(eq(installmentPlan.userId, userId)),
      app.db.select().from(recurringBill).where(eq(recurringBill.userId, userId)),
      app.db.select().from(bill).where(eq(bill.userId, userId)),
      app.db.select().from(debt).where(eq(debt.userId, userId)),
      app.db.select().from(debt).where(eq(debt.creditorId, userId)),
      app.db.select().from(person).where(eq(person.userId, userId)),
      app.db.select().from(category).where(eq(category.userId, userId)),
      app.db.select().from(notification).where(eq(notification.userId, userId)),
      app.db.select().from(passkey).where(eq(passkey.userId, userId)),
      app.db.select().from(session).where(eq(session.userId, userId)),
      app.db.select().from(auditLog).where(eq(auditLog.userId, userId)),
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