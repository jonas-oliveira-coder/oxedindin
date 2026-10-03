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
  if (!browserSupportsPush()) {
    throw new Error('Seu navegador ou dispositivo não possui suporte a notificações push.');
  }

  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    throw new Error('Notificações push requerem uma conexão segura HTTPS.');
  }

  let publicKey: string | null = null;
  try {
    publicKey = await getVapidPublicKey();
  } catch {
    throw new Error('Não foi possível conectar ao serviço de notificações do servidor.');
  }

  if (!publicKey) {
    throw new Error('O servidor não possui as chaves VAPID configuradas (VAPID_PUBLIC_KEY). Configure as chaves no servidor para habilitar notificações push.');
  }

  if (Notification.permission === 'denied') {
    throw new Error('Permissão de notificações bloqueada no navegador. Permita notificações nas configurações do site (ícone de cadeado na barra de endereços).');
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      throw new Error('Permissão de notificações foi recusada no navegador.');
    }
    if (permission !== 'granted') {
      throw new Error('Permissão de notificações não foi autorizada.');
    }
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker não está disponível no navegador.');
  }

  const reg = await navigator.serviceWorker.ready;
  if (!reg.pushManager) {
    throw new Error('PushManager não está ativo no Service Worker.');
  }

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }

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