import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Copy, ExternalLink, FileStack, Link2, MonitorPlay, Pause, Play, Plus, Radio, Trash2, UserPlus, Users, Video, X } from 'lucide-react';
import { createChannel, getChannels, getCollaborators, getFeaturedChannel, inviteCollaborator, removeCollaborator, setCollaboratorAccess } from '../api/channels';
import { useAuth } from '../context/AuthContext';
import { useSystemAlert } from '../components/ui/SystemAlert';

function initials(user) {
  const source = String(user?.username || user?.displayName || 'U').replace(/^@/, '').trim();
  if (!source) return 'U';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function collaboratorName(row) {
  const user = row?.user || {};
  return user.username ? `@${user.username}` : (user.displayName || user.email || 'Usuario');
}

function channelEmbedUrl(channelUrl) {
  if (!channelUrl) return null;
  try {
    const url = new URL(channelUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
      const channel = parts[0];
      if (channel && !['directory', 'downloads', 'jobs', 'p'].includes(channel.toLowerCase())) {
        const parent = window.location.hostname || 'localhost';
        return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&autoplay=false&muted=true`;
      }
    }

    if (host === 'youtu.be' && parts[0]) return `https://www.youtube.com/embed/${encodeURIComponent(parts[0])}`;
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const videoId = url.searchParams.get('v') || ((parts[0] === 'live' || parts[0] === 'shorts') ? parts[1] : null);
      if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }
  } catch { /* fallback a tarjeta */ }
  return null;
}

function channelHandle(channelUrl) {
  if (!channelUrl) return null;
  try {
    const url = new URL(channelUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts[0]) return url.hostname.replace(/^www\./, '');
    if (url.hostname.includes('youtube.com') && ['channel', 'c', 'user'].includes(parts[0])) return parts[1] || parts[0];
    return parts[0].replace(/^@/, '');
  } catch { return null; }
}

function CopyLink({ value, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return <button type="button" className="dc-canvas-mini-action" onClick={copy}><Copy size={14} /> {copied ? 'Copiado' : label}</button>;
}

function FeaturedStreamer({ channel }) {
  if (!channel) return (
    <section className="dc-home-featured dc-home-featured-empty">
      <div className="dc-home-featured-empty-copy"><span className="dc-kicker">STREAMER DEL DÍA</span><h2>Aquí puede aparecer la comunidad</h2><p>Cuando alguien registre el link de su canal, DrawCast podrá destacarlo aquí.</p></div>
      <Video size={34} />
    </section>
  );

  const embed = channelEmbedUrl(channel.channelUrl);
  const handle = channelHandle(channel.channelUrl);
  return (
    <section className="dc-home-featured">
      <div className="dc-home-featured-media">
        {embed ? <iframe src={embed} title={`Streamer del día: ${channel.name}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /> : <a className="dc-home-featured-fallback" href={channel.channelUrl} target="_blank" rel="noreferrer"><MonitorPlay size={38} /><strong>Ver el canal</strong><span>Esta plataforma no ofrece un embed compatible aquí.</span></a>}
      </div>
      <div className="dc-home-featured-footer">
        <div><span className="dc-kicker">STREAMER DEL DÍA</span><h2>{channel.name}</h2><p>{handle ? `@${handle}` : (channel.platform?.toUpperCase() || 'CANAL DE LA COMUNIDAD')}</p></div>
        <a href={channel.channelUrl} target="_blank" rel="noreferrer" title="Visitar canal"><ExternalLink size={17} /></a>
      </div>
    </section>
  );
}

function canvasStatus(channel) {
  const runtime = channel.runtime || {};
  if (runtime.overlayHidden) return { label: 'Overlay apagado', tone: 'danger' };
  if (runtime.liveEnabled === false) return { label: runtime.hasDraftChanges ? 'Estudio · cambios' : 'Estudio', tone: 'studio' };
  if ((runtime.overlayCount || 0) > 0) return { label: 'Live', tone: 'live' };
  if ((runtime.editorCount || 0) > 0) return { label: 'Editando', tone: 'editing' };
  return { label: 'Listo', tone: 'idle' };
}

function CanvasSummaryCard({ channel, selected, onClick }) {
  const status = canvasStatus(channel);
  return (
    <button type="button" className={`dc-home-canvas-card ${selected ? 'selected' : ''}`} onClick={onClick} aria-expanded={selected}>
      <div className="dc-home-canvas-main">
        <div className="dc-home-canvas-title-row"><h3>{channel.name}</h3><span className={`dc-home-canvas-status ${status.tone}`}><i />{status.label}</span></div>
        <p>{channel.channelUrl ? `${channel.platform?.toUpperCase() || 'WEB'} · ${channelHandle(channel.channelUrl) ? `@${channelHandle(channel.channelUrl)}` : 'CANAL VINCULADO'}` : 'SIN CANAL VINCULADO'}</p>
      </div>
      <div className="dc-home-canvas-facts">
        <span><Users size={13} /> {channel.activeCollaboratorCount ?? channel.collaboratorCount ?? 0}</span>
        <span><FileStack size={13} /> {channel.savedDesignCount || 0}</span>
        {(channel.runtime?.editorCount || 0) > 0 && <span><Activity size={13} /> {channel.runtime.editorCount}</span>}
      </div>
      <ArrowRight size={17} className="dc-home-canvas-arrow" />
    </button>
  );
}

function CollaboratorAvatar({ user }) {
  return user?.avatarUrl
    ? <img className="dc-collab-avatar" src={user.avatarUrl} alt="" />
    : <span className="dc-collab-avatar dc-collab-initials">{initials(user)}</span>;
}

function CanvasDetails({ channel, collaborators, loadingCollaborators, inviteState, onInviteChange, onInvite, onToggleCollaborator, onRemoveCollaborator, onClose }) {
  const origin = window.location.origin;
  const editorUrl = `${origin}/app/editor/${channel.publicKey}`;
  const overlayUrl = `${origin}/overlay/${channel.publicKey}`;
  const status = canvasStatus(channel);

  return (
    <section className="dc-home-canvas-details">
      <div className="dc-home-canvas-details-head">
        <div><span className="dc-kicker">LIENZO SELECCIONADO</span><div className="dc-home-detail-title"><h2>{channel.name}</h2><span className={`dc-home-canvas-status ${status.tone}`}><i />{status.label}</span></div></div>
        <div className="dc-home-detail-actions"><Link className="dc-action" to={`/app/editor/${channel.publicKey}`}><MonitorPlay size={15} /> Abrir editor</Link><button type="button" className="dc-canvas-mini-action" onClick={onClose} title="Cerrar detalle"><X size={15} /></button></div>
      </div>

      <div className="dc-canvas-links-grid">
        <div className="dc-canvas-link-box"><span>EDITOR</span><code>{editorUrl}</code><div><CopyLink value={editorUrl} /><Link className="dc-canvas-mini-action" to={`/app/editor/${channel.publicKey}`}><ExternalLink size={14} /> Abrir</Link></div></div>
        <div className="dc-canvas-link-box"><span>OVERLAY / OBS</span><code>{overlayUrl}</code><div><CopyLink value={overlayUrl} /></div></div>
        <div className="dc-canvas-link-box"><span>CANAL DEL STREAMER</span>{channel.channelUrl ? <a className="dc-canvas-channel-link" href={channel.channelUrl} target="_blank" rel="noreferrer">{channel.channelUrl}<ExternalLink size={13} /></a> : <em>Sin link registrado</em>}</div>
      </div>

      <section className="dc-canvas-collaborators">
        <div className="dc-canvas-section-heading"><div><span className="dc-kicker">EQUIPO</span><h3>Colaboradores</h3></div><span>{collaborators?.length || 0} registrados</span></div>
        <div className="dc-canvas-invite-row">
          <input type="email" value={inviteState.email} onChange={(event) => onInviteChange({ ...inviteState, email: event.target.value, message: '' })} placeholder="correo@ejemplo.com" />
          <button type="button" onClick={onInvite} disabled={!inviteState.email.trim() || inviteState.sending}><UserPlus size={15} /> {inviteState.sending ? 'Enviando...' : 'Invitar'}</button>
        </div>
        {inviteState.message && <p className="dc-canvas-inline-message">{inviteState.message}</p>}

        {loadingCollaborators ? <p className="dc-canvas-empty-line">Cargando colaboradores...</p> : null}
        {!loadingCollaborators && (!collaborators || collaborators.length === 0) ? <p className="dc-canvas-empty-line">Este lienzo todavía no tiene colaboradores.</p> : null}
        <div className="dc-canvas-collab-list">{(collaborators || []).map((row) => <div className={`dc-canvas-collab-row ${row.canEdit ? '' : 'suspended'}`} key={row.userId}>
          <CollaboratorAvatar user={row.user} />
          <div className="dc-canvas-collab-copy"><strong>{collaboratorName(row)}</strong><span>{row.user?.displayName || row.user?.email}</span></div>
          <span className={`dc-collab-status ${row.canEdit ? 'active' : 'suspended'}`}>{row.canEdit ? 'Activo' : 'Suspendido'}</span>
          <button type="button" className="dc-collab-control" title={row.canEdit ? 'Suspender colaborador' : 'Reactivar colaborador'} onClick={() => onToggleCollaborator(row)}>{row.canEdit ? <Pause size={15} /> : <Play size={15} />}</button>
          <button type="button" className="dc-collab-control danger" title="Eliminar colaborador" onClick={() => onRemoveCollaborator(row)}><Trash2 size={15} /></button>
        </div>)}</div>
      </section>
    </section>
  );
}

function DashboardSummary({ user, channels, used, limit }) {
  const activeCollaborators = channels.reduce((total, channel) => total + Number(channel.activeCollaboratorCount || 0), 0);
  const savedDesigns = channels.reduce((total, channel) => total + Number(channel.savedDesignCount || 0), 0);
  const overlayHidden = channels.filter((channel) => channel.runtime?.overlayHidden).length;
  const studio = channels.filter((channel) => channel.runtime?.liveEnabled === false).length;
  const live = channels.filter((channel) => (channel.runtime?.overlayCount || 0) > 0 && !channel.runtime?.overlayHidden).length;
  const editors = channels.reduce((total, channel) => total + Number(channel.runtime?.editorCount || 0), 0);

  let title = 'Todo listo';
  let message = 'Tus lienzos están preparados. Entra a cualquiera cuando quieras empezar a trabajar.';
  let tone = 'idle';
  if (overlayHidden) {
    title = overlayHidden === 1 ? 'Hay un overlay apagado' : `Hay ${overlayHidden} overlays apagados`;
    message = 'Algún propietario usó el control de emergencia. El workspace sigue intacto.';
    tone = 'danger';
  } else if (studio) {
    title = studio === 1 ? 'Hay un lienzo en Estudio' : `Hay ${studio} lienzos en Estudio`;
    message = 'Existen cambios que todavía no se están mostrando en el overlay.';
    tone = 'studio';
  } else if (live) {
    title = live === 1 ? 'Hay un lienzo en directo' : `Hay ${live} lienzos en directo`;
    message = editors ? `${editors} editor${editors === 1 ? '' : 'es'} conectado${editors === 1 ? '' : 's'} ahora mismo.` : 'El overlay está conectado y listo para recibir cambios.';
    tone = 'live';
  } else if (editors) {
    title = editors === 1 ? 'Hay un editor trabajando' : `Hay ${editors} editores trabajando`;
    message = 'Tu equipo está preparando contenido en alguno de tus lienzos.';
    tone = 'editing';
  }

  const username = user?.username ? `@${user.username}` : (user?.displayName || 'tu cuenta');
  return (
    <section className="dc-home-summary">
      <div className="dc-home-summary-copy">
        <span className="dc-kicker">AHORA</span>
        <div className={`dc-home-summary-status ${tone}`}><i /><span>{title}</span></div>
        <h2>{username}</h2>
        <p>{message}</p>
      </div>
      <div className="dc-home-metrics">
        <div className="dc-home-metric"><strong>{used}<small>/{limit}</small></strong><span>LIENZOS</span></div>
        <div className="dc-home-metric"><strong>{activeCollaborators}</strong><span>EQUIPO ACTIVO</span></div>
        <div className="dc-home-metric"><strong>{savedDesigns}</strong><span>DISEÑOS</span></div>
      </div>
    </section>
  );
}

export default function ChannelDashboard() {
  const { user } = useAuth();
  const { showAlert, confirmDialog } = useSystemAlert();
  const [data, setData] = useState({ ownedChannels: [], collaborations: [], limits: { canvases: 3, used: 0, remaining: 3 } });
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newCanvas, setNewCanvas] = useState({ name: '', channelUrl: '' });
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [collaboratorsByCanvas, setCollaboratorsByCanvas] = useState({});
  const [collabLoading, setCollabLoading] = useState({});
  const [inviteByCanvas, setInviteByCanvas] = useState({});

  const ownedChannels = useMemo(() => data.ownedChannels || (data.owned ? [data.owned] : []), [data]);
  const selectedChannel = useMemo(() => ownedChannels.find((channel) => channel.id === expandedId) || null, [ownedChannels, expandedId]);
  const limit = data.limits?.canvases ?? 1;
  const used = data.limits?.used ?? ownedChannels.length;
  const atLimit = used >= limit;

  const load = async ({ force = false } = {}) => {
    const next = await getChannels({ force });
    setData(next);
    return next;
  };

  useEffect(() => {
    let active = true;
    Promise.all([getChannels(), getFeaturedChannel()]).then(([channels, featuredResult]) => {
      if (!active) return;
      setData(channels);
      setFeatured(featuredResult.channel || null);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const ensureCollaborators = async (channelId, { force = false } = {}) => {
    if (!force && collaboratorsByCanvas[channelId]) return collaboratorsByCanvas[channelId];
    setCollabLoading((current) => ({ ...current, [channelId]: true }));
    try {
      const rows = await getCollaborators(channelId, { force });
      setCollaboratorsByCanvas((current) => ({ ...current, [channelId]: rows }));
      return rows;
    } finally {
      setCollabLoading((current) => ({ ...current, [channelId]: false }));
    }
  };

  const toggleCanvas = (channel) => {
    const opening = expandedId !== channel.id;
    setExpandedId(opening ? channel.id : null);
    if (opening) ensureCollaborators(channel.id).catch(() => {});
  };

  const handleCreate = async () => {
    if (!newCanvas.name.trim() || creatingCanvas) return;
    setCreatingCanvas(true);
    try {
      const created = await createChannel({ name: newCanvas.name, channelUrl: newCanvas.channelUrl });
      await load({ force: true });
      setCreating(false);
      setNewCanvas({ name: '', channelUrl: '' });
      setExpandedId(created.id);
      setCollaboratorsByCanvas((current) => ({ ...current, [created.id]: [] }));
    } catch (error) {
      await showAlert({ title: 'No se pudo crear el lienzo', message: error.response?.data?.message || 'Inténtalo nuevamente.', tone: 'danger' });
    } finally { setCreatingCanvas(false); }
  };

  const inviteState = (channelId) => inviteByCanvas[channelId] || { email: '', sending: false, message: '' };
  const setInviteState = (channelId, next) => setInviteByCanvas((current) => ({ ...current, [channelId]: next }));

  const handleInvite = async (channelId) => {
    const state = inviteState(channelId);
    if (!state.email.trim() || state.sending) return;
    setInviteState(channelId, { ...state, sending: true, message: '' });
    try {
      await inviteCollaborator(channelId, state.email);
      setInviteState(channelId, { email: '', sending: false, message: 'Invitación enviada. Aparecerá aquí cuando la acepte.' });
    } catch (error) {
      setInviteState(channelId, { ...state, sending: false, message: error.response?.data?.message || 'No se pudo enviar la invitación.' });
    }
  };

  const handleToggleCollaborator = async (channelId, row) => {
    const nextCanEdit = !row.canEdit;
    if (!nextCanEdit) {
      const accepted = await confirmDialog({ title: `¿Suspender a ${collaboratorName(row)}?`, message: 'Conservará su registro en este lienzo, pero no podrá abrir ni editar el workspace hasta que lo reactives.', confirmLabel: 'Suspender', cancelLabel: 'Cancelar', tone: 'danger' });
      if (!accepted) return;
    }
    try {
      await setCollaboratorAccess(channelId, row.userId, nextCanEdit);
      setCollaboratorsByCanvas((current) => ({ ...current, [channelId]: (current[channelId] || []).map((item) => item.userId === row.userId ? { ...item, canEdit: nextCanEdit } : item) }));
      setData((current) => ({ ...current, ownedChannels: (current.ownedChannels || []).map((canvas) => canvas.id === channelId ? { ...canvas, activeCollaboratorCount: Math.max(0, Number(canvas.activeCollaboratorCount || 0) + (nextCanEdit ? 1 : -1)) } : canvas) }));
    } catch (error) {
      await showAlert({ title: 'No se pudo cambiar el acceso', message: error.response?.data?.message || 'Inténtalo nuevamente.', tone: 'danger' });
    }
  };

  const handleRemoveCollaborator = async (channelId, row) => {
    const accepted = await confirmDialog({ title: `¿Eliminar a ${collaboratorName(row)}?`, message: 'Perderá el acceso a este lienzo. Después tendrás que invitarlo de nuevo si quieres recuperarlo.', confirmLabel: 'Eliminar', cancelLabel: 'Cancelar', tone: 'danger' });
    if (!accepted) return;
    try {
      await removeCollaborator(channelId, row.userId);
      setCollaboratorsByCanvas((current) => ({ ...current, [channelId]: (current[channelId] || []).filter((item) => item.userId !== row.userId) }));
      setData((current) => ({ ...current, ownedChannels: (current.ownedChannels || []).map((canvas) => canvas.id === channelId ? { ...canvas, collaboratorCount: Math.max(0, Number(canvas.collaboratorCount || 1) - 1), activeCollaboratorCount: Math.max(0, Number(canvas.activeCollaboratorCount || 0) - (row.canEdit ? 1 : 0)) } : canvas) }));
    } catch (error) {
      await showAlert({ title: 'No se pudo eliminar', message: error.response?.data?.message || 'Inténtalo nuevamente.', tone: 'danger' });
    }
  };

  return (
    <div className="dc-dashboard dc-canvases-home mx-auto w-[min(1240px,calc(100%-32px))] py-8 pt-7">
      <div className="dc-home-main-grid">
        <FeaturedStreamer channel={featured} />

        <section className="dc-home-canvases-panel">
          <div className="dc-home-canvases-head">
            <div><span className="dc-kicker">TUS LIENZOS</span><h1>Espacios de trabajo</h1></div>
            <button type="button" className="dc-home-new-canvas" onClick={() => setCreating((value) => !value)} disabled={atLimit}><Plus size={15} /> Nuevo</button>
          </div>

          <div className="dc-home-canvas-stack">
            {loading ? <div className="dc-home-canvas-placeholder">Cargando tus lienzos...</div> : null}
            {!loading && ownedChannels.length === 0 ? <button type="button" className="dc-home-canvas-empty" onClick={() => setCreating(true)} disabled={atLimit}><Plus size={22} /><strong>Crea tu primer lienzo</strong><span>Obtendrás un editor y un overlay para OBS.</span></button> : null}
            {ownedChannels.map((channel) => <CanvasSummaryCard key={channel.id} channel={channel} selected={expandedId === channel.id} onClick={() => toggleCanvas(channel)} />)}
          </div>

          <div className="dc-home-canvases-foot"><span>{used} de {limit} usados</span><span>{Math.max(0, limit - used)} disponible{Math.max(0, limit - used) === 1 ? '' : 's'}</span></div>
        </section>
      </div>

      {creating && !atLimit && <section className="dc-new-canvas-card dc-home-new-canvas-form">
        <div><span className="dc-kicker">NUEVO LIENZO</span><h2>Prepara otro espacio</h2><p>El nombre es obligatorio. El link del canal es opcional; si lo agregas, podrá aparecer en Streamer del día.</p></div>
        <label><span>Nombre</span><input value={newCanvas.name} onChange={(event) => setNewCanvas((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Stream principal" maxLength={120} /></label>
        <label><span>Link del canal · opcional</span><div className="dc-input-with-icon"><Link2 size={15} /><input value={newCanvas.channelUrl} onChange={(event) => setNewCanvas((current) => ({ ...current, channelUrl: event.target.value }))} placeholder="https://twitch.tv/tu_canal" /></div></label>
        <div className="dc-new-canvas-actions"><button type="button" className="secondary" onClick={() => setCreating(false)}>Cancelar</button><button type="button" onClick={handleCreate} disabled={!newCanvas.name.trim() || creatingCanvas}>{creatingCanvas ? 'Creando...' : 'Crear lienzo'}</button></div>
      </section>}

      {atLimit && <div className="dc-canvas-limit-note">Llegaste al límite de {limit} lienzo{limit === 1 ? '' : 's'} de tu plan. Puedes seguir administrando los que ya tienes.</div>}

      {selectedChannel && <CanvasDetails channel={selectedChannel} collaborators={collaboratorsByCanvas[selectedChannel.id]} loadingCollaborators={Boolean(collabLoading[selectedChannel.id])} inviteState={inviteState(selectedChannel.id)} onInviteChange={(next) => setInviteState(selectedChannel.id, next)} onInvite={() => handleInvite(selectedChannel.id)} onToggleCollaborator={(row) => handleToggleCollaborator(selectedChannel.id, row)} onRemoveCollaborator={(row) => handleRemoveCollaborator(selectedChannel.id, row)} onClose={() => setExpandedId(null)} />}

      <DashboardSummary user={user} channels={ownedChannels} used={used} limit={limit} />

      {(data.collaborations || []).length > 0 && <section className="dc-shared-canvases"><div className="dc-canvas-section-heading"><div><span className="dc-kicker">COLABORACIÓN</span><h2>Compartidos contigo</h2></div><span>{data.collaborations.length} lienzo{data.collaborations.length === 1 ? '' : 's'}</span></div><div className="dc-shared-grid">{data.collaborations.map((channel) => <Link key={channel.id} to={`/app/editor/${channel.publicKey}`} className="dc-shared-card"><div><strong>{channel.name}</strong><span>{channel.platform ? channel.platform.toUpperCase() : 'LIENZO COMPARTIDO'}</span></div><ExternalLink size={16} /></Link>)}</div></section>}
    </div>
  );
}
