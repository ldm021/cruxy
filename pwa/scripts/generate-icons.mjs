#!/usr/bin/env node
/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 *
 *   npm run icons
 *
 * Dibuja una mini-grilla de crucigrama (casillas blancas, negras y una letra
 * marcada) sobre el color de marca. Si mas adelante quieres un icono diseñado
 * a mano, simplemente reemplaza los archivos de public/icons/.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'icons');

const BG = [27, 34, 51]; // #1b2233
const CELL = [244, 244, 240];
const BLOCK = [17, 21, 32];
const ACCENT = [232, 168, 79];

/** CRC32 (tabla precalculada en el primer uso). */
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** rgba: Uint8Array de size*size*4 -> Buffer PNG. */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10..12 = compression, filter, interlace = 0

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro "None"
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param {number} size  lado del icono en px
 * @param {number} pad   fraccion del lado reservada como margen (maskable usa mas)
 */
function drawIcon(size, pad) {
  const px = new Uint8Array(size * size * 4);
  const put = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, BG);

  // Grilla 4x4. 1 = casilla negra, 2 = casilla resaltada, 0 = casilla blanca.
  const layout = [
    [0, 0, 0, 1],
    [0, 1, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 1, 0],
  ];
  const n = layout.length;
  const margin = Math.round(size * pad);
  const inner = size - margin * 2;
  const gap = Math.max(1, Math.round(inner * 0.02));
  const cell = Math.floor((inner - gap * (n - 1)) / n);
  const originX = Math.round((size - (cell * n + gap * (n - 1))) / 2);
  const originY = originX;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const kind = layout[row][col];
      const color = kind === 1 ? BLOCK : kind === 2 ? ACCENT : CELL;
      const x0 = originX + col * (cell + gap);
      const y0 = originY + row * (cell + gap);
      for (let y = y0; y < y0 + cell; y++) {
        for (let x = x0; x < x0 + cell; x++) {
          if (x >= 0 && y >= 0 && x < size && y < size) put(x, y, color);
        }
      }
    }
  }

  return encodePng(size, px);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ['icon-192.png', 192, 0.08],
  ['icon-512.png', 512, 0.08],
  ['icon-maskable-512.png', 512, 0.2], // safe zone para iconos adaptativos
  ['apple-touch-icon.png', 180, 0.08],
];

for (const [name, size, pad] of targets) {
  writeFileSync(join(OUT_DIR, name), drawIcon(size, pad));
  console.log(`✓ ${name} (${size}x${size})`);
}
