/**
 * Utilidades puras sobre la estructura de un crucigrama.
 * No dependen de Firebase: se pueden testear sueltas.
 */

export const ACROSS = 'across';
export const DOWN = 'down';

/** Id del documento de una casilla dentro de `crosswords/{id}/cells`. */
export function cellId(row, col) {
  return `${row}_${col}`;
}

/**
 * Clave estable y única de una palabra.
 *
 * Se basa en la casilla donde empieza, no en su número: en los crucigramas
 * españoles de revista el número es la fila o la columna entera, así que la
 * "5 horizontal" puede contener tres palabras distintas separadas por casillas
 * negras. Usar el número como clave las mezclaría.
 */
export function entryKey(entry) {
  return `${entry.direction}_${entry.cells?.[0]?.row ?? entry.row}_${entry.cells?.[0]?.col ?? entry.col}`;
}

/**
 * Firestore no admite arrays dentro de arrays, así que la grilla se guarda como
 * `[{ cells: [...] }, ...]`. Esto la devuelve a la forma 2D `grid[row][col]`.
 */
export function hydrateGrid(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.map((row) => (Array.isArray(row) ? row : row?.cells || []));
}

/** Normaliza lo que escribe el usuario: una sola letra mayuscula, sin acentos sueltos. */
export function normalizeLetter(input) {
  if (!input) return '';
  const chars = [...String(input).toUpperCase()];
  const last = chars[chars.length - 1] ?? '';
  return /^[A-ZÑÁÉÍÓÚÜ0-9]$/.test(last) ? last : '';
}

/** Devuelve `true` si la casilla existe y no está bloqueada. */
export function isOpenCell(crossword, row, col) {
  if (!crossword) return false;
  if (row < 0 || col < 0 || row >= crossword.rows || col >= crossword.cols) return false;
  return !crossword.grid?.[row]?.[col]?.blocked;
}

/**
 * Coordenadas que ocupa una entrada. Si la pista no trae `length` (Claude no
 * pudo deducirla), avanza hasta chocar con una casilla bloqueada o el borde.
 */
export function entryCells(crossword, clue, direction) {
  const cells = [];
  if (!crossword || !clue) return cells;

  const dr = direction === DOWN ? 1 : 0;
  const dc = direction === ACROSS ? 1 : 0;
  const max = direction === DOWN ? crossword.rows : crossword.cols;
  const limit = Number.isInteger(clue.length) && clue.length > 0 ? clue.length : max;

  let { row, col } = clue;
  for (let i = 0; i < limit; i++) {
    if (!isOpenCell(crossword, row, col)) break;
    cells.push({ row, col });
    row += dr;
    col += dc;
  }
  return cells;
}

/** Lista plana de entradas: `{ number, direction, text, cells }`. */
export function allEntries(crossword) {
  if (!crossword?.clues) return [];
  const out = [];
  for (const direction of [ACROSS, DOWN]) {
    for (const clue of crossword.clues[direction] || []) {
      out.push({
        number: clue.number,
        direction,
        text: clue.text || '',
        cells: entryCells(crossword, clue, direction),
      });
    }
  }
  return out;
}

/**
 * Índice `"row_col" -> { across?: entry, down?: entry }`, para saber a qué
 * palabra pertenece cada casilla al mover el cursor.
 */
export function buildCellIndex(crossword) {
  const index = new Map();
  for (const entry of allEntries(crossword)) {
    for (const { row, col } of entry.cells) {
      const key = cellId(row, col);
      const slot = index.get(key) || {};
      slot[entry.direction] = entry;
      index.set(key, slot);
    }
  }
  return index;
}

/** `true` si todas las casillas de la entrada tienen letra. */
export function isEntryComplete(entry, values) {
  if (!entry?.cells?.length) return false;
  return entry.cells.every((c) => {
    const value = values[cellId(c.row, c.col)]?.value;
    return typeof value === 'string' && value.trim() !== '';
  });
}

/** Palabra formada actualmente por una entrada (con espacios donde falta). */
export function entryWord(entry, values) {
  return entry.cells
    .map((c) => values[cellId(c.row, c.col)]?.value || ' ')
    .join('');
}

/** `true` si todas las casillas abiertas del crucigrama tienen letra. */
export function isGridComplete(crossword, values) {
  if (!crossword) return false;
  for (let row = 0; row < crossword.rows; row++) {
    for (let col = 0; col < crossword.cols; col++) {
      if (!isOpenCell(crossword, row, col)) continue;
      const value = values[cellId(row, col)]?.value;
      if (!value || !value.trim()) return false;
    }
  }
  return true;
}

/** Cantidad de casillas abiertas y cuántas están completas. */
export function gridProgress(crossword, values) {
  let total = 0;
  let filled = 0;
  if (!crossword) return { total, filled };
  for (let row = 0; row < crossword.rows; row++) {
    for (let col = 0; col < crossword.cols; col++) {
      if (!isOpenCell(crossword, row, col)) continue;
      total += 1;
      if (values[cellId(row, col)]?.value) filled += 1;
    }
  }
  return { total, filled };
}

/**
 * Siguiente casilla abierta en una dirección, saltando bloqueadas.
 * Devuelve `null` si se sale de la grilla.
 */
export function nextOpenCell(crossword, row, col, direction, step = 1) {
  const dr = direction === DOWN ? step : 0;
  const dc = direction === ACROSS ? step : 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && c >= 0 && r < crossword.rows && c < crossword.cols) {
    if (isOpenCell(crossword, r, c)) return { row: r, col: c };
    r += dr;
    c += dc;
  }
  return null;
}

const DIRECTION_LABEL = { [ACROSS]: 'horizontal', [DOWN]: 'vertical' };

/** "5 horizontal" / "12 vertical" */
export function entryLabel(number, direction) {
  return `${number} ${DIRECTION_LABEL[direction] || direction}`;
}

/**
 * Nombre legible de una palabra para avisos y toasts. Cuando un mismo número
 * agrupa varias palabras (numeración española), el número solo no alcanza para
 * saber cuál se completó, así que sumamos el texto de la pista.
 */
export function entryDescription(entry) {
  const label = entryLabel(entry.number, entry.direction);
  // Las pistas impresas suelen venir con punto final; sacarlo evita el
  // «...Pampa.».» que quedaría al meterlas entre comillas.
  const text = (entry.text || '').trim().replace(/[.\s]+$/, '');
  return text ? `${label}: «${text}»` : label;
}
