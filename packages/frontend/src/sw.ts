/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// O globPatterns do plugin está vazio, então NADA é pré-carregado/armazenado
// em cache. O precacheAndRoute([...]) apenas garante o ponto de injeção do
// workbox e, sem entradas, não oferece funcionalidade offline.
precacheAndRoute(self.__WB_MANIFEST);

// Rede pura (sem cache/offline). O handler de fetch mantém o app instalável
// como atalho no Chrome, mas sempre acessa a rede (nada de cache offline).
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'OxeDinDin',
    body: 'Nova notificação',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/' },
  };

  let payload = fallback;
  try {
    if (event.data) payload = { ...fallback, ...event.data.json() };
  } catch {
    /* not JSON */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || fallback.title, {
      body: payload.body || fallback.body,
      icon: payload.icon || fallback.icon,
      badge: payload.badge || fallback.badge,
      data: payload.data || fallback.data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && url) await client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});