import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import {
  allEntries,
  cellId,
  entryDescription,
  entryKey,
  hydrateGrid,
} from './lib/crossword.js';

/**
 * Se dispara cada vez que alguien escribe una letra. Si esa letra completó una
 * palabra, avisa por push al resto de la familia.
 *
 * El registro de palabras ya anunciadas vive en `crosswords/{id}.completed` y se
 * actualiza dentro de una transacción: sin eso, dos personas escribiendo la
 * última letra casi a la vez generarían dos avisos para la misma palabra.
 */
export const checkWordCompletion = onDocumentWritten(
  {
    document: 'crosswords/{crosswordId}/cells/{cellId}',
    maxInstances: 10,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Solo nos interesa el momento en que una casilla pasa de vacía a con letra.
    if (!after?.value || before?.value === after.value) return;

    const { crosswordId } = event.params;
    const db = getFirestore();
    const crosswordRef = db.collection('crosswords').doc(crosswordId);

    const snap = await crosswordRef.get();
    if (!snap.exists) return;

    const crossword = { id: snap.id, ...snap.data() };
    crossword.grid = hydrateGrid(crossword.grid);

    const [row, col] = event.params.cellId.split('_').map(Number);

    // Solo las entradas que pasan por la casilla recién escrita pueden haberse
    // completado con esta escritura.
    const candidates = allEntries(crossword).filter((entry) =>
      entry.cells.some((c) => c.row === row && c.col === col),
    );
    if (!candidates.length) return;

    // Leemos solo las casillas de las palabras candidatas, no la subcolección
    // entera: esto corre en cada letra que escribe cualquiera, y un crucigrama
    // de 15x15 son 225 documentos contra las ~30 que hacen falta.
    const cellsRef = crosswordRef.collection('cells');
    const neededIds = [
      ...new Set(candidates.flatMap((entry) => entry.cells.map((c) => cellId(c.row, c.col)))),
    ];
    const cellDocs = await db.getAll(...neededIds.map((id) => cellsRef.doc(id)));

    const values = {};
    cellDocs.forEach((doc) => {
      if (doc.exists) values[doc.id] = doc.data();
    });

    const finished = candidates.filter((entry) =>
      entry.cells.every((c) => Boolean(values[cellId(c.row, c.col)]?.value)),
    );
    if (!finished.length) return;

    const author = after.filledBy || 'Alguien';
    const authorUid = after.filledByUid || '';

    // Nos quedamos solo con las que nadie anunció todavía.
    const toAnnounce = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(crosswordRef);
      const already = fresh.data()?.completed || {};
      const nuevas = finished.filter((entry) => !already[entryKey(entry)]);
      if (!nuevas.length) return [];

      const update = {};
      for (const entry of nuevas) {
        update[`completed.${entryKey(entry)}`] = {
          by: author,
          byUid: authorUid,
          at: FieldValue.serverTimestamp(),
        };
      }
      tx.update(crosswordRef, update);
      return nuevas;
    });

    if (!toAnnounce.length) return;

    for (const entry of toAnnounce) {
      await notifyOthers({
        db,
        crosswordId,
        excludeUid: authorUid,
        title: '🧩 Cruxy',
        body: `${author} completó la ${entryDescription(entry)}`,
        tag: `${crosswordId}:${entryKey(entry)}`,
      });
    }
  },
);

/**
 * Manda un push a todos los usuarios con token guardado, menos al que escribió.
 * De paso limpia los tokens que FCM reporta como muertos.
 */
async function notifyOthers({ db, crosswordId, excludeUid, title, body, tag }) {
  const usersSnap = await db.collection('users').get();

  const targets = [];
  usersSnap.forEach((doc) => {
    if (doc.id === excludeUid) return;
    const token = doc.data()?.fcmToken;
    if (token) targets.push({ uid: doc.id, token });
  });

  if (!targets.length) return;

  // Mensaje solo-datos: la notificación la dibuja nuestro service worker, así
  // no aparece duplicada con la que mostraría FCM por su cuenta.
  const response = await getMessaging().sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    data: { title, body, tag, crosswordId },
    webpush: {
      headers: { Urgency: 'high', TTL: '3600' },
      fcmOptions: { link: `/?crossword=${crosswordId}` },
    },
  });

  const dead = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      dead.push(targets[index].uid);
    } else {
      logger.warn('Push fallido', { uid: targets[index].uid, code });
    }
  });

  await Promise.all(
    dead.map((uid) =>
      db.collection('users').doc(uid).update({ fcmToken: FieldValue.delete() }),
    ),
  );

  logger.info('Push enviado', {
    crosswordId,
    ok: response.successCount,
    fail: response.failureCount,
  });
}
