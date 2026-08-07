import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { demoMode, isConfigured } from './firebase/config';
import { clearAllCells, setCrosswordStatus } from './firebase/firestore';
import { useAuth } from './hooks/useAuth';
import { useCrosswordList } from './hooks/useCrosswordList';
import { useCrosswordSync } from './hooks/useCrosswordSync';
import { useDemoCrossword } from './hooks/useDemoCrossword';
import { useNotifications } from './hooks/useNotifications';
import { CluesPanel } from './components/CluesPanel';
import { CrosswordGrid } from './components/CrosswordGrid';
import { CrosswordPicker } from './components/CrosswordPicker';
import { NamePrompt } from './components/NamePrompt';
import { PhotoUpload } from './components/PhotoUpload';
import { Toasts, useToasts } from './components/Toasts';
import { UserBadge } from './components/UserBadge';
import {
  ACROSS,
  DOWN,
  cellId,
  entryDescription,
  entryKey,
  entryLabel,
  gridProgress,
  isEntryComplete,
  isGridComplete,
} from './lib/crossword';

/** Quién puso la última letra de una entrada recién completada. */
function whoCompleted(entry, values) {
  let best = null;
  let bestAt = -1;
  for (const c of entry.cells) {
    const cell = values[cellId(c.row, c.col)];
    if (!cell) continue;
    // `updatedAt` null = escritura local todavía sin confirmar, o sea la más nueva.
    const at = cell.updatedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    if (at >= bestAt) {
      bestAt = at;
      best = cell.filledBy || '';
    }
  }
  return best;
}

/**
 * Interruptor de avisos push. En iPhone solo hay push si la app está agregada a
 * la pantalla de inicio (iOS 16.4+), así que lo decimos en vez de dejar un
 * botón que no hace nada.
 */
function NotificationsSetting({ notifications, onToast }) {
  const { permission, enabled, busy, enable } = notifications;

  if (permission === 'unsupported') {
    return (
      <p className="hint">
        Este navegador no soporta avisos. En iPhone hay que agregar la app a la
        pantalla de inicio (Compartir → Agregar a pantalla de inicio).
      </p>
    );
  }

  if (permission === 'denied') {
    return (
      <p className="hint">
        Bloqueaste los avisos para este sitio. Se reactivan desde la
        configuración del navegador.
      </p>
    );
  }

  if (enabled) {
    return <p className="hint">🔔 Avisos activados en este dispositivo.</p>;
  }

  return (
    <button
      type="button"
      className="btn btn--block"
      disabled={busy}
      onClick={async () => {
        const token = await enable();
        onToast(
          token
            ? { tone: 'success', body: 'Listo, te vamos a avisar cuando alguien complete una palabra.' }
            : { tone: 'error', body: 'No se pudieron activar los avisos en este dispositivo.' },
        );
      }}
    >
      {busy ? 'Activando…' : '🔔 Activar avisos de palabras completadas'}
    </button>
  );
}

