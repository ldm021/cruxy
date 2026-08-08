/**
 * Normalización y validación de lo que devuelve el modelo.
 *
 * Aunque pidamos salida estructurada, la foto puede estar torcida o con
 * sombras y la extracción puede venir con inconsistencias (una fila más corta,
 * una pista que apunta a una casilla negra). Aquí dejamos siempre una estructura
 * coherente y devolvemos las advertencias para poder mirarlas en los logs.
 */

export const ACROSS = 'across';
export const DOWN = 'down';

export const MAX_SIDE = 40;

export function cellId(row, col) {
  return `${row}_${col}`;
}

/**
 * Clave estable y única de una palabra: se basa en la casilla donde empieza,
 * no en su número. En los crucigramas españoles de revista el número es la fila
 * o la columna entera, así que una misma "5 horizontal" puede contener varias
 * palabras separadas por casillas negras.
 *
 * Se usa como clave dentro del mapa `completed` del documento, así que no puede
 * contener puntos ni barras (rompen los field paths de Firestore).
 */
export function entryKey(entry) {
  return `${entry.direction}_${entry.cells?.[0]?.row ?? entry.row}_${entry.cells?.[0]?.col ?? entry.col}`;
}

/**
 * Firestore no admite arrays dentro de arrays, así que la grilla se guarda como
 * `[{ cells: [...] }, ...]`. Esto la devuelve a la forma 2D con la que trabaja
 * el resto del código.
 */
export function hydrateGrid(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.map((row) => (Array.isArray(row) ? row : row?.cells || []));
}

const DIRECTION_LABEL = { [ACROSS]: 'horizontal', [DOWN]: 'vertical' };

export function entryLabel(number, direction) {
  return `${number} ${DIRECTION_LABEL[direction] || direction}`;
}

