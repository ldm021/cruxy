import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, firebaseConfig, vapidKey } from './config';

let messagingPromise = null;

/**
 * Registra nuestro service worker único (cache + push) pasándole la config de
 * Firebase por query string; `/public/sw.js` la lee de ahí.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const params = new URLSearchParams({
    firebaseConfig: JSON.stringify(firebaseConfig),
  });
  return navigator.serviceWorker.register(`/sw.js?${params.toString()}`, {
    scope: '/',
  });
}

async function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!app) return null;
      return (await isSupported()) ? getMessaging(app) : null;
    })();
  }
  return messagingPromise;
}

/**
 * Pide permiso de notificaciones y devuelve el token FCM del dispositivo,
 * o `null` si el usuario dijo que no / el navegador no soporta push.
 *
 * En iOS solo funciona con la app ya instalada en la pantalla de inicio
 * (iOS 16.4+); en un Safari normal `isSupported()` devuelve false.
 */
export async function requestNotificationToken(serviceWorkerRegistration) {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  if (!vapidKey) {
    console.warn('[fcm] falta VITE_FIREBASE_VAPID_KEY: no se pueden pedir tokens');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  try {
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  } catch (err) {
    console.warn('[fcm] no se pudo obtener el token', err);
    return null;
  }
}

/** Mensajes que llegan con la app abierta (los mostramos como toast in-app). */
export async function onForegroundMessage(handler) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}

export function notificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
