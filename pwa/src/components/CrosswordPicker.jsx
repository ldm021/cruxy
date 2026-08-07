function formatDate(timestamp) {
  const date = timestamp?.toDate?.() ?? (timestamp ? new Date(timestamp) : null);
  if (!date) return '';
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Lista de crucigramas guardados: se puede volver a cualquiera cuando sea. */
export function CrosswordPicker({ crosswords, currentId, onSelect }) {
  if (!crosswords.length) return null;

  return (
    <section className="picker" aria-label="Crucigramas">
      <h2 className="picker__title">Crucigramas</h2>
      <ul className="picker__list">
        {crosswords.map((cw) => (
          <li key={cw.id}>
            <button
              type="button"
              className={`picker__item ${cw.id === currentId ? 'is-active' : ''}`}
              onClick={() => onSelect(cw.id)}
            >
              <span className="picker__name">{cw.title || 'Sin título'}</span>
              <span className="picker__meta">
                {cw.rows}×{cw.cols}
                {cw.createdBy ? ` · ${cw.createdBy}` : ''}
                {cw.createdAt ? ` · ${formatDate(cw.createdAt)}` : ''}
              </span>
              {cw.status === 'completed' && <span className="picker__done">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
