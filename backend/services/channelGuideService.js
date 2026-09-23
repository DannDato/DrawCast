const MAX_BYTES = 4 * 1024 * 1024;
const PNG_PREFIX = 'data:image/png;base64,';

export function parseGuideSlot(value) {
  return /^[1-3]$/.test(String(value)) ? Number(value) : null;
}

export function validateGuide(body = {}, slot) {
  const guideSlot = parseGuideSlot(slot);
  if (!guideSlot) throw Object.assign(new Error('Elige una de las tres guías del lienzo.'), { status: 400 });
  const name = `Guía ${guideSlot}`;
  const imageData = body?.imageData;
  if (typeof imageData !== 'string' || !imageData.startsWith(PNG_PREFIX)) throw Object.assign(new Error('La guía debe ser una imagen PNG.'), { status: 400 });
  const encoded = imageData.slice(PNG_PREFIX.length);
  if (encoded.length > Math.ceil(MAX_BYTES / 3) * 4) throw Object.assign(new Error('La guía supera el máximo de 4 MB.'), { status: 413 });
  const image = Buffer.from(encoded, 'base64');
  if (image.length > MAX_BYTES) throw Object.assign(new Error('La guía supera el máximo de 4 MB.'), { status: 413 });
  if (image.length < 45 || image.toString('base64') !== encoded || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || image.toString('ascii', 12, 16) !== 'IHDR' || image.readUInt32BE(16) !== 1920 || image.readUInt32BE(20) !== 1080 || image.subarray(-12).toString('hex') !== '0000000049454e44ae426082') {
    throw Object.assign(new Error('La guía debe ser un PNG válido de 1920 × 1080.'), { status: 400 });
  }
  return { name, imageData, sizeBytes: image.length };
}