function SetupNeeded() {
  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <h1 className="onboarding__logo">🧩 Cruxy</h1>
        <h2>Falta conectar Firebase</h2>
        <p className="onboarding__lead">
          Copia <code>pwa/.env.example</code> a <code>pwa/.env</code> y pega las
          credenciales de tu proyecto de Firebase. Están en:
        </p>
        <p className="onboarding__lead">
          <strong>Firebase Console → ⚙ Configuración del proyecto → Tus apps → App web</strong>
        </p>
        <p className="onboarding__lead">
          El paso a paso completo está en <code>pwa/README.md</code>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const { crosswords, active } = useCrosswordList();
  const { toasts, push, dismiss } = useToasts();

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get('crossword') || null,
  );
  const [cursor, setCursor] = useState(null);
  const [direction, setDirection] = useState(ACROSS);
  const gridInputRef = useRef(null);

  // Los dos hooks corren siempre (no se pueden llamar condicionalmente), pero
  // el que no corresponde queda inerte: `useCrosswordSync` sin id y
  // `useDemoCrossword` deshabilitado no hacen ningún pedido.
  const remote = useCrosswordSync(demoMode ? null : selectedId || active?.id || null);
  const demo = useDemoCrossword(demoMode);
  const { crossword, values, entries, cellIndex, writeCell, loading, error } = demoMode
    ? demo
    : remote;
  const crosswordId = crossword?.id ?? (demoMode ? null : selectedId || active?.id || null);

  const notifications = useNotifications(auth.uid, (msg) =>
    push({ ...msg, tone: 'info' }),
  );

  // Mantener la URL en sintonía: así el link de una notificación abre el
  // crucigrama correcto, y compartir la URL funciona.
  useEffect(() => {
    if (!crosswordId || demoMode) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('crossword') !== crosswordId) {
      url.searchParams.set('crossword', crosswordId);
      window.history.replaceState({}, '', url);
    }
  }, [crosswordId]);

  // Al cambiar de crucigrama el cursor viejo ya no significa nada.
  useEffect(() => {
    setCursor(null);
    setDirection(ACROSS);
  }, [crosswordId]);

  const activeEntry = cursor
    ? cellIndex.get(cellId(cursor.row, cursor.col))?.[direction] || null
    : null;

  const progress = useMemo(() => gridProgress(crossword, values), [crossword, values]);

  // --- Aviso local de palabra completada -----------------------------------
  // El push al resto de la familia lo manda la Cloud Function; esto es solo
  // la palmadita en la espalda para quien la completó.
  const completedRef = useRef(null);
  useEffect(() => {
    if (!entries.length) {
      completedRef.current = null;
      return;
    }
    const current = new Set(
      entries
        .filter((e) => isEntryComplete(e, values))
        .map((e) => entryKey(e)),
    );

    if (completedRef.current === null) {
      completedRef.current = current; // primer snapshot: no festejamos nada
      return;
    }

    for (const entry of entries) {
      const key = entryKey(entry);
      if (current.has(key) && !completedRef.current.has(key)) {
        if (whoCompleted(entry, values) === auth.name) {
          push({
            tone: 'success',
            title: '¡Palabra completa!',
            body: `Completaste la ${entryDescription(entry)}`,
          });
        }
      }
    }
    completedRef.current = current;
  }, [entries, values, auth.name, push]);

  // --- Crucigrama terminado -------------------------------------------------
  const finished = useMemo(
    () => Boolean(crossword) && isGridComplete(crossword, values),
    [crossword, values],
  );
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!crossword || !finished || finishedRef.current) {
      if (!finished) finishedRef.current = false;
      return;
    }
    finishedRef.current = true;
    push({ tone: 'success', title: '🎉 ¡Terminado!', body: 'Completaron todo el crucigrama.' });
    if (!demoMode && crossword.status !== 'completed') {
      setCrosswordStatus(crossword.id, 'completed').catch(() => {});
    }
  }, [crossword, finished, push]);

  const handleWrite = useCallback(
    (row, col, value) => writeCell(row, col, value, auth.name, auth.uid),
    [writeCell, auth.name, auth.uid],
  );

  const handleSelectEntry = useCallback((entry) => {
    if (!entry.cells.length) return;
    setDirection(entry.direction);
    setCursor(entry.cells[0]);
    // Enfocamos aquí, dentro del click, y no en un efecto: iOS solo abre el
    // teclado si el foco se pide durante el gesto del usuario.
    gridInputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleClear = useCallback(async () => {
    if (!crossword) return;
    if (!window.confirm('¿Borrar todas las letras de este crucigrama?')) return;
    if (demoMode) {
      demo.clear();
      return;
    }
    await clearAllCells(crossword.id, Object.keys(values));
    if (crossword.status === 'completed') {
      await setCrosswordStatus(crossword.id, 'active').catch(() => {});
    }
  }, [crossword, values, demo]);

  if (!isConfigured && !demoMode) return <SetupNeeded />;

  if (auth.loading) {
    return (
      <div className="onboarding">
        <div className="onboarding__card">
          <div className="spinner" />
          <p className="onboarding__lead">Conectando…</p>
        </div>
      </div>
    );
  }

  if (!auth.hasIdentity || editingIdentity) {
    return (
      <NamePrompt
        initialName={auth.name}
        initialAvatar={auth.avatar}
        onSubmit={async (name, avatar) => {
          await auth.setIdentity(name, avatar);
          setEditingIdentity(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="topbar__menu"
          onClick={() => setShowPicker((v) => !v)}
          aria-expanded={showPicker}
        >
          🧩
        </button>
        <div className="topbar__title">
          <strong>{crossword?.title || 'Cruxy'}</strong>
          {crossword && (
            <span className="topbar__progress">
              {progress.filled}/{progress.total} casillas
            </span>
          )}
        </div>
        <UserBadge
          name={auth.name}
          avatar={auth.avatar}
          onEdit={() => setEditingIdentity(true)}
        />
      </header>

      {showPicker && (
        <div className="drawer">
          {demoMode ? (
            <p className="hint">
              <strong>Modo demo.</strong> Estás viendo{' '}
              <code>public/demo-crossword.json</code> y las letras se guardan solo
              en este navegador. Para probar otra foto:
              <br />
              <code>node scripts/extract-local.mjs foto.jpg</code>
            </p>
          ) : (
            <>
              <PhotoUpload
                uid={auth.uid}
                userName={auth.name}
                onCreated={(id) => {
                  setSelectedId(id);
                  setShowPicker(false);
                  push({ tone: 'success', title: 'Listo', body: 'Crucigrama cargado.' });
                }}
                onError={(err) =>
                  push({
                    tone: 'error',
                    title: 'No se pudo cargar',
                    body: err?.message || 'Prueba con otra foto, más derecha y con buena luz.',
                  })
                }
              />
              <CrosswordPicker
                crosswords={crosswords}
                currentId={crosswordId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setShowPicker(false);
                }}
              />
              <NotificationsSetting notifications={notifications} onToast={push} />
            </>
          )}

          {crossword && (
            <button type="button" className="btn btn--ghost btn--block" onClick={handleClear}>
              Borrar todas las letras
            </button>
          )}
        </div>
      )}

      <main className="main">
        {loading && <div className="spinner spinner--center" />}

        {!loading && !crossword && (
          <div className="empty">
            <p>Todavía no hay ningún crucigrama.</p>
            <p>Toca 🧩 arriba a la izquierda y sube la foto de uno.</p>
          </div>
        )}

        {error && (
          <div className="empty empty--error">
            <p>Hubo un problema leyendo el crucigrama.</p>
            <code>{error.message}</code>
          </div>
        )}

        {crossword && (
          <>
            <CrosswordGrid
              crossword={crossword}
              values={values}
              cellIndex={cellIndex}
              cursor={cursor}
              direction={direction}
              myName={auth.name}
              onCursorChange={setCursor}
              onDirectionChange={setDirection}
              onWrite={handleWrite}
              inputRef={gridInputRef}
            />

            {activeEntry && (
              <div className="current-clue">
                <button
                  type="button"
                  className="current-clue__flip"
                  onClick={() => setDirection(direction === ACROSS ? DOWN : ACROSS)}
                  title="Cambiar entre horizontal y vertical"
                >
                  {direction === ACROSS ? '→' : '↓'}
                </button>
                <span className="current-clue__text">
                  <strong>{entryLabel(activeEntry.number, activeEntry.direction)}</strong>{' '}
                  {activeEntry.text}
                </span>
              </div>
            )}

            <CluesPanel
              entries={entries}
              values={values}
              activeEntry={activeEntry}
              direction={direction}
              onDirectionChange={setDirection}
              onSelectEntry={handleSelectEntry}
            />
          </>
        )}
      </main>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
