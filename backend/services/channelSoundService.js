import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { deleteR2Object, getR2Text, headR2Object, isR2Enabled, listR2Objects, putR2Object, r2PublicUrl } from './r2StorageService.js';

const execFileAsync = promisify(execFile);
const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(serviceDir, '../uploads/channel-sounds');
const FINAL_MAX_BYTES = 2 * 1024 * 1024;
const SOURCE_MAX_BYTES = 12 * 1024 * 1024;
const FFMPEG_PATH = String(process.env.FFMPEG_PATH || 'ffmpeg').trim() || 'ffmpeg';
const SOUND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp3$/i;

function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function ref(value) { return typeof value === 'object' ? { id: Number(value.id), uuid: String(value.uuid || '') } : { id: Number(value), uuid: '' }; }
function channelDir(channel) { return path.join(ROOT, String(ref(channel).id)); }
function metaPath(channel, soundId) { return path.join(channelDir(channel), `${soundId}.json`); }
function soundPath(channel, soundId) { return path.join(channelDir(channel), soundId); }
function r2SoundKey(channel, soundId) { return `channels/${ref(channel).uuid}/sounds/${soundId}`; }
function r2MetaKey(channel, soundId) { return `${r2SoundKey(channel, soundId)}.json`; }
function cleanLabel(value) { const raw = path.basename(String(value || 'sonido.mp3')).replace(/\.mp3$/i, ''); return raw.replace(/[\0-\x1f\x7f]/g, '').replace(/[\\/]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sonido'; }
function looksLikeMp3(buffer) { if (!Buffer.isBuffer(buffer) || buffer.length < 3) return false; if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return true; for (let i = 0; i < Math.min(buffer.length - 1, 4096); i += 1) if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) return true; return false; }
async function readLocalMeta(channel, soundId) { try { return JSON.parse(await fs.readFile(metaPath(channel, soundId), 'utf8')); } catch { return null; } }
async function runFfmpeg(inputPath, outputPath) { try { await execFileAsync(FFMPEG_PATH, ['-hide_banner','-loglevel','error','-y','-i',inputPath,'-map','0:a:0','-vn','-codec:a','libmp3lame','-b:a','96k','-ar','44100',outputPath], { timeout: 45_000, windowsHide: true, maxBuffer: 512 * 1024 }); } catch (error) { if (error?.code === 'ENOENT') throw httpError('No pudimos reducir el MP3 automáticamente. El tamaño máximo final es 2 MB.', 413); throw httpError('No pudimos procesar ese MP3. Verifica que el archivo de audio sea válido.', 415); } }
export function getChannelSoundUploadLimits() { return { finalMaxBytes: FINAL_MAX_BYTES, sourceMaxBytes: SOURCE_MAX_BYTES }; }

async function listLocal(channel) {
  let entries; try { entries = await fs.readdir(channelDir(channel), { withFileTypes: true }); } catch (e) { if (e?.code === 'ENOENT') return []; throw e; }
  const rows = await Promise.all(entries.filter((e) => e.isFile() && SOUND_ID_PATTERN.test(e.name)).map(async (e) => { const [stat, meta] = await Promise.all([fs.stat(soundPath(channel,e.name)).catch(()=>null), readLocalMeta(channel,e.name)]); if (!stat?.isFile() || stat.size <= 0 || stat.size > FINAL_MAX_BYTES) return null; return { id:e.name, name:cleanLabel(meta?.name||e.name), size:stat.size, version:Math.floor(stat.mtimeMs), scope:'channel', uploadedAt:meta?.uploadedAt||stat.mtime.toISOString(), storage:'local' }; }));
  return rows.filter(Boolean);
}

export async function listChannelSounds(channel) {
  const c = ref(channel); const rows = [];
  if (isR2Enabled() && c.uuid) {
    const objects = await listR2Objects(`channels/${c.uuid}/sounds/`);
    for (const object of objects.filter((o) => SOUND_ID_PATTERN.test(path.basename(o.key)))) {
      const id = path.basename(object.key); let meta = null; try { meta = JSON.parse(await getR2Text(r2MetaKey(c,id)) || 'null'); } catch {}
      rows.push({ id, name: cleanLabel(meta?.name || id), size: object.size, version: Date.parse(object.lastModified || '') || 0, scope:'channel', uploadedAt: meta?.uploadedAt || object.lastModified, storage:'r2' });
    }
  }
  const seen = new Set(rows.map((r)=>r.id));
  for (const row of await listLocal(c)) if (!seen.has(row.id)) rows.push(row);
  return rows.sort((a,b)=>new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0));
}

