import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Check,
    Clock3,
    Copy,
    ExternalLink,
    FileStack,
    LogOut,
    Mail,
    MonitorPlay,
    PenTool,
    Search,
    Star,
    Users,
    X,
    XCircle,
} from "lucide-react";
import {
    acceptPendingInvitation,
    getChannels,
    getPendingInvitations,
    leaveChannel,
    notifyInvitationsChanged,
    rejectPendingInvitation,
    setChannelFavorite,
} from "../api/channels";
import { useSystemAlert } from "../components/ui/SystemAlert";
import { PresenceStack } from "../components/ui/PresenceAvatar";

function channelStatus(channel) {
    const runtime = channel.runtime || {};
    if (runtime.overlayHidden) return { label: "Overlay apagado", tone: "danger" };
    if (runtime.liveEnabled === false)
        return { label: runtime.hasDraftChanges ? "Estudio · cambios" : "Estudio", tone: "studio" };
    if ((runtime.overlayCount || 0) > 0) return { label: "Live", tone: "live" };
    if ((runtime.editorCount || 0) > 0) return { label: "Editando", tone: "editing" };
    return { label: "Listo", tone: "idle" };
}

function CopyObsButton({ publicKey }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/overlay/${publicKey}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };
    return (
        <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-[7px] border border-[var(--dc-line)] bg-[var(--dc-surface-2)] px-[11px] text-[13px] font-bold leading-none text-[var(--dc-text)] transition hover:border-[var(--dc-accent)] hover:bg-[var(--dc-accent-soft)]"
            onClick={copy}
        >
            <Copy size={15} /> {copied ? "Copiado" : "Copiar OBS"}
        </button>
    );
}

function InvitationAvatar({ inviter }) {
    const label = inviter?.displayName || inviter?.username || "Usuario";
    if (inviter?.avatarUrl)
        return (
            <img
                src={inviter.avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] object-cover"
            />
        );
    const initials = String(inviter?.username || inviter?.displayName || "U")
        .replace(/^@/, "")
        .slice(0, 2)
        .toUpperCase();
    return (
        <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--dc-line)] bg-[var(--dc-panel)] text-[12px] font-black text-[var(--dc-text-strong)]"
            title={label}
        >
            {initials}
        </div>
    );
}


function lastUsedLabel(value) {
    if (!value) return "Nunca usado";
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "Nunca usado";
    const diffMinutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (diffMinutes < 1) return "Usado ahora";
    if (diffMinutes < 60) return `Usado hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Usado hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Usado hace ${diffDays} d`;
    return `Usado ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(time))}`;
}

function expiresLabel(value) {
    const expires = new Date(value).getTime();
    const hours = Math.max(0, Math.ceil((expires - Date.now()) / 3600000));
    if (hours < 24) return `Expira en ${hours} h`;
    return `Expira en ${Math.ceil(hours / 24)} días`;
}

