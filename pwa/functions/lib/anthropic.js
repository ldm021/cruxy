import Anthropic from '@anthropic-ai/sdk';

/**
 * Modelo con visión que lee la foto. Se puede cambiar sin tocar código con la
 * variable de entorno `CRUXY_MODEL` (por ejemplo, a `claude-sonnet-5` si quieres
 * abaratar la extracción a costa de un poco de precisión).
 */
export const DEFAULT_MODEL = process.env.CRUXY_MODEL || 'claude-opus-5';

export const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXTRACTION_PROMPT = `Eres un asistente que extrae la estructura de crucigramas en español a partir de una foto.

Analiza la imagen y devuelve la estructura del crucigrama con esta forma:

{
  "rows": <número de filas>,
  "cols": <número de columnas>,
  "grid": [[{"blocked": bool, "number": number|null}, ...], ...],
  "clues": {
    "across": [{"number": number, "row": number, "col": number, "length": number, "text": "..."}],
    "down": [{"number": number, "row": number, "col": number, "length": number, "text": "..."}]
  }
}

Reglas generales:
- Usa fila y columna con índice empezando en 0.
- "grid" debe tener exactamente "rows" filas y cada fila exactamente "cols" casillas.
- "row" y "col" de cada pista son las coordenadas de la PRIMERA casilla de esa palabra, y esa casilla nunca puede estar bloqueada.
- "length" es la cantidad de casillas de la palabra, contando hasta la siguiente casilla bloqueada o el borde. Usa null solo si de verdad no se puede deducir.
- Transcribe el texto de las pistas tal como aparece, respetando acentos y mayúsculas.
- No inventes pistas ni casillas que no veas claramente en la imagen.

Hay dos convenciones de numeración y tienes que detectar cuál usa esta imagen:

(A) Numeración por palabra (estilo americano / de periódico): los números están
    impresos DENTRO de las casillas donde empieza cada palabra, y cada número
    identifica una sola palabra.
    - Pon ese número en "number" de la casilla correspondiente de "grid".
    - Cada pista lleva el número de su casilla de inicio.

(B) Numeración por fila y columna (estilo revista española): NO hay números
    dentro de las casillas; los números están al costado (filas) y arriba
    (columnas), y el enunciado dice "HORIZONTALES 1: ... 2: ..." refiriéndose a
    filas enteras y "VERTICALES 1: ..." a columnas enteras.
    - Deja "number": null en TODAS las casillas de "grid".
    - Una misma fila o columna suele contener VARIAS palabras separadas por
      casillas bloqueadas, y su enunciado contiene varias pistas seguidas
      (normalmente separadas por punto). Devuelve UNA entrada por palabra, todas
      con el mismo "number" (el de la fila para "across", el de la columna para
      "down"), en el orden en que aparecen: de izquierda a derecha en las
      horizontales, de arriba abajo en las verticales.
    - Ejemplo: si la fila 5 tiene casillas bloqueadas en las columnas 4 y 10, y
      su enunciado trae tres pistas, devuelve tres entradas "across" con
      number 5 y col 0, 5 y 11 respectivamente.
    - Las palabras de una sola casilla normalmente NO tienen pista propia: si
      hay menos pistas que huecos, sáltate los huecos de longitud 1 al repartir.
    - Ojo: la primera fila y la primera columna del enunciado son la 1, pero
      "row"/"col" van en base 0, así que la "HORIZONTAL 1" es row 0.`;

const NULLABLE_INT = { anyOf: [{ type: 'integer' }, { type: 'null' }] };

const CROSSWORD_SCHEMA = {
  type: 'object',
  properties: {
    rows: { type: 'integer' },
    cols: { type: 'integer' },
    grid: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            blocked: { type: 'boolean' },
            number: NULLABLE_INT,
          },
          required: ['blocked', 'number'],
          additionalProperties: false,
        },
      },
    },
    clues: {
      type: 'object',
      properties: {
        across: { type: 'array', items: clueSchema() },
        down: { type: 'array', items: clueSchema() },
      },
      required: ['across', 'down'],
      additionalProperties: false,
    },
  },
  required: ['rows', 'cols', 'grid', 'clues'],
  additionalProperties: false,
};

function clueSchema() {
  return {
    type: 'object',
    properties: {
      number: { type: 'integer' },
      row: { type: 'integer' },
      col: { type: 'integer' },
      length: NULLABLE_INT,
      text: { type: 'string' },
    },
    required: ['number', 'row', 'col', 'length', 'text'],
    additionalProperties: false,
  };
}

/**
 * Manda la foto al modelo y devuelve el JSON crudo de la extracción.
 *
 * Usa salida estructurada (`output_config.format`), así que la respuesta ya
 * viene validada contra el esquema: no hace falta limpiar backticks ni
 * arriesgarse a un `JSON.parse` de texto libre.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mediaType  p. ej. "image/jpeg"
 * @param {string} apiKey
 * @returns {Promise<{data: object, usage: object, model: string}>}
 */
export async function extractCrosswordFromImage(imageBuffer, mediaType, apiKey) {
  const client = new Anthropic({ apiKey });

  // Streaming: `max_tokens` alto en una petición normal puede pasarse del
  // timeout HTTP del SDK.
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 32000,
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: CROSSWORD_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBuffer.toString('base64'),
            },
          },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error(
      `El modelo declinó procesar la imagen (${message.stop_details?.category ?? 'sin categoría'}).`,
    );
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('La respuesta se cortó por longitud: prueba con una foto de un crucigrama más chico.');
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('El modelo no devolvió contenido de texto.');
  }

  return {
    data: JSON.parse(textBlock.text),
    usage: message.usage,
    model: message.model,
  };
}
