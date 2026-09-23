import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const SOUND_DIRECTORY = path.resolve(serviceDir, '../sounds');
const configuredMaxBytes = Number(process.env.SOUND_MAX_BYTES || 15 * 1024 * 1024);
const MAX_SOUND_BYTES = Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0 ? configuredMaxBytes : 15 * 1024 * 1024;

function isSafeSoundId(value) {
  const id = String(value || '').trim();
  return id.length > 4
    && id.length <= 180
    && id.toLowerCase().endsWith('.mp3')
    && !/[\\/\0-\x1f\x7f]/.test(id);
}

function soundLabel(fileName) {
  return String(fileName || '')
    .replace(/\.mp3$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

async function soundMetadata(fileName) {
  if (!isSafeSoundId(fileName)) return null;

  const filePath = path.resolve(SOUND_DIRECTORY, fileName);
  if (path.dirname(filePath) !== SOUND_DIRECTORY) return null;

  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > MAX_SOUND_BYTES) return null;
    return {
      id: fileName,
      name: soundLabel(fileName) || fileName,
      size: stat.size,
      version: Math.floor(stat.mtimeMs),
      path: filePath
    };
  } catch {
    return null;
  }
}

export async function listSounds() {
  let entries;
  try {
    entries = await fs.readdir(SOUND_DIRECTORY, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const sounds = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'))
    .map((entry) => soundMetadata(entry.name)));

  return sounds
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'es-MX', { sensitivity: 'base' }))
    .map(({ path: _path, ...sound }) => sound);
}

export async function getSound(soundId) {
  return soundMetadata(String(soundId || '').trim());
}
