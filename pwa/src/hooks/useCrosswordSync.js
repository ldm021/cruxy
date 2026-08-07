import { useCallback, useEffect, useMemo, useState } from 'react';
import { setCellValue, watchCells, watchCrossword } from '../firebase/firestore';
import { allEntries, buildCellIndex, normalizeLetter } from '../lib/crossword';

/**
 * Mantiene sincronizado un crucigrama y sus casillas vía `onSnapshot`.
 *
 * Firestore ya aplica las escrituras locales de forma optimista (latency
 * compensation), así que escribir una letra se ve al instante en el teléfono
 * propio y llega al resto en cuanto el servidor confirma.
 */
export function useCrosswordSync(crosswordId) {
  const [crossword, setCrossword] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(Boolean(crosswordId));
  const [error, setError] = useState(null);

  useEffect(() => {
    setCrossword(null);
    setValues({});
    setError(null);
    if (!crosswordId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let gotCrossword = false;
    let gotCells = false;
    const settle = () => {
      if (gotCrossword && gotCells) setLoading(false);
    };

    const unsubCrossword = watchCrossword(
      crosswordId,
      (data) => {
        setCrossword(data);
        gotCrossword = true;
        settle();
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    const unsubCells = watchCells(
      crosswordId,
      (next) => {
        setValues(next);
        gotCells = true;
        settle();
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubCrossword();
      unsubCells();
    };
  }, [crosswordId]);

  const entries = useMemo(() => allEntries(crossword), [crossword]);
  const cellIndex = useMemo(() => buildCellIndex(crossword), [crossword]);

  const writeCell = useCallback(
    async (row, col, rawValue, userName, uid) => {
      if (!crosswordId) return;
      const value = rawValue === '' ? '' : normalizeLetter(rawValue);
      try {
        await setCellValue(crosswordId, row, col, value, userName, uid);
      } catch (err) {
        setError(err);
      }
    },
    [crosswordId],
  );

  return { crossword, values, entries, cellIndex, writeCell, loading, error };
}
