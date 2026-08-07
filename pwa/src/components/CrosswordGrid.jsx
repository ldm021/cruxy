import { useCallback, useEffect, useRef } from 'react';
import { GridCell } from './GridCell';
import {
  ACROSS,
  DOWN,
  cellId,
  isOpenCell,
  nextOpenCell,
  normalizeLetter,
} from '../lib/crossword';

/**
 * Grilla interactiva. En móvil no usamos un input por casilla (el teclado
 * parpadearía al saltar de una a otra): hay un único input invisible que
 * mantiene el foco y capta las teclas.
 */
export function CrosswordGrid({
  crossword,
  values,
  cellIndex,
  cursor,
  direction,
  myName,
  onCursorChange,
  onDirectionChange,
  onWrite,
  // Ref al input oculto. El padre lo usa para abrir el teclado cuando el
  // usuario elige una pista desde el panel en vez de tocar la grilla.
  inputRef: externalInputRef,
}) {
  const localInputRef = useRef(null);
  const inputRef = externalInputRef || localInputRef;

  const activeEntry = cursor
    ? cellIndex.get(cellId(cursor.row, cursor.col))?.[direction]
    : null;

  const inEntry = useCallback(
    (row, col) =>
      Boolean(activeEntry?.cells.some((c) => c.row === row && c.col === col)),
    [activeEntry],
  );

  const focusInput = useCallback(() => {
    // El foco tiene que pedirse dentro del gesto del usuario o iOS lo ignora.
    inputRef.current?.focus({ preventScroll: true });
  }, [inputRef]);

  const selectCell = useCallback(
    (row, col) => {
      const slot = cellIndex.get(cellId(row, col));
      if (cursor && cursor.row === row && cursor.col === col) {
        // Tocar la casilla ya seleccionada alterna horizontal / vertical.
        const other = direction === ACROSS ? DOWN : ACROSS;
        if (slot?.[other]) onDirectionChange(other);
      } else {
        onCursorChange({ row, col });
        if (slot && !slot[direction]) {
          onDirectionChange(direction === ACROSS ? DOWN : ACROSS);
        }
      }
      focusInput();
    },
    [cellIndex, cursor, direction, focusInput, onCursorChange, onDirectionChange],
  );

  /** Movimiento libre por la grilla (flechas): salta casillas bloqueadas. */
  const moveCursor = useCallback(
    (dir, step) => {
      if (!cursor) return;
      const next = nextOpenCell(crossword, cursor.row, cursor.col, dir, step);
      if (next) onCursorChange(next);
    },
    [crossword, cursor, onCursorChange],
  );

  /**
   * Movimiento al escribir/borrar: se queda dentro de la palabra actual. Si no,
   * al terminar una palabra el cursor saltaría por encima de una casilla negra
   * y seguiría escribiendo en otra palabra distinta.
   */
  const stepWithinEntry = useCallback(
    (step) => {
      if (!cursor) return null;
      if (!activeEntry) {
        const next = nextOpenCell(crossword, cursor.row, cursor.col, direction, step);
        if (next) onCursorChange(next);
        return next;
      }
      const index = activeEntry.cells.findIndex(
        (c) => c.row === cursor.row && c.col === cursor.col,
      );
      const target = activeEntry.cells[index + step];
      if (target) onCursorChange(target);
      return target ?? null;
    },
    [activeEntry, crossword, cursor, direction, onCursorChange],
  );

  const typeLetter = useCallback(
    (raw) => {
      if (!cursor) return;
      const letter = normalizeLetter(raw);
      if (!letter) return;
      onWrite(cursor.row, cursor.col, letter);
      stepWithinEntry(1);
    },
    [cursor, onWrite, stepWithinEntry],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (!cursor) return;
      switch (event.key) {
        case 'Backspace': {
          event.preventDefault();
          const current = values[cellId(cursor.row, cursor.col)]?.value;
          if (current) {
            onWrite(cursor.row, cursor.col, '');
          } else {
            const prev = stepWithinEntry(-1);
            if (prev) onWrite(prev.row, prev.col, '');
          }
          break;
        }
        case 'ArrowLeft':
          event.preventDefault();
          if (direction !== ACROSS) onDirectionChange(ACROSS);
          else moveCursor(ACROSS, -1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (direction !== ACROSS) onDirectionChange(ACROSS);
          else moveCursor(ACROSS, 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (direction !== DOWN) onDirectionChange(DOWN);
          else moveCursor(DOWN, -1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (direction !== DOWN) onDirectionChange(DOWN);
          else moveCursor(DOWN, 1);
          break;
        case ' ':
        case 'Tab':
          event.preventDefault();
          onDirectionChange(direction === ACROSS ? DOWN : ACROSS);
          break;
        default:
          // Los caracteres normales llegan por `onInput`, que también cubre
          // los teclados virtuales que no emiten `keydown` con la tecla real.
          break;
      }
    },
    [cursor, direction, moveCursor, onDirectionChange, onWrite, stepWithinEntry, values],
  );

  const handleInput = useCallback(
    (event) => {
      const raw = event.target.value;
      event.target.value = '';
      typeLetter(raw);
    },
    [typeLetter],
  );

  // Al cambiar de crucigrama, arrancamos en la primera casilla utilizable.
  useEffect(() => {
    if (!crossword || cursor) return;
    for (let row = 0; row < crossword.rows; row++) {
      for (let col = 0; col < crossword.cols; col++) {
        if (isOpenCell(crossword, row, col)) {
          onCursorChange({ row, col });
          return;
        }
      }
    }
  }, [crossword, cursor, onCursorChange]);

  if (!crossword) return null;

  return (
    <div className="grid-wrapper">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${crossword.cols}, 1fr)` }}
        role="grid"
        aria-label={crossword.title || 'Crucigrama'}
      >
        {crossword.grid.map((rowCells, row) =>
          rowCells.map((cell, col) => {
            const key = cellId(row, col);
            const entry = values[key];
            return (
              <GridCell
                key={key}
                row={row}
                col={col}
                cell={cell}
                value={entry?.value || ''}
                filledBy={entry?.filledBy || ''}
                isMine={entry?.filledBy === myName}
                isSelected={cursor?.row === row && cursor?.col === col}
                isInEntry={inEntry(row, col)}
                onSelect={selectCell}
              />
            );
          }),
        )}
      </div>

      {/* Captura de teclado: invisible pero enfocable. Nada de display:none,
          que impediría el foco y, por lo tanto, el teclado virtual. */}
      <input
        ref={inputRef}
        className="grid__hidden-input"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck="false"
        aria-hidden="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
    </div>
  );
}
