import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(serviceDir, '../uploads/channel-sounds');
const FINAL_MAX_BYTES = 2 * 1024 * 1024;
const SOURCE_MAX_BYTES = 12 * 1024 * 1024;
const FFMPEG_PATH = String(process.env.FFMPEG_PATH || 'ffmpeg').trim() || 'ffmpeg';
const SOUND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp3$/i;

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function channelDir(channelId) {
  return path.join(ROOT, String(Number(channelId)));
}

function metaPath(channelId, soundId) {
  return path.join(channelDir(channelId), `${soundId}.json`);
}

function soundPath(channelId, soundId) {
  return path.join(channelDir(channelId), soundId);
}

function cleanLabel(value) {
  const raw = path.basename(String(value || 'sonido.mp3')).replace(/\.mp3$/i, '');
  return raw
    .replace(/[\0-\x1f\x7f]/g, '')
    .replace(/[\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Sonido';
}

function looksLikeMp3(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) return false;
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return true;
  for (let index = 0; index < Math.min(buffer.length - 1, 4096); index += 1) {
    if (buffer[index] === 0xff && (buffer[index + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

async function readMeta(channelId, soundId) {
  try {
    return JSON.parse(await fs.readFile(metaPath(channelId, soundId), 'utf8'));
  } catch {
    return null;
  }
}

async function runFfmpeg(inputPath, outputPath) {
  try {
    await execFileAsync(FFMPEG_PATH, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inputPath,
      '-map', '0:a:0', '-vn',
      '-codec:a', 'libmp3lame',
      '-b:a', '96k',
      '-ar', '44100',
      outputPath
    ], { timeout: 45_000, windowsHide: true, maxBuffer: 512 * 1024 });
  } catch (error) {
    if (error?.code === 'ENOENT') throw httpError('No pudimos reducir el MP3 automáticamente. El tamaño máximo final es 2 MB.', 413);
    throw httpError('No pudimos procesar ese MP3. Verifica que el archivo de audio sea válido.', 415);
  }
}

export function getChannelSoundUploadLimits() {
  return { finalMaxBytes: FINAL_MAX_BYTES, sourceMaxBytes: SOURCE_MAX_BYTES };
}

export async function listChannelSounds(channelId) {
  const dir = channelDir(channelId);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const rows = await Promise.all(entries
    .filter((entry) => entry.isFile() && SOUND_ID_PATTERN.test(entry.name))
    .map(async (entry) => {
      const filePath = soundPath(channelId, entry.name);
      const [stat, meta] = await Promise.all([
        fs.stat(filePath).catch(() => null),
        readMeta(channelId, entry.name)
      ]);
      if (!stat?.isFile() || stat.size <= 0 || stat.size > FINAL_MAX_BYTES) return null;
      return {
        id: entry.name,
        name: cleanLabel(meta?.name || entry.name),
        size: stat.size,
        version: Math.floor(stat.mtimeMs),
        scope: 'channel',
        uploadedAt: meta?.uploadedAt || stat.birthtime?.toISOString?.() || stat.mtime.toISOString()
      };
    }));

  return rows.filter(Boolean).sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
}

export async function getChannelSound(channelId, soundId) {
  const id = String(soundId || '').trim();
  if (!SOUND_ID_PATTERN.test(id)) return null;
  const filePath = soundPath(channelId, id);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > FINAL_MAX_BYTES) return null;
    const meta = await readMeta(channelId, id);
    return {
      id,
      name: cleanLabel(meta?.name || id),
      size: stat.size,
      version: Math.floor(stat.mtimeMs),
      scope: 'channel',
      path: filePath
    };
  } catch {
    return null;
  }
}

export async function ingestChannelSound({ channelId, userId, tempPath, originalName, size }) {
  const sourceSize = Number(size || 0);
  if (!tempPath || sourceSize <= 0) throw httpError('No se recibió un MP3 válido.');
  if (sourceSize > SOURCE_MAX_BYTES) throw httpError('El archivo es demasiado grande para procesarlo.', 413);

  const handleCleanup = async (...paths) => Promise.all(paths.filter(Boolean).map((file) => fs.rm(file, { force: true }).catch(() => {})));
  let candidate = tempPath;
  let compressedPath = null;

  try {
    const header = await fs.readFile(tempPath).then((buffer) => buffer.subarray(0, Math.min(buffer.length, 4096)));
    if (!looksLikeMp3(header)) throw httpError('El archivo no parece ser un MP3 válido.', 415);

    if (sourceSize > FINAL_MAX_BYTES) {
      compressedPath = `${tempPath}.compressed.mp3`;
      await runFfmpeg(tempPath, compressedPath);
      const compressedStat = await fs.stat(compressedPath);
      if (!compressedStat.isFile() || compressedStat.size <= 0 || compressedStat.size > FINAL_MAX_BYTES) {
        throw httpError('Incluso después de reducirlo, el sonido supera el máximo de 2 MB.', 413);
      }
      candidate = compressedPath;
    }

    const dir = channelDir(channelId);
    await fs.mkdir(dir, { recursive: true });
    const soundId = `${crypto.randomUUID()}.mp3`;
    const destination = soundPath(channelId, soundId);
    await fs.copyFile(candidate, destination);
    const stat = await fs.stat(destination);
    const metadata = {
      name: cleanLabel(originalName),
      uploadedBy: Number(userId),
      uploadedAt: new Date().toISOString(),
      originalSize: sourceSize,
      compressed: sourceSize > FINAL_MAX_BYTES
    };
    await fs.writeFile(metaPath(channelId, soundId), JSON.stringify(metadata), 'utf8');

    return {
      id: soundId,
      name: metadata.name,
      size: stat.size,
      version: Math.floor(stat.mtimeMs),
      scope: 'channel',
      uploadedAt: metadata.uploadedAt,
      compressed: metadata.compressed
    };
  } finally {
    await handleCleanup(tempPath, compressedPath);
  }
}

export async function deleteChannelSound(channelId, soundId) {
  const sound = await getChannelSound(channelId, soundId);
  if (!sound) return false;
  await Promise.all([
    fs.rm(sound.path, { force: true }),
    fs.rm(metaPath(channelId, sound.id), { force: true })
  ]);
  return true;
}
