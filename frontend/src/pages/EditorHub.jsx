import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    Check,
    Copy,
    ExternalLink,
    FileStack,
    LogOut,
    Mail,
    MonitorPlay,
    PenTool,
    Search,
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
    const [busyInvitationId, setBusyInvitationId] = useState(null);
    const [query, setQuery] = useState("");

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
    const filtered = useMemo(() => {
        const value = query.trim().toLowerCase();
        if (!value) return channels;
        return channels.filter((channel) =>
            [channel.name, channel.platform, channel.channelUrl, channel.relation].some((field) =>
                String(field || "")
                    .toLowerCase()
                    .includes(value)
            )
        );
    }, [channels, query]);

    const emptyBox =
        "grid justify-items-center gap-2.5 bg-[var(--dc-panel)] p-[18px] text-center shadow-[0_8px_24px_var(--dc-shadow-soft)]";

    const refreshChannels = async () => {
        const next = await getChannels({ force: true });
        setData(next);
    };

    const handleAcceptInvitation = async (invitation) => {
        setBusyInvitationId(invitation.id);
        try {
            const result = await acceptPendingInvitation(invitation.id);
            setInvitations((current) => current.filter((item) => item.id !== invitation.id));
            await refreshChannels();
            notifyInvitationsChanged();
            await showAlert({
                title: result.status === "already_member" ? "Ya estás dentro" : "Invitación aceptada",
                message: result.message || `Ya formas parte de “${invitation.channel?.name || "este lienzo"}”.`,
                tone: "success",
            });
        } catch (error) {
            if ([409, 410].includes(error.response?.status)) {
                setInvitations((current) => current.filter((item) => item.id !== invitation.id));
                notifyInvitationsChanged();
            }
            await showAlert({
                title: "No se pudo aceptar la invitación",
                message: error.response?.data?.message || "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setBusyInvitationId(null);
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

        setBusyInvitationId(invitation.id);
        try {
            const result = await rejectPendingInvitation(invitation.id);
            setInvitations((current) => current.filter((item) => item.id !== invitation.id));
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
            setBusyInvitationId(null);
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
            await leaveChannel(channel.id);
            setData((current) => ({
                ...current,
                collaborations: (current.collaborations || []).filter((item) => item.id !== channel.id),
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
                    <h1 className="font-['Bebas_Neue'] font-normal uppercase text-[3rem] md:text-[5rem] leading-[5rem]">
                        ERES <span className="text-[var(--dc-accent)]">EDITOR</span>
                    </h1>
                    {/* <p className="m-0 text-[13px] text-[var(--dc-text)]">Accede rápido a tus espacios o a los lienzos donde colaboras.</p> */}
                </div>
                <div className="mb-3.5 grid min-h-11 grid-cols-[18px_minmax(0,1fr)_30px] items-center gap-[9px] border border-[var(--dc-line)] bg-[var(--dc-panel)] px-[11px] pl-[13px] text-[var(--dc-muted)] focus-within:border-[var(--dc-accent)] focus-within:text-[var(--dc-accent)]">
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

            {invitations.length > 0 && (
                <section className="mb-5">
                    <div className="mb-2.5 flex items-center gap-2">
                        <Mail size={17} className="text-[var(--dc-accent)]" />
                        <span className="dc-kicker">INVITACIONES PENDIENTES</span>
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--dc-danger-strong)] px-1.5 text-[10px] font-black text-[var(--dc-text-strong)]">
                            {invitations.length}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
                        {invitations.map((invitation) => {
                            const inviterName =
                                invitation.inviter?.displayName || invitation.inviter?.username || "Un usuario";
                            return (
                                <article
                                    key={invitation.id}
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
                                            disabled={busyInvitationId === invitation.id}
                                            className="inline-flex min-h-9 flex-1 items-center justify-center gap-[7px] border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-[11px] text-[13px] font-bold text-[var(--dc-button-primary-text)] transition hover:brightness-110 disabled:opacity-50"
                                            onClick={() => handleAcceptInvitation(invitation)}
                                        >
                                            <Check size={16} /> Aceptar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyInvitationId === invitation.id}
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
                    <Search size={26} className="text-[var(--dc-accent)]" />
                    <h2>Sin resultados</h2>
                    <p className="text-[var(--dc-muted)]">No encontramos ningún lienzo con “{query}”.</p>
                </section>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
                {filtered.map((channel) => {
                    const status =
                        !channel.owned && channel.collaboration?.canEdit === false
                            ? { label: "Suspendido", tone: "studio" }
                            : channelStatus(channel);
                    return (
                        <article
                            className="grid min-w-0 gap-[13px] bg-[var(--dc-panel)] p-[15px] shadow-[0_8px_24px_var(--dc-shadow-soft)] transition hover:-translate-y-px hover:bg-[var(--dc-surface-hover)]"
                            key={`${channel.relation}-${channel.id}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="dc-kicker">{channel.relation}</span>
                                <span className={`dc-home-canvas-status ${status.tone}`}>
                                    <i />
                                    {status.label}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <h2 className="mb-1 mt-0 truncate text-[19px]">{channel.name}</h2>
                                <p className="m-0 truncate text-[13px] text-[var(--dc-muted)]">
                                    {channel.platform ? channel.platform.toUpperCase() : "SIN CANAL VINCULADO"} · LIENZO
                                    1920×1080
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
                                {(channel.runtime?.editorCount || 0) > 0 && (
                                    <span>
                                        <Activity size={14} /> {channel.runtime.editorCount} conectados
                                    </span>
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
