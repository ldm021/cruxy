import { useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { uploadCrosswordPhoto } from '../firebase/storage';
import { downscaleImage } from '../lib/image';

const STEPS = {
  idle: '',
  resizing: 'Preparando la foto…',
  uploading: 'Subiendo la foto…',
  extracting: 'Claude está leyendo el crucigrama… (puede tardar un minuto)',
};

/**
 * Sacar/elegir foto → Storage → Cloud Function `extractCrossword` → Firestore.
 * El usuario nunca ve una API key: la extracción corre en el servidor.
 */
export function PhotoUpload({ uid, userName, onCreated, onError }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');

  const busy = step !== 'idle';

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !uid) return;

    try {
      setStep('resizing');
      const prepared = await downscaleImage(file);

      setStep('uploading');
      setProgress(0);
      const storagePath = await uploadCrosswordPhoto(prepared, uid, setProgress);

      setStep('extracting');
      const extract = httpsCallable(functions, 'extractCrossword', {
        timeout: 540_000, // la función puede tardar: le damos margen al cliente
      });
      const { data } = await extract({
        storagePath,
        title: title.trim() || null,
        createdBy: userName,
      });

      setTitle('');
      onCreated?.(data.crosswordId, data);
    } catch (err) {
      console.error('[upload]', err);
      onError?.(err);
    } finally {
      setStep('idle');
      setProgress(0);
    }
  }

  return (
    <div className="upload">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFile}
      />

      <label className="upload__title">
        <span>Título (opcional)</span>
        <input
          type="text"
          value={title}
          maxLength={60}
          placeholder="Crucigrama del domingo"
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </label>

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || !uid}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? 'Procesando…' : '📷 Subir foto de un crucigrama'}
      </button>

      {busy && (
        <div className="upload__status" role="status">
          <p>{STEPS[step]}</p>
          {step === 'uploading' && (
            <div className="progress">
              <div className="progress__bar" style={{ width: `${progress}%` }} />
            </div>
          )}
          {step === 'extracting' && <div className="spinner" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
