import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Copy, ExternalLink, FileStack, MonitorPlay, PenTool, Search, Users, X } from 'lucide-react';
import { getChannels } from '../api/channels';

function channelStatus(channel) {
  const runtime = channel.runtime || {};
  if (runtime.overlayHidden) return { label: 'Overlay apagado', tone: 'danger' };
  if (runtime.liveEnabled === false) return { label: runtime.hasDraftChanges ? 'Estudio · cambios' : 'Estudio', tone: 'studio' };
  if ((runtime.overlayCount || 0) > 0) return { label: 'Live', tone: 'live' };
  if ((runtime.editorCount || 0) > 0) return { label: 'Editando', tone: 'editing' };
  return { label: 'Listo', tone: 'idle' };
}

function CopyObsButton({ publicKey }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/overlay/${publicKey}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return <button type="button" className="dc-editor-hub-action" onClick={copy}><Copy size={15} /> {copied ? 'Copiado' : 'Copiar OBS'}</button>;
}

export default function EditorHub() {
  const [data, setData] = useState({ ownedChannels: [], collaborations: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    getChannels().then((next) => { if (active) setData(next); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const ownedChannels = useMemo(() => data.ownedChannels || (data.owned ? [data.owned] : []), [data.ownedChannels, data.owned]);
  const channels = useMemo(() => [
    ...ownedChannels.map((channel) => ({ ...channel, relation: 'TU LIENZO', owned: true })),
    ...(data.collaborations || []).map((channel) => ({ ...channel, relation: 'COLABORADOR', owned: false }))
  ], [ownedChannels, data.collaborations]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return channels;
    return channels.filter((channel) => [channel.name, channel.platform, channel.channelUrl, channel.relation].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [channels, query]);

  return <div className="dc-dashboard dc-editor-hub mx-auto w-[min(1200px,calc(100%-32px))] py-8 pt-7">
    <div className="dc-editor-hub-header">
      <div><span className="dc-kicker">EDITORES</span><h1>Abrir un lienzo</h1><p>Accede rápido a tus espacios o a los lienzos donde colaboras.</p></div>
      <div className="dc-editor-hub-count"><strong>{channels.length}</strong><span>DISPONIBLES</span></div>
    </div>

    <div className="dc-editor-hub-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lienzo..." />{query && <button type="button" onClick={() => setQuery('')} title="Limpiar búsqueda"><X size={14} /></button>}</div>

    {loading ? <section className="dc-panel"><p>Cargando tus lienzos...</p></section> : null}
    {!loading && channels.length === 0 ? <section className="dc-panel dc-empty"><PenTool size={28} /><h2>Todavía no tienes lienzos</h2><p className="muted">Crea uno desde Inicio o acepta una invitación para comenzar.</p><Link className="dc-action" to="/app">Ir a mis lienzos</Link></section> : null}
    {!loading && channels.length > 0 && filtered.length === 0 ? <section className="dc-panel dc-empty"><Search size={26} /><h2>Sin resultados</h2><p className="muted">No encontramos ningún lienzo con “{query}”.</p></section> : null}

    <div className="dc-editor-hub-grid">{filtered.map((channel) => {
      const status = channelStatus(channel);
      return <article className="dc-editor-hub-card" key={`${channel.relation}-${channel.id}`}>
        <div className="dc-editor-hub-card-head"><span className="dc-kicker">{channel.relation}</span><span className={`dc-home-canvas-status ${status.tone}`}><i />{status.label}</span></div>
        <div className="dc-editor-hub-card-copy"><h2>{channel.name}</h2><p>{channel.platform ? channel.platform.toUpperCase() : 'SIN CANAL VINCULADO'} · LIENZO 1920×1080</p></div>
        <div className="dc-editor-hub-facts"><span><Users size={14} /> {channel.activeCollaboratorCount ?? channel.collaboratorCount ?? 0} equipo</span><span><FileStack size={14} /> {channel.savedDesignCount || 0} diseños</span>{(channel.runtime?.editorCount || 0) > 0 && <span><Activity size={14} /> {channel.runtime.editorCount} conectados</span>}</div>
        <div className="dc-editor-hub-actions"><Link className="dc-editor-hub-primary" to={`/app/editor/${channel.publicKey}`}><MonitorPlay size={16} /> Abrir editor <ExternalLink size={14} /></Link>{channel.owned && <CopyObsButton publicKey={channel.publicKey} />}</div>
      </article>;
    })}</div>
  </div>;
}
