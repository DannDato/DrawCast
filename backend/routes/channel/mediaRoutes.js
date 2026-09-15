import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { verifyToken } from '../../middlewares/auth.js';
import { requireChannelEditor } from '../../middlewares/channelAccess.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import logger from '../../helpers/winston.js';

const router = Router();
const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');
const maxBytes = 20 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const extensions = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function mediaUrl(req, channelId, fileName) {
  const configuredOrigin = String(process.env.PUBLIC_API_ORIGIN || '').trim().replace(/\/$/, '');
  const origin = configuredOrigin || `${req.protocol}://${req.get('host')}`;
  const appFolder = `/${String(process.env.APP_FOLDER || 'api').replace(/^\/+|\/+$/g, '')}`;
  return `${origin}${appFolder}/channel-media/${channelId}/${encodeURIComponent(fileName)}`;
}

function detectImageMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function isBlockedIpv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

function isBlockedIp(ip) {
  if (net.isIP(ip) === 4) return isBlockedIpv4(ip);
  if (net.isIP(ip) !== 6) return true;

  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice(7);
    if (net.isIP(mapped) === 4) return isBlockedIpv4(mapped);
  }
  return false;
}

async function safeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    throw httpError('URL inválida');
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw httpError('Solo se permiten URLs http/https');
  if (url.username || url.password) throw httpError('URLs con credenciales no permitidas');
  if (url.hostname.toLowerCase() === 'localhost') throw httpError('Destino privado/local bloqueado');

  if (net.isIP(url.hostname) && isBlockedIp(url.hostname)) throw httpError('Destino privado/local bloqueado');

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) throw httpError('Destino privado/local bloqueado');
  return url;
}

async function downloadLimited(initialUrl) {
  let current = initialUrl;

  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'DrawCastCloud/1.0 (+media-import)' }
    });

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = await safeUrl(new URL(response.headers.get('location'), current).toString());
      continue;
    }

    if (!response.ok) throw httpError('No fue posible descargar la imagen remota');

    const declaredMime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!allowedMimeTypes.has(declaredMime)) throw httpError('El recurso remoto no es una imagen permitida', 415);

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) throw httpError('Imagen demasiado grande', 413);

    const reader = response.body?.getReader();
    if (!reader) throw httpError('Respuesta remota inválida');

    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw httpError('Imagen demasiado grande', 413);
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    const detectedMime = detectImageMime(buffer);
    if (!detectedMime || detectedMime !== declaredMime) throw httpError('El contenido recibido no coincide con una imagen permitida', 415);
    return { buffer, mimeType: detectedMime };
  }

  throw httpError('Demasiadas redirecciones');
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const dir = path.join(root, String(req.channel.id));
      fs.mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename(req, file, callback) {
      const extension = extensions[file.mimetype];
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    }
  }),
  limits: { fileSize: maxBytes, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) return callback(httpError('Tipo de imagen no permitido', 415));
    return callback(null, true);
  }
});

router.get('/:channelId/image-search', verifyToken, asyncHandler(requireChannelEditor), asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 160);
  if (!query) throw httpError('Consulta vacía');

  const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
  endpoint.searchParams.set('action', 'query');
  endpoint.searchParams.set('generator', 'search');
  endpoint.searchParams.set('gsrsearch', query);
  endpoint.searchParams.set('gsrnamespace', '6');
  endpoint.searchParams.set('gsrlimit', '12');
  endpoint.searchParams.set('prop', 'imageinfo');
  endpoint.searchParams.set('iiprop', 'url|mime');
  endpoint.searchParams.set('iiurlwidth', '320');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('origin', '*');

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(8_000),
    headers: { 'User-Agent': 'DrawCastCloud/1.0 (+wikimedia-search)' }
  });
  if (!response.ok) throw httpError('Wikimedia API no disponible', 502);

  const data = await response.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const results = pages.map((page) => {
    const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
    const mimeType = String(info?.mime || '').toLowerCase();
    if (!info?.url || !allowedMimeTypes.has(mimeType)) return null;
    return {
      title: String(page.title || 'Imagen').replace(/^File:/i, ''),
      imageUrl: info.url,
      thumbnailUrl: info.thumburl || info.url,
      mimeType,
      source: 'commons.wikimedia.org'
    };
  }).filter(Boolean);

  logger.info('Búsqueda de imágenes realizada', { channelId: req.channel.id, userId: req.user.id, query, results: results.length });
  res.json({ ok: true, provider: 'wikimedia', results });
}));

router.post('/:channelId/upload', verifyToken, asyncHandler(requireChannelEditor), upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError('No se recibió archivo', 400);

  const buffer = await fsp.readFile(req.file.path);
  const detectedMime = detectImageMime(buffer);
  if (!detectedMime || detectedMime !== req.file.mimetype) {
    await fsp.rm(req.file.path, { force: true });
    throw httpError('El contenido del archivo no coincide con una imagen permitida', 415);
  }

  const url = mediaUrl(req, req.channel.id, req.file.filename);
  const mediaKind = detectedMime === 'image/gif' ? 'gif' : 'image';
  logger.info('Imagen subida al canal', { channelId: req.channel.id, userId: req.user.id, mimeType: detectedMime, bytes: req.file.size, mediaKind });
  res.status(201).json({ url, mimeType: detectedMime, mediaKind, fileName: req.file.originalname });
}));

router.post('/:channelId/import-image-url', verifyToken, asyncHandler(requireChannelEditor), asyncHandler(async (req, res) => {
  const sourceUrl = await safeUrl(req.body?.url);
  const { buffer, mimeType } = await downloadLimited(sourceUrl);
  const dir = path.join(root, String(req.channel.id));
  await fsp.mkdir(dir, { recursive: true });

  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensions[mimeType]}`;
  await fsp.writeFile(path.join(dir, fileName), buffer);

  const mediaKind = mimeType === 'image/gif' ? 'gif' : 'image';
  logger.info('Imagen remota importada', { channelId: req.channel.id, userId: req.user.id, bytes: buffer.length, mimeType, mediaKind, sourceHost: sourceUrl.hostname });
  res.status(201).json({ url: mediaUrl(req, req.channel.id, fileName), mimeType, mediaKind, fileName: sourceUrl.pathname.split('/').pop() || 'Imagen web' });
}));

export default router;
