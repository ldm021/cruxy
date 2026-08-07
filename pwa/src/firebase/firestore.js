import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { cellId, hydrateGrid } from '../lib/crossword';

/** Documento de Firestore -> forma que usa la UI (grilla 2D incluida). */
function toCrossword(id, data) {
  return { id, ...data, grid: hydrateGrid(data.grid) };
}

export const crosswordsCol = () => collection(db, 'crosswords');
export const crosswordDoc = (crosswordId) => doc(db, 'crosswords', crosswordId);
export const cellsCol = (crosswordId) =>
  collection(db, 'crosswords', crosswordId, 'cells');
export const userDoc = (uid) => doc(db, 'users', uid);

/** Escucha la lista de crucigramas, del más nuevo al más viejo. */
export function watchCrosswords(callback, onError) {
  const q = query(crosswordsCol(), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/** Escucha un crucigrama concreto (dimensiones, grilla, pistas, estado). */
export function watchCrossword(crosswordId, callback, onError) {
  return onSnapshot(
    crosswordDoc(crosswordId),
    (snap) => callback(snap.exists() ? toCrossword(snap.id, snap.data()) : null),
    onError,
  );
}

/**
 * Escucha todas las casillas de un crucigrama. Es la subscripción que hace que
 * las letras aparezcan en el resto de los teléfonos al instante.
 */
export function watchCells(crosswordId, callback, onError) {
  return onSnapshot(
    cellsCol(crosswordId),
    (snap) => {
      const values = {};
      snap.forEach((d) => {
        values[d.id] = d.data();
      });
      callback(values, snap.metadata.hasPendingWrites);
    },
    onError,
  );
}

/** Escribe (o borra) la letra de una casilla. */
export function setCellValue(crosswordId, row, col, value, userName, uid) {
  return setDoc(
    doc(cellsCol(crosswordId), cellId(row, col)),
    {
      value,
      filledBy: value ? userName : '',
      // El uid es lo que usa la Cloud Function para no mandarte un push a ti
      // mismo cuando completas una palabra.
      filledByUid: value ? uid || '' : '',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Guarda el perfil simple del usuario (nombre, avatar y token de push). */
export function saveUserProfile(uid, data) {
  return setDoc(
    userDoc(uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function getUserProfile(uid) {
  return getDoc(userDoc(uid));
}

export function setCrosswordStatus(crosswordId, status) {
  return updateDoc(crosswordDoc(crosswordId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Borra todas las letras del crucigrama (por si quieren empezar de nuevo). */
export async function clearAllCells(crosswordId, cellIds) {
  const chunks = [];
  for (let i = 0; i < cellIds.length; i += 400) chunks.push(cellIds.slice(i, i + 400));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.set(
        doc(cellsCol(crosswordId), id),
        { value: '', filledBy: '', filledByUid: '', updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();
  }
}
