import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    ArrowDown,
    ArrowRight,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    FileStack,
    Link2,
    LogOut,
    MonitorPlay,
    Pause,
    Play,
    Plus,
    Radio,
    Search,
    Trash2,
    UserPlus,
    Users,
    Video,
    X,
} from "lucide-react";
import {
    createChannel,
    deleteChannel,
    getChannels,
    getCollaborators,
    getFeaturedChannel,
    inviteCollaborator,
    removeCollaborator,
    setCollaboratorAccess,
} from "../api/channels";
import { useAuth } from "../context/AuthContext";
import { useSystemAlert } from "../components/ui/SystemAlert";

function initials(user) {
    const source = String(user?.username || user?.displayName || "U")
        .replace(/^@/, "")
        .trim();
    if (!source) return "U";
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function collaboratorName(row) {
    const user = row?.user || {};
    return user.username ? `@${user.username}` : user.displayName || user.email || "Usuario";
}

function channelEmbedUrl(channelUrl) {
    if (!channelUrl) return null;
    try {
        const url = new URL(channelUrl);
        const host = url.hostname.toLowerCase().replace(/^www\./, "");
        const parts = url.pathname.split("/").filter(Boolean);

        if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
            const channel = parts[0];
            if (channel && !["directory", "downloads", "jobs", "p"].includes(channel.toLowerCase())) {
                const parent = window.location.hostname || "localhost";
                return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&autoplay=false&muted=true`;
            }
        }

        if (host === "youtu.be" && parts[0]) return `https://www.youtube.com/embed/${encodeURIComponent(parts[0])}`;
        if (host === "youtube.com" || host.endsWith(".youtube.com")) {
            const videoId =
                url.searchParams.get("v") || (parts[0] === "live" || parts[0] === "shorts" ? parts[1] : null);
            if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
        }
    } catch {
        /* fallback a tarjeta */
    }
    return null;
}

function channelHandle(channelUrl) {
    if (!channelUrl) return null;
    try {
        const url = new URL(channelUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        if (!parts[0]) return url.hostname.replace(/^www\./, "");
        if (url.hostname.includes("youtube.com") && ["channel", "c", "user"].includes(parts[0]))
            return parts[1] || parts[0];
        return parts[0].replace(/^@/, "");
    } catch {
        return null;
    }
}

function CopyLink({ value, label = "Copiar" }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };
    return (
        <button type="button" className="dc-canvas-mini-action" onClick={copy}>
            <Copy size={14} /> {copied ? "Copiado" : label}
        </button>
    );
}


function PrivateLinkValue({ value }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="dc-private-link-value">
            <code>{visible ? value : "********************"}</code>
            <button
                type="button"
                className="dc-canvas-mini-action shrink-0"
                onClick={() => setVisible((current) => !current)}
                title={visible ? "Ocultar enlace" : "Mostrar enlace"}
                aria-label={visible ? "Ocultar enlace" : "Mostrar enlace"}
                aria-pressed={visible}
            >
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
        </div>
    );
}

function FeaturedStreamer({ channel }) {
    if (!channel)
        return (
            <section className="dc-home-featured dc-home-featured-empty">
                
                <div className="dc-home-featured-empty-copy">
                    {/* <span className="dc-kicker">STREAMER DEL DÍA</span> */}
                    <h2>Aquí puede aparecer tu canal</h2>
                    <p>Cuando alguien registre el link de su canal, DrawCast podrá destacarlo aquí.</p>
                </div>
                <Video size={34} />
            </section>
        );

    const embed = channelEmbedUrl(channel.channelUrl);
    return (
        <section className="dc-home-featured">
            <div className="dc-home-featured-media">
                {embed ? (
                    <iframe
                        src={embed}
                        title={`Streamer del día: ${channel.name}`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <a className="dc-home-featured-fallback" href={channel.channelUrl} target="_blank" rel="noreferrer">
                        <MonitorPlay size={38} />
                        <strong>Ver el canal</strong>
                        <span>Esta plataforma no ofrece un embed compatible aquí.</span>
                    </a>
                )}
            </div>
            <div className="dc-home-featured-footer bg-[var(--dc-panel)]">
                <div className="flex gap-5 justify-between">
                    <h2 className="font-['Bebas_Neue'] text-[3rem] font-normal uppercase leading-[0.82] tracking-[-0.02em] text-[var(--dc-accent)]">
                        RECOMENDACION <span className="text-[var(--dc-text-muted)]">DEL DÍA</span>
                    </h2>
                    <h2 className="font-['Bebas_Neue'] text-[3rem] font-normal uppercase leading-[0.82] tracking-[-0.02em] text-[var(--dc-text)]">{channel.name}</h2>
                    {/* <p>{handle ? `@${handle}` : channel.platform?.toUpperCase() || "CANAL DE LA COMUNIDAD"}</p> */}
                </div>
                <a href={channel.channelUrl} target="_blank" rel="noreferrer" title="Visitar canal">
                    <ExternalLink size={17} />
                </a>
            </div>
        </section>
    );
}

function CanvasSummaryCard({ channel, selected, onClick }) {
    const overlayUrl = `${window.location.origin}/overlay/${channel.publicKey}`;
    return (
        <article className={`dc-home-canvas-card ${selected ? "selected" : ""}`}>
            <button type="button" className="dc-home-canvas-card-main" onClick={onClick} aria-expanded={selected}>
                <div className="dc-home-canvas-main">
                    <div className="dc-home-canvas-title-row">
                        <h3>{channel.name}</h3>
                    </div>
                    <p>
                        {channel.channelUrl
                            ? `${channel.platform?.toUpperCase() || "WEB"} · ${channelHandle(channel.channelUrl) ? `@${channelHandle(channel.channelUrl)}` : "CANAL VINCULADO"}`
                            : "SIN CANAL VINCULADO"}
                    </p>
                </div>
                <div className="dc-home-canvas-facts">
                    <span title="Colaboradores activos">
                        <Users size={14} /> {channel.activeCollaboratorCount ?? channel.collaboratorCount ?? 0}
                    </span>
                    <span title="Diseños guardados">
                        <FileStack size={14} /> {channel.savedDesignCount || 0}
                    </span>
                    {(channel.runtime?.editorCount || 0) > 0 && (
                        <span title="Editores conectados">
                            <Activity size={14} /> {channel.runtime.editorCount}
                        </span>
                    )}
                </div>
                <ArrowRight size={17} className="dc-home-canvas-arrow" />
            </button>
            <div className="dc-home-canvas-quick-actions">
                <Link
                    className="dc-home-canvas-quick-action"
                    to={`/app/editor/${channel.publicKey}`}
                    title={`Abrir ${channel.name} en el editor`}
                >
                    <MonitorPlay size={14} /> Editor
                </Link>
                <CopyLink value={overlayUrl} label="OBS" />
            </div>
        </article>
    );
}

function CollaboratorAvatar({ user }) {
    return user?.avatarUrl ? (
        <img className="dc-collab-avatar" src={user.avatarUrl} alt="" />
    ) : (
        <span className="dc-collab-avatar dc-collab-initials">{initials(user)}</span>
    );
}

function CanvasDetails({
    channel,
    collaborators,
    inviteState,
    onInviteChange,
    onInvite,
    onToggleCollaborator,
    onRemoveCollaborator,
    onDeleteChannel,
}) {
    const origin = window.location.origin;
    const editorUrl = `${origin}/app/editor/${channel.publicKey}`;
    const overlayUrl = `${origin}/overlay/${channel.publicKey}`;

    return (
        <section className="dc-home-canvas-details">
            
            <div className="dc-home-canvas-details-head">
                <div>
                    <span className="dc-kicker">LIENZO SELECCIONADO</span>
                    {/* <div className="dc-home-detail-title">
                        <h2>{channel.name}</h2>
                        <span className={`dc-home-canvas-status ${status.tone}`}>
                            <i />
                            {status.label}
                        </span>
                    </div> */}
                </div>
                <div className="dc-home-detail-actions">
                    <Link
                        className="inline-flex min-h-[34px] items-center justify-center gap-[7px] border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-[11px] text-[13px] font-extrabold text-[var(--dc-button-primary-text)] transition hover:brightness-110"
                        to={`/app/editor/${channel.publicKey}`}
                    >
                        <MonitorPlay size={15} /> Abrir editor
                    </Link>
                </div>
            </div>

            <div className="dc-canvas-links-grid">
                <div className="dc-canvas-link-box">
                    <span>EDITOR</span>
                    <PrivateLinkValue value={editorUrl} />
                    <div className="dc-canvas-link-actions">
                        <CopyLink value={editorUrl} />
                        <Link className="dc-canvas-mini-action" to={`/app/editor/${channel.publicKey}`}>
                            <ExternalLink size={14} /> Abrir
                        </Link>
                    </div>
                </div>
                <div className="dc-canvas-link-box">
                    <span>OVERLAY / OBS</span>
                    <PrivateLinkValue value={overlayUrl} />
                    <div className="dc-canvas-link-actions">
                        <CopyLink value={overlayUrl} />
                        <a className="dc-canvas-mini-action" href={overlayUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> Abrir
                        </a>
                    </div>
                </div>
                <div className="dc-canvas-link-box dc-canvas-link-box-channel">
                    <span>CANAL DEL STREAMER</span>
                    {channel.channelUrl ? (
                        <a
                            className="dc-canvas-channel-link"
                            href={channel.channelUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {channel.channelUrl}
                            <ExternalLink size={13} />
                        </a>
                    ) : (
                        <em>Sin link registrado</em>
                    )}
                </div>
                <div className="dc-canvas-danger-row">
                    <div className="dc-canvas-danger-copy">
                        <h3 className="mb-1 mt-[3px] text-[10px] text-[var(--dc-danger-text)]">Eliminar lienzo</h3>
                        <p className="m-0 max-w-[720px] text-[10px] leading-[1.45] text-[var(--dc-muted)]">
                            Elimina permanentemente colaboradores, invitaciones, diseños guardados, archivos subidos y el
                            acceso al editor/overlay.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="dc-canvas-danger-button"
                        onClick={onDeleteChannel}
                    >
                        <Trash2 size={15} /> Eliminar lienzo
                    </button>
                </div>
            </div>

            <section className="dc-canvas-collaborators">
                <div className="dc-canvas-section-heading mt-15">
                    <div>
                        {/* <span className="dc-kicker">EQUIPO</span> */}
                        <h3 className="dc-kicker text-md uppercase ">Colaboradores</h3>
                    </div>
                    {/* <span>{collaborators?.length || 0} registrados</span> */}
                </div>
                <div className="dc-canvas-invite-row">
                    <input
                        type="email"
                        className="w-full border border-[var(--dc-line)] bg-[var(--dc-input-bg)] p-2.5 text-[var(--dc-text-strong)]"
                        value={inviteState.email}
                        onChange={(event) => onInviteChange({ ...inviteState, email: event.target.value, message: "" })}
                        placeholder="correo@ejemplo.com"
                    />
                    <button
                        type="button"
                        onClick={onInvite}
                        disabled={!inviteState.email.trim() || inviteState.sending}
                    >
                        <UserPlus size={15} /> {inviteState.sending ? "Enviando..." : "Invitar"}
                    </button>
                </div>
                {inviteState.message && <p className="dc-canvas-inline-message">{inviteState.message}</p>}

                
                <div className="dc-canvas-collab-list">
                    {(collaborators || []).map((row) => (
                        <div className={`dc-canvas-collab-row ${row.canEdit ? "" : "suspended"}`} key={row.user?.uuid}>
                            <CollaboratorAvatar user={row.user} />
                            <div className="dc-canvas-collab-copy">
                                <strong>{collaboratorName(row)}</strong>
                                <span>{row.user?.displayName || row.user?.email}</span>
                            </div>
                            <span className={`dc-collab-status ${row.canEdit ? "active" : "suspended"}`}>
                                {row.canEdit ? "Activo" : "Suspendido"}
                            </span>
                            <button
                                type="button"
                                className="dc-collab-control"
                                title={row.canEdit ? "Suspender colaborador" : "Reactivar colaborador"}
                                onClick={() => onToggleCollaborator(row)}
                            >
                                {row.canEdit ? <Pause size={15} /> : <Play size={15} />}
                            </button>
                            <button
                                type="button"
                                className="dc-collab-control danger"
                                title="Eliminar colaborador"
                                onClick={() => onRemoveCollaborator(row)}
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            
        </section>
    );
}

function DashboardSummary({ user, channels, used, limit }) {
    const activeCollaborators = channels.reduce(
        (total, channel) => total + Number(channel.activeCollaboratorCount || 0),
        0
    );
    const savedDesigns = channels.reduce((total, channel) => total + Number(channel.savedDesignCount || 0), 0);
    const overlayHidden = channels.filter((channel) => channel.runtime?.overlayHidden).length;
    const studio = channels.filter((channel) => channel.runtime?.liveEnabled === false).length;
    const live = channels.filter(
        (channel) => (channel.runtime?.overlayCount || 0) > 0 && !channel.runtime?.overlayHidden
    ).length;
    const editors = channels.reduce((total, channel) => total + Number(channel.runtime?.editorCount || 0), 0);

    let message = "Tus lienzos están preparados. Entra a cualquiera cuando quieras empezar a trabajar.";
    if (overlayHidden) {
        message = "Algún propietario usó el control de emergencia. El workspace sigue intacto.";
    } else if (studio) {
        message = "Existen cambios que todavía no se están mostrando en el overlay.";
    } else if (live) {
        message = editors
            ? `${editors} editor${editors === 1 ? "" : "es"} conectado${editors === 1 ? "" : "s"} ahora mismo.`
            : "El overlay está conectado y listo para recibir cambios.";
    } else if (editors) {
        message = "Tu equipo está preparando contenido en alguno de tus lienzos.";
    }

    const username = user?.username ? `@${user.username}` : user?.displayName || "tu cuenta";
    return (
        <section className="dc-home-summary">
            <div className="dc-home-summary-copy">
                <h2>{username}</h2>
                <p>{message}</p>
            </div>
            <div className="dc-home-metrics">
                <div className="dc-home-metric">
                    <strong>
                        {used}
                        <small>/{limit}</small>
                    </strong>
                    <span>LIENZOS</span>
                </div>
                <div className="dc-home-metric">
                    <strong>{activeCollaborators}</strong>
                    <span>EQUIPO</span>
                </div>
                <div className="dc-home-metric">
                    <strong>{savedDesigns}</strong>
                    <span>DISEÑOS</span>
                </div>
            </div>
        </section>
    );
}

export default function ChannelDashboard() {
    const { user } = useAuth();
    const { showAlert, confirmDialog, confirmTextDialog } = useSystemAlert();
    const [data, setData] = useState({
        ownedChannels: [],
        collaborations: [],
        limits: { canvases: 3, used: 0, remaining: 3 },
    });
    const [featured, setFeatured] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newCanvas, setNewCanvas] = useState({ name: "", channelUrl: "" });
    const [creatingCanvas, setCreatingCanvas] = useState(false);
    const [expandedUuid, setExpandedUuid] = useState(null);
    const [collaboratorsByCanvas, setCollaboratorsByCanvas] = useState({});
    const [collabLoading, setCollabLoading] = useState({});
    const [inviteByCanvas, setInviteByCanvas] = useState({});
    const [canvasQuery, setCanvasQuery] = useState("");

    const ownedChannels = useMemo(() => data.ownedChannels || (data.owned ? [data.owned] : []), [data]);
    const selectedChannel = useMemo(
        () => ownedChannels.find((channel) => channel.uuid === expandedUuid) || null,
        [ownedChannels, expandedUuid]
    );
    const limit = data.limits?.canvases ?? 1;
    const used = data.limits?.used ?? ownedChannels.length;
    const atLimit = used >= limit;
    const filteredOwnedChannels = useMemo(() => {
        const query = canvasQuery.trim().toLowerCase();
        if (!query) return ownedChannels;
        return ownedChannels.filter((channel) => {
            const handle = channelHandle(channel.channelUrl);
            return [channel.name, channel.platform, channel.channelUrl, handle ? `@${handle}` : ""].some((value) =>
                String(value || "")
                    .toLowerCase()
                    .includes(query)
            );
        });
    }, [ownedChannels, canvasQuery]);

    const load = async ({ force = false } = {}) => {
        const next = await getChannels({ force });
        setData(next);
        return next;
    };

    useEffect(() => {
        let active = true;
        Promise.all([getChannels(), getFeaturedChannel()])
            .then(([channels, featuredResult]) => {
                if (!active) return;
                setData(channels);
                setFeatured(featuredResult.channel || null);

                const firstChannel = (channels.ownedChannels || (channels.owned ? [channels.owned] : []))[0] || null;
                if (!firstChannel) return;

                setExpandedUuid(firstChannel.uuid);
                setCollabLoading((current) => ({ ...current, [firstChannel.uuid]: true }));
                getCollaborators(firstChannel.uuid)
                    .then((rows) => {
                        if (active) setCollaboratorsByCanvas((current) => ({ ...current, [firstChannel.uuid]: rows }));
                    })
                    .catch(() => {})
                    .finally(() => {
                        if (active) setCollabLoading((current) => ({ ...current, [firstChannel.uuid]: false }));
                    });
            })
            .catch(() => {})
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const ensureCollaborators = async (channelUuid, { force = false } = {}) => {
        if (!force && collaboratorsByCanvas[channelUuid]) return collaboratorsByCanvas[channelUuid];
        setCollabLoading((current) => ({ ...current, [channelUuid]: true }));
        try {
            const rows = await getCollaborators(channelUuid, { force });
            setCollaboratorsByCanvas((current) => ({ ...current, [channelUuid]: rows }));
            return rows;
        } finally {
            setCollabLoading((current) => ({ ...current, [channelUuid]: false }));
        }
    };

    const selectCanvas = (channel) => {
        if (expandedUuid === channel.uuid) return;
        setExpandedUuid(channel.uuid);
        ensureCollaborators(channel.uuid).catch(() => {});
    };

    const handleCreate = async () => {
        if (!newCanvas.name.trim() || creatingCanvas) return;
        setCreatingCanvas(true);
        try {
            const created = await createChannel({ name: newCanvas.name, channelUrl: newCanvas.channelUrl });
            await load({ force: true });
            setCreating(false);
            setNewCanvas({ name: "", channelUrl: "" });
            setExpandedUuid(created.uuid);
            setCollaboratorsByCanvas((current) => ({ ...current, [created.uuid]: [] }));
        } catch (error) {
            await showAlert({
                title: "No se pudo crear el lienzo",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setCreatingCanvas(false);
        }
    };

    const inviteState = (channelUuid) => inviteByCanvas[channelUuid] || { email: "", sending: false, message: "" };
    const setInviteState = (channelUuid, next) => setInviteByCanvas((current) => ({ ...current, [channelUuid]: next }));

    const handleInvite = async (channelUuid) => {
        const state = inviteState(channelUuid);
        if (!state.email.trim() || state.sending) return;
        setInviteState(channelUuid, { ...state, sending: true, message: "" });
        try {
            await inviteCollaborator(channelUuid, state.email);
            setInviteState(channelUuid, {
                email: "",
                sending: false,
                message: "Invitación enviada. Aparecerá aquí cuando la acepte.",
            });
        } catch (error) {
            setInviteState(channelUuid, {
                ...state,
                sending: false,
                message: error.response?.data?.message || "No se pudo enviar la invitación.",
            });
        }
    };

    const handleToggleCollaborator = async (channelUuid, row) => {
        const nextCanEdit = !row.canEdit;
        if (!nextCanEdit) {
            const accepted = await confirmDialog({
                title: `¿Suspender a ${collaboratorName(row)}?`,
                message:
                    "Conservará su registro en este lienzo, pero no podrá abrir ni editar el workspace hasta que lo reactives.",
                confirmLabel: "Suspender",
                cancelLabel: "Cancelar",
                tone: "danger",
            });
            if (!accepted) return;
        }
        try {
            await setCollaboratorAccess(channelUuid, row.user?.uuid, nextCanEdit);
            setCollaboratorsByCanvas((current) => ({
                ...current,
                [channelUuid]: (current[channelUuid] || []).map((item) =>
                    item.user?.uuid === row.user?.uuid ? { ...item, canEdit: nextCanEdit } : item
                ),
            }));
            setData((current) => ({
                ...current,
                ownedChannels: (current.ownedChannels || []).map((canvas) =>
                    canvas.uuid === channelUuid
                        ? {
                              ...canvas,
                              activeCollaboratorCount: Math.max(
                                  0,
                                  Number(canvas.activeCollaboratorCount || 0) + (nextCanEdit ? 1 : -1)
                              ),
                          }
                        : canvas
                ),
            }));
        } catch (error) {
            await showAlert({
                title: "No se pudo cambiar el acceso",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    const handleRemoveCollaborator = async (channelUuid, row) => {
        const accepted = await confirmDialog({
            title: `¿Eliminar a ${collaboratorName(row)}?`,
            message: "Perderá el acceso a este lienzo. Después tendrás que invitarlo de nuevo si quieres recuperarlo.",
            confirmLabel: "Eliminar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (!accepted) return;
        try {
            await removeCollaborator(channelUuid, row.user?.uuid);
            setCollaboratorsByCanvas((current) => ({
                ...current,
                [channelUuid]: (current[channelUuid] || []).filter((item) => item.user?.uuid !== row.user?.uuid),
            }));
            setData((current) => ({
                ...current,
                ownedChannels: (current.ownedChannels || []).map((canvas) =>
                    canvas.uuid === channelUuid
                        ? {
                              ...canvas,
                              collaboratorCount: Math.max(0, Number(canvas.collaboratorCount || 1) - 1),
                              activeCollaboratorCount: Math.max(
                                  0,
                                  Number(canvas.activeCollaboratorCount || 0) - (row.canEdit ? 1 : 0)
                              ),
                          }
                        : canvas
                ),
            }));
        } catch (error) {
            await showAlert({
                title: "No se pudo eliminar",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    const handleDeleteChannel = async (channel) => {
        const firstConfirm = await confirmDialog({
            title: `¿Eliminar “${channel.name}”?`,
            message:
                "Esta acción es permanente. Se eliminarán sus colaboradores, invitaciones, diseños guardados, archivos subidos y sus URLs de editor/overlay.",
            confirmLabel: "Continuar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (!firstConfirm) return;

        const requiredText = `${channel.name} BORRAR`;
        const typed = await confirmTextDialog({
            title: "Confirmación de seguridad",
            message:
                "Para evitar eliminaciones accidentales, confirma escribiendo el nombre del lienzo seguido de BORRAR.",
            requiredText,
            inputLabel: "Nombre del lienzo + BORRAR",
            confirmLabel: "Eliminar definitivamente",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (typed !== requiredText) return;

        try {
            await deleteChannel(channel.uuid, typed);
            setCollaboratorsByCanvas((current) => {
                const next = { ...current };
                delete next[channel.uuid];
                return next;
            });
            const [next, featuredResult] = await Promise.all([
                load({ force: true }),
                getFeaturedChannel({ force: true }),
            ]);
            setFeatured(featuredResult.channel || null);
            const remaining = next.ownedChannels || (next.owned ? [next.owned] : []);
            const nextSelected = remaining[0] || null;
            setExpandedUuid(nextSelected?.uuid ?? null);
            if (nextSelected) ensureCollaborators(nextSelected.uuid, { force: true }).catch(() => {});
            await showAlert({
                title: "Lienzo eliminado",
                message: `“${channel.name}” se eliminó permanentemente.`,
                tone: "success",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo eliminar el lienzo",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1440px] py-8 pt-1 text-[13px]">
          <DashboardSummary user={user} channels={ownedChannels} used={used} limit={limit}  />
            <div className="dc-home-main-grid items-start max-[980px]:grid-cols-1">
                <div className="mt-3 max-[980px]:hidden">
                    <div className="">
                        <FeaturedStreamer channel={featured} />
                    </div>
                </div>

                <div className="mt-3">
                    <section className="dc-home-canvases-panel">
                        <div className="dc-home-canvases-head">
                            <button
                                type="button"
                                className="dc-home-new-canvas"
                                onClick={() => setCreating((value) => !value)}
                                disabled={atLimit}
                            >
                                <Plus size={15} /> Nuevo
                            </button>
                            <div>
                              <h2 className="font-['Bebas_Neue'] text-[clamp(3.5rem,6vw,5rem)] font-normal uppercase leading-[0.82] tracking-[-0.02em] text-right">
                                  TUS <span className="text-[var(--dc-accent)]">LIENZOS</span>
                              </h2>
                            </div>
                        </div>
                        <div className="dc-home-canvases-foot">
                            <span>
                                {used} de {limit} usados
                            </span>
                            <span>
                                {Math.max(0, limit - used)} disponible{Math.max(0, limit - used) === 1 ? "" : "s"}
                            </span>
                        </div>

                        <div className="dc-home-canvas-search">
                            <Search size={15} />
                            <input
                                value={canvasQuery}
                                onChange={(event) => setCanvasQuery(event.target.value)}
                                placeholder="Buscar lienzo, canal o plataforma..."
                            />
                            {canvasQuery && (
                                <button type="button" onClick={() => setCanvasQuery("")} title="Limpiar búsqueda">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="dc-home-canvas-stack">
                            {loading ? <div className="dc-home-canvas-placeholder">Cargando tus lienzos...</div> : null}
                            {!loading && ownedChannels.length === 0 ? (
                                <button
                                    type="button"
                                    className="dc-home-canvas-empty"
                                    onClick={() => setCreating(true)}
                                    disabled={atLimit}
                                >
                                    <Plus size={22} />
                                    <strong>Crea tu primer lienzo</strong>
                                    <span>Obtendrás un editor y un overlay para OBS.</span>
                                </button>
                            ) : null}
                            {!loading && ownedChannels.length > 0 && filteredOwnedChannels.length === 0 ? (
                                <div className="dc-home-canvas-placeholder">
                                    No encontramos lienzos con “{canvasQuery}”.
                                </div>
                            ) : null}
                            {filteredOwnedChannels.map((channel) => (
                                <CanvasSummaryCard
                                    key={channel.uuid}
                                    channel={channel}
                                    selected={expandedUuid === channel.uuid}
                                    onClick={() => selectCanvas(channel)}
                                />
                            ))}
                        </div>

                    </section>
                </div>
            </div>

            {creating && !atLimit && (
                <section className="dc-new-canvas-card dc-home-new-canvas-form">
                    <div>
                        <span className="dc-kicker">NUEVO LIENZO</span>
                        <h2>Prepara otro espacio</h2>
                        <p>
                            El nombre es obligatorio. El link del canal es opcional; si lo agregas, podrá aparecer en
                            Streamer del día.
                        </p>
                    </div>
                    <label>
                        <span>Nombre</span>
                        <input
                            className="w-full border border-[var(--dc-line)] bg-[var(--dc-input-bg)] text-[var(--dc-text-strong)]"
                            value={newCanvas.name}
                            onChange={(event) => setNewCanvas((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Ej. Stream principal"
                            maxLength={120}
                        />
                    </label>
                    <label>
                        <span>Link del canal · opcional</span>
                        <div className="dc-input-with-icon">
                            <Link2 size={15} />
                            <input
                                className="w-full border border-[var(--dc-line)] bg-[var(--dc-input-bg)] text-[var(--dc-text-strong)]"
                                value={newCanvas.channelUrl}
                                onChange={(event) =>
                                    setNewCanvas((current) => ({ ...current, channelUrl: event.target.value }))
                                }
                                placeholder="https://twitch.tv/tu_canal"
                            />
                        </div>
                    </label>
                    <div className="dc-new-canvas-actions">
                        <button type="button" className="secondary" onClick={() => setCreating(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!newCanvas.name.trim() || creatingCanvas}
                        >
                            {creatingCanvas ? "Creando..." : "Crear lienzo"}
                        </button>
                    </div>
                </section>
            )}

            {atLimit && (
                <div className="my-3 border border-[var(--dc-warning-border)] bg-[var(--dc-warning-bg-soft)] px-[13px] py-[11px] text-[13px] text-[var(--dc-warning)]">
                    Llegaste al límite de {limit} lienzo{limit === 1 ? "" : "s"} de tu plan. Puedes seguir administrando
                    los que ya tienes.
                </div>
            )}
             {!loading && ownedChannels.length > 0 && !atLimit ? (
              <div className="dc-home-main-grid items-start max-[980px]:grid-cols-1 my-[-20px] p-0">
                <div className="mt-3 max-[980px]:hidden">
                    <div className=""></div>
                </div>

                <div className="relative bg-[var(--dc-panel)] h-5 my-[-8px]">
                    <ArrowDown
                        size={28}
                        strokeWidth={1.35}
                        className="absolute left-1/2 top-[-11px] -translate-x-1/2 text-[var(--dc-accent)]"
                    />
                </div>
              </div>
            ) : null}

          <div className="mt-3"></div>

            {selectedChannel && (
                <CanvasDetails
                    channel={selectedChannel}
                    collaborators={collaboratorsByCanvas[selectedChannel.uuid]}
                    loadingCollaborators={Boolean(collabLoading[selectedChannel.uuid])}
                    inviteState={inviteState(selectedChannel.uuid)}
                    onInviteChange={(next) => setInviteState(selectedChannel.uuid, next)}
                    onInvite={() => handleInvite(selectedChannel.uuid)}
                    onToggleCollaborator={(row) => handleToggleCollaborator(selectedChannel.uuid, row)}
                    onRemoveCollaborator={(row) => handleRemoveCollaborator(selectedChannel.uuid, row)}
                    onDeleteChannel={() => handleDeleteChannel(selectedChannel)}
                />
            )}

            

        </div>
    );
}
