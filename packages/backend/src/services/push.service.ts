import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { pushSubscription } from '../db/schema/index.js';
import { env } from '../utils/env.js';

let configured = false;

function configure(): boolean {
  if (configured) return true;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
    return true;
  }
  return false;
}

export function vapidConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export async function sendPush(app: any, userId: string, payload: {
  title: string;
  message: string;
  type?: string;
  url?: string;
}): Promise<void> {
  if (!configure()) return;

  try {
    const subscriptions = await app.db.select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId));

    const body = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url, type: payload.type },
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys as any,
        }, body);
      } catch (err: any) {
        app.log.warn({ err, endpoint: sub.endpoint }, 'Push send failed');
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await app.db.delete(pushSubscription).where(eq(pushSubscription.endpoint, sub.endpoint)).catch(() => {});
        }
      }
    }
  } catch (err) {
    app.log.error({ err }, 'sendPush failed');
  }
}