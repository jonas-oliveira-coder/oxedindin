import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { notification, notificationPreferences } from '../db/schema/index.js';
import { sendPush } from '../services/push.service.js';

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  url?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    notify: (input: NotifyInput) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorate('notify', async ({ userId, type, title, message, relatedEntityType, relatedEntityId, url }: NotifyInput) => {
    const [prefs] = await app.db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    const pushEnabled = prefs?.pushEnabled ?? false;
    const inAppEnabled = prefs?.inAppEnabled ?? true;

    if (inAppEnabled) {
      await app.db.insert(notification).values({
        userId,
        type: type as any,
        title,
        message,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
        channels: ['IN_APP'],
      });
    }

    if (pushEnabled) {
      await sendPush(app, userId, {
        title,
        message,
        type,
        url: url || (relatedEntityId ? `/debts` : undefined),
      });
    }

    app.broadcast(userId, {
      type: 'notification',
      data: {
        type,
        relatedEntityType,
        relatedEntityId,
        title,
        message,
      },
    });
  });
});