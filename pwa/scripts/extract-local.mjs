#!/usr/bin/env node
/**
 * Prueba la extracción de un crucigrama sin Firebase ni despliegue.
 *
 *   node scripts/extract-local.mjs foto.jpg
 *
 * Toma la key de `functions/.env` (que está en .gitignore) o de
 * ANTHROPIC_API_KEY en el entorno.
 *
 * Usa exactamente el mismo código que la Cloud Function (`functions/lib/`), así
 * que lo que veas aquí es lo que va a guardar la app. Escribe el resultado en
 * `public/demo-crossword.json`, que es lo que carga el modo demo del navegador:
 *
 *   VITE_DEMO=1 npm run dev
 *
 * Opciones:
 *   --out <ruta>     dónde escribir el JSON (por defecto public/demo-crossword.json)
 *   --model <id>     modelo a usar (por defecto claude-opus-5)
 *   --title <texto>  título del crucigrama
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const MEDIA_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function parseArgs(argv) {
  const args = { image: null, out: null, model: null, title: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--title') args.title = argv[++i];
    else if (!arg.startsWith('--')) args.image = arg;
  }
  return args;
}

/**
 * Si la key no viene en el entorno, la busca en `functions/.env` (que está en
 * .gitignore). Así no hay que pegarla en cada comando ni dejarla en el historial
 * del shell.
 */
async function loadKeyFromEnvFile() {
  if (process.env.ANTHROPIC_API_KEY) return;
  for (const candidate of [join(ROOT, 'functions/.env'), join(ROOT, '.env.local')]) {
    try {
      const content = await readFile(candidate, 'utf8');
      const match = content.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
      if (match) {
        process.env.ANTHROPIC_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
        console.log(`🔑 key tomada de ${candidate.replace(ROOT + '/', '')}`);
        return;
      }
    } catch {
      // El archivo no existe: seguimos con el siguiente.
    }
  }
}

const args = parseArgs(process.argv.slice(2));

await loadKeyFromEnvFile();

if (!args.image) {
  console.error(`
Falta la imagen.

  node scripts/extract-local.mjs <foto.jpg>
`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(`
Falta la API key de Anthropic. Dos opciones:

  1) Guardarla una sola vez (recomendado, el archivo está en .gitignore):

       echo 'ANTHROPIC_API_KEY=sk-ant-...' > functions/.env

  2) Pasarla en el comando:

       ANTHROPIC_API_KEY=sk-ant-... node scripts/extract-local.mjs ${args.image}
`);
  process.exit(1);
}

if (args.model) process.env.CRUXY_MODEL = args.model;

// Importamos después de fijar CRUXY_MODEL: el módulo lo lee al cargarse.
const { extractCrosswordFromImage, DEFAULT_MODEL } = await import(
  join(ROOT, 'functions/lib/anthropic.js')
);
const { normalizeExtraction, allEntries } = await import(
  join(ROOT, 'functions/lib/crossword.js')
);

const imagePath = resolve(args.image);
const mediaType = MEDIA_TYPES[extname(imagePath).toLowerCase()];
if (!mediaType) {
  console.error(`Formato no soportado: ${extname(imagePath)}. Usa JPEG, PNG o WebP.`);
  process.exit(1);
}

let buffer;
try {
  buffer = await readFile(imagePath);
} catch {
  console.error(`No encontré la imagen: ${imagePath}`);
  process.exit(1);
}
console.log(`📷 ${basename(imagePath)} — ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`🤖 modelo: ${DEFAULT_MODEL}`);
console.log('⏳ leyendo el crucigrama (esto puede tardar un minuto)…\n');

const started = Date.now();
const extraction = await extractCrosswordFromImage(
  buffer,
  mediaType,
  process.env.ANTHROPIC_API_KEY,
);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

const normalized = normalizeExtraction(extraction.data);
const crossword = {
  id: 'demo',
  title: args.title || basename(imagePath, extname(imagePath)),
  createdBy: 'Extracción local',
  rows: normalized.rows,
  cols: normalized.cols,
  grid: normalized.grid,
  clues: normalized.clues,
  status: 'active',
  extraction: {
    model: extraction.model,
    warnings: normalized.warnings,
    inputTokens: extraction.usage?.input_tokens ?? null,
    outputTokens: extraction.usage?.output_tokens ?? null,
  },
};

const outPath = resolve(args.out || join(ROOT, 'public/demo-crossword.json'));
await writeFile(outPath, JSON.stringify(crossword, null, 2) + '\n');

// ---------------------------------------------------------------- resumen ---

const blocked = normalized.grid.flat().filter((c) => c.blocked).length;
const entries = allEntries(crossword);
const sinPista = entries.filter((e) => !e.text).length;

console.log(`✅ listo en ${seconds}s (${extraction.usage?.input_tokens ?? '?'} tokens de entrada, ${extraction.usage?.output_tokens ?? '?'} de salida)\n`);
console.log(`   Grilla:      ${normalized.rows} filas × ${normalized.cols} columnas`);
console.log(`   Bloqueadas:  ${blocked}`);
console.log(`   Horizontales:${String(normalized.clues.across.length).padStart(3)}`);
console.log(`   Verticales:  ${String(normalized.clues.down.length).padStart(3)}`);
if (sinPista) console.log(`   ⚠ sin texto: ${sinPista}`);
console.log(`\n   → ${outPath}\n`);

if (normalized.warnings.length) {
  console.log('⚠️  Advertencias de la validación:');
  for (const w of normalized.warnings) console.log(`   · ${w}`);
  console.log('');
}

// Dibujo de la grilla en la terminal, para comparar con la foto de un vistazo.
console.log('   ' + Array.from({ length: normalized.cols }, (_, i) => String((i + 1) % 10)).join(''));
normalized.grid.forEach((row, i) => {
  const line = row.map((cell) => (cell.blocked ? '█' : '·')).join('');
  console.log(String(i + 1).padStart(2) + ' ' + line);
});

console.log('\nPistas leídas:');
for (const [dirName, list] of [
  ['HORIZONTALES', normalized.clues.across],
  ['VERTICALES', normalized.clues.down],
]) {
  console.log(`\n  ${dirName}`);
  for (const clue of list) {
    const pos = `(f${clue.row + 1},c${clue.col + 1})`.padEnd(9);
    console.log(
      `   ${String(clue.number).padStart(2)} ${pos} ${String(clue.length).padStart(2)} letras  ${clue.text}`,
    );
  }
}

console.log('\nPara verlo e interactuar en el navegador:\n\n   VITE_DEMO=1 npm run dev\n');
