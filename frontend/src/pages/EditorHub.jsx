import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, PenTool } from 'lucide-react';
import { getChannels } from '../api/channels';

export default function EditorHub() {
  const [data, setData] = useState({ owned: null, collaborations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getChannels()
      .then((next) => { if (active) setData(next); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const channels = [
    ...(data.owned ? [{ ...data.owned, relation: 'TU CANAL' }] : []),
    ...data.collaborations.map((channel) => ({ ...channel, relation: 'COLABORADOR' }))
  ];

  return <div className="dc-dashboard mx-auto w-[min(1200px,calc(100%-32px))] py-8 pt-7">
    <header><h1>ABRIR // EDITOR</h1><span>CANALES DISPONIBLES</span></header>
    <p className="muted">Entra al editor de tu canal o a cualquiera donde te hayan agregado como colaborador.</p>
    {loading ? <section className="dc-panel"><p>Cargando tus canales...</p></section> : null}
    {!loading && channels.length === 0 ? <section className="dc-panel dc-empty"><PenTool size={28} /><h2>TODAVÍA NO TIENES CANALES</h2><p className="muted">Crea tu canal desde Inicio o acepta una invitación para comenzar.</p><Link className="dc-action" to="/app">IR A CONFIGURAR MI CANAL</Link></section> : null}
    <div className="dc-editor-list">{channels.map((channel) => <section className="dc-panel dc-editor-card" key={channel.id}><div><span className="dc-kicker">{channel.relation}</span><h2>{channel.name}</h2><p className="muted">LIENZO 1920×1080 // CAMBIOS EN TIEMPO REAL</p></div><Link className="dc-action" to={`/app/editor/${channel.publicKey}`}><ExternalLink size={16} /> ABRIR EDITOR</Link></section>)}</div>
  </div>;
}
