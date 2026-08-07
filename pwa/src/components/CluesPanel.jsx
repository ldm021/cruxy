import { ACROSS, DOWN, entryKey, isEntryComplete } from '../lib/crossword';

const TABS = [
  { id: ACROSS, label: 'Horizontales' },
  { id: DOWN, label: 'Verticales' },
];

/**
 * Panel de pistas sincronizado con la grilla: resalta la pista activa y marca
 * las que ya están completas.
 */
export function CluesPanel({
  entries,
  values,
  activeEntry,
  direction,
  onDirectionChange,
  onSelectEntry,
}) {
  const visible = entries.filter((e) => e.direction === direction);

  return (
    <section className="clues" aria-label="Pistas">
      <div className="clues__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={direction === tab.id}
            className={`clues__tab ${direction === tab.id ? 'is-active' : ''}`}
            onClick={() => onDirectionChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ol className="clues__list">
        {visible.length === 0 && (
          <li className="clues__empty">Este crucigrama no tiene pistas en esta dirección.</li>
        )}
        {visible.map((entry) => {
          const key = entryKey(entry);
          // Por posición, no por número: varias palabras pueden compartirlo.
          const isActive = activeEntry ? entryKey(activeEntry) === key : false;
          const done = isEntryComplete(entry, values);

          return (
            <li key={key}>
              <button
                type="button"
                className={`clue ${isActive ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                onClick={() => onSelectEntry(entry)}
              >
                <span className="clue__number">{entry.number}</span>
                <span className="clue__text">{entry.text}</span>
                {entry.cells.length > 0 && (
                  <span className="clue__length">{entry.cells.length}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
