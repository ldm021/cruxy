/* eslint-env serviceworker */
/**
 * Service worker unico de Cruxy. Hace dos cosas:
 *
 *  1. Cachea el app shell para que la PWA abra offline (y rapido) una vez
 *     instalada en la pantalla de inicio.
 *  2. Recibe los mensajes push de Firebase Cloud Messaging cuando la app esta
 *     cerrada o en segundo plano.
 *
 * La config de Firebase no puede vivir en un archivo estatico (las variables de
 * Vite no se inyectan en /public), asi que el cliente registra este worker con
 * la config en el query string:
 *
 *     navigator.serviceWorker.register('/sw.js?firebaseConfig=' + encodeURIComponent(JSON.stringify(cfg)))
 *
 * Nada de esto es secreto: la config de Firebase para web es publica por diseño
 * y el acceso real se controla con las reglas de Firestore/Storage.
 */

const VERSION = 'cruxy-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll aborta todo si un solo recurso falla; los pedimos de a uno.
      await Promise.all(
        SHELL_URLS.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Todo lo que sea API (Firestore, Storage, Functions, FCM) va directo a la
  // red: cachear respuestas en tiempo real solo genera datos viejos.
  if (url.origin !== self.location.origin) return;

  // Navegacion: red primero, cache como respaldo offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cached =
            (await caches.match(request)) || (await caches.match('/index.html'));
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Assets con hash en el nombre: cache primero (nunca cambian de contenido).
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(ASSET_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          return Response.error();
        }
      })(),
    );
  }
});

// ---------------------------------------------------------------------------
// Firebase Cloud Messaging (push en segundo plano)
// ---------------------------------------------------------------------------

function readFirebaseConfig() {
  try {
    const raw = new URL(self.location.href).searchParams.get('firebaseConfig');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const firebaseConfig = readFirebaseConfig();

if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    importScripts(
      'https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js',
    );

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      const title = data.title || 'Cruxy';
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'cruxy-word',
        renotify: false,
        data: { crosswordId: data.crosswordId || null },
      });
    });
  } catch (err) {
    // Sin push (por ejemplo, sin red al instalar). El cache sigue funcionando.
    console.warn('[sw] FCM no disponible:', err);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const crosswordId = event.notification.data?.crosswordId;
  const target = crosswordId ? `/?crossword=${crosswordId}` : '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) await client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
