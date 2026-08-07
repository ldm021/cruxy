import { memo } from 'react';

/** Color estable por persona, para ver de un vistazo quién escribió qué. */
function authorHue(name) {
  if (!name) return null;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

function GridCellBase({
  row,
  col,
  cell,
  value,
  filledBy,
  isSelected,
  isInEntry,
  isMine,
  onSelect,
}) {
  if (cell?.blocked) {
    return <div className="cell cell--blocked" aria-hidden="true" />;
  }

  const hue = authorHue(filledBy);
  const classes = ['cell'];
  if (isSelected) classes.push('cell--selected');
  else if (isInEntry) classes.push('cell--in-entry');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onPointerDown={(event) => {
        // Evita que el teclado virtual se cierre y se reabra en cada toque.
        event.preventDefault();
        onSelect(row, col);
      }}
      aria-label={`Fila ${row + 1}, columna ${col + 1}${value ? `, letra ${value}` : ', vacía'}`}
    >
      {cell?.number != null && <span className="cell__number">{cell.number}</span>}
      <span className="cell__value">{value || ''}</span>
      {value && !isMine && hue != null && (
        <span
          className="cell__author"
          style={{ background: `hsl(${hue} 70% 55%)` }}
          title={`Escrita por ${filledBy}`}
        />
      )}
    </button>
  );
}

export const GridCell = memo(GridCellBase);
