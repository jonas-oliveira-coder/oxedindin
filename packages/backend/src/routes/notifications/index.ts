import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { paginationSchema } from '../../types/schemas.js';

const notificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        read: z.boolean().optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, read } = request.query;
    const userId = request.authUser!.id;

    const where: any = { userId };
    if (read !== undefined) where.read = read;

    const [notifications, total] = await Promise.all([
      app.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.patch('/:id/read', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const notification = await app.prisma.notification.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
    });

    if (!notification) throw app.httpErrors.notFound('Notification not found');

    await app.prisma.notification.update({
      where: { id: request.params.id },
      data: { read: true },
    });

    return { success: true };
  });

  app.patch('/read-all', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.notification.updateMany({
      where: { userId: request.authUser!.id, read: false },
      data: { read: true },
    });

    return { success: true };
  });

  app.get('/preferences', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    let prefs = await app.prisma.notificationPreferences.findUnique({
      where: { userId: request.authUser!.id },
    });

    if (!prefs) {
      prefs = await app.prisma.notificationPreferences.create({
        data: { userId: request.authUser!.id },
      });
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
  }, async (request, reply) => {
    const prefs = await app.prisma.notificationPreferences.upsert({
      where: { userId: request.authUser!.id },
      create: { userId: request.authUser!.id, ...request.body },
      update: request.body,
    });

    return prefs;
  });
};

export default notificationsRoutes;