/** Descripción legible para los avisos push. */
export function entryDescription(entry) {
  const label = entryLabel(entry.number, entry.direction);
  // Las pistas impresas suelen venir con punto final; sacarlo evita la
  // puntuación duplicada al meterlas entre comillas.
  const text = (entry.text || '').trim().replace(/[.\s]+$/, '');
  return text ? `${label} («${text}»)` : label;
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {any} raw JSON devuelto por el modelo
 * @returns {{rows:number, cols:number, grid:object[][], clues:object, warnings:string[]}}
 */
export function normalizeExtraction(raw) {
  const warnings = [];

  if (!raw || typeof raw !== 'object') {
    throw new Error('El modelo no devolvió un objeto JSON.');
  }

  let rows = toInt(raw.rows);
  let cols = toInt(raw.cols);
  const grid = Array.isArray(raw.grid) ? raw.grid : [];

  // Si faltan las dimensiones, las deducimos de la grilla.
  if (!rows || rows < 1) rows = grid.length;
  if (!cols || cols < 1) cols = Math.max(0, ...grid.map((r) => (Array.isArray(r) ? r.length : 0)));

  if (!rows || !cols) {
    throw new Error('No se pudieron determinar las dimensiones de la grilla.');
  }
  if (rows > MAX_SIDE || cols > MAX_SIDE) {
    throw new Error(`Grilla demasiado grande (${rows}x${cols}); el máximo es ${MAX_SIDE}.`);
  }

  if (grid.length !== rows) {
    warnings.push(`La grilla trae ${grid.length} filas pero rows=${rows}; se ajustó.`);
  }

  // Rellena/recorta para que la grilla sea exactamente rows x cols.
  const normalizedGrid = [];
  for (let r = 0; r < rows; r++) {
    const sourceRow = Array.isArray(grid[r]) ? grid[r] : [];
    if (sourceRow.length !== cols) {
      warnings.push(`Fila ${r} trae ${sourceRow.length} casillas; se ajustó a ${cols}.`);
    }
    const row = [];
    for (let c = 0; c < cols; c++) {
      const cell = sourceRow[c];
      row.push({
        blocked: Boolean(cell?.blocked),
        number: toInt(cell?.number),
      });
    }
    normalizedGrid.push(row);
  }

  const isOpen = (r, c) =>
    r >= 0 && c >= 0 && r < rows && c < cols && !normalizedGrid[r][c].blocked;

  /** Longitud real de la palabra desde (row,col) hacia `direction`. */
  const runLength = (row, col, direction) => {
    const dr = direction === DOWN ? 1 : 0;
    const dc = direction === ACROSS ? 1 : 0;
    let len = 0;
    let r = row;
    let c = col;
    while (isOpen(r, c)) {
      len += 1;
      r += dr;
      c += dc;
    }
    return len;
  };

  const clues = { [ACROSS]: [], [DOWN]: [] };

  for (const direction of [ACROSS, DOWN]) {
    const source = Array.isArray(raw.clues?.[direction]) ? raw.clues[direction] : [];
    const seen = new Set();

    for (const clue of source) {
      const number = toInt(clue?.number);
      const row = toInt(clue?.row);
      const col = toInt(clue?.col);
      const text = typeof clue?.text === 'string' ? clue.text.trim() : '';

      if (number == null || row == null || col == null) {
        warnings.push(`Pista ${direction} descartada por datos incompletos: ${JSON.stringify(clue)}`);
        continue;
      }
      if (!isOpen(row, col)) {
        warnings.push(
          `Pista ${entryLabel(number, direction)} apunta a (${row},${col}), que está bloqueada o fuera de la grilla; se descartó.`,
        );
        continue;
      }
      // Deduplicamos por casilla de inicio, no por número: en la numeración
      // española varias palabras de la misma fila comparten el número.
      const startKey = `${row}_${col}`;
      if (seen.has(startKey)) {
        warnings.push(
          `Pista ${entryLabel(number, direction)} repite el inicio (${row},${col}); se quedó la primera.`,
        );
        continue;
      }
      seen.add(startKey);

      const geometric = runLength(row, col, direction);
      let length = toInt(clue?.length);
      if (length == null || length < 1 || length > geometric) {
        if (length != null) {
          warnings.push(
            `Pista ${entryLabel(number, direction)}: length=${length} no coincide con la grilla (${geometric}); se usó ${geometric}.`,
          );
        }
        length = geometric;
      }

      clues[direction].push({ number, row, col, length, text });
    }

    // Orden de lectura: por número y, dentro del mismo número, de izquierda a
    // derecha / de arriba abajo.
    clues[direction].sort(
      (a, b) => a.number - b.number || a.row - b.row || a.col - b.col,
    );
  }

  if (!clues[ACROSS].length && !clues[DOWN].length) {
    throw new Error('No se pudo leer ninguna pista de la imagen.');
  }

  /*
   * Números dentro de las casillas.
   *
   * Solo existen en la numeración por palabra (estilo periódico), donde van
   * impresos en la casilla inicial de cada palabra. En la numeración por fila y
   * columna (revista española) el número vive al margen y NO va en la grilla:
   * copiarlo ahí llenaría el tablero de números repetidos que además significan
   * otra cosa ("fila 5", no "palabra 5").
   *
   * La señal que las distingue: con numeración por palabra, cada número aparece
   * una sola vez por dirección.
   */
  for (const direction of [ACROSS, DOWN]) {
    const list = clues[direction];
    const perWord = new Set(list.map((c) => c.number)).size === list.length;
    if (!perWord) continue;
    for (const clue of list) {
      if (normalizedGrid[clue.row][clue.col].number == null) {
        normalizedGrid[clue.row][clue.col].number = clue.number;
      }
    }
  }

  return { rows, cols, grid: normalizedGrid, clues, warnings };
}

/** Coordenadas que ocupa una pista ya normalizada. */
export function entryCells(crossword, clue, direction) {
  const cells = [];
  const dr = direction === DOWN ? 1 : 0;
  const dc = direction === ACROSS ? 1 : 0;
  let { row, col } = clue;

  for (let i = 0; i < clue.length; i++) {
    if (
      row < 0 ||
      col < 0 ||
      row >= crossword.rows ||
      col >= crossword.cols ||
      crossword.grid?.[row]?.[col]?.blocked
    ) {
      break;
    }
    cells.push({ row, col });
    row += dr;
    col += dc;
  }
  return cells;
}

/** Todas las entradas del crucigrama, con sus coordenadas resueltas. */
export function allEntries(crossword) {
  const out = [];
  for (const direction of [ACROSS, DOWN]) {
    for (const clue of crossword.clues?.[direction] || []) {
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
