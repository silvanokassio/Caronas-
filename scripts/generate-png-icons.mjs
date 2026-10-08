import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal compliant PNG generator in pure Node.js
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPNG(width, height, pixelShader) {
  // RGBA buffer with filter byte 0 at each scanline
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelShader(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG header signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const toCrc = buf.subarray(4, 8 + len);
  const crc = crc32(toCrc);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Shader for CaronaFlow brand icon: Dark elegant canvas (#0f172a / #1e1b4b), emerald / cyan highlight & rounded squircle
function caronaShader(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dx = nx - cx;
  const dy = ny - cy;

  // Squircle distance formula: (dx^4 + dy^4)^(1/4)
  const squircleDist = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
  const maxRadius = 0.46;

  if (squircleDist > maxRadius) {
    return [0, 0, 0, 0]; // Transparent outside squircle
  }

  // Gradient base: deep slate to indigo & emerald
  const t = (nx + ny) / 2;
  let r = Math.floor(15 * (1 - t) + 4 * t);
  let g = Math.floor(23 * (1 - t) + 120 * t);
  let b = Math.floor(42 * (1 - t) + 87 * t);

  // Border highlight
  if (squircleDist > maxRadius - 0.02) {
    r = Math.min(255, r + 50);
    g = Math.min(255, g + 80);
    b = Math.min(255, b + 90);
  }

  // Central Car Symbol / Emerald Glow
  const cDist = Math.hypot(dx, dy);
  if (cDist < 0.25) {
    const carIntensity = 1 - cDist / 0.25;
    r = Math.floor(r * (1 - carIntensity) + 16 * carIntensity);
    g = Math.floor(g * (1 - carIntensity) + 185 * carIntensity);
    b = Math.floor(b * (1 - carIntensity) + 129 * carIntensity);
  }

  return [r, g, b, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const sizes = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'pwa-maskable-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon.png', size: 192 },
];

for (const { file, size } of sizes) {
  const buf = createPNG(size, size, caronaShader);
  fs.writeFileSync(path.join(publicDir, file), buf);
  console.log(`Generated ${file} (${size}x${size})`);
}

console.log('All PNG icons generated successfully!');
