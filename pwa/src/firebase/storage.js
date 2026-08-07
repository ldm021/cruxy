import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './config';

/**
 * Sube la foto del crucigrama a Storage y devuelve la ruta interna
 * (`crossword-uploads/...`). La Cloud Function lee el archivo desde ahí con el
 * SDK admin, así que no hace falta URL pública ni token de descarga.
 *
 * @param {File} file
 * @param {string} uid
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>} storagePath
 */
export function uploadCrosswordPhoto(file, uid, onProgress) {
  const extension = (file.name?.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
  const path = `crossword-uploads/${uid}/${Date.now()}.${extension}`;
  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type || 'image/jpeg',
  });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      () => resolve(path),
    );
  });
}
