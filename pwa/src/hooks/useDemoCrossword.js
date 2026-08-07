import { useCallback, useEffect, useMemo, useState } from 'react';
import { allEntries, buildCellIndex, cellId, hydrateGrid, normalizeLetter } from '../lib/crossword';

const STORAGE_PREFIX = 'cruxy:demo:';

/**
 * Reemplazo local de `useCrosswordSync` para el modo demo.
 *
 * Carga el crucigrama de `/demo-crossword.json` (lo que escribe
 * `scripts/extract-local.mjs`) y guarda las letras en localStorage. Misma forma
 * de retorno que el hook real, así que `App` no necesita saber cuál está usando.
 */
export function useDemoCrossword(enabled) {
  const [crossword, setCrossword] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/demo-crossword.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(
            'No se encontró public/demo-crossword.json. Generalo con: ' +
              'ANTHROPIC_API_KEY=... node scripts/extract-local.mjs foto.jpg',
          );
        }
        const data = await response.json();
        if (cancelled) return;

        const id = data.id || 'demo';
        setCrossword({ ...data, id, grid: hydrateGrid(data.grid) });

        const saved = localStorage.getItem(STORAGE_PREFIX + id);
        setValues(saved ? JSON.parse(saved) : {});
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const entries = useMemo(() => allEntries(crossword), [crossword]);
  const cellIndex = useMemo(() => buildCellIndex(crossword), [crossword]);

  const writeCell = useCallback(
    (row, col, rawValue, userName) => {
      if (!crossword) return;
      const value = rawValue === '' ? '' : normalizeLetter(rawValue);
      setValues((current) => {
        const next = {
          ...current,
          [cellId(row, col)]: {
            value,
            filledBy: value ? userName : '',
            // El hook real trae un Timestamp de Firestore; acá alcanza con algo
            // que responda a `toMillis()` para que App detecte quién completó.
            updatedAt: { toMillis: () => Date.now() },
          },
        };
        localStorage.setItem(
          STORAGE_PREFIX + crossword.id,
          JSON.stringify(next, (key, val) => (key === 'updatedAt' ? undefined : val)),
        );
        return next;
      });
    },
    [crossword],
  );

  const clear = useCallback(() => {
    if (!crossword) return;
    localStorage.removeItem(STORAGE_PREFIX + crossword.id);
    setValues({});
  }, [crossword]);

  return { crossword, values, entries, cellIndex, writeCell, clear, loading, error };
}
