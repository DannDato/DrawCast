import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink, MonitorPlay, Plus, Sparkles } from "lucide-react";

import ExpandableCanvasCard from "../components/channels/ExpandableCanvasCard";

import {
    createChannel,
    deleteChannel,
    getChannels,
    getCollaborators,
    getFeaturedChannel,
    inviteCollaborator,
    removeCollaborator,
    setCollaboratorAccess,
    updateChannel,
} from "../api/channels";

import { getStoreCatalog } from "../api/store";
import { useSystemAlert } from "../components/ui/SystemAlert";

export default function Inicio() {
    const navigate = useNavigate();
    const { showAlert, confirmDialog, confirmTextDialog } = useSystemAlert();

    const [data, setData] = useState({ ownedChannels: [] });
    const [featured, setFeatured] = useState(null);
    const [catalog, setCatalog] = useState({ intelligence: {}, products: [] });
    const [plus, setPlus] = useState(null);

    const [expandedUuid, setExpandedUuid] = useState(null);
    const [collaborators, setCollaborators] = useState({});
    const [loadingCollaborators, setLoadingCollaborators] = useState({});
    const [savingUuid, setSavingUuid] = useState(null);

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [creatingBusy, setCreatingBusy] = useState(false);
    const [newCanvas, setNewCanvas] = useState({
        name: "",
        channelUrl: "",
    });

    const channels = useMemo(
        () => data.ownedChannels || (data.owned ? [data.owned] : []),
        [data],
    );

    useEffect(() => {
        let active = true;

        Promise.all([
            getChannels({ force: true }),
            getFeaturedChannel(),
            getStoreCatalog(),
        ])
            .then(([channelsResult, featuredResult, catalogResult]) => {
                if (!active) return;

                setData(channelsResult || { ownedChannels: [] });
                setFeatured(featuredResult?.channel || null);
                setCatalog(
                    catalogResult || {
                        intelligence: {},
                        products: [],
                    },
                );

                setPlus(
                    (catalogResult?.products || []).find(
                        (product) => product.featured,
                    ) || null,
                );
            })
            .catch(() => {})
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const canvasLimit = Number(data?.limits?.canvases || 1);
    const canvasUsed = Number(data?.limits?.used ?? channels.length);
    const canvasRemaining = Number(
        data?.limits?.remaining ??
            Math.max(0, canvasLimit - canvasUsed),
    );

    const canCreateCanvas =
        channels.length === 0 || canvasRemaining > 0;

    const plusCoverageComplete =
        channels.length > 0 &&
        catalog.intelligence?.plusCoverageComplete === true;

    const expansionProducts = useMemo(
        () =>
            (catalog.products || []).filter(
                (product) => product.kind === "addon",
            ),
        [catalog.products],
    );

    const beginCreate = () => {
        if (!canCreateCanvas) {
            navigate("/app/store?product=account.canvas_slot.1");
            return;
        }

        setCreating((current) => !current);
    };

    const createCanvas = async () => {
        if (!newCanvas.name.trim() || creatingBusy) return;

        setCreatingBusy(true);

        try {
            const created = await createChannel({
                name: newCanvas.name.trim(),
                channelUrl: newCanvas.channelUrl.trim(),
            });

            const next = await getChannels({ force: true });

            setData(next || { ownedChannels: [] });
            setNewCanvas({
                name: "",
                channelUrl: "",
            });
            setCreating(false);
            setExpandedUuid(null);

            if (created?.uuid) {
                setCollaborators((current) => ({
                    ...current,
                    [created.uuid]: [],
                }));
            }

            await showAlert({
                title: "Lienzo creado",
                message: `“${created?.name || "Tu nuevo lienzo"}” ya está listo.`,
                tone: "success",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo crear",
                message:
                    error.response?.data?.message ||
                    "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setCreatingBusy(false);
        }
    };

    const ensureCollaborators = async (
        channelUuid,
        { force = false } = {},
    ) => {
        if (!force && collaborators[channelUuid]) {
            return collaborators[channelUuid];
        }

        setLoadingCollaborators((current) => ({
            ...current,
            [channelUuid]: true,
        }));

        try {
            const rows = await getCollaborators(channelUuid, { force });

            setCollaborators((current) => ({
                ...current,
                [channelUuid]: rows,
            }));

            return rows;
        } finally {
            setLoadingCollaborators((current) => ({
                ...current,
                [channelUuid]: false,
            }));
        }
    };

    const toggle = (channel) => {
        if (expandedUuid === channel.uuid) {
            setExpandedUuid(null);
            return;
        }

        setExpandedUuid(channel.uuid);
        ensureCollaborators(channel.uuid).catch(() => {});
    };

    const save = async (channel, payload) => {
        setSavingUuid(channel.uuid);

        try {
            const result = await updateChannel(channel.uuid, payload);

            const updated =
                result?.channel || {
                    ...channel,
                    ...payload,
                };

            setData((current) => ({
                ...current,
                owned:
                    current.owned?.uuid === channel.uuid
                        ? {
                              ...current.owned,
                              ...updated,
                          }
                        : current.owned,
                ownedChannels: (current.ownedChannels || []).map(
                    (item) =>
                        item.uuid === channel.uuid
                            ? {
                                  ...item,
                                  ...updated,
                              }
                            : item,
                ),
            }));

            await showAlert({
                title: "Lienzo actualizado",
                message: "Los cambios se guardaron correctamente.",
                tone: "success",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo guardar",
                message:
                    error.response?.data?.message ||
                    "Inténtalo nuevamente.",
                tone: "danger",
            });
        } finally {
            setSavingUuid(null);
        }
    };

    const invite = async (channel, email) => {
        try {
            await inviteCollaborator(channel.uuid, email);

            await showAlert({
                title: "Invitación enviada",
                message: `Enviamos la invitación a ${email}.`,
                tone: "success",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo invitar",
                message:
                    error.response?.data?.message ||
                    "Inténtalo nuevamente.",
                tone: "danger",
            });

            throw error;
        }
    };

    const toggleCollaborator = async (channel, row) => {
        const nextCanEdit = !row.canEdit;

        if (!nextCanEdit) {
            const accepted = await confirmDialog({
                title: `¿Suspender a ${
                    row.user?.username
                        ? `@${row.user.username}`
                        : row.user?.email || "este usuario"
                }?`,
                message:
                    "Conservará su registro, pero no podrá editar el lienzo hasta que lo reactives.",
                confirmLabel: "Suspender",
                cancelLabel: "Cancelar",
                tone: "danger",
            });

            if (!accepted) return;
        }

        try {
            await setCollaboratorAccess(
                channel.uuid,
                row.user?.uuid,
                nextCanEdit,
            );

            setCollaborators((current) => ({
                ...current,
                [channel.uuid]: (
                    current[channel.uuid] || []
                ).map((item) =>
                    item.user?.uuid === row.user?.uuid
                        ? {
                              ...item,
                              canEdit: nextCanEdit,
                          }
                        : item,
                ),
            }));
        } catch (error) {
            await showAlert({
                title: "No se pudo cambiar el acceso",
                message:
                    error.response?.data?.message ||
                    "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    const remove = async (channel, row) => {
        const accepted = await confirmDialog({
            title: "¿Quitar colaborador?",
            message: "Perderá el acceso a este lienzo.",
            confirmLabel: "Quitar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });

        if (!accepted) return;

        try {
            await removeCollaborator(
                channel.uuid,
                row.user?.uuid,
            );

            setCollaborators((current) => ({
                ...current,
                [channel.uuid]: (
                    current[channel.uuid] || []
                ).filter(
                    (item) =>
                        item.user?.uuid !== row.user?.uuid,
                ),
            }));
        } catch (error) {
            await showAlert({
                title: "No se pudo quitar",
                message:
                    error.response?.data?.message ||
                    "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    const removeCanvas = async (channel) => {
        const accepted = await confirmDialog({
            title: `¿Eliminar “${channel.name}”?`,
            message:
                "Esta acción elimina permanentemente el lienzo, colaboradores, diseños y archivos asociados.",
            confirmLabel: "Continuar",
            cancelLabel: "Cancelar",
            tone: "danger",
        });

        if (!accepted) return;

        const requiredText = `${channel.name} BORRAR`;

        const typed = await confirmTextDialog({
            title: "Confirmación final",
            message:
                "Escribe el nombre del lienzo seguido de BORRAR.",
            requiredText,
            inputLabel: "Nombre del lienzo + BORRAR",
            confirmLabel: "Eliminar definitivamente",
            cancelLabel: "Cancelar",
            tone: "danger",
        });

        if (typed !== requiredText) return;

        try {
            await deleteChannel(channel.uuid, typed);

            const next = await getChannels({ force: true });

            setData(next);
            setExpandedUuid(null);

            await showAlert({
                title: "Lienzo eliminado",
                message: `“${channel.name}” se eliminó permanentemente.`,
                tone: "success",
            });
        } catch (error) {
            await showAlert({
                title: "No se pudo eliminar",
                message:
                    error.response?.data?.message ||
                    "Inténtalo nuevamente.",
                tone: "danger",
            });
        }
    };

    return (
        <div className="dc-home2-page">
            <header className="dc-home2-header">
                <div />                
            </header>

           

            <section
                className="dc-home2-canvas-list"
                aria-label="Tus lienzos"
            >
                {loading && (
                    <div className="dc-home2-placeholder">
                        Cargando tus lienzos…
                    </div>
                )}

                {!loading &&
                    channels.length === 0 &&
                    (!creating ? (
                        <button
                            type="button"
                            className="dc-home2-first-canvas"
                            onClick={beginCreate}
                            aria-label="Crear tu primer lienzo"
                            style={{
                                position: "relative",
                                width: "100%",
                                minHeight: "138px",
                                display: "flex",
                                alignItems: "center",
                                background: "#000",
                                border: 0,
                                overflow: "hidden",
                                textAlign: "left",
                            }}
                        >
                            <div
                                className="dc-home2-first-canvas-copy"
                                style={{
                                    position: "relative",
                                    zIndex: 2,
                                }}
                            >
                                <strong>
                                    Tu primer lienzo está
                                    incluido.
                                </strong>

                                <span>
                                    Haz click aquí para crear
                                    tu primer lienzo.
                                </span>
                            </div>

                            <div
                                className="dc-home2-first-canvas-mark"
                                aria-hidden="true"
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    transform:
                                        "translate(-50%, -50%)",
                                    display: "grid",
                                    placeItems: "center",
                                    pointerEvents: "none",
                                    color: "#8b9099",
                                }}
                            >
                                <Plus
                                    size={72}
                                    strokeWidth={1.35}
                                />
                            </div>
                        </button>
                    ) : (
                        <div className="dc-home2-first-canvas is-creating">
                            <div className="dc-home2-first-canvas-form">
                                <div className="dc-home2-first-canvas-form-head">
                                    <div>
                                        <strong>
                                            Vamos a crear tu
                                            primer lienzo
                                        </strong>

                                        <span>
                                            Sólo necesitamos un
                                            nombre. El canal lo
                                            puedes agregar ahora
                                            o después.
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        className="dc-home2-first-canvas-close"
                                        onClick={() =>
                                            setCreating(false)
                                        }
                                        disabled={
                                            creatingBusy
                                        }
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="dc-home2-first-canvas-fields">
                                    <label>
                                        <span>Nombre</span>

                                        <input
                                            autoFocus
                                            value={
                                                newCanvas.name
                                            }
                                            onChange={(
                                                event,
                                            ) =>
                                                setNewCanvas(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        name: event
                                                            .target
                                                            .value,
                                                    }),
                                                )
                                            }
                                            placeholder="Mi primer lienzo"
                                            maxLength={120}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            Canal{" "}
                                            <em>
                                                opcional
                                            </em>
                                        </span>

                                        <input
                                            value={
                                                newCanvas.channelUrl
                                            }
                                            onChange={(
                                                event,
                                            ) =>
                                                setNewCanvas(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        channelUrl:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                            }
                                            placeholder="https://twitch.tv/tu_canal"
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        className="dc-home2-first-canvas-submit"
                                        onClick={
                                            createCanvas
                                        }
                                        disabled={
                                            !newCanvas.name.trim() ||
                                            creatingBusy
                                        }
                                    >
                                        <Plus size={16} />

                                        {creatingBusy
                                            ? "Creando…"
                                            : "Crear lienzo"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                {channels.map((channel) => (
                    <ExpandableCanvasCard
                        key={channel.uuid}
                        channel={channel}
                        expanded={
                            expandedUuid === channel.uuid
                        }
                        collaborators={
                            collaborators[channel.uuid] || []
                        }
                        loadingCollaborators={Boolean(
                            loadingCollaborators[
                                channel.uuid
                            ],
                        )}
                        busy={
                            savingUuid === channel.uuid
                        }
                        onToggle={toggle}
                        onSave={save}
                        onInvite={invite}
                        onToggleCollaborator={
                            toggleCollaborator
                        }
                        onRemoveCollaborator={remove}
                        onDelete={removeCanvas}
                    />
                ))}
                 {creating && channels.length > 0 && (
                    <section className="dc-home2-create-panel">
                        <label>
                            <span>Nombre</span>

                            <input
                                value={newCanvas.name}
                                onChange={(event) =>
                                    setNewCanvas((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                                placeholder="Mi nuevo lienzo"
                                maxLength={120}
                            />
                        </label>

                        <label>
                            <span>Canal</span>

                            <input
                                value={newCanvas.channelUrl}
                                onChange={(event) =>
                                    setNewCanvas((current) => ({
                                        ...current,
                                        channelUrl:
                                            event.target.value,
                                    }))
                                }
                                placeholder="https://twitch.tv/tu_canal"
                            />
                        </label>

                        <div>
                            <button
                                type="button"
                                className="secondary"
                                onClick={() =>
                                    setCreating(false)
                                }
                                disabled={creatingBusy}
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={createCanvas}
                                disabled={
                                    !newCanvas.name.trim() ||
                                    creatingBusy
                                }
                            >
                                {creatingBusy
                                    ? "Creando…"
                                    : "Crear lienzo"}
                            </button>
                        </div>
                    </section>
                )}
                <div className="w-full mx-auto mt-0">
                    {channels.length > 0 && (
                        <button
                            type="button"
                            className="flex w-full justify-center py-4 bg-black text-white rounded "
                            onClick={beginCreate}
                        >
                            <Plus size={20} className="mr-2 mt-[02px]" />
                            Nuevo lienzo
                        </button>
                    )}
                </div>
            </section>

            {channels.length > 0 && (
                <>
                    <div className="dc-home2-section-title">
                        <h2>SUGERENCIAS</h2>
                    </div>

                    <section className="dc-home2-suggestions">
                        {!plusCoverageComplete ? (
                            <article className="dc-home2-plus-card">
                                <div>
                                    <span className="dc-home2-canvas-kicker">
                                        <Sparkles
                                            size={14}
                                        />
                                        Esto es para ti!
                                    </span>

                                    <h2>
                                        {plus?.name ||
                                            "Lienzo Plus"}
                                    </h2>

                                    <p>
                                        {plus?.description ||
                                            "Desbloquea las herramientas premium del lienzo y mantenlas disponibles para todos tus colaboradores."}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                "/app/store?product=canvas.plus",
                                            )
                                        }
                                    >
                                        Ver en Tienda
                                        <ArrowRight
                                            size={16}
                                        />
                                    </button>
                                </div>

                                <div className="dc-home2-plus-mark">
                                    <Sparkles size={56} />
                                </div>
                            </article>
                        ) : (
                            <article className="dc-home2-plus-card is-expansions">
                                <div>
                                    <span className="dc-home2-canvas-kicker">
                                        <Plus size={14} />
                                        SIGUE CRECIENDO
                                    </span>

                                    <h2>Expansiones</h2>

                                    <p>
                                        Aumenta los límites de
                                        tus lienzos Plus sin
                                        cambiar de plan.
                                    </p>

                                    <div className="dc-home2-expansion-list">
                                        {expansionProducts
                                            .slice(0, 3)
                                            .map(
                                                (product) => (
                                                    <span
                                                        key={
                                                            product.uuid
                                                        }
                                                    >
                                                        {
                                                            product.name
                                                        }
                                                    </span>
                                                ),
                                            )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                "/app/store?tab=expansions",
                                            )
                                        }
                                    >
                                        Ver expansiones
                                        <ArrowRight
                                            size={16}
                                        />
                                    </button>
                                </div>

                                <div className="dc-home2-plus-mark">
                                    <Plus size={56} />
                                </div>
                            </article>
                        )}

                        <article className="dc-home2-featured-card">
                            <div className="dc-home2-featured-media">
                                <MonitorPlay size={44} />
                            </div>

                            <div>
                                <span className="dc-home2-canvas-kicker">
                                    STREAMER RECOMENDADO
                                </span>

                                <h3>
                                    {featured?.name ||
                                        "Descubre un canal"}
                                </h3>

                                <p>
                                    {featured?.channelUrl
                                        ? "Un canal de la comunidad TRAZIO."
                                        : "Cuando haya un canal destacado aparecerá aquí."}
                                </p>

                                {featured?.channelUrl && (
                                    <a
                                        href={
                                            featured.channelUrl
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Visitar canal
                                        <ExternalLink
                                            size={15}
                                        />
                                    </a>
                                )}
                            </div>
                        </article>
                    </section>
                </>
            )}
        </div>
    );
}