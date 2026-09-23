import { useEffect, useState } from 'react';
import { Save, Trash2, X } from 'lucide-react';
import { useSystemAlert } from '../../ui/SystemAlert';

export default function GuidesModal({ guides, onSave, onDelete, onClose, disabled = false }) {
  const { confirmDialog } = useSystemAlert();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || busy || document.querySelector('.dc-system-alert-backdrop')) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const handleSave = async (slot, current) => {
    if (busy || disabled) return;
    if (current && !await confirmDialog({ title: '¿Reemplazar guía?', message: `La Guía ${slot} será reemplazada por el dibujo actual para todos los editores de este lienzo.`, confirmLabel: 'Reemplazar', cancelLabel: 'Cancelar' })) return;
    setBusy(true);
    setStatus('Guardando guía...');
    try {
      await onSave(slot);
      onClose();
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || 'No se pudo guardar la guía.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (current) => {
    if (busy || disabled) return;
    if (!await confirmDialog({ title: '¿Eliminar guía?', message: `La Guía ${current.slot} dejará de estar disponible para los editores de este lienzo.`, confirmLabel: 'Eliminar', cancelLabel: 'Cancelar', tone: 'danger' })) return;
    setBusy(true);
    try {
      await onDelete(current.slot);
      setStatus('Guía eliminada.');
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || 'No se pudo eliminar la guía.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dc-designs-backdrop" role="presentation" onMouseDown={() => { if (!busy) onClose(); }}>
      <section className="dc-designs-modal dc-guides-modal" role="dialog" aria-modal="true" aria-label="Guardar como guía" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-designs-header">
          <div><h2>GUARDAR COMO GUÍA</h2><p>Guarda el dibujo actual como referencia compartida de este lienzo. Máximo 3 guías.</p></div>
          <button type="button" className="dc-designs-close" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="dc-designs-list">
          {[1, 2, 3].map((slot) => {
            const current = guides.find((item) => item.slot === slot);
            return (
              <article key={slot} className="dc-design-card">
                <div className="dc-design-card-copy"><b>GUÍA {slot}</b><span>{current ? 'Guardada' : 'Espacio libre'}</span></div>
                <div className="dc-design-card-actions">
                  <button type="button" className="overwrite" onClick={() => handleSave(slot, current)} disabled={busy || disabled}><Save size={13} /> {current ? 'REEMPLAZAR' : 'GUARDAR'}</button>
                  {current && <button type="button" onClick={() => handleDelete(current)} disabled={busy || disabled} aria-label={`Eliminar Guía ${slot}`}><Trash2 size={13} /></button>}
                </div>
              </article>
            );
          })}
        </div>
        <footer className="dc-designs-footer"><span role="status">{status || 'Las guías son referencias del Editor; no aparecen en OBS.'}</span><button type="button" onClick={onClose} disabled={busy}>CERRAR</button></footer>
      </section>
    </div>
  );
}
