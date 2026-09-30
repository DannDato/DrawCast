import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ExpandableCanvasCard from "../components/channels/ExpandableCanvasCard";
import {
    Check,
    Mail,
    PenTool,
    Search,
    Star,
    X,
    XCircle,
} from "lucide-react";
import {
    acceptPendingInvitation,
    deleteChannel,
    getChannels,
    getCollaborators,
    getPendingInvitations,
    inviteCollaborator,
    leaveChannel,
    notifyInvitationsChanged,
    rejectPendingInvitation,
    removeCollaborator,
    setChannelFavorite,
    setCollaboratorAccess,
    updateChannel,
} from "../api/channels";
import { useSystemAlert } from "../components/ui/SystemAlert";

function channelStatus(channel) {
    const runtime = channel.runtime || {};
    if (runtime.overlayHidden) return { label: "Overlay apagado", tone: "danger" };
    if (runtime.liveEnabled === false)
        return { label: runtime.hasDraftChanges ? "Estudio · cambios" : "Estudio", tone: "studio" };
    if ((runtime.overlayCount || 0) > 0) return { label: "Live", tone: "live" };
    if ((runtime.editorCount || 0) > 0) return { label: "Editando", tone: "editing" };
    return { label: "Listo", tone: "idle" };
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
    const { showAlert, confirmDialog, confirmTextDialog } = useSystemAlert();
    const [data, setData] = useState({ ownedChannels: [], collaborations: [] });
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyInvitationUuid, setBusyInvitationUuid] = useState(null);
    const [favoriteBusyUuids, setFavoriteBusyUuids] = useState(() => new Set());
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [sortBy, setSortBy] = useState("recent");
    const [expandedUuid, setExpandedUuid] = useState(null);
    const [collaborators, setCollaborators] = useState({});
    const [loadingCollaborators, setLoadingCollaborators] = useState({});
    const [savingUuid, setSavingUuid] = useState(null);

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

    const ensureCollaborators = async (channelUuid, { force = false } = {}) => {
        if (!force && collaborators[channelUuid]) return collaborators[channelUuid];

        setLoadingCollaborators((current) => ({ ...current, [channelUuid]: true }));
        try {
            const rows = await getCollaborators(channelUuid, { force });
            setCollaborators((current) => ({ ...current, [channelUuid]: rows }));
            return rows;
        } finally {
            setLoadingCollaborators((current) => ({ ...current, [channelUuid]: false }));
        }
    };

    const toggleChannel = (channel) => {
        if (!channel.owned) return;
        if (expandedUuid === channel.uuid) {
            setExpandedUuid(null);
            return;
        }
        setExpandedUuid(channel.uuid);
        ensureCollaborators(channel.uuid).catch(() => {});
    };

    const saveChannel = async (channel, payload) => {
        setSavingUuid(channel.uuid);
        try {
            const result = await updateChannel(channel.uuid, payload);
            const updated = result?.channel || { ...channel, ...payload };
            setData((current) => ({
                ...current,
                owned: current.owned?.uuid === channel.uuid ? { ...current.owned, ...updated } : current.owned,
                ownedChannels: (current.ownedChannels || []).map((item) => item.uuid === channel.uuid ? { ...item, ...updated } : item),
            }));
            await showAlert({ title: "Lienzo actualizado", message: "Los cambios se guardaron correctamente.", tone: "success" });
        } catch (error) {
            await showAlert({ title: "No se pudo guardar", message: error.response?.data?.message || "Inténtalo nuevamente.", tone: "danger" });
        } finally {
            setSavingUuid(null);
        }
    };

    const inviteToChannel = async (channel, email) => {
        try {
            await inviteCollaborator(channel.uuid, email);
            await showAlert({ title: "Invitación enviada", message: `Enviamos la invitación a ${email}.`, tone: "success" });
        } catch (error) {
            await showAlert({ title: "No se pudo invitar", message: error.response?.data?.message || "Inténtalo nuevamente.", tone: "danger" });
            throw error;
        }
    };

    const toggleCollaborator = async (channel, row) => {
        const nextCanEdit = !row.canEdit;
        if (!nextCanEdit) {
            const accepted = await confirmDialog({
                title: `¿Suspender a ${row.user?.username ? `@${row.user.username}` : row.user?.email || "este usuario"}?`,
                message: "Conservará su registro, pero no podrá editar el lienzo hasta que lo reactives.",
                confirmLabel: "Suspender",
                cancelLabel: "Cancelar",
                tone: "danger",
            });
            if (!accepted) return;
        }

        try {
            await setCollaboratorAccess(channel.uuid, row.user?.uuid, nextCanEdit);
            setCollaborators((current) => ({
                ...current,
                [channel.uuid]: (current[channel.uuid] || []).map((item) => item.user?.uuid === row.user?.uuid ? { ...item, canEdit: nextCanEdit } : item),
            }));
        } catch (error) {
            await showAlert({ title: "No se pudo cambiar el acceso", message: error.response?.data?.message || "Inténtalo nuevamente.", tone: "danger" });
        }
    };

    const removeChannelCollaborator = async (channel, row) => {
        const accepted = await confirmDialog({
            title: "¿Quitar colaborador?",
            message: "Perderá el acceso a este lienzo.",
            confirmLabel: "Quitar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (!accepted) return;

        try {
            await removeCollaborator(channel.uuid, row.user?.uuid);
            setCollaborators((current) => ({
                ...current,
                [channel.uuid]: (current[channel.uuid] || []).filter((item) => item.user?.uuid !== row.user?.uuid),
            }));
        } catch (error) {
            await showAlert({ title: "No se pudo quitar", message: error.response?.data?.message || "Inténtalo nuevamente.", tone: "danger" });
        }
    };

    const deleteOwnedChannel = async (channel) => {
        const accepted = await confirmDialog({
            title: `¿Eliminar “${channel.name}”?`,
            message: "Esta acción elimina permanentemente el lienzo, colaboradores, diseños y archivos asociados.",
            confirmLabel: "Continuar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (!accepted) return;

        const requiredText = `${channel.name} BORRAR`;
        const typed = await confirmTextDialog({
            title: "Confirmación final",
            message: "Escribe el nombre del lienzo seguido de BORRAR.",
            requiredText,
            inputLabel: "Nombre del lienzo + BORRAR",
            confirmLabel: "Eliminar definitivamente",
            cancelLabel: "Cancelar",
            tone: "danger",
        });
        if (typed !== requiredText) return;

        try {
            await deleteChannel(channel.uuid, typed);
            await refreshChannels();
            setExpandedUuid(null);
            await showAlert({ title: "Lienzo eliminado", message: `“${channel.name}” se eliminó permanentemente.`, tone: "success" });
        } catch (error) {
            await showAlert({ title: "No se pudo eliminar", message: error.response?.data?.message || "Inténtalo nuevamente.", tone: "danger" });
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
        <div className="dc-app-page text-[13px]">
            <div className="mb-4">
                {/* <span className="dc-kicker">EDITORES</span> */}
                <h1 className="dc-page-title">LOS LIENZOS</h1>
                {/* <p className="m-0 text-[13px] text-[var(--dc-text)]">Accede rápido a tus espacios o a los lienzos donde colaboras.</p> */}
            </div>

            <div className="dc-editorhub-toolbar mb-5 border-b border-[var(--dc-line)]">
                <div className="dc-editorhub-tabs dc-section-tabs" role="tablist" aria-label="Filtrar lienzos">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`dc-section-tab${activeTab === tab.id ? " is-active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                            <span>{tab.count}</span>
                        </button>
                    ))}
                </div>

                <div className="dc-editorhub-filters">
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
                    <div className="grid min-h-11 min-w-[260px] grid-cols-[18px_minmax(0,1fr)_30px] items-center gap-[9px] border border-[var(--dc-line)] bg-[var(--dc-panel)] px-[11px] pl-[13px] text-[var(--dc-muted)] focus-within:border-[var(--dc-accent-titles)] focus-within:text-[var(--dc-accent-titles)] max-[760px]:min-w-0">
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

            {invitations.length > 0 && (
                <section className="mb-5">
                    <div className="mb-2.5 flex items-center gap-2">
                        <Mail size={17} className="text-[var(--dc-accent-four)]" />
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
                                    className="grid min-w-0 gap-[13px] border border-[var(--dc-accent-three)]/40 bg-[var(--dc-panel)] p-[15px] shadow-[0_8px_24px_var(--dc-shadow-soft)]"
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
                    <PenTool size={28} className="text-[var(--dc-accent-four)]" />
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
                    {activeTab === "favorites" ? <Star size={26} className="text-[#f3c94d]" /> : <Search size={26} className="text-[var(--dc-accent-three)]" />}
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

            <div className="dc-home2-canvas-list">
                {filtered.map((channel) => {
                    const status =
                        !channel.owned && channel.collaboration?.canEdit === false
                            ? { label: "Suspendido", tone: "studio" }
                            : channelStatus(channel);

                    return (
                        <ExpandableCanvasCard
                            key={`${channel.relation}-${channel.uuid}`}
                            channel={channel}
                            expanded={channel.owned && expandedUuid === channel.uuid}
                            collaborators={collaborators[channel.uuid] || []}
                            loadingCollaborators={Boolean(loadingCollaborators[channel.uuid])}
                            busy={savingUuid === channel.uuid}
                            onToggle={toggleChannel}
                            onSave={saveChannel}
                            onInvite={inviteToChannel}
                            onToggleCollaborator={toggleCollaborator}
                            onRemoveCollaborator={removeChannelCollaborator}
                            onDelete={deleteOwnedChannel}
                            onLeave={handleLeave}
                            onFavorite={handleFavorite}
                            favoriteBusy={favoriteBusyUuids.has(channel.uuid)}
                            status={status}
                            lastUsedText={lastUsedLabel(channel.lastUsedAt)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
