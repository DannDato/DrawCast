import { useEffect, useMemo, useRef, useState } from 'react';
import { Music2, RefreshCw, Save, Search, Trash2, Upload, Volume2, X } from 'lucide-react';
import { useSystemAlert } from '../../ui/SystemAlert';

const SLOT_COUNT = 5;

const cleanSoundName = (value) => String(value || 'Sonido').replace(/\.mp3$/i, '');
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function SoundSlotsModal({ sounds = [], customSounds = [], slots = [], onClose, onRefresh, resolveSoundUrl, onUpload, onDelete, onSave }) {
  const { confirmDialog } = useSystemAlert();
  const [draft, setDraft] = useState(() => Array.from({ length: SLOT_COUNT }, (_, index) => slots[index] || null));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);
  const allSounds = useMemo(() => [...sounds, ...customSounds], [sounds, customSounds]);
  const soundMap = useMemo(() => new Map(allSounds.map((sound) => [sound.id, sound])), [allSounds]);
  const initialSlots = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => slots[index] || null), [slots]);
  const hasUnsavedChanges = useMemo(() => draft.some((value, index) => value !== initialSlots[index]), [draft, initialSlots]);
  const filteredSounds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es-MX');
    if (!needle) return sounds;
    return sounds.filter((sound) => `${sound.name || ''} ${sound.id || ''}`.toLocaleLowerCase('es-MX').includes(needle));
  }, [query, sounds]);

  const stopPreview = () => {
    const current = previewRef.current;
    if (!current) return false;
    previewRef.current = null;
    current.audio.pause();
    current.audio.currentTime = 0;
    current.cleanup();
    setPreview(null);
    return true;
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
    audio.preload = 'auto';
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      audio.removeEventListener('loadedmetadata', handleMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleEnded);
    };
    const handleMetadata = () => {
      if (previewRef.current?.audio !== audio) return;
      const durationMs = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : 0;
      setPreview({ soundId: sound.id, durationMs });
    };
    const handleEnded = () => {
      if (previewRef.current?.audio === audio) previewRef.current = null;
      cleanup();
      setPreview((current) => current?.soundId === sound.id ? null : current);
    };

    previewRef.current = { soundId: sound.id, audio, cleanup };
    audio.addEventListener('loadedmetadata', handleMetadata);
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleEnded, { once: true });
    audio.play()?.catch(handleEnded);
  };

  const requestClose = async () => {
    if (!hasUnsavedChanges) {
      onClose?.();
      return;
    }

    const confirmed = await confirmDialog({
      tone: 'danger',
      title: 'Cambios sin guardar',
      message: 'Tienes cambios sin guardar. ¿Seguro que deseas salir?',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir editando'
    });
    if (confirmed) onClose?.();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || document.querySelector('.dc-system-alert-backdrop')) return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasUnsavedChanges, onClose, confirmDialog]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => () => {
    const current = previewRef.current;
    previewRef.current = null;
    if (!current) return;
    current.audio.pause();
    current.audio.currentTime = 0;
    current.cleanup();
  }, []);

  const assign = (slotIndex, soundId) => {
    if (!soundMap.has(soundId)) return;
    setDraft((current) => current.map((value, index) => index === slotIndex ? soundId : value));
    setStatus(`Slot ${slotIndex + 1} listo. Guarda la asignación para aplicarlo.`);
  };

  const clearSlot = (slotIndex) => {
    setDraft((current) => current.map((value, index) => index === slotIndex ? null : value));
    setStatus('');
  };

  const beginDrag = (event, sound) => {
    setDraggingId(sound.id);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-trazio-sound', sound.id);
    event.dataTransfer.setData('text/plain', sound.id);
  };

  const dropOnSlot = (event, slotIndex) => {
    event.preventDefault();
    const soundId = event.dataTransfer.getData('application/x-trazio-sound') || event.dataTransfer.getData('text/plain') || draggingId;
    assign(slotIndex, soundId);
    setDraggingId('');
    setDragOverSlot(null);
  };

  const refresh = async () => {
    setBusy('refresh');
    setStatus('');
    try {
      await onRefresh?.();
    } catch (error) {
      setStatus(error?.message || 'No se pudo actualizar la biblioteca.');
    } finally {
      setBusy('');
    }
  };

  const upload = async (file) => {
    if (!file) return;
    if (!String(file.name || '').toLowerCase().endsWith('.mp3')) {
      setStatus('Sólo puedes subir archivos MP3.');
      return;
    }
    setBusy('upload');
    setStatus(file.size > 2 * 1024 * 1024 ? 'El MP3 supera 2 MB. TRAZIO intentará reducirlo automáticamente…' : 'Subiendo sonido…');
    try {
      const sound = await onUpload?.(file);
      setStatus(sound?.compressed ? `${cleanSoundName(sound.name)} se redujo y quedó listo para este lienzo.` : `${cleanSoundName(sound?.name || file.name)} ya está disponible en Tus sonidos.`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || 'No se pudo subir el sonido.');
    } finally {
      setBusy('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeCustomSound = async (sound) => {
    if (previewRef.current?.soundId === sound.id) stopPreview();
    setBusy(`delete:${sound.id}`);
    setStatus('');
    try {
      await onDelete?.(sound.id);
      setDraft((current) => current.map((value) => value === sound.id ? null : value));
      setStatus(`${cleanSoundName(sound.name)} se eliminó de este lienzo.`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || 'No se pudo eliminar el sonido.');
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    setStatus('');
    try {
      await onSave?.(draft);
    } catch (error) {
      setStatus(error?.message || 'No se pudo guardar la asignación.');
      setBusy('');
    }
  };

  const playbackProps = (sound) => {
    const playing = preview?.soundId === sound.id;
    return {
      className: playing ? 'is-playing' : '',
      style: playing && preview.durationMs ? { '--dc-sound-duration': `${preview.durationMs}ms` } : undefined,
      'aria-pressed': playing
    };
  };

  const renderLibrarySound = (sound) => {
    const state = playbackProps(sound);
    return (
      <button key={sound.id} type="button" className={`dc-sounds-item ${state.className}`} style={state.style} aria-pressed={state['aria-pressed']} draggable onDragStart={(event) => beginDrag(event, sound)} onDragEnd={() => setDraggingId('')} onClick={() => togglePreview(sound)}>
        <Music2 size={15} />
        <span><b>{cleanSoundName(sound.name)}</b><small>{formatBytes(sound.size) || 'Biblioteca TRAZIO'}</small></span>
        <Volume2 size={13} />
      </button>
    );
  };

  return (
    <div className="dc-sounds-backdrop" role="presentation" onMouseDown={requestClose}>
      <section className="dc-sounds-modal" role="dialog" aria-modal="true" aria-label="Asignar sonidos" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-sounds-header">
          <div>
            <div className="dc-sounds-title-row"><h2 className="dc-sounds-title"><span>ASIGNAR</span> <strong>SONIDOS</strong></h2>{hasUnsavedChanges && <span className="dc-sounds-dirty">CAMBIOS SIN GUARDAR</span>}</div>
            <p>Arrastra un sonido hacia un slot. Haz click para escucharlo o detenerlo.</p>
          </div>
          <button type="button" className="dc-sounds-close" onClick={requestClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="dc-sounds-body">
          <section className="dc-sounds-column dc-sounds-slots" aria-label="Slots de sonido">
            <div className="dc-sounds-column-head"><div><b>SLOTS</b></div></div>
            <div className="dc-sounds-slot-list">
              {Array.from({ length: SLOT_COUNT }, (_, index) => {
                const sound = soundMap.get(draft[index]);
                return (
                  <div
                    key={index}
                    className={`dc-sounds-slot ${dragOverSlot === index ? 'is-drag-over' : ''}`}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOverSlot(index); }}
                    onDragLeave={() => setDragOverSlot((current) => current === index ? null : current)}
                    onDrop={(event) => dropOnSlot(event, index)}
                  >
                    <span className="dc-sounds-slot-number">{index + 1}</span>
                    <span className="dc-sounds-slot-copy"><b>{sound ? cleanSoundName(sound.name) : 'Sin asignar'}</b><small>{sound ? (sound.scope === 'channel' ? 'Tus sonidos' : 'Biblioteca') : 'Suelta un sonido aquí'}</small></span>
                    {draft[index] && <button type="button" className="dc-sounds-slot-clear" onClick={() => clearSlot(index)} title={`Vaciar slot ${index + 1}`} aria-label={`Vaciar slot ${index + 1}`}><X size={14} /></button>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="dc-sounds-column dc-sounds-library" aria-label="Biblioteca de sonidos">
            <div className="dc-sounds-column-head">
              <div><b>BIBLIOTECA</b><span>{filteredSounds.length} de {sounds.length}</span></div>
              <button type="button" onClick={refresh} disabled={busy === 'refresh'}><RefreshCw size={14} className={busy === 'refresh' ? 'animate-spin' : ''} /> Actualizar</button>
            </div>
            <label className="dc-sounds-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sonido..." /></label>
            <div className="dc-sounds-library-list">
              {filteredSounds.length > 0 ? filteredSounds.map(renderLibrarySound) : (
                <div className="dc-sounds-empty"><Music2 size={22} /><b>Sin resultados</b><span>{sounds.length ? 'Prueba otra búsqueda.' : 'La biblioteca todavía no tiene sonidos.'}</span></div>
              )}
            </div>
          </section>

          <section className="dc-sounds-column dc-sounds-custom" aria-label="Tus sonidos">
            <div className="dc-sounds-column-head"><div><b>TUS SONIDOS</b><span>{customSounds.length} en este lienzo</span></div></div>
            <div className="dc-sounds-upload-box">
              <input ref={fileInputRef} type="file" accept="audio/mpeg,.mp3" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy === 'upload'}><Upload size={15} /> {busy === 'upload' ? 'Procesando…' : 'Subir MP3'}</button>
              <span>Máximo final: 2 MB. Si pesa más, intentamos reducirlo automáticamente.</span>
            </div>
            <div className="dc-sounds-custom-list">
              {customSounds.length > 0 ? customSounds.map((sound) => {
                const state = playbackProps(sound);
                return (
                  <div key={sound.id} className={`dc-sounds-custom-item ${state.className}`} style={state.style} draggable onDragStart={(event) => beginDrag(event, sound)} onDragEnd={() => setDraggingId('')}>
                    <button type="button" className="dc-sounds-custom-preview" aria-pressed={state['aria-pressed']} onClick={() => togglePreview(sound)}>
                      <Music2 size={15} />
                      <span><b>{cleanSoundName(sound.name)}</b><small>{formatBytes(sound.size)}</small></span>
                      <Volume2 size={13} />
                    </button>
                    <button type="button" className="dc-sounds-custom-delete" onClick={() => removeCustomSound(sound)} disabled={busy === `delete:${sound.id}`} title="Eliminar sonido" aria-label={`Eliminar ${cleanSoundName(sound.name)}`}><Trash2 size={14} /></button>
                  </div>
                );
              }) : (
                <div className="dc-sounds-empty"><Upload size={22} /><b>Todavía no subes sonidos</b><span>Lo que subas aquí queda ligado a este lienzo y lo verán sus colaboradores.</span></div>
              )}
            </div>
          </section>
        </div>

        <footer className="dc-sounds-footer">
          <span>{status || 'Click para escuchar o detener. Los sonidos propios se comparten sólo dentro de este lienzo.'}</span>
          <div><button type="button" onClick={requestClose}>Cancelar</button><button type="button" className="primary" onClick={save} disabled={busy === 'save' || !hasUnsavedChanges}><Save size={14} /> {busy === 'save' ? 'Guardando…' : 'Guardar asignación'}</button></div>
        </footer>
      </section>
    </div>
  );
}
