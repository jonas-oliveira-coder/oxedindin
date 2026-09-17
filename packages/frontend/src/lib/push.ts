import { api } from '@/lib/api';

export async function getVapidPublicKey(): Promise<string | null> {
  const res = await api.get('/push/vapid-public-key');
  return res.data?.publicKey ?? null;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return browserSupportsPush();
}

export function browserSupportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function subscribeToPush(): Promise<boolean> {
  if (!(await isPushSupported())) return false;

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return false;

  if (Notification.permission === 'denied') return false;
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await api.post('/push/subscribe', {
      endpoint: existing.endpoint,
      keys: existing.toJSON() as any,
    });
    return true;
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
  });

  await api.post('/push/subscribe', {
    endpoint: subscription.endpoint,
    keys: subscription.toJSON() as any,
  });

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}

export async function pushEnabled(): Promise<boolean> {
  if (!(await isPushSupported())) return false;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  return subscription != null && Notification.permission === 'granted';
}