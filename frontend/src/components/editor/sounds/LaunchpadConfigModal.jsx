import { useEffect, useMemo, useState } from 'react';
import { Music2, RefreshCw, Save, Search, Trash2, Volume2, X } from 'lucide-react';

const PAD_COUNT = 24;

export default function LaunchpadConfigModal({ sounds = [], slots = [], onClose, onRefresh, onSave }) {
  const [draft, setDraft] = useState(() => Array.from({ length: PAD_COUNT }, (_, index) => slots[index] || null));
  const [activePad, setActivePad] = useState(0);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const soundMap = useMemo(() => new Map(sounds.map((sound) => [sound.id, sound])), [sounds]);
  const filteredSounds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sounds;
    return sounds.filter((sound) => `${sound.name} ${sound.id}`.toLowerCase().includes(needle));
  }, [query, sounds]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const assign = (soundId) => {
    setDraft((current) => current.map((value, index) => index === activePad ? soundId : value));
    setStatus('');
  };

  const clearActive = () => {
    setDraft((current) => current.map((value, index) => index === activePad ? null : value));
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
      setStatus(error?.message || 'No se pudo guardar el Launchpad.');
      setBusy('');
    }
  };

  return (
    <div className="dc-launchpad-config-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dc-launchpad-config-modal" role="dialog" aria-modal="true" aria-label="Configurar Launchpad" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-launchpad-config-header">
          <div>
            <span className="dc-launchpad-kicker"><Volume2 size={15} /> LAUNCHPAD</span>
            <h2>Configurar pads</h2>
            <p>Selecciona un pad y asígnale cualquier sonido de la biblioteca.</p>
          </div>
          <button type="button" className="dc-launchpad-config-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="dc-launchpad-config-body">
          <section className="dc-launchpad-config-pads" aria-label="Pads configurables">
            <div className="dc-launchpad-config-column-head"><b>24 PADS</b><span>Selecciona el que quieres editar</span></div>
            <div className="dc-launchpad-config-grid">
              {Array.from({ length: PAD_COUNT }, (_, index) => {
                const sound = soundMap.get(draft[index]);
                return (
                  <button key={index} type="button" className={activePad === index ? 'active' : ''} onClick={() => setActivePad(index)}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{sound?.name || 'Sin asignar'}</b>
                  </button>
                );
              })}
            </div>
            <button type="button" className="dc-launchpad-clear-pad" onClick={clearActive} disabled={!draft[activePad]}><Trash2 size={14} /> Vaciar pad {activePad + 1}</button>
          </section>

          <section className="dc-launchpad-config-library" aria-label="Biblioteca de sonidos">
            <div className="dc-launchpad-config-column-head">
              <div><b>BIBLIOTECA</b><span>{sounds.length} sonido{sounds.length === 1 ? '' : 's'}</span></div>
              <button type="button" onClick={refresh} disabled={busy === 'refresh'}><RefreshCw size={14} className={busy === 'refresh' ? 'animate-spin' : ''} /> Actualizar</button>
            </div>
            <label className="dc-launchpad-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sonido..." /></label>
            <div className="dc-launchpad-library-list">
              {filteredSounds.length > 0 ? filteredSounds.map((sound) => (
                <button key={sound.id} type="button" className={draft[activePad] === sound.id ? 'active' : ''} onClick={() => assign(sound.id)}>
                  <Music2 size={16} />
                  <span><b>{sound.name}</b><small>{sound.id}</small></span>
                  <i>PAD {String(activePad + 1).padStart(2, '0')}</i>
                </button>
              )) : (
                <div className="dc-launchpad-library-empty"><Music2 size={22} /><b>No encontramos sonidos</b><span>{sounds.length ? 'Prueba con otro término.' : 'Agrega archivos .mp3 en backend/sounds/ y pulsa Actualizar.'}</span></div>
              )}
            </div>
          </section>
        </div>

        <footer className="dc-launchpad-config-footer">
          <span>{status || 'Tu Launchpad es personal: cada colaborador puede guardar su propia distribución de pads.'}</span>
          <div><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" onClick={save} disabled={busy === 'save'}><Save size={14} /> {busy === 'save' ? 'Guardando…' : 'Guardar Launchpad'}</button></div>
        </footer>
      </section>
    </div>
  );
}
