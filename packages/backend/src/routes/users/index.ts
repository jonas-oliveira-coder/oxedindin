import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { env } from '../../utils/env.js';
import {
  user, bankAccount, creditCard, transaction, installmentPlan,
  recurringBill, bill, debt, person, category, notification,
  passkey, session, auditLog
} from '../../db/schema/index.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function publicAvatarUrl(filename: string): string {
  return `/uploads/${filename}`;
}

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

  app.post('/me/avatar', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });

    const data = await request.file();

    if (!data) throw app.httpErrors.badRequest('Envie um arquivo de imagem.');
    if (!ALLOWED_MIME.has(data.mimetype)) {
      throw app.httpErrors.badRequest('Formato de imagem inválido. Use JPG, PNG ou WebP.');
    }

    const buffer = Buffer.from(await data.toBuffer());

    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw app.httpErrors.badRequest('Imagem inválida.');
      }
      if (metadata.width < 32 || metadata.height < 32) {
        throw app.httpErrors.badRequest('A imagem deve ter pelo menos 32x32 pixels.');
      }
      const ratio = Math.min(metadata.width, metadata.height) / Math.max(metadata.width, metadata.height);
      if (ratio < 0.5) {
        throw app.httpErrors.badRequest('A imagem deve ser próxima de um quadrado (ex.: 1:1).');
      }

      const normalized = await sharp(buffer)
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      const filename = `${request.authUser!.id}-${randomUUID()}.webp`;
      const filePath = join(env.UPLOAD_DIR, filename);
      const url = publicAvatarUrl(filename);

      await fs.writeFile(filePath, normalized);

      const previous = request.authUser!.avatarUrl;
      await app.db.update(user)
        .set({ avatarUrl: url })
        .where(eq(user.id, request.authUser!.id));

      if (previous && previous.startsWith('/uploads/')) {
        const prevName = previous.split('/').pop();
        await fs.rm(join(env.UPLOAD_DIR, prevName!), { force: true }).catch(() => {});
      }

      await app.auditLog({
        userId: request.authUser!.id,
        action: 'USER_AVATAR_UPDATED',
        entityType: 'User',
        entityId: request.authUser!.id,
        newData: { avatarUrl: url },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return { avatarUrl: url };
    } catch (err: any) {
      if (err?.statusCode) throw err;
      throw app.httpErrors.badRequest('Não foi possível processar a imagem.');
    }
  });

  app.delete('/me/avatar', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const previous = request.authUser!.avatarUrl;
    await app.db.update(user)
      .set({ avatarUrl: null })
      .where(eq(user.id, request.authUser!.id));

    if (previous && previous.startsWith('/uploads/')) {
      const prevName = previous.split('/').pop();
      await fs.rm(join(env.UPLOAD_DIR, prevName!), { force: true }).catch(() => {});
    }

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'USER_AVATAR_REMOVED',
      entityType: 'User',
      entityId: request.authUser!.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
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