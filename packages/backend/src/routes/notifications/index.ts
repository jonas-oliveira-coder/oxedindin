import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { paginationSchema } from '../../types/schemas.js';
import { notification, notificationPreferences } from '../../db/schema/index.js';

const notificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        read: z.boolean().optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, read } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(notification.userId, userId)];
    if (read !== undefined) conditions.push(eq(notification.read, read));

    const [notificationsData, totalResult] = await Promise.all([
      app.db.select().from(notification)
        .where(and(...conditions))
        .orderBy(desc(notification.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(notification).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: notificationsData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.patch('/:id/read', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [notificationRecord] = await app.db.select()
      .from(notification)
      .where(and(eq(notification.id, request.params.id), eq(notification.userId, request.authUser!.id)))
      .limit(1);

    if (!notificationRecord) throw app.httpErrors.notFound('Notification not found');

    await app.db.update(notification)
      .set({ read: true })
      .where(eq(notification.id, request.params.id));

    return { success: true };
  });

  app.patch('/read-all', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    await app.db.update(notification)
      .set({ read: true })
      .where(and(eq(notification.userId, request.authUser!.id), eq(notification.read, false)));

    return { success: true };
  });

  app.get('/preferences', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    let [prefs] = await app.db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, request.authUser!.id))
      .limit(1);

    if (!prefs) {
      [prefs] = await app.db.insert(notificationPreferences).values({
        userId: request.authUser!.id,
      }).returning();
    }

    return prefs;
  });

  app.patch('/preferences', {
    schema: {
      body: z.object({
        invoiceDueSoon: z.boolean().optional(),
        invoiceOverdue: z.boolean().optional(),
        billDueSoon: z.boolean().optional(),
        billOverdue: z.boolean().optional(),
        installmentDueSoon: z.boolean().optional(),
        debtDueSoon: z.boolean().optional(),
        sharedDebtAdded: z.boolean().optional(),
        sharedDebtUpdated: z.boolean().optional(),
        paymentReceived: z.boolean().optional(),
        securityAlert: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, request.authUser!.id))
      .limit(1);

    let prefs;
    if (existing) {
      [prefs] = await app.db.update(notificationPreferences)
        .set(request.body)
        .where(eq(notificationPreferences.userId, request.authUser!.id))
        .returning();
    } else {
      [prefs] = await app.db.insert(notificationPreferences).values({
        userId: request.authUser!.id,
        ...request.body,
      }).returning();
    }

    return prefs;
  });
};

export default notificationsRoutes;