export async function getChannelSound(channel, soundId) {
  const c=ref(channel); const id=String(soundId||'').trim(); if (!SOUND_ID_PATTERN.test(id)) return null;
  if (isR2Enabled() && c.uuid) { const head=await headR2Object(r2SoundKey(c,id)); if (head?.size>0 && head.size<=FINAL_MAX_BYTES) { let meta=null; try { meta=JSON.parse(await getR2Text(r2MetaKey(c,id))||'null'); } catch {} return { id, name:cleanLabel(meta?.name||id), size:head.size, version:Date.parse(head.lastModified||'')||0, scope:'channel', url:r2PublicUrl(r2SoundKey(c,id)), storage:'r2' }; } }
  try { const filePath=soundPath(c,id); const stat=await fs.stat(filePath); if (!stat.isFile()||stat.size<=0||stat.size>FINAL_MAX_BYTES) return null; const meta=await readLocalMeta(c,id); return { id,name:cleanLabel(meta?.name||id),size:stat.size,version:Math.floor(stat.mtimeMs),scope:'channel',path:filePath,storage:'local' }; } catch { return null; }
}

export async function ingestChannelSound({ channelId, channelUuid, userId, tempPath, originalName, size }) {
  const c={id:Number(channelId),uuid:String(channelUuid||'')}; const sourceSize=Number(size||0); if(!tempPath||sourceSize<=0) throw httpError('No se recibió un MP3 válido.'); if(sourceSize>SOURCE_MAX_BYTES) throw httpError('El archivo es demasiado grande para procesarlo.',413);
  const cleanup=async(...paths)=>Promise.all(paths.filter(Boolean).map((f)=>fs.rm(f,{force:true}).catch(()=>{}))); let candidate=tempPath; let compressedPath=null;
  try {
    const header=await fs.readFile(tempPath).then((b)=>b.subarray(0,Math.min(b.length,4096))); if(!looksLikeMp3(header)) throw httpError('El archivo no parece ser un MP3 válido.',415);
    if(sourceSize>FINAL_MAX_BYTES){ compressedPath=`${tempPath}.compressed.mp3`; await runFfmpeg(tempPath,compressedPath); const st=await fs.stat(compressedPath); if(!st.isFile()||st.size<=0||st.size>FINAL_MAX_BYTES) throw httpError('Incluso después de reducirlo, el sonido supera el máximo de 2 MB.',413); candidate=compressedPath; }
    const soundId=`${crypto.randomUUID()}.mp3`; const metadata={name:cleanLabel(originalName),uploadedBy:Number(userId),uploadedAt:new Date().toISOString(),originalSize:sourceSize,compressed:sourceSize>FINAL_MAX_BYTES};
    let finalSize=0;
    if(isR2Enabled()){ if(!c.uuid) throw new Error('No se pudo resolver el UUID del lienzo para R2.'); const buffer=await fs.readFile(candidate); finalSize=buffer.length; await putR2Object(r2SoundKey(c,soundId),buffer,{contentType:'audio/mpeg'}); await putR2Object(r2MetaKey(c,soundId),Buffer.from(JSON.stringify(metadata)),{contentType:'application/json',cacheControl:'no-store'}); }
    else { const dir=channelDir(c); await fs.mkdir(dir,{recursive:true}); const destination=soundPath(c,soundId); await fs.copyFile(candidate,destination); finalSize=(await fs.stat(destination)).size; await fs.writeFile(metaPath(c,soundId),JSON.stringify(metadata),'utf8'); }
    return { id:soundId,name:metadata.name,size:finalSize,version:Date.now(),scope:'channel',uploadedAt:metadata.uploadedAt,compressed:metadata.compressed };
  } finally { await cleanup(tempPath,compressedPath); }
}

export async function deleteChannelSound(channel, soundId) {
  const c=ref(channel); const sound=await getChannelSound(c,soundId); if(!sound) return false;
  if(sound.storage==='r2'){ await Promise.all([deleteR2Object(r2SoundKey(c,sound.id)),deleteR2Object(r2MetaKey(c,sound.id))]); return true; }
  await Promise.all([fs.rm(sound.path,{force:true}),fs.rm(metaPath(c,sound.id),{force:true})]); return true;
}