export default function EditorHub() {
    const { showAlert, confirmDialog } = useSystemAlert();
    const [data, setData] = useState({ ownedChannels: [], collaborations: [] });
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyInvitationUuid, setBusyInvitationUuid] = useState(null);
    const [favoriteBusyUuids, setFavoriteBusyUuids] = useState(() => new Set());
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [sortBy, setSortBy] = useState("recent");

    useEffect(() => {
        let active = true;
        Promise.all([getChannels(), getPendingInvitations()])
            .then(([nextChannels, pending]) => {
                if (!active) return;
                setData(nextChannels);
                setInvitations(pending?.invitations || []);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const ownedChannels = useMemo(
        () => data.ownedChannels || (data.owned ? [data.owned] : []),
        [data.ownedChannels, data.owned]
    );
    const channels = useMemo(
        () => [
            ...ownedChannels.map((channel) => ({ ...channel, relation: "TU LIENZO", owned: true })),
            ...(data.collaborations || []).map((channel) => ({
                ...channel,
                relation: channel.collaboration?.canEdit === false ? "COLABORADOR SUSPENDIDO" : "COLABORADOR",
                owned: false,
            })),
        ],
        [ownedChannels, data.collaborations]
    );
    const tabs = useMemo(() => [
        { id: "all", label: "Todos", count: channels.length },
        { id: "favorites", label: "Favoritos", count: channels.filter((channel) => channel.isFavorite).length },
        { id: "owned", label: "Tus lienzos", count: ownedChannels.length },
        { id: "guest", label: "Invitado", count: (data.collaborations || []).length },
    ], [channels, ownedChannels.length, data.collaborations]);

    const filtered = useMemo(() => {
        const value = query.trim().toLowerCase();
        let next = channels.filter((channel) => {
            if (activeTab === "favorites" && !channel.isFavorite) return false;
            if (activeTab === "owned" && !channel.owned) return false;
            if (activeTab === "guest" && channel.owned) return false;
            if (!value) return true;
            return [channel.name, channel.platform, channel.channelUrl, channel.relation].some((field) =>
                String(field || "")
                    .toLowerCase()
                    .includes(value)
            );
        });

        next = [...next].sort((a, b) => {
            if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
            const aUsed = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
            const bUsed = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
            if (aUsed !== bUsed) return bUsed - aUsed;
            return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
        });
        return next;
    }, [channels, query, activeTab, sortBy]);

    const gridColumns = filtered.length === 1 ? "grid-cols-1" : filtered.length % 2 === 0 ? "grid-cols-2" : "grid-cols-3";

    const emptyBox =
        "grid justify-items-center gap-2.5 bg-[var(--dc-panel)] p-[18px] text-center shadow-[0_8px_24px_var(--dc-shadow-soft)]";

    const refreshChannels = async () => {
        const next = await getChannels({ force: true });
        setData(next);
    };

    const updateFavoriteState = (channelUuid, isFavorite) => {
        const updateChannel = (channel) => channel.uuid === channelUuid ? { ...channel, isFavorite } : channel;
        setData((current) => ({
            ...current,
            owned: current.owned ? updateChannel(current.owned) : current.owned,
            ownedChannels: (current.ownedChannels || []).map(updateChannel),
            collaborations: (current.collaborations || []).map(updateChannel),
        }));
    };

    const handleFavorite = async (channel) => {
        if (favoriteBusyUuids.has(channel.uuid)) return;
        const nextFavorite = !channel.isFavorite;
        updateFavoriteState(channel.uuid, nextFavorite);
        setFavoriteBusyUuids((current) => new Set(current).add(channel.uuid));
        try {
            await setChannelFavorite(channel.uuid, nextFavorite);
        } catch (error) {
            updateFavoriteState(channel.uuid, !nextFavorite);
            await showAlert({
                title: "No se pudo actualizar el favorito",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setFavoriteBusyUuids((current) => {
                const next = new Set(current);
                next.delete(channel.uuid);
                return next;
            });
        }
    };

    const handleAcceptInvitation = async (invitation) => {
        setBusyInvitationUuid(invitation.uuid);
        try {
            const result = await acceptPendingInvitation(invitation.uuid);
            setInvitations((current) => current.filter((item) => item.uuid !== invitation.uuid));
            await refreshChannels();
            notifyInvitationsChanged();
            await showAlert({
                title: result.status === "already_member" ? "Ya estás dentro" : "Invitación aceptada",
                message: result.message || `Ya formas parte de “${invitation.channel?.name || "este lienzo"}”.`,
                tone: "success",
            });
        } catch (error) {
            if ([409, 410].includes(error.response?.status)) {
                setInvitations((current) => current.filter((item) => item.uuid !== invitation.uuid));
                notifyInvitationsChanged();
            }
            await showAlert({
                title: "No se pudo aceptar la invitación",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setBusyInvitationUuid(null);
        }
    };

    const handleRejectInvitation = async (invitation) => {
        const accepted = await confirmDialog({
            title: "¿Rechazar invitación?",
            message: `No entrarás al lienzo “${invitation.channel?.name || "sin nombre"}”. Si cambias de opinión, el propietario tendrá que invitarte nuevamente.`,
            confirmLabel: "Rechazar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (!accepted) return;

        setBusyInvitationUuid(invitation.uuid);
        try {
            const result = await rejectPendingInvitation(invitation.uuid);
            setInvitations((current) => current.filter((item) => item.uuid !== invitation.uuid));
            notifyInvitationsChanged();
            await showAlert({
                title: "Invitación rechazada",
                message: result.message || "La invitación fue rechazada.",
                tone: "info",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo rechazar la invitación",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setBusyInvitationUuid(null);
        }
    };

    const handleLeave = async (channel) => {
        const accepted = await confirmDialog({
            title: `¿Abandonar “${channel.name}”?`,
            message:
                "Dejarás de tener acceso a este lienzo. Para volver, el propietario tendrá que invitarte nuevamente.",
            confirmLabel: "Abandonar lienzo",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (!accepted) return;
        try {
            await leaveChannel(channel.uuid);
            setData((current) => ({
                ...current,
                collaborations: (current.collaborations || []).filter((item) => item.uuid !== channel.uuid),
            }));
            await showAlert({
                title: "Lienzo abandonado",
                message: `Ya no colaboras en “${channel.name}”.`,
                tone: "success",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo abandonar el lienzo",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1440px] py-8 pt-7 text-[13px]">
            <div className="mb-4 md:flex items-end justify-between gap-6 max-[760px]:items-start">
                <div>
                    {/* <span className="dc-kicker">EDITORES</span> */}
                    <h1 className="dc-page-title">
                        ERES <span className="dc-page-title-accent">EDITOR</span>
                    </h1>
                    {/* <p className="m-0 text-[13px] text-[var(--dc-text)]">Accede rápido a tus espacios o a los lienzos donde colaboras.</p> */}
                </div>
                <div className="mb-3.5 flex items-center gap-2.5 max-[760px]:mt-3 max-[760px]:w-full max-[760px]:flex-col max-[760px]:items-stretch">
                    <label className="flex min-h-11 items-center gap-2 border border-[var(--dc-line)] bg-[var(--dc-panel)] px-[11px] text-[12px] font-bold text-[var(--dc-muted)]">
                        <span className="shrink-0">ORDENAR POR</span>
                        <select
                            className="min-w-[170px] flex-1 border-0 bg-transparent text-[13px] font-bold text-[var(--dc-text)] outline-none"
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value)}
                        >
                            <option value="recent">Última vez utilizado</option>
                            <option value="name">Nombre (A - Z)</option>
                        </select>
                    </label>
                    <div className="grid min-h-11 min-w-[260px] grid-cols-[18px_minmax(0,1fr)_30px] items-center gap-[9px] border border-[var(--dc-line)] bg-[var(--dc-panel)] px-[11px] pl-[13px] text-[var(--dc-muted)] focus-within:border-[var(--dc-accent)] focus-within:text-[var(--dc-accent)] max-[760px]:min-w-0">
                        <Search size={16} />
                        <input
                            className="h-[42px] w-full border-0 bg-transparent text-[13px] font-medium text-[var(--dc-text)] outline-none"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar lienzo..."
                        />
                        {query && (
                            <button
                                type="button"
                                className="grid h-7 w-7 place-items-center border-0 bg-transparent text-[var(--dc-muted)]"
                                onClick={() => setQuery("")}
                                title="Limpiar búsqueda"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-[var(--dc-line)]" role="tablist" aria-label="Filtrar lienzos">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`relative inline-flex min-h-10 items-center gap-2 px-3.5 text-[13px] font-bold transition ${activeTab === tab.id ? "text-[var(--dc-text-strong)]" : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]"}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                        <span className="text-[11px] font-black opacity-60">{tab.count}</span>
                        {activeTab === tab.id && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[var(--dc-accent)]" />}
                    </button>
                ))}
            </div>

            {invitations.length > 0 && (
                <section className="mb-5">
                    <div className="mb-2.5 flex items-center gap-2">
                        <Mail size={17} className="text-[var(--dc-accent)]" />
                        <span className="dc-kicker">INVITACIONES PENDIENTES</span>
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--dc-danger-strong)] px-1.5 text-[10px] font-black text-[var(--dc-text-strong)]">
                            {invitations.length}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 max-[760px]:grid-cols-1">
                        {invitations.map((invitation) => {
                            const inviterName =
                                invitation.inviter?.displayName || invitation.inviter?.username || "Un usuario";
                            return (
                                <article
                                    key={invitation.uuid}
                                    className="grid min-w-0 gap-[13px] border border-[var(--dc-accent-soft)] bg-[var(--dc-panel)] p-[15px] shadow-[0_8px_24px_var(--dc-shadow-soft)]"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="dc-kicker">TE INVITARON</span>
                                        <span className="text-[12px] font-bold text-[var(--dc-warning)]">
                                            {expiresLabel(invitation.expiresAt)}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="mb-1 mt-0 truncate text-[19px]">
                                            {invitation.channel?.name || "Lienzo"}
                                        </h2>
                                        <p className="m-0 truncate text-[13px] text-[var(--dc-muted)]">
                                            {invitation.channel?.platform
                                                ? invitation.channel.platform.toUpperCase()
                                                : "SIN CANAL VINCULADO"}{" "}
                                            · INVITACIÓN PENDIENTE
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <InvitationAvatar inviter={invitation.inviter} />
                                        <div className="min-w-0">
                                            <strong className="block truncate text-[13px]">{inviterName}</strong>
                                            <span className="block truncate text-[12px] text-[var(--dc-muted)]">
                                                @{invitation.inviter?.username || "usuario"} te invitó a colaborar
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-[7px] max-[520px]:flex-col max-[520px]:items-stretch">
                                        <button
                                            type="button"
                                            disabled={busyInvitationUuid === invitation.uuid}
                                            className="inline-flex min-h-9 flex-1 items-center justify-center gap-[7px] border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-[11px] text-[13px] font-bold text-[var(--dc-button-primary-text)] transition hover:brightness-110 disabled:opacity-50"
                                            onClick={() => handleAcceptInvitation(invitation)}
                                        >
                                            <Check size={16} /> Aceptar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyInvitationUuid === invitation.uuid}
                                            className="inline-flex min-h-9 items-center justify-center gap-[7px] border border-[var(--dc-button-danger-border)] bg-[var(--dc-button-danger-bg)] px-[11px] text-[13px] font-bold text-[var(--dc-button-danger-text)] transition hover:brightness-110 disabled:opacity-50"
                                            onClick={() => handleRejectInvitation(invitation)}
                                        >
                                            <XCircle size={16} /> Rechazar
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            

            {loading ? (
                <section className="bg-[var(--dc-panel)] p-[18px] shadow-[0_8px_24px_var(--dc-shadow-soft)]">
                    <p>Cargando tus lienzos...</p>
                </section>
            ) : null}
            {!loading && channels.length === 0 && invitations.length === 0 ? (
                <section className={emptyBox}>
                    <PenTool size={28} className="text-[var(--dc-accent)]" />
                    <h2>Todavía no tienes lienzos</h2>
                    <p className="text-[var(--dc-muted)]">
                        Crea uno desde Inicio o espera una invitación para comenzar.
                    </p>
                    <Link
                        className="inline-flex min-h-10 items-center justify-center gap-[7px] border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 text-[11px] font-extrabold text-[var(--dc-button-primary-text)]"
                        to="/app"
                    >
                        Ir a mis lienzos
                    </Link>
                </section>
            ) : null}
            {!loading && channels.length > 0 && filtered.length === 0 ? (
                <section className={emptyBox}>
                    {activeTab === "favorites" ? <Star size={26} className="text-[#f3c94d]" /> : <Search size={26} className="text-[var(--dc-accent)]" />}
                    <h2>{activeTab === "favorites" && !query ? "Todavía no tienes favoritos" : "Sin resultados"}</h2>
                    <p className="text-[var(--dc-muted)]">
                        {query
                            ? `No encontramos ningún lienzo con “${query}”.`
                            : activeTab === "favorites"
                              ? "Marca una estrella en cualquier lienzo para tenerlo a mano aquí."
                              : activeTab === "owned"
                                ? "No tienes lienzos propios en esta vista."
                                : "No tienes lienzos invitados en esta vista."}
                    </p>
                </section>
            ) : null}

            <div className={`grid ${gridColumns} gap-2.5 max-[760px]:grid-cols-1`}>
                {filtered.map((channel) => {
                    const status =
                        !channel.owned && channel.collaboration?.canEdit === false
                            ? { label: "Suspendido", tone: "studio" }
                            : channelStatus(channel);
                    return (
                        <article
                            className="grid min-w-0 gap-[13px] bg-[var(--dc-panel)] p-[15px] shadow-[0_8px_24px_var(--dc-shadow-soft)] transition hover:-translate-y-px hover:bg-[var(--dc-surface-hover)]"
                            key={`${channel.relation}-${channel.uuid}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="dc-kicker">{channel.relation}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className={`grid h-8 w-8 place-items-center border transition ${channel.isFavorite ? "border-[#c99b24] bg-[rgba(243,201,77,0.12)] text-[#f3c94d]" : "border-[var(--dc-line)] bg-[var(--dc-surface-2)] text-[var(--dc-muted)] hover:border-[#c99b24] hover:text-[#f3c94d]"}`}
                                        onClick={() => handleFavorite(channel)}
                                        disabled={favoriteBusyUuids.has(channel.uuid)}
                                        title={channel.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                                        aria-label={channel.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                                        aria-pressed={Boolean(channel.isFavorite)}
                                    >
                                        <Star size={15} fill={channel.isFavorite ? "currentColor" : "none"} />
                                    </button>
                                    <span className={`dc-home-canvas-status ${status.tone}`}>
                                        <i />
                                        {status.label}
                                    </span>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h2 className="mb-1 mt-0 truncate text-[19px]">{channel.name}</h2>
                                <p className="m-0 flex items-center gap-1.5 truncate text-[13px] text-[var(--dc-muted)]">
                                    <Clock3 size={13} className="shrink-0" /> {lastUsedLabel(channel.lastUsedAt)}
                                </p>
                            </div>
                            <div className="flex min-h-7 flex-wrap items-center gap-x-3.5 gap-y-2 text-[var(--dc-muted)] [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[5px] [&>span]:text-[13px] [&>span]:font-bold">
                                <span>
                                    <Users size={14} />{" "}
                                    {channel.activeCollaboratorCount ?? channel.collaboratorCount ?? 0} equipo
                                </span>
                                <span>
                                    <FileStack size={14} /> {channel.savedDesignCount || 0} diseños
                                </span>
                                {(channel.runtime?.editorUsers || []).length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <PresenceStack editors={channel.runtime.editorUsers} max={4} />
                                        <span className="text-[12px] font-bold text-[var(--dc-muted)]">{channel.runtime.editorUsers.length} dentro</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-[7px] pt-0.5 max-[680px]:flex-col max-[680px]:items-stretch">
                                {channel.owned || channel.collaboration?.canEdit !== false ? (
                                    <Link
                                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-[7px] border border-[var(--dc-accent)] bg-[var(--dc-accent)] px-[11px] text-[13px] font-bold leading-none text-[var(--dc-text-strong)]"
                                        to={`/app/editor/${channel.publicKey}`}
                                    >
                                        <MonitorPlay size={16} /> Abrir editor <ExternalLink size={14} />
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-[7px] border border-[var(--dc-line)] bg-[var(--dc-surface-2)] px-[11px] text-[13px] font-bold text-[var(--dc-muted)] opacity-60"
                                        disabled
                                    >
                                        <MonitorPlay size={16} /> Acceso suspendido
                                    </button>
                                )}
                                {channel.owned && <CopyObsButton publicKey={channel.publicKey} />}
                                {!channel.owned && (
                                    <button
                                        type="button"
                                        className="inline-flex min-h-9 items-center justify-center gap-[7px] border border-[var(--dc-button-danger-border)] bg-[var(--dc-button-danger-bg)] px-[11px] text-[13px] font-bold text-[var(--dc-button-danger-text)] hover:brightness-110"
                                        onClick={() => handleLeave(channel)}
                                    >
                                        <LogOut size={15} /> Abandonar
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
