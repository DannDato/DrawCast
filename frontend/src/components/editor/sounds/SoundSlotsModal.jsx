import { useEffect, useMemo, useState } from 'react';
import { Music2, RefreshCw, Save, Volume2, X } from 'lucide-react';

const SLOT_COUNT = 5;

export default function SoundSlotsModal({ sounds = [], slots = [], onClose, onRefresh, onSave }) {
  const [draft, setDraft] = useState(() => Array.from({ length: SLOT_COUNT }, (_, index) => slots[index] || null));
  const [activeSlot, setActiveSlot] = useState(0);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const soundMap = useMemo(() => new Map(sounds.map((sound) => [sound.id, sound])), [sounds]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const assign = (soundId) => {
    setDraft((current) => current.map((value, index) => index === activeSlot ? soundId : value));
    setStatus('');
  };

  const clearSlot = (slotIndex) => {
    setDraft((current) => current.map((value, index) => index === slotIndex ? null : value));
    setStatus('');
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

  return (
    <div className="dc-sounds-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dc-sounds-modal" role="dialog" aria-modal="true" aria-label="Asignar sonidos" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-sounds-header">
          <div>
            <span className="dc-sounds-kicker"><Volume2 size={15} /> SONIDOS RÁPIDOS</span>
            <h2>Asignar sonidos</h2>
            <p>Selecciona un slot y asígnale cualquier MP3 disponible en la biblioteca.</p>
          </div>
          <button type="button" className="dc-sounds-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="dc-sounds-body">
          <section className="dc-sounds-slots" aria-label="Slots de sonido">
            <div className="dc-sounds-column-head"><b>5 SLOTS</b><span>Elige cuál editar</span></div>
            <div className="dc-sounds-slot-list">
              {Array.from({ length: SLOT_COUNT }, (_, index) => {
                const sound = soundMap.get(draft[index]);
                return (
                  <div key={index} className={`dc-sounds-slot ${activeSlot === index ? 'active' : ''}`}>
                    <button type="button" className="dc-sounds-slot-main" onClick={() => setActiveSlot(index)}>
                      <span className="dc-sounds-slot-number">{index + 1}</span>
                      <span className="dc-sounds-slot-copy"><b>{sound?.name || 'Sin asignar'}</b><small>{sound?.id || 'Selecciona un sonido de la biblioteca'}</small></span>
                    </button>
                    {draft[index] && <button type="button" className="dc-sounds-slot-clear" onClick={() => clearSlot(index)} title={`Vaciar slot ${index + 1}`} aria-label={`Vaciar slot ${index + 1}`}><X size={14} /></button>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="dc-sounds-library" aria-label="Biblioteca de sonidos">
            <div className="dc-sounds-column-head"><div><b>BIBLIOTECA</b><span>{sounds.length} sonido{sounds.length === 1 ? '' : 's'}</span></div><button type="button" onClick={refresh} disabled={busy === 'refresh'}><RefreshCw size={14} className={busy === 'refresh' ? 'animate-spin' : ''} /> Actualizar</button></div>
            <div className="dc-sounds-library-list">
              {sounds.length > 0 ? sounds.map((sound) => (
                <button key={sound.id} type="button" className={draft[activeSlot] === sound.id ? 'active' : ''} onClick={() => assign(sound.id)}>
                  <Music2 size={16} />
                  <span><b>{sound.name}</b><small>{sound.id}</small></span>
                  <i>SLOT {activeSlot + 1}</i>
                </button>
              )) : (
                <div className="dc-sounds-empty"><Music2 size={22} /><b>No hay sonidos todavía</b><span>Agrega archivos .mp3 en <code>backend/sounds/</code> y pulsa Actualizar.</span></div>
              )}
            </div>
          </section>
        </div>

        <footer className="dc-sounds-footer">
          <span>{status || 'Los slots se guardan en tu cuenta y quedan disponibles en cualquier editor.'}</span>
          <div><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" onClick={save} disabled={busy === 'save'}><Save size={14} /> {busy === 'save' ? 'Guardando…' : 'Guardar asignación'}</button></div>
        </footer>
      </section>
    </div>
  );
}
