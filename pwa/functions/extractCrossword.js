import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  extractCrosswordFromImage,
  SUPPORTED_MEDIA_TYPES,
} from './lib/anthropic.js';
import { cellId, normalizeExtraction } from './lib/crossword.js';

const UPLOAD_PREFIX = 'crossword-uploads/';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // el límite de la API es 5 MB en base64 (~6.6 MB binario)

/**
 * Recibe la ruta en Storage de una foto ya subida, se la pasa al modelo de
 * visión de Claude y guarda el crucigrama estructurado en Firestore.
 *
 * Es una función *callable*: el cliente la invoca con el usuario autenticado,
 * y la API key de Anthropic nunca sale del servidor.
 */
export function makeExtractCrossword(anthropicKey) {
  return onCall(
    {
      secrets: [anthropicKey],
      timeoutSeconds: 540,
      memory: '1GiB',
      // Una sola instancia extrayendo por vez alcanza de sobra para una familia
      // y evita sorpresas en la factura si alguien sube fotos en cadena.
      maxInstances: 3,
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Necesitás estar identificado para subir un crucigrama.');
      }

      const { storagePath, title, createdBy } = request.data || {};

      if (typeof storagePath !== 'string' || !storagePath.startsWith(UPLOAD_PREFIX)) {
        throw new HttpsError('invalid-argument', 'La ruta de la imagen no es válida.');
      }
      // Cada quien solo puede procesar sus propias subidas.
      if (!storagePath.startsWith(`${UPLOAD_PREFIX}${request.auth.uid}/`)) {
        throw new HttpsError('permission-denied', 'Esa imagen no es tuya.');
      }

      const db = getFirestore();
      // `bucket()` sin argumentos usa el bucket por defecto del proyecto, que es
      // lo correcto en el 99% de los casos. `CRUXY_STORAGE_BUCKET` está por si
      // tu proyecto usa otro (algunos proyectos viejos siguen en `.appspot.com`).
      const bucketName = process.env.CRUXY_STORAGE_BUCKET || undefined;
      const file = getStorage().bucket(bucketName).file(storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', 'No se encontró la imagen subida.');
      }

      const [metadata] = await file.getMetadata();
      const mediaType = metadata.contentType || 'image/jpeg';
      if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
        throw new HttpsError(
          'invalid-argument',
          `Formato de imagen no soportado (${mediaType}). Usá JPEG, PNG o WebP.`,
        );
      }
      if (Number(metadata.size) > MAX_IMAGE_BYTES) {
        throw new HttpsError('invalid-argument', 'La imagen es demasiado grande.');
      }

      const [imageBuffer] = await file.download();

      let extraction;
      try {
        extraction = await extractCrosswordFromImage(
          imageBuffer,
          mediaType,
          anthropicKey.value(),
        );
      } catch (err) {
        logger.error('Falló la extracción con Claude', {
          storagePath,
          error: err?.message,
        });
        throw new HttpsError(
          'internal',
          `No se pudo leer el crucigrama de la foto: ${err?.message ?? 'error desconocido'}`,
        );
      }

      let normalized;
      try {
        normalized = normalizeExtraction(extraction.data);
      } catch (err) {
        logger.error('La extracción no pasó la validación', {
          storagePath,
          error: err?.message,
        });
        throw new HttpsError('internal', err?.message ?? 'La extracción no es válida.');
      }

      if (normalized.warnings.length) {
        logger.warn('Extracción con advertencias', {
          storagePath,
          warnings: normalized.warnings,
        });
      }

      const crosswordRef = db.collection('crosswords').doc();

      await crosswordRef.set({
        title: (typeof title === 'string' && title.trim()) || defaultTitle(),
        createdBy: (typeof createdBy === 'string' && createdBy.trim()) || 'Alguien',
        createdByUid: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        rows: normalized.rows,
        cols: normalized.cols,
        grid: flattenGrid(normalized.grid), // Firestore no admite arrays anidados
        clues: normalized.clues,
        status: 'active',
        completed: {},
        sourceImage: storagePath,
        extraction: {
          model: extraction.model,
          warnings: normalized.warnings,
          inputTokens: extraction.usage?.input_tokens ?? null,
          outputTokens: extraction.usage?.output_tokens ?? null,
        },
      });

      await createEmptyCells(db, crosswordRef, normalized);

      logger.info('Crucigrama creado', {
        crosswordId: crosswordRef.id,
        size: `${normalized.rows}x${normalized.cols}`,
        across: normalized.clues.across.length,
        down: normalized.clues.down.length,
      });

      return {
        crosswordId: crosswordRef.id,
        rows: normalized.rows,
        cols: normalized.cols,
        warnings: normalized.warnings,
      };
    },
  );
}

function defaultTitle() {
  return `Crucigrama del ${new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  })}`;
}

/**
 * Firestore no soporta arrays dentro de arrays, así que la grilla se guarda
 * como un array de objetos `{ cells: [...] }`, uno por fila.
 */
function flattenGrid(grid) {
  return grid.map((row) => ({ cells: row }));
}

/** Crea en blanco todas las casillas no bloqueadas, en lotes de 400. */
async function createEmptyCells(db, crosswordRef, { rows, cols, grid }) {
  const cellsRef = crosswordRef.collection('cells');
  let batch = db.batch();
  let pending = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col].blocked) continue;
      batch.set(cellsRef.doc(cellId(row, col)), {
        value: '',
        filledBy: '',
        filledByUid: '',
        updatedAt: FieldValue.serverTimestamp(),
      });
      pending += 1;
      if (pending === 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }

  if (pending > 0) await batch.commit();
}
