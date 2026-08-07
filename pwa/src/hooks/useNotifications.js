import { useCallback, useEffect, useRef, useState } from 'react';
import {
  notificationPermission,
  onForegroundMessage,
  registerServiceWorker,
  requestNotificationToken,
} from '../firebase/messaging';
import { saveUserProfile } from '../firebase/firestore';
import { isConfigured } from '../firebase/config';

/**
 * Registra el service worker, gestiona el permiso de notificaciones y guarda
 * el token FCM en `users/{uid}.fcmToken` para que la Cloud Function pueda
 * avisar al resto de la familia.
 *
 * @param {string|null} uid
 * @param {(msg: {title: string, body: string}) => void} [onMessage] toast in-app
 */
export function useNotifications(uid, onMessage) {
  const [permission, setPermission] = useState(() => notificationPermission());
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const registrationRef = useRef(null);
  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;

  // Registrar el service worker apenas arranca: es lo que hace instalable la PWA.
  useEffect(() => {
    if (!isConfigured) return;
    registerServiceWorker()
      .then((reg) => {
        registrationRef.current = reg;
      })
      .catch((err) => console.warn('[sw] no se pudo registrar', err));
  }, []);

  // Mensajes con la app en primer plano: FCM no muestra notificación del
  // sistema, así que los mostramos nosotros como toast.
  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    onForegroundMessage((payload) => {
      const data = payload?.data || {};
      messageHandler.current?.({
        title: data.title || 'Cruxy',
        body: data.body || '',
      });
    }).then((fn) => {
      if (cancelled) fn?.();
      else unsubscribe = fn || (() => {});
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Si ya dio permiso antes, refrescamos el token en cada arranque (los tokens
  // FCM rotan y uno viejo hace que los avisos dejen de llegar en silencio).
  useEffect(() => {
    if (!uid || permission !== 'granted') return;
    let cancelled = false;
    (async () => {
      const reg = registrationRef.current || (await registerServiceWorker());
      registrationRef.current = reg;
      const fresh = await requestNotificationToken(reg);
      if (cancelled || !fresh) return;
      setToken(fresh);
      saveUserProfile(uid, { fcmToken: fresh }).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, permission]);

  const enable = useCallback(async () => {
    if (!uid) return null;
    setBusy(true);
    try {
      const reg = registrationRef.current || (await registerServiceWorker());
      registrationRef.current = reg;
      const fresh = await requestNotificationToken(reg);
      setPermission(notificationPermission());
      if (fresh) {
        setToken(fresh);
        await saveUserProfile(uid, { fcmToken: fresh });
      }
      return fresh;
    } finally {
      setBusy(false);
    }
  }, [uid]);

  return {
    permission,
    token,
    busy,
    enabled: permission === 'granted' && Boolean(token),
    enable,
  };
}
