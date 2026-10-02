import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Music2, Search, Upload, Volume2, X } from 'lucide-react';
import OwnSoundsPanel from './OwnSoundsPanel';

const cleanSoundName = (value) => String(value || 'Sonido').replace(/\.mp3$/i, '');

export default function LaunchpadConfigModal({ sounds = [], customSounds = [], slots = [], onClose, resolveSoundUrl, onSave, padCount = 0, soundLimit = 0, onUpload, onDelete }) {
  const [draft, setDraft] = useState(() => Array.from({ length: padCount }, (_, index) => slots[index] || null));
  const [view, setView] = useState('pads');
  const [activePad, setActivePad] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const previewRef = useRef(null);

  const customIds = useMemo(() => new Set(customSounds.map((sound) => sound.id)), [customSounds]);
  const orderedSounds = useMemo(() => {
    const seen = new Set();
    return [...customSounds, ...sounds].filter((sound) => sound?.id && !seen.has(sound.id) && seen.add(sound.id));
  }, [customSounds, sounds]);
  const soundMap = useMemo(() => new Map(orderedSounds.map((sound) => [sound.id, sound])), [orderedSounds]);
  const filteredSounds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es-MX');
    if (!needle) return orderedSounds;
    return orderedSounds.filter((sound) => `${sound.name || ''} ${sound.id || ''}`.toLocaleLowerCase('es-MX').includes(needle));
  }, [orderedSounds, query]);

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
      if (view === 'picker') {
        setView('pads');
        setActivePad(null);
        setQuery('');
        stopPreview();
      } else {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, view]);

  const persist = async (nextDraft, message) => {
    setBusy('save');
    setStatus('');
    try {
      await onSave?.(nextDraft);
      setDraft(nextDraft);
      setStatus(message || 'Launchpad actualizado.');
      return true;
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || 'No se pudo guardar el Launchpad.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const assignSound = async (sound) => {
    if (activePad == null || !sound?.id || busy) return;
    stopPreview();
    const nextDraft = draft.map((value, index) => index === activePad ? sound.id : value);
    const saved = await persist(nextDraft, `${cleanSoundName(sound.name)} asignado al pad ${activePad + 1}.`);
    if (!saved) return;
    setView('pads');
    setActivePad(null);
    setQuery('');
  };

  const clearPad = async (event, index) => {
    event.stopPropagation();
    if (busy) return;
    const nextDraft = draft.map((value, padIndex) => padIndex === index ? null : value);
    await persist(nextDraft, `Pad ${index + 1} vacío.`);
  };

  const renderSoundChoice = (sound) => {
    const isPlaying = preview === sound.id;
    const custom = customIds.has(sound.id);
    return (
      <div key={sound.id} className={`dc-launchpad-config-choice ${custom ? 'is-custom' : ''} ${isPlaying ? 'is-playing' : ''}`}>
        <button type="button" className="dc-launchpad-config-choice-main" onClick={() => assignSound(sound)} disabled={busy === 'save'}>
          <span className="dc-launchpad-config-choice-icon"><Music2 size={17} /></span>
          <span className="dc-launchpad-config-choice-copy"><b>{cleanSoundName(sound.name)}</b><small>{custom ? 'Tu sonido' : 'Sonido TRAZIO'}</small></span>
        </button>
        <button type="button" className="dc-launchpad-config-preview" onClick={(event) => { event.stopPropagation(); togglePreview(sound); }} aria-label={`Escuchar ${cleanSoundName(sound.name)}`} aria-pressed={isPlaying}><Volume2 size={15} /></button>
      </div>
    );
  };

  return (
    <div className="dc-sounds-backdrop" role="presentation" onMouseDown={() => onClose?.()}>
      <section className="dc-launchpad-config-modal" role="dialog" aria-modal="true" aria-label="Configurar Launchpad" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-launchpad-config-header">
          <div>
            {view === 'picker' && <button type="button" className="dc-launchpad-config-back" onClick={() => { setView('pads'); setActivePad(null); setQuery(''); stopPreview(); }}><ArrowLeft size={15} /> Volver</button>}
            <h2>{view === 'pads' ? 'Configura tu Launchpad' : `Pad ${Number(activePad) + 1}`}</h2>
            <p>{view === 'pads' ? 'Elige el pad que quieres configurar.' : 'Elige un sonido para este pad.'}</p>
          </div>
          <div className="dc-launchpad-config-header-actions">{view === 'picker' && <button type="button" className="dc-launchpad-config-upload-toggle" onClick={() => setUploadOpen((value) => !value)}><Upload size={15} /> Subir</button>}<button type="button" className="dc-launchpad-config-close" onClick={() => onClose?.()} aria-label="Cerrar"><X size={19} /></button></div>
        </header>

        {view === 'pads' ? (
          <div className="dc-launchpad-config-pads-view">
            <div className="dc-launchpad-config-pad-grid">
              {Array.from({ length: padCount }, (_, index) => {
                const sound = soundMap.get(draft[index]);
                return (
                  <button key={index} type="button" className={`dc-launchpad-config-pad-tile ${sound ? 'has-sound' : 'is-empty'}`} onClick={() => { setActivePad(index); setStatus(''); setQuery(''); setView('picker'); }} disabled={busy === 'save'}>
                    <span className="dc-launchpad-config-pad-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="dc-launchpad-config-pad-tile-copy"><small>PAD</small><b>{sound ? cleanSoundName(sound.name) : 'Sin asignar'}</b><em>{sound ? (customIds.has(sound.id) ? 'Tu sonido' : 'TRAZIO') : 'Click para elegir'}</em></span>
                    {sound && <span role="button" tabIndex={0} className="dc-launchpad-config-pad-tile-clear" onClick={(event) => clearPad(event, index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') clearPad(event, index); }} aria-label={`Vaciar pad ${index + 1}`}><X size={14} /></span>}
                  </button>
                );
              })}
            </div>
            {status && <p className="dc-launchpad-config-status">{status}</p>}
          </div>
        ) : (
          <div className={`dc-launchpad-config-picker-shell ${uploadOpen ? 'has-upload-panel' : ''}`}>
            <div className="dc-launchpad-config-picker-view is-list-only">
            <section className="dc-launchpad-config-library-area">
              <label className="dc-launchpad-config-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sonido..." /></label>
              <div className="dc-launchpad-config-library-grid">
                {filteredSounds.length > 0 ? filteredSounds.map(renderSoundChoice) : <div className="dc-launchpad-config-empty"><Music2 size={23} /><b>Sin resultados</b><span>Prueba otra búsqueda.</span></div>}
              </div>
            </section>
            {status && <p className="dc-launchpad-config-status is-picker">{status}</p>}
            </div>
            {uploadOpen && <OwnSoundsPanel sounds={customSounds} soundLimit={soundLimit} resolveSoundUrl={resolveSoundUrl} onUpload={onUpload} onDelete={onDelete} onClose={() => setUploadOpen(false)} />}
          </div>
        )}
      </section>
    </div>
  );
}
