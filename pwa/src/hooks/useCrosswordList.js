import { useEffect, useState } from 'react';
import { watchCrosswords } from '../firebase/firestore';
import { isConfigured } from '../firebase/config';

/** Lista de crucigramas en tiempo real (para el selector y el "activo"). */
export function useCrosswordList() {
  const [crosswords, setCrosswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return undefined;
    }
    return watchCrosswords(
      (list) => {
        setCrosswords(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
  }, []);

  const active = crosswords.find((c) => c.status === 'active') || crosswords[0] || null;

  return { crosswords, active, loading, error };
}
