import { useEffect, useRef, useState } from 'react';
import { Music2, Trash2, Upload, Volume2, X } from 'lucide-react';

const cleanSoundName = (value) => String(value || 'Sonido').replace(/\.mp3$/i, '');
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function OwnSoundsModal({ sounds = [], soundLimit = 0, onClose, resolveSoundUrl, onUpload, onDelete }) {
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  const stopPreview = () => {
    const current = previewRef.current;
    if (!current) return;
    previewRef.current = null;
    current.audio.pause();
    current.audio.currentTime = 0;
    current.cleanup();
    setPreview(null);
  };

  const togglePreview = (sound) => {
    if (!sound?.id) return;
    if (previewRef.current?.soundId === sound.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const url = resolveSoundUrl?.(sound);
    if (!url) return;
    const audio = new Audio(url);
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      audio.removeEventListener('ended', handleEnd);
      audio.removeEventListener('error', handleEnd);
    };
    const handleEnd = () => {
      if (previewRef.current?.audio === audio) previewRef.current = null;
      cleanup();
      setPreview((current) => current === sound.id ? null : current);
    };
    previewRef.current = { soundId: sound.id, audio, cleanup };
    setPreview(sound.id);
    audio.addEventListener('ended', handleEnd, { once: true });
    audio.addEventListener('error', handleEnd, { once: true });
    audio.play()?.catch(handleEnd);
  };

  useEffect(() => () => stopPreview(), []);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const upload = async (file) => {
    if (!file) return;
    if (!String(file.name || '').toLowerCase().endsWith('.mp3')) {
      setStatus('Sólo puedes subir archivos MP3.');
      return;
    }
    if (soundLimit > 0 && sounds.length >= soundLimit) {
      setStatus(`Ya usas tus ${soundLimit} sonidos personalizados.`);
      return;
    }
    setBusy('upload');
    setStatus(file.size > 2 * 1024 * 1024 ? 'Preparando y reduciendo el MP3…' : 'Subiendo sonido…');
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

  const removeSound = async (sound) => {
    if (busy) return;
    if (previewRef.current?.soundId === sound.id) stopPreview();
    setBusy(`delete:${sound.id}`);
    setStatus('');
    try {
      await onDelete?.(sound.id);
      setStatus(`${cleanSoundName(sound.name)} eliminado.`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || 'No se pudo eliminar el sonido.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="dc-sounds-backdrop" role="presentation" onMouseDown={() => onClose?.()}>
      <section className="dc-own-sounds-modal" role="dialog" aria-modal="true" aria-label="Tus sonidos" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-own-sounds-header">
          <div>
            <span>TUS SONIDOS</span>
            <h2>Subir sonidos</h2>
            <p>Administra los sonidos propios de este lienzo.</p>
          </div>
          <button type="button" className="dc-own-sounds-close" onClick={() => onClose?.()} aria-label="Cerrar"><X size={19} /></button>
        </header>

        <div className="dc-own-sounds-body">
          <input ref={fileInputRef} type="file" accept="audio/mpeg,.mp3" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          <button type="button" className="dc-own-sounds-upload" onClick={() => fileInputRef.current?.click()} disabled={busy === 'upload' || (soundLimit > 0 && sounds.length >= soundLimit)}>
            <Upload size={20} />
            <span><b>{busy === 'upload' ? 'Procesando…' : 'Subir MP3'}</b><small>{soundLimit > 0 ? `${sounds.length} / ${soundLimit} sonidos` : 'Máximo final 2 MB'}</small></span>
          </button>

          <div className="dc-own-sounds-list">
            {sounds.length > 0 ? sounds.map((sound) => {
              const isPlaying = preview === sound.id;
              return (
                <div key={sound.id} className={`dc-own-sounds-item ${isPlaying ? 'is-playing' : ''}`}>
                  <span className="dc-own-sounds-item-icon"><Music2 size={17} /></span>
                  <span className="dc-own-sounds-item-copy"><b>{cleanSoundName(sound.name)}</b><small>{formatBytes(sound.size) || 'Tu sonido'}</small></span>
                  <button type="button" onClick={() => togglePreview(sound)} aria-label={`Escuchar ${cleanSoundName(sound.name)}`} aria-pressed={isPlaying}><Volume2 size={15} /></button>
                  <button type="button" className="is-danger" onClick={() => removeSound(sound)} disabled={busy === `delete:${sound.id}`} aria-label={`Eliminar ${cleanSoundName(sound.name)}`}><Trash2 size={14} /></button>
                </div>
              );
            }) : <div className="dc-own-sounds-empty"><Music2 size={24} /><b>Todavía no has subido sonidos</b><span>Usa el botón de arriba para agregar el primero.</span></div>}
          </div>
          {status && <p className="dc-own-sounds-status">{status}</p>}
        </div>
      </section>
    </div>
  );
}
