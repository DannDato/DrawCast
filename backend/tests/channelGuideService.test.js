import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { parseGuideSlot, validateGuide } from '../services/channelGuideService.js';

function png(width = 1920, height = 1080) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(body.length + 8);
    result.writeUInt32BE(data.length, 0);
    body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const data = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${data.toString('base64')}`;
}

test('acepta una captura PNG y fija el nombre según su espacio', () => {
  const imageData = png();
  const guide = validateGuide({ name: 'Nombre ignorado', imageData }, 2);
  assert.equal(guide.name, 'Guía 2');
  assert.equal(validateGuide({ imageData }, 1).name, 'Guía 1');
  assert.equal(validateGuide({ imageData }, 3).name, 'Guía 3');
  assert.equal(validateGuide({ imageData }, 4).name, 'Guía 4');
  assert.equal(guide.imageData, imageData);
  assert.ok(guide.sizeBytes > 0);
});

test('acepta slots expandibles y rechaza identificadores inválidos', () => {
  for (const slot of [1, 2, 3, 4, 24, 99]) assert.equal(parseGuideSlot(String(slot)), slot);
  for (const slot of [0, 100, -1, 1.5, '01', '1/../../', '', undefined]) assert.equal(parseGuideSlot(slot), null);
});

test('rechaza contenido ajeno a PNG', () => {
  for (const imageData of [null, 'data:image/svg+xml,<svg/>', 'data:image/png;base64,AAAA', 'https://example.com/guide.png']) {
    assert.throws(() => validateGuide({ imageData }, 1), { status: 400 });
  }
  assert.throws(() => validateGuide(null, 1), { status: 400 });
});

test('rechaza dimensiones distintas del lienzo y archivos truncados', () => {
  assert.throws(() => validateGuide({ imageData: png(1, 1) }, 1), { status: 400 });
  assert.throws(() => validateGuide({ imageData: png().slice(0, -16) }, 1), { status: 400 });
});

test('limita el tamaño antes de decodificar la captura', () => {
  const imageData = `data:image/png;base64,${'A'.repeat(Math.ceil(4 * 1024 * 1024 / 3) * 4 + 4)}`;
  assert.throws(() => validateGuide({ imageData }, 1), { status: 413 });
});
