import { useCallback, useEffect, useRef, useState } from 'react';

let nextId = 1;

/** Cola simple de avisos in-app (palabra completa, errores, etc.). */
export function useToasts(ttl = 5000) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, ...toast }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ttl),
      );
      return id;
    },
    [dismiss, ttl],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast toast--${toast.tone || 'info'}`}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.title && <strong>{toast.title}</strong>}
          <span>{toast.body}</span>
        </button>
      ))}
    </div>
  );
}
