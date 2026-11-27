// A PNG writer and reader for sprite sheets, with no dependencies: 8-bit indexed colour, index 0 transparent.
// decodePng reads only what encodePng writes (one IDAT, filter 0 on every row).
import { deflateSync, inflateSync, crc32 } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

// indices: one palette index per pixel, row by row. palette: [[r, g, b], ...]; entry 0 is drawn transparent.
export function encodePng(width, height, indices, palette) {
  if (indices.length !== width * height) throw new Error(`${indices.length} pixels is not ${width} × ${height}`);
  if (palette.length < 1 || palette.length > 256) throw new Error(`a palette of ${palette.length} does not fit 8 bits`);
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;    // bit depth
  head[9] = 3;    // colour type: indexed
  const rows = Buffer.alloc((width + 1) * height);   // each row starts with its filter byte, 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = indices[y * width + x];
      if (!(i < palette.length)) throw new Error(`pixel ${x},${y} is ${i}, outside a palette of ${palette.length}`);
      rows[y * (width + 1) + 1 + x] = i;
    }
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', head),
    chunk('PLTE', Buffer.from(palette.flat())),
    chunk('tRNS', Buffer.from([0])),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let width = 0, height = 0, palette = [];
  const data = [];
  for (let at = 8; at < buf.length;) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 3) throw new Error('not an 8-bit indexed PNG');
    } else if (type === 'PLTE') {
      for (let i = 0; i < length; i += 3) palette.push([body[i], body[i + 1], body[i + 2]]);
    } else if (type === 'IDAT') {
      data.push(body);
    }
    at += length + 12;
  }
  const rows = inflateSync(Buffer.concat(data));
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    if (rows[y * (width + 1)] !== 0) throw new Error(`row ${y} uses a filter this reader does not undo`);
    indices.set(rows.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)), y * width);
  }
  return { width, height, indices, palette };
}
