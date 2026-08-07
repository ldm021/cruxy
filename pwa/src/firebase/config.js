import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
export const functionsRegion =
  import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1';

/**
 * Modo demo: la app carga `/demo-crossword.json` y guarda las letras en el
 * navegador, sin Firebase. Sirve para probar la extracción y el rendering uno
 * mismo antes de conectar a la familia.
 *
 *   VITE_DEMO=1 npm run dev
 */
export const demoMode = import.meta.env.VITE_DEMO === '1';

/** true cuando el `.env` todavia no fue completado. */
export const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app = null;
let auth = null;
let db = null;
let storage = null;
let functions = null;

if (isConfigured && !demoMode) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, functionsRegion);

  if (import.meta.env.VITE_USE_EMULATORS === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
}

export { app, auth, db, storage, functions };
