import { useRef, useState } from 'react';
import { Music2, Trash2, Upload, Volume2, X } from 'lucide-react';

const cleanSoundName = (value) => String(value || 'Sonido').replace(/\.mp3$/i, '');

export default function OwnSoundsPanel({ sounds = [], soundLimit = 0, resolveSoundUrl, onUpload, onDelete, onClose }) {
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const stopPreview = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
    setPreview(null);
  };

  const togglePreview = (sound) => {
    if (!sound?.id) return;
    if (preview === sound.id) return stopPreview();
    stopPreview();
    const url = resolveSoundUrl?.(sound);
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPreview(sound.id);
    const done = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setPreview(null);
    };
    audio.addEventListener('ended', done, { once: true });
    audio.addEventListener('error', done, { once: true });
    audio.play()?.catch(done);
  };

  const upload = async (file) => {
    if (!file) return;
    if (!String(file.name || '').toLowerCase().endsWith('.mp3')) return setStatus('Sólo puedes subir archivos MP3.');
    if (soundLimit > 0 && sounds.length >= soundLimit) return setStatus(`Ya usas tus ${soundLimit} sonidos personalizados.`);
    setBusy('upload');
    setStatus('Subiendo sonido…');
    try {
      const sound = await onUpload?.(file);
      setStatus(`${cleanSoundName(sound?.name || file.name)} ya está disponible.`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || 'No se pudo subir el sonido.');
    } finally {
      setBusy('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remove = async (sound) => {
    if (busy) return;
    if (preview === sound.id) stopPreview();
    setBusy(`delete:${sound.id}`);
    setStatus('');
    try {
      await onDelete?.(sound.id);
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || 'No se pudo eliminar el sonido.');
    } finally {
      setBusy('');
    }
  };

  return (
    <aside className="dc-inline-own-sounds" aria-label="Subir sonidos propios">
      <div className="dc-inline-own-sounds-head">
        <div><b>Subir sonidos</b><span>Tus sonidos propios</span></div>
        <button type="button" onClick={onClose} aria-label="Cerrar panel"><X size={16} /></button>
      </div>
      <div className="dc-inline-own-sounds-body">
        <input ref={fileInputRef} type="file" accept="audio/mpeg,.mp3" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
        <button type="button" className="dc-inline-own-sounds-upload" onClick={() => fileInputRef.current?.click()} disabled={busy === 'upload' || (soundLimit > 0 && sounds.length >= soundLimit)}>
          <Upload size={18} />
          <span><b>{busy === 'upload' ? 'Procesando…' : 'Subir MP3'}</b><small>{soundLimit > 0 ? `${sounds.length} / ${soundLimit}` : 'MP3'}</small></span>
        </button>
        <div className="dc-inline-own-sounds-list">
          {sounds.length ? sounds.map((sound) => (
            <div key={sound.id} className="dc-inline-own-sounds-item">
              <span><Music2 size={15} /></span>
              <b>{cleanSoundName(sound.name)}</b>
              <button type="button" onClick={() => togglePreview(sound)} aria-label={`Escuchar ${cleanSoundName(sound.name)}`} aria-pressed={preview === sound.id}><Volume2 size={14} /></button>
              <button type="button" className="is-danger" onClick={() => remove(sound)} disabled={busy === `delete:${sound.id}`} aria-label={`Eliminar ${cleanSoundName(sound.name)}`}><Trash2 size={14} /></button>
            </div>
          )) : <p className="dc-inline-own-sounds-empty">Todavía no has subido sonidos.</p>}
        </div>
        {status && <p className="dc-inline-own-sounds-status">{status}</p>}
      </div>
    </aside>
  );
}
