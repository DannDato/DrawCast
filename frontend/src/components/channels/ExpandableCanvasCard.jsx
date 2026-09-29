import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    ChevronDown,
    ChevronRight,
    Copy,
    ExternalLink,
    FileStack,
    MonitorPlay,
    Save,
    Trash2,
    UserMinus,
    UserPlus,
    Users,
} from "lucide-react";

function channelHandle(channelUrl) {
    if (!channelUrl) return null;
    try {
        const url = new URL(channelUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        if (!parts[0]) return url.hostname.replace(/^www\./, "");
        if (url.hostname.includes("youtube.com") && ["channel", "c", "user"].includes(parts[0])) return parts[1] || parts[0];
        return parts[0].replace(/^@/, "");
    } catch {
        return null;
    }
}

function collaboratorName(row) {
    const user = row?.user || {};
    return user.username ? `@${user.username}` : user.displayName || user.email || "Usuario";
}

function initials(user) {
    const source = String(user?.username || user?.displayName || user?.email || "U").replace(/^@/, "").trim();
    if (!source) return "U";
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function CopyButton({ value, children }) {
    const [copied, setCopied] = useState(false);
    const copy = async (event) => {
        event.stopPropagation();
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };
    return <button type="button" className="dc-home2-action" onClick={copy}><Copy size={15} /> {copied ? "Copiado" : children}</button>;
}

export default function ExpandableCanvasCard({
    channel,
    expanded,
    collaborators = [],
    loadingCollaborators = false,
    busy = false,
    onToggle,
    onSave,
    onInvite,
    onToggleCollaborator,
    onRemoveCollaborator,
    onDelete,
}) {
    const [draft, setDraft] = useState({ name: channel.name || "", channelUrl: channel.channelUrl || "" });
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteBusy, setInviteBusy] = useState(false);
    const editorPath = `/app/editor/${channel.publicKey}`;
    const overlayUrl = `${window.location.origin}/overlay/${channel.publicKey}`;
    const handle = channelHandle(channel.channelUrl);


    const save = async () => {
        if (!draft.name.trim() || busy) return;
        await onSave?.(channel, { name: draft.name.trim(), channelUrl: draft.channelUrl.trim() });
    };

    const invite = async () => {
        if (!inviteEmail.trim() || inviteBusy) return;
        setInviteBusy(true);
        try {
            await onInvite?.(channel, inviteEmail.trim());
            setInviteEmail("");
        } finally {
            setInviteBusy(false);
        }
    };

    return (
        <article className={`dc-home2-canvas ${expanded ? "is-open" : ""}`}>
            <div className="dc-home2-canvas-summary">
                <button type="button" className="dc-home2-canvas-toggle" onClick={() => onToggle?.(channel)} aria-expanded={expanded}>
                    <div className="dc-home2-canvas-identity">
                        <span className="dc-home2-canvas-kicker">{channel.owned === false ? "LIENZO COMPARTIDO" : "TU LIENZO"}</span>
                        <strong>{channel.name}</strong>
                        <span>{channel.channelUrl ? `${channel.platform?.toUpperCase() || "CANAL"}${handle ? ` · @${handle}` : ""}` : "Sin canal vinculado"}</span>
                    </div>
                    <div className="dc-home2-canvas-stats" aria-label="Resumen del lienzo">
                        <span><Users size={15} /> {channel.collaboratorCount ?? 0}</span>
                        <span><FileStack size={15} /> {channel.savedDesignCount ?? 0}</span>
                        {(channel.runtime?.editorCount || 0) > 0 && <span><Activity size={15} /> {channel.runtime.editorCount}</span>}
                    </div>
                    {expanded ? <ChevronDown size={21} /> : <ChevronRight size={21} />}
                </button>

                <div className="dc-home2-canvas-shortcuts">
                    <Link className="dc-home2-action primary" to={editorPath} onClick={(event) => event.stopPropagation()}><MonitorPlay size={15} /> Editor</Link>
                    <CopyButton value={overlayUrl}>OBS</CopyButton>
                </div>
            </div>

            {expanded && (
                <div className="dc-home2-canvas-detail">
                    <div className="dc-home2-edit-grid">
                        <label>
                            <span>Nombre</span>
                            <input value={draft.name} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                        </label>
                        <label>
                            <span>Canal</span>
                            <input value={draft.channelUrl} onChange={(event) => setDraft((current) => ({ ...current, channelUrl: event.target.value }))} placeholder="https://twitch.tv/tu_canal" />
                        </label>
                        <button type="button" className="dc-home2-save" onClick={save} disabled={!draft.name.trim() || busy}><Save size={15} /> Guardar</button>
                    </div>

                    <div className="dc-home2-link-row">
                        <div><span>EDITOR</span><code>{window.location.origin}{editorPath}</code></div>
                        <Link className="dc-home2-icon-button" to={editorPath} title="Abrir editor"><ExternalLink size={16} /></Link>
                        <div><span>OBS</span><code>{overlayUrl}</code></div>
                        <CopyButton value={overlayUrl}>Copiar</CopyButton>
                    </div>

                    <section className="dc-home2-team">
                        <div className="dc-home2-team-head">
                            <div><span className="dc-home2-canvas-kicker">EQUIPO</span><h3>Invitados</h3></div>
                            <div className="dc-home2-invite">
                                <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="correo@ejemplo.com" />
                                <button type="button" onClick={invite} disabled={!inviteEmail.trim() || inviteBusy}><UserPlus size={15} /> {inviteBusy ? "Enviando…" : "Invitar"}</button>
                            </div>
                        </div>

                        {loadingCollaborators ? <div className="dc-home2-empty-row">Cargando colaboradores…</div> : null}
                        {!loadingCollaborators && collaborators.length === 0 ? <div className="dc-home2-empty-row">Todavía no hay colaboradores en este lienzo.</div> : null}
                        <div className="dc-home2-collaborators">
                            {collaborators.map((row) => (
                                <div className="dc-home2-collaborator" key={row.user?.uuid}>
                                    <div className="dc-home2-avatar">{row.user?.avatarUrl ? <img src={row.user.avatarUrl} alt="" /> : initials(row.user)}</div>
                                    <div><strong>{collaboratorName(row)}</strong><span>{row.user?.email || row.user?.displayName || ""}</span></div>
                                    <button type="button" className={row.canEdit ? "active" : ""} onClick={() => onToggleCollaborator?.(channel, row)}>{row.canEdit ? "Activo" : "Suspendido"}</button>
                                    <button type="button" className="danger" onClick={() => onRemoveCollaborator?.(channel, row)} title="Quitar colaborador"><UserMinus size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="dc-home2-danger-zone">
                        <div><strong>Eliminar lienzo</strong><span>Esta acción elimina permanentemente el lienzo y sus recursos.</span></div>
                        <button type="button" onClick={() => onDelete?.(channel)}><Trash2 size={16} /> Eliminar</button>
                    </div>
                </div>
            )}
        </article>
    );
}
