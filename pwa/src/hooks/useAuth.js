import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, demoMode, isConfigured } from '../firebase/config';
import { getUserProfile, saveUserProfile } from '../firebase/firestore';

const NAME_KEY = 'cruxy:name';
const AVATAR_KEY = 'cruxy:avatar';

/**
 * Auth "de familia": Firebase Anonymous Auth + un nombre y un emoji elegidos
 * a mano. Sin contraseñas, sin mails. El nombre se guarda en `users/{uid}` y
 * en localStorage para que la app abra directo la próxima vez.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(() => ({
    name: localStorage.getItem(NAME_KEY) || '',
    avatar: localStorage.getItem(AVATAR_KEY) || '🙂',
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // En modo demo no hay Firebase: la identidad vive solo en este navegador.
    if (demoMode) {
      let localUid = localStorage.getItem('cruxy:demo:uid');
      if (!localUid) {
        localUid = `demo-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('cruxy:demo:uid', localUid);
      }
      setUser({ uid: localUid });
      setLoading(false);
      return undefined;
    }

    if (!isConfigured) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      if (!current) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          setError(err);
          setLoading(false);
        }
        return;
      }

      setUser(current);
      try {
        const snap = await getUserProfile(current.uid);
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) {
            setProfile({ name: data.name, avatar: data.avatar || '🙂' });
            localStorage.setItem(NAME_KEY, data.name);
            if (data.avatar) localStorage.setItem(AVATAR_KEY, data.avatar);
          }
        }
      } catch (err) {
        // Si falla la lectura seguimos con lo que haya en localStorage.
        console.warn('[auth] no se pudo leer el perfil', err);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const setIdentity = useCallback(
    async (name, avatar) => {
      const clean = name.trim().slice(0, 24);
      if (!clean) return;
      setProfile({ name: clean, avatar });
      localStorage.setItem(NAME_KEY, clean);
      localStorage.setItem(AVATAR_KEY, avatar);
      if (user && !demoMode) await saveUserProfile(user.uid, { name: clean, avatar });
    },
    [user],
  );

  return {
    user,
    uid: user?.uid ?? null,
    name: profile.name,
    avatar: profile.avatar,
    hasIdentity: Boolean(user && profile.name),
    loading,
    error,
    setIdentity,
  };
}
