import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, HardDrive, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { createSavedDesign, deleteSavedDesign, getSavedDesign, getSavedDesigns, updateSavedDesign } from '../../api/designs';
import { useSystemAlert } from '../ui/SystemAlert';

function formatBytes(value = 0) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return '';
  }
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
}

function sameName(a, b) {
  return String(a || '').trim().localeCompare(String(b || '').trim(), 'es-MX', { sensitivity: 'accent' }) === 0;
}

export default function SavedDesignsModal({ onClose, channelId, buildSnapshot, onLoad, hasScene, liveEnabled = true, initialView = 'load' }) {
  const { confirmDialog } = useSystemAlert();
  const [designs, setDesigns] = useState([]);
  const [name, setName] = useState('');
  const [activeDesignId, setActiveDesignId] = useState(null);
  const [busy, setBusy] = useState('list');
  const [status, setStatus] = useState('');
  const saveInputRef = useRef(null);
  const listRef = useRef(null);

  const activeDesign = useMemo(() => designs.find((design) => Number(design.id) === Number(activeDesignId)) || null, [designs, activeDesignId]);

  const refresh = async () => {
    if (!channelId) return;
    setBusy('list');
    setStatus('');
    try {
      setDesigns(await getSavedDesigns(channelId));
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudieron cargar tus diseños.'));
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    let active = true;
    if (!channelId) return undefined;
    getSavedDesigns(channelId)
      .then((rows) => { if (active) setDesigns(rows); })
      .catch((error) => { if (active) setStatus(errorMessage(error, 'No se pudieron cargar tus diseños.')); })
      .finally(() => { if (active) setBusy(''); });
    return () => { active = false; };
  }, [channelId]);

  useEffect(() => {
    if (busy === 'list') return undefined;
    const frame = requestAnimationFrame(() => {
      if (initialView === 'save') {
        saveInputRef.current?.focus();
        saveInputRef.current?.select();
        return;
      }
      listRef.current?.querySelector('.dc-design-card-actions .load')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, designs.length, initialView]);

  const applyUpdatedDesign = (updated) => {
    setDesigns((current) => current
      .map((design) => Number(design.id) === Number(updated.id) ? updated : design)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    setActiveDesignId(updated.id);
    setName(updated.name);
  };

  const overwriteDesign = async (design, { ask = true } = {}) => {
    if (!design) return false;
    if (ask) {
      const accepted = await confirmDialog({
        title: `¿Sobrescribir “${design.name}”?`,
        message: 'La copia guardada se reemplazará por lo que tienes ahora en el editor.',
        confirmLabel: 'Sobrescribir',
        cancelLabel: 'Cancelar',
        tone: 'danger'
      });
      if (!accepted) return false;
    }

    setBusy(`update:${design.id}`);
    setStatus(`Sobrescribiendo “${design.name}”...`);
    try {
      const updated = await updateSavedDesign(channelId, design.id, { state: buildSnapshot() });
      applyUpdatedDesign(updated);
      setStatus(`“${updated.name}” quedó sobrescrito con tu workspace actual.`);
      return true;
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo sobrescribir el diseño.'));
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveNew = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setStatus('Ponle un nombre para poder guardarlo.');
      return;
    }

    const existing = designs.find((design) => sameName(design.name, cleanName));
    if (existing) {
      const accepted = await confirmDialog({
        title: `“${existing.name}” ya existe`,
        message: '¿Quieres sobrescribirlo con lo que tienes ahora en el editor?',
        confirmLabel: 'Sobrescribir',
        cancelLabel: 'Guardar con otro nombre',
        tone: 'danger'
      });
      if (accepted) await overwriteDesign(existing, { ask: false });
      return;
    }

    setBusy('save');
    setStatus('Guardando diseño...');
    try {
      const saved = await createSavedDesign(channelId, { name: cleanName, state: buildSnapshot() });
      setDesigns((current) => [saved, ...current]);
      setActiveDesignId(saved.id);
      setName(saved.name);
      setStatus(`“${saved.name}” quedó guardado.`);
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo guardar el diseño.'));
    } finally {
      setBusy('');
    }
  };

  const load = async (design) => {
    if (hasScene) {
      const accepted = await confirmDialog({
        title: `¿Cargar “${design.name}”?`,
        message: liveEnabled ? 'El lienzo actual será reemplazado para todos los editores y el overlay conectado.' : 'El lienzo actual será reemplazado para todos los editores. Como estás en modo Estudio, el overlay no cambiará hasta que publiques.',
        confirmLabel: 'Cargar diseño',
        cancelLabel: 'Cancelar'
      });
      if (!accepted) return;
    }
    setBusy(`load:${design.id}`);
    setStatus(`Cargando “${design.name}”...`);
    try {
      const fullDesign = await getSavedDesign(channelId, design.id);
      await onLoad(fullDesign.state, fullDesign);
      setActiveDesignId(fullDesign.id);
      setName(fullDesign.name);
      setStatus(`“${fullDesign.name}” está cargado.`);
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo cargar el diseño. Tu workspace actual no fue reemplazado.'));
    } finally {
      setBusy('');
    }
  };

  const remove = async (design) => {
    const accepted = await confirmDialog({
      title: `¿Eliminar “${design.name}”?`,
      message: 'Esta copia guardada se borrará de forma permanente.',
      confirmLabel: 'Eliminar diseño',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!accepted) return;
    setBusy(`delete:${design.id}`);
    setStatus('');
    try {
      await deleteSavedDesign(channelId, design.id);
      setDesigns((current) => current.filter((item) => Number(item.id) !== Number(design.id)));
      if (Number(activeDesignId) === Number(design.id)) {
        setActiveDesignId(null);
        setName('');
      }
      setStatus(`“${design.name}” fue eliminado.`);
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo eliminar el diseño.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="dc-designs-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dc-designs-modal" role="dialog" aria-modal="true" aria-label="Diseños guardados" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dc-designs-header">
          <div>
            <span className="dc-designs-kicker"><HardDrive size={14} /> DISEÑOS GUARDADOS</span>
            <h2>Guarda tu setup y vuelve a él cuando quieras</h2>
            <p>Capas, trazos, estilos y configuración del editor quedan en la misma copia.</p>
          </div>
          <button type="button" className="dc-designs-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="dc-designs-save">
          <div className="dc-designs-save-copy">
            <b>GUARDAR LO QUE TIENES AHORA</b>
            <span>Si usas un nombre existente, DrawCast te preguntará si quieres sobrescribirlo.</span>
          </div>
          <div className="dc-designs-save-row">
            <input ref={saveInputRef} maxLength="120" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !busy) saveNew(); }} placeholder="Ej. Sorteo de subs, charla, pantalla de espera..." />
            <button type="button" className="primary" onClick={saveNew} disabled={!channelId || Boolean(busy)}><Save size={14} /> GUARDAR</button>
            {activeDesign && <button type="button" onClick={() => overwriteDesign(activeDesign)} disabled={Boolean(busy)} title={`Sobrescribir ${activeDesign.name} con el workspace actual`}><RefreshCw size={14} /> SOBRESCRIBIR</button>}
          </div>
        </div>

        <div className="dc-designs-list-head">
          <div><b>TUS DISEÑOS</b><span>{designs.length} guardado{designs.length === 1 ? '' : 's'}</span></div>
          <button type="button" onClick={refresh} disabled={Boolean(busy)}><RefreshCw size={13} /> RECARGAR</button>
        </div>

        <div ref={listRef} className="dc-designs-list">
          {busy === 'list' && !designs.length && <div className="dc-designs-empty">Buscando tus diseños...</div>}
          {!busy && !designs.length && <div className="dc-designs-empty"><FolderOpen size={22} /><b>Todavía no has guardado ninguno</b><span>Arma tu escena, ponle nombre arriba y guárdala.</span></div>}

          {designs.map((design) => (
            <article key={design.id} className={`dc-design-card ${Number(activeDesignId) === Number(design.id) ? 'active' : ''}`}>
              <div className="dc-design-card-copy">
                <b>{design.name}</b>
                <span>{formatDate(design.updatedAt)} · {formatBytes(design.sizeBytes)}</span>
              </div>
              <div className="dc-design-card-actions">
                <button type="button" className="load" onClick={() => load(design)} disabled={Boolean(busy)}><FolderOpen size={14} /> CARGAR</button>
                <button type="button" className="overwrite" onClick={() => overwriteDesign(design)} disabled={Boolean(busy)} title={`Guardar el workspace actual encima de ${design.name}`}><Save size={13} /> SOBRESCRIBIR</button>
                <button type="button" className="delete" onClick={() => remove(design)} disabled={Boolean(busy)} aria-label={`Eliminar ${design.name}`}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>

        <footer className="dc-designs-footer">
          <span>{status || (liveEnabled ? 'Cargar reemplaza el lienzo del canal y se refleja en el overlay.' : 'Modo Estudio: cargar cambia el workspace, pero no el overlay hasta que publiques.')}</span>
          <button type="button" onClick={onClose}>LISTO</button>
        </footer>
      </section>
    </div>
  );
}
