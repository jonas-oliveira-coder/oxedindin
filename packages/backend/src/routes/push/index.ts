import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { pushSubscription } from '../../db/schema/index.js';
import { vapidConfigured } from '../../services/push.service.js';
import { env } from '../../utils/env.js';

const pushRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/vapid-public-key', {
    preHandler: [app.authenticate],
  }, async () => {
    return { publicKey: env.VAPID_PUBLIC_KEY || null, enabled: vapidConfigured() };
  });

  app.post('/subscribe', {
    schema: {
      body: z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser!.id;
    const { endpoint, keys } = request.body;

    const [existing] = await app.db.select()
      .from(pushSubscription)
      .where(eq(pushSubscription.endpoint, endpoint))
      .limit(1);

    if (existing) {
      if (existing.userId !== userId) {
        throw app.httpErrors.conflict('Esta inscrição pertence a outro usuário.');
      }
      return { success: true };
    }

    await app.db.insert(pushSubscription).values({
      userId,
      endpoint,
      keys: { ...keys },
    });

    return reply.status(201).send({ success: true });
  });

  app.post('/unsubscribe', {
    schema: {
      body: z.object({ endpoint: z.string().url() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser!.id;
    await app.db.delete(pushSubscription)
      .where(and(eq(pushSubscription.endpoint, request.body.endpoint), eq(pushSubscription.userId, userId)));
    return { success: true };
  });
};

export default pushRoutes;