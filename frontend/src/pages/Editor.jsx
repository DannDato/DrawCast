import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Redo2, Undo2 } from 'lucide-react';
import { getSavedDesign, getSavedDesigns } from '../api/designs';
import { getChannelEntitlements, getChannels, markChannelUsed } from '../api/channels';
import { useChannelSocket } from '../hooks/useChannelSocket';
import CanvasStage from '../components/editor/CanvasStage';
import Inspector from '../components/editor/Inspector';
import LayersPanel from '../components/editor/LayersPanel';
import Toolbar from '../components/editor/Toolbar';
import HotkeysModal from '../components/editor/hotkeys/HotkeysModal';
import SavedDesignsModal from '../components/editor/SavedDesignsModal';
import SoundSlotsModal from '../components/editor/sounds/SoundSlotsModal';
import LaunchpadConfigModal from '../components/editor/sounds/LaunchpadConfigModal';
import LaunchpadSurface from '../components/editor/sounds/LaunchpadSurface';
import { useSystemAlert } from '../components/ui/SystemAlert';
import { makeShape, makeText, makeTimer } from '../components/editor/objectFactory';
import { createGroupPatches, duplicateSelection, selectedGroupIds, ungroupPatches } from '../components/editor/groups/groupUtils';
import { moveSelectionOneLevel, reorderLayerUnitToIndex } from '../components/editor/layers/layerUtils';
import { applyTextStyle, updateTextContent } from '../components/editor/tools/text/textTool';
import { adjustTimerSeconds, applyTimerConfig, toggleTimer } from '../components/editor/tools/timer/timerTool';
import { appendStrokeToLayer, clearDrawLayer, DRAW_LAYER_MAX_BYTES, isDrawLayer, makeDrawLayer, pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';
import { applyHistoryEntry, cloneValue, makeDrawStrokeHistoryEntry, makeHistoryEntry, pushHistoryEntry } from '../components/editor/history/historyUtils';
import { createClipboardPayload, materializeClipboardPayload, serializeClipboardPayload } from '../components/editor/clipboard/clipboardUtils';
import { getCursorThemeColor } from '../utils/theme';
import { GRAPHICS_FRAME_MS } from '../utils/frameRate';
import useEditorPreferences from '../components/editor/preferences/useEditorPreferences';
import useEditorSounds from '../components/editor/sounds/useEditorSounds';
import useEditorGuides from '../components/editor/guides/useEditorGuides';
import GuidesModal from '../components/editor/guides/GuidesModal';
import useEditorHotkeys from '../components/editor/hotkeys/useEditorHotkeys';
import useEditorMedia from '../components/editor/tools/images/useEditorMedia';
import { decodeDesignSnapshot, ensureSceneDrawLayer } from '../components/editor/scene/sceneUtils';
import { TOOL_LABELS } from '../components/editor/hotkeys/shortcuts';
import { DEFAULT_LINE_CONFIG } from '../components/editor/tools/lines/lineTool';
import { EMPTY_CHANNEL_ENTITLEMENTS, FEATURE_LABELS, TOOL_FEATURE, entitlementLimit, featureEnabled, normalizeChannelEntitlements, objectFeature } from '../components/editor/entitlements/editorEntitlements';

export default function Editor() {
  const { publicKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirmDialog, showAlert } = useSystemAlert();
  const {
    userSettings, drawConfig, setDrawConfig, shapeConfig, setShapeConfig, imageConfig, setImageConfig,
    textConfig, setTextConfig, timerConfig, setTimerConfig
  } = useEditorPreferences();
  const [channelUuid, setChannelUuid] = useState(null);
  const [entitlements, setEntitlements] = useState(EMPTY_CHANNEL_ENTITLEMENTS);
  const [objects, setObjects] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const [lineConfig, setLineConfig] = useState(DEFAULT_LINE_CONFIG);
  const [imagePickerRequest, setImagePickerRequest] = useState(0);
  const [activeDrawLayerId, setActiveDrawLayerId] = useState(null);
  const [liveStrokes, setLiveStrokes] = useState({});
  const [history, setHistory] = useState({ past: [], future: [] });
  const [clipboardPayload, setClipboardPayload] = useState(null);
  const [pasteSerial, setPasteSerial] = useState(1);
  const [mediaStatus, setMediaStatus] = useState('');
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const workspaceMode = searchParams.get('view') === 'launchpad' ? 'launchpad' : 'canvas';
  const [designsOpen, setDesignsOpen] = useState(false);
  const [designsIntent, setDesignsIntent] = useState('load');
  const [recentDesigns, setRecentDesigns] = useState([]);
  const [snapEnabled, setSnapEnabled] = useState(() => {
    try { return localStorage.getItem('TRAZIO.editor.snap') !== 'off'; } catch { return true; }
  });
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [controlBusy, setControlBusy] = useState('');
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesAnchor, setPropertiesAnchor] = useState(null);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [fitViewRequest, setFitViewRequest] = useState(0);
  const [editorAccess, setEditorAccess] = useState({ canEdit: true, liveEnabled: true, liveRequired: false, editorCount: 1, isStudioEditor: false });
  const objectsRef = useRef({});
  const historyStartRef = useRef(null);
  const nudgeActiveRef = useRef(false);
  const propertiesRequestRef = useRef(0);
  const cursorFrameRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const cursorLastSentRef = useRef(0);
  const drawPointFrameRef = useRef(null);
  const pendingDrawPointRef = useRef(null);
  const drawPointLastSentRef = useRef(0);
  const transformFrameRef = useRef(null);
  const transformLatestRef = useRef(new Map());
  const transformLastSentRef = useRef(0);
  const inboundStrokeFrameRef = useRef(null);
  const inboundStrokeQueueRef = useRef([]);
  const inboundStrokeLastAppliedRef = useRef(0);
  const inboundCursorFrameRef = useRef(null);
  const inboundCursorQueueRef = useRef(new Map());
  const inboundCursorLastAppliedRef = useRef(0);
  const pendingDrawFallbackSelectionRef = useRef(false);

  const setScene = (next) => {
    objectsRef.current = next;
    setObjects(next);
  };

  const updateScene = (updater) => {
    const next = typeof updater === 'function' ? updater(objectsRef.current) : updater;
    setScene(next);
    return next;
  };

  const handlers = useMemo(() => ({
    'sync-state': ({ objects: list } = {}) => {
      if (!Array.isArray(list)) return;
      const rawScene = Object.fromEntries(list.filter((object) => object?.id).map((object) => [object.id, object]));
      const ensured = ensureSceneDrawLayer(rawScene);
      objectsRef.current = ensured.scene;
      setObjects(ensured.scene);
      pendingDrawFallbackSelectionRef.current = false;
      setActiveDrawLayerId((current) => current && isDrawLayer(ensured.scene[current]) ? current : ensured.drawLayer.id);
      setSelectedIds((current) => {
        const valid = current.filter((id) => ensured.scene[id]);
        const next = valid.length ? valid : [ensured.drawLayer.id];
        setSelectedId((primary) => primary && next.includes(primary) ? primary : next.at(-1) || null);
        return next;
      });
      setHistory({ past: [], future: [] });
      historyStartRef.current = null;
      setFitViewRequest((current) => current + 1);
    },
    'obj-upsert': (object) => {
      if (historyStartRef.current) historyStartRef.current.before[object.id] = object;
      const next = { ...objectsRef.current, [object.id]: object };
      objectsRef.current = next;
      setObjects(next);
      if (pendingDrawFallbackSelectionRef.current && isDrawLayer(object)) {
        pendingDrawFallbackSelectionRef.current = false;
        setActiveDrawLayerId(object.id);
        setSelectedIds([object.id]);
        setSelectedId(object.id);
      }
    },
    'obj-transform': ({ updates = [] } = {}) => {
      if (!Array.isArray(updates) || !updates.length) return;
      const next = { ...objectsRef.current };
      let changed = false;
      updates.forEach(({ id, patch: patchData }) => {
        if (!id || !next[id] || !patchData || typeof patchData !== 'object') return;
        const object = { ...next[id], ...patchData };
        if (historyStartRef.current) historyStartRef.current.before[id] = object;
        next[id] = object;
        changed = true;
      });
      if (!changed) return;
      objectsRef.current = next;
      setObjects(next);
    },
    'obj-remove': ({ id }) => {
      if (historyStartRef.current) delete historyStartRef.current.before[id];
      const next = { ...objectsRef.current };
      delete next[id];
      objectsRef.current = next;
      setObjects(next);
      const remainingDrawLayer = Object.values(next)
        .filter(isDrawLayer)
        .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0] || null;
      if (!remainingDrawLayer) pendingDrawFallbackSelectionRef.current = true;
      setActiveDrawLayerId((current) => current === id ? remainingDrawLayer?.id || null : current);
      setSelectedIds((current) => {
        if (!current.includes(id)) return current;

        const selected = current.filter((item) => item !== id);
        if (selected.length) {
          setSelectedId((primary) => primary === id ? selected.at(-1) || null : primary);
          return selected;
        }

        const fallback = Object.values(next)
          .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))
          .find((object) => !object.hidden) || Object.values(next)[0];
        setSelectedId(fallback?.id || null);
        return fallback?.id ? [fallback.id] : [];
      });
    },
    'draw-live': (payload) => {
      inboundStrokeQueueRef.current.push(payload);
      if (inboundStrokeFrameRef.current != null) return;
      const flush = (timestamp) => {
        if (timestamp - inboundStrokeLastAppliedRef.current < GRAPHICS_FRAME_MS) {
          inboundStrokeFrameRef.current = requestAnimationFrame(flush);
          return;
        }
        inboundStrokeFrameRef.current = null;
        inboundStrokeLastAppliedRef.current = timestamp;
        const queue = inboundStrokeQueueRef.current.splice(0);
        if (!queue.length) return;
        setLiveStrokes((current) => queue.reduce((next, event) => reduceLiveStrokeMap(next, event), current));
      };
      inboundStrokeFrameRef.current = requestAnimationFrame(flush);
    },
    'draw-commit': ({ layerId, stroke } = {}) => {
      if (!layerId || !stroke?.id) return;
      inboundStrokeQueueRef.current = inboundStrokeQueueRef.current.filter((event) => event?.strokeId !== stroke.id);
      setLiveStrokes((current) => reduceLiveStrokeMap(current, { phase: 'end', strokeId: stroke.id }));
      const layer = objectsRef.current[layerId];
      if (!layer || !isDrawLayer(layer) || (layer.lineas || []).some((item) => item?.id === stroke.id)) return;
      const nextLayer = appendStrokeToLayer(layer, stroke);
      if (historyStartRef.current) historyStartRef.current.before[layerId] = nextLayer;
      const next = { ...objectsRef.current, [layerId]: nextLayer };
      objectsRef.current = next;
      setObjects(next);
    },
    'draw-remove': ({ layerId, strokeId } = {}) => {
      if (!layerId || !strokeId) return;
      inboundStrokeQueueRef.current = inboundStrokeQueueRef.current.filter((event) => event?.strokeId !== strokeId);
      setLiveStrokes((current) => reduceLiveStrokeMap(current, { phase: 'end', strokeId }));
      const layer = objectsRef.current[layerId];
      if (!layer || !isDrawLayer(layer) || !(layer.lineas || []).some((item) => item?.id === strokeId)) return;
      const nextLayer = { ...layer, lineas: (layer.lineas || []).filter((item) => item?.id !== strokeId) };
      if (historyStartRef.current) historyStartRef.current.before[layerId] = nextLayer;
      const next = { ...objectsRef.current, [layerId]: nextLayer };
      objectsRef.current = next;
      setObjects(next);
    },
    'cursor-move': (payload) => {
      if (!payload?.socketId || !Number.isFinite(Number(payload.x)) || !Number.isFinite(Number(payload.y))) return;
      inboundCursorQueueRef.current.set(payload.socketId, { ...payload, x: Number(payload.x), y: Number(payload.y) });
      if (inboundCursorFrameRef.current != null) return;
      const flush = (timestamp) => {
        if (timestamp - inboundCursorLastAppliedRef.current < GRAPHICS_FRAME_MS) {
          inboundCursorFrameRef.current = requestAnimationFrame(flush);
          return;
        }
        inboundCursorFrameRef.current = null;
        inboundCursorLastAppliedRef.current = timestamp;
        const updates = Array.from(inboundCursorQueueRef.current.entries());
        inboundCursorQueueRef.current.clear();
        if (!updates.length) return;
        setRemoteCursors((current) => {
          const next = { ...current };
          updates.forEach(([socketId, cursor]) => { next[socketId] = cursor; });
          return next;
        });
      };
      inboundCursorFrameRef.current = requestAnimationFrame(flush);
    },
    'cursor-leave': ({ socketId } = {}) => {
      if (!socketId) return;
      inboundCursorQueueRef.current.delete(socketId);
      setRemoteCursors((current) => {
        if (!current[socketId]) return current;
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    },
    'editor-access': (access = {}) => setEditorAccess((current) => ({ ...current, ...access })),
    'editor-locked': (access = {}) => {
      setEditorAccess((current) => ({ ...current, ...access, canEdit: false }));
      setMediaStatus('Esperando Live: otro editor está preparando cambios en modo Estudio.');
    },
    'studio-waiting': ({ message } = {}) => {
      void showAlert({
        title: 'Editor en modo Estudio',
        message: message || 'Hay un editor preparando cambios. Podrás editar cuando publique y active Live.'
      });
    },
    'studio-collaborator-waiting': ({ editor } = {}) => {
      void showAlert({
        title: 'Entró otro editor',
        message: `${editor?.username ? `@${editor.username}` : 'Un colaborador'} acaba de entrar. Para trabajar juntos, publica tus cambios y activa Live.`
      });
    },
    'studio-forced-live': ({ message } = {}) => {
      void showAlert({
        title: 'TRAZIO volvió a Live',
        message: message || 'El editor que controlaba el modo Estudio se desconectó. El workspace fue publicado para desbloquear al equipo.'
      });
    },
    'channel-entitlements': (value = {}) => setEntitlements(normalizeChannelEntitlements(value)),
    'feature-denied': ({ message, feature } = {}) => {
      const label = FEATURE_LABELS[feature] || 'Esta función';
      setMediaStatus(message || `${label} está bloqueado en este lienzo.`);
      void showAlert({
        title: `${label} · Lienzo Plus`,
        message: message || 'Esta función no está incluida en este lienzo. Lienzo Plus desbloquea las herramientas premium para todos sus colaboradores.'
      });
    },
    'channel-control': ({ liveEnabled: nextLive, overlayHidden: nextHidden, hasDraftChanges: nextDraft } = {}) => {
      if (typeof nextLive === 'boolean') setLiveEnabled(nextLive);
      if (typeof nextHidden === 'boolean') setOverlayHidden(nextHidden);
      if (typeof nextDraft === 'boolean') setHasDraftChanges(nextDraft);
    },
    'clear-all': () => {
      if (historyStartRef.current) historyStartRef.current.before = {};
      objectsRef.current = {};
      setObjects({});
      setSelectedIds([]);
      setSelectedId(null);
      setActiveDrawLayerId(null);
      pendingDrawFallbackSelectionRef.current = true;
      setLiveStrokes({});
    }
  }), [showAlert]);

  const { socket, presence, connected, denied } = useChannelSocket(publicKey, 'editor', handlers);
  const entitlementsReady = entitlements.loaded === true;
  const canFeature = (feature) => featureEnabled(entitlements, feature);
  const layerLimit = entitlementLimit(entitlements, 'limit.layers');
  const designSlotLimit = entitlementLimit(entitlements, 'limit.design_slots');
  const guideSlotLimit = entitlementLimit(entitlements, 'limit.guide_slots');
  const quickSoundSlotLimit = entitlementLimit(entitlements, 'limit.quick_sound_slots');
  const customSoundLimit = entitlementLimit(entitlements, 'limit.custom_sound_slots');
  const launchpadPadLimit = entitlementLimit(entitlements, 'limit.launchpad_pads');

  const showLockedFeature = (feature, fallbackLabel = 'Función') => {
    if (!entitlementsReady) { setMediaStatus('Cargando permisos del lienzo...'); return; }
    const label = FEATURE_LABELS[feature] || fallbackLabel;
    setMediaStatus(`${label} requiere una mejora para este lienzo.`);
    void showAlert({
      title: `${label} · Lienzo Plus`,
      message: 'Esta función está bloqueada en este lienzo. Lienzo Plus desbloquea todas las herramientas premium para el propietario y todos los colaboradores.'
    });
  };

  const requireFrontendFeature = (feature, label, { silent = false } = {}) => {
    if (!entitlementsReady) {
      if (!silent) setMediaStatus('Cargando permisos del lienzo...');
      return false;
    }
    if (canFeature(feature)) return true;
    if (!silent) showLockedFeature(feature, label);
    return false;
  };

  const canMutateObject = (object, options = {}) => {
    const feature = objectFeature(object);
    return !feature || requireFrontendFeature(feature, FEATURE_LABELS[feature], options);
  };

  const { guide, setGuide, guides, guideImageUrl, guidesOpen, setGuidesOpen, refreshGuides, saveGuide, deleteGuide } = useEditorGuides({ channelUuid, publicKey, socket, objectsRef, setMediaStatus, enabled: canFeature('editor.guides'), slotLimit: guideSlotLimit });

  const editingLocked = editorAccess.canEdit === false;
  const liveRequired = Boolean(editorAccess.liveRequired);
  const studioEditor = !liveEnabled ? (presence.editorList || []).find((editor) => editor.canEdit) : null;
  const remoteCursorList = useMemo(() => Object.values(remoteCursors).map((cursor) => {
    const editor = (presence.editorList || []).find((item) => item.socketId === cursor.socketId);
    const username = String(editor?.username || '').trim();
    return {
      ...cursor,
      color: getCursorThemeColor(editor?.colorSlot),
      cursorLabel: username ? `@${username}` : 'Editor'
    };
  }), [remoteCursors, presence.editorList]);

  const applyControlState = (control = {}) => {
    if (typeof control.liveEnabled === 'boolean') setLiveEnabled(control.liveEnabled);
    if (typeof control.overlayHidden === 'boolean') setOverlayHidden(control.overlayHidden);
    if (typeof control.hasDraftChanges === 'boolean') setHasDraftChanges(control.hasDraftChanges);
  };

  const emitChannelAction = (event, payload = {}) => new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('TRAZIO perdió conexión con el canal.'));
      return;
    }
    socket.timeout(6000).emit(event, payload, (error, response) => {
      if (error) {
        reject(new Error('El canal no confirmó la acción. Vuelve a intentarlo.'));
        return;
      }
      if (!response?.ok) {
        const actionError = new Error(response?.message || 'El canal rechazó la acción.');
        actionError.code = response?.code; actionError.feature = response?.feature; actionError.limitKey = response?.limitKey; actionError.limit = response?.limit;
        reject(actionError);
        return;
      }
      applyControlState(response.control);
      resolve(response);
    });
  });

  const {
    soundsOpen, setSoundsOpen, launchpadConfigOpen, setLaunchpadConfigOpen,
    soundLibrary, customSoundLibrary, soundSlots, launchpadSlots, allSounds, soundSlotItems,
    soundPlayback, soundMonitorEnabled, setSoundMonitorEnabled, playSound,
    openSoundAssignments, saveSoundAssignments, openLaunchpadAssignments, saveLaunchpadAssignments,
    refreshSoundLibrary, uploadOwnSound, deleteOwnSound, resolveSoundUrl
  } = useEditorSounds({
    userSettings, channelUuid, publicKey, connected, overlayHidden, presence, emitChannelAction, setMediaStatus,
    quickSoundsEnabled: canFeature('editor.quick_sounds'),
    customSoundsEnabled: canFeature('editor.custom_sounds'),
    launchpadEnabled: canFeature('editor.launchpad'),
    quickSoundSlotLimit, customSoundLimit, launchpadPadLimit
  });

  const broadcastCursor = (point) => {
    if (editingLocked || !socket.connected || !point) return;
    pendingCursorRef.current = point;
    if (cursorFrameRef.current != null) return;

    const flush = (timestamp) => {
      if (timestamp - cursorLastSentRef.current < GRAPHICS_FRAME_MS) {
        cursorFrameRef.current = requestAnimationFrame(flush);
        return;
      }
      cursorFrameRef.current = null;
      const next = pendingCursorRef.current;
      pendingCursorRef.current = null;
      if (!next || editingLocked || !socket.connected) return;
      cursorLastSentRef.current = timestamp;
      socket.volatile.compress(false).emit('cursor-move', { x: next.x, y: next.y });
    };

    cursorFrameRef.current = requestAnimationFrame(flush);
  };

  const broadcastCursorLeave = () => {
    pendingCursorRef.current = null;
    if (cursorFrameRef.current != null) {
      cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }
    if (socket.connected) socket.volatile.compress(false).emit('cursor-leave');
  };

  useEffect(() => () => {
    if (cursorFrameRef.current != null) cancelAnimationFrame(cursorFrameRef.current);
    if (drawPointFrameRef.current != null) cancelAnimationFrame(drawPointFrameRef.current);
    if (transformFrameRef.current != null) cancelAnimationFrame(transformFrameRef.current);
    if (inboundStrokeFrameRef.current != null) cancelAnimationFrame(inboundStrokeFrameRef.current);
    if (inboundCursorFrameRef.current != null) cancelAnimationFrame(inboundCursorFrameRef.current);
    cursorFrameRef.current = null;
    drawPointFrameRef.current = null;
    transformFrameRef.current = null;
    inboundStrokeFrameRef.current = null;
    inboundCursorFrameRef.current = null;
    pendingCursorRef.current = null;
    pendingDrawPointRef.current = null;
    inboundStrokeQueueRef.current = [];
    inboundCursorQueueRef.current.clear();
    transformLatestRef.current.clear();
  }, []);

  const toggleLiveMode = async () => {
    if (!requireFrontendFeature('editor.live_studio', 'Live / Estudio')) return;
    if (controlBusy || !connected || editingLocked) return;
    const nextLive = !liveEnabled;
    if (!nextLive && liveRequired) {
      setMediaStatus('Live es obligatorio mientras haya otro colaborador conectado.');
      return;
    }

    if (nextLive && hasDraftChanges) {
      const accepted = await confirmDialog({
        title: '¿Volver a Live?',
        message: 'Lo que tienes preparado se publicará de inmediato y, desde ahí, cada cambio volverá a salir en tiempo real.',
        confirmLabel: 'Publicar y activar Live',
        cancelLabel: 'Seguir en Estudio'
      });
      if (!accepted) return;
    }

    setControlBusy('live');
    try {
      await emitChannelAction('live-mode-set', { enabled: nextLive });
      setMediaStatus(nextLive ? 'Modo Live activado. El workspace actual ya está al aire.' : 'Modo Estudio activado. Prepara cambios y publícalos cuando estén listos.');
    } catch (error) {
      setMediaStatus(error.message || 'No se pudo cambiar el modo de salida.');
    } finally {
      setControlBusy('');
    }
  };

  const publishScene = async () => {
    if (!requireFrontendFeature('editor.live_studio', 'Live / Estudio')) return;
    if (controlBusy || !connected || editingLocked || liveEnabled || !hasDraftChanges) return;
    setControlBusy('publish');
    try {
      await emitChannelAction('publish-scene');
      setMediaStatus(overlayHidden ? 'Cambios publicados. El overlay sigue apagado hasta que el propietario lo encienda.' : 'Cambios publicados en el overlay.');
    } catch (error) {
      setMediaStatus(error.message || 'No se pudieron publicar los cambios.');
    } finally {
      setControlBusy('');
    }
  };

  const togglePanic = async () => {
    if (!isOwner || controlBusy || !connected) return;
    const nextHidden = !overlayHidden;
    setControlBusy('panic');
    try {
      await emitChannelAction('panic-set', { hidden: nextHidden });
      setMediaStatus(nextHidden ? 'Overlay apagado. El workspace sigue intacto.' : 'Overlay encendido.');
    } catch (error) {
      setMediaStatus(error.message || 'No se pudo cambiar la visibilidad del overlay.');
    } finally {
      setControlBusy('');
    }
  };

  const handleToggleWorkspaceMode = () => {
    if (effectiveWorkspaceMode === 'canvas' && !requireFrontendFeature('editor.launchpad', 'Launchpad')) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('view', effectiveWorkspaceMode === 'canvas' ? 'launchpad' : 'canvas');
      return next;
    }, { replace: true });
  };

  const refreshRecentDesigns = async () => {
    if (!canFeature('editor.designs')) { setRecentDesigns([]); return []; }
    if (!channelUuid) {
      setRecentDesigns([]);
      return [];
    }
    try {
      const rows = await getSavedDesigns(channelUuid);
      const ordered = [...rows].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      setRecentDesigns(ordered);
      return ordered;
    } catch {
      return [];
    }
  };

  const openDesigns = (intent = 'load') => {
    if (!requireFrontendFeature('editor.designs', 'Diseños')) return;
    setDesignsIntent(intent);
    setDesignsOpen(true);
  };

  const beginHistory = (label = 'Editar') => {
    if (historyStartRef.current) return;
    historyStartRef.current = { label, before: { ...objectsRef.current } };
  };

  const commitHistory = (label = null) => {
    const started = historyStartRef.current;
    historyStartRef.current = null;
    if (!started) return null;
    const entry = makeHistoryEntry(started.before, objectsRef.current, label || started.label);
    if (!entry) return null;
    setHistory((current) => ({ past: pushHistoryEntry(current.past, entry), future: [] }));
    return entry;
  };

  const cancelHistory = () => { historyStartRef.current = null; };

  const setSelection = (ids = [], primaryId = null) => {
    const scene = objectsRef.current;
    const unique = [...new Set(ids)].filter((id) => scene[id]);
    const primary = primaryId && unique.includes(primaryId) ? primaryId : unique.at(-1) || null;
    setSelectedIds(unique);
    setSelectedId(primary);
  };

  const fallbackSelectionId = (scene = objectsRef.current, preferredIds = []) => {
    const preferred = preferredIds.find((id) => scene[id]);
    if (preferred) return preferred;

    const ordered = Object.values(scene).sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));
    return ordered.find((object) => !object.hidden)?.id || ordered[0]?.id || null;
  };

  const openPropertiesAt = ({ clientX, clientY, hasSelectionTarget = false } = {}) => {
    if (hasSelectionTarget) setTool('select');
    const hasAnchor = Number.isFinite(clientX) && Number.isFinite(clientY);
    if (hasAnchor) {
      propertiesRequestRef.current += 1;
      setPropertiesAnchor({ clientX, clientY, requestId: propertiesRequestRef.current });
    } else {
      setPropertiesAnchor(null);
    }
    setPropertiesOpen(true);
  };

  const toggleProperties = () => {
    if (propertiesOpen) {
      setPropertiesOpen(false);
      return;
    }
    setPropertiesAnchor(null);
    setPropertiesOpen(true);
  };

  const openInsertProperties = ({ id, clientX, clientY } = {}) => {
    if (!['text', 'shape', 'timer'].includes(id)) return;
    openPropertiesAt({ clientX, clientY });
  };

  const select = (id, options = {}) => {
    const { append = false } = options;
    const scene = objectsRef.current;
    if (id && isDrawLayer(scene[id])) setActiveDrawLayerId(id);
    if (!id) {
      if (!append) setSelection([]);
      return;
    }

    if (!append) {
      setSelection([id], id);
      return;
    }

    const next = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    setSelection(next, next.includes(id) ? id : next.at(-1) || null);
  };

  const upsert = (object) => {
    if (editingLocked || !object?.id || !canMutateObject(object)) return;
    updateScene((current) => ({ ...current, [object.id]: object }));
    socket.emit('obj-upsert', object);
  };

  const applyUpdates = (updates = []) => {
    if (editingLocked) return;
    const scene = objectsRef.current;
    const valid = updates.filter(({ id }) => scene[id] && canMutateObject(scene[id], { silent: true }));
    if (!valid.length) return;

    const nextObjects = valid.map(({ id, patch }) => ({ ...scene[id], ...patch }));
    updateScene((current) => {
      const next = { ...current };
      nextObjects.forEach((object) => { next[object.id] = object; });
      return next;
    });
    nextObjects.forEach((object) => socket.emit('obj-upsert', object));
  };

  const applyTransformLocally = (updates = []) => {
    if (!updates.length) return;
    updateScene((current) => {
      let next = current;
      updates.forEach(({ id, patch: patchData }) => {
        if (!current[id]) return;
        if (next === current) next = { ...current };
        next[id] = { ...next[id], ...patchData };
      });
      return next;
    });
  };

  const flushTransformUpdates = (final = false) => {
    if (transformFrameRef.current != null) {
      cancelAnimationFrame(transformFrameRef.current);
      transformFrameRef.current = null;
    }
    if (!transformLatestRef.current.size) return;

    const updates = Array.from(transformLatestRef.current, ([id, patchData]) => ({ id, patch: patchData }));
    applyTransformLocally(updates);
    if (final) socket.emit('obj-transform', { updates, preview: false });
    else if (socket.connected) socket.volatile.compress(false).emit('obj-transform', { updates, preview: true });
  };

  const scheduleTransformFlush = () => {
    if (transformFrameRef.current != null) return;
    const flush = (timestamp) => {
      if (timestamp - transformLastSentRef.current < GRAPHICS_FRAME_MS) {
        transformFrameRef.current = requestAnimationFrame(flush);
        return;
      }
      transformFrameRef.current = null;
      transformLastSentRef.current = timestamp;
      flushTransformUpdates(false);
    };
    transformFrameRef.current = requestAnimationFrame(flush);
  };

  const applyTransformUpdates = (updates = []) => {
    if (editingLocked) return;
    const scene = objectsRef.current;
    let accepted = false;
    updates.forEach(({ id, patch: patchData }) => {
      if (!scene[id] || !patchData || typeof patchData !== 'object' || !canMutateObject(scene[id], { silent: true })) return;
      transformLatestRef.current.set(id, { ...(transformLatestRef.current.get(id) || {}), ...patchData });
      accepted = true;
    });
    if (accepted) scheduleTransformFlush();
  };

  const beginTransform = (label) => {
    transformLatestRef.current.clear();
    if (transformFrameRef.current != null) {
      cancelAnimationFrame(transformFrameRef.current);
      transformFrameRef.current = null;
    }
    beginHistory(label || 'Transformar capa');
  };

  const finishTransform = () => {
    flushTransformUpdates(true);
    transformLatestRef.current.clear();
    commitHistory();
  };

  const patch = (id, patchData) => applyUpdates([{ id, patch: patchData }]);

  const patchWithHistory = (id, patchData, label = 'Editar capa') => {
    if (!objectsRef.current[id]) return;
    beginHistory(label);
    patch(id, patchData);
    commitHistory(label);
  };

  const applyUpdatesWithHistory = (updates = [], label = 'Editar capas') => {
    if (!updates.some(({ id }) => objectsRef.current[id])) return;
    beginHistory(label);
    applyUpdates(updates);
    commitHistory(label);
  };

  const add = (object, options = {}) => {
    if (editingLocked || !object?.id || !canMutateObject(object)) return;
    if (layerLimit > 0 && Object.keys(objectsRef.current).length >= layerLimit) { setMediaStatus(`Llegaste al límite de ${layerLimit} capas de este lienzo.`); return; }
    if (options.history !== false) beginHistory(options.label || 'Agregar capa');
    upsert(object);
    setSelectedIds([object.id]);
    setSelectedId(object.id);
    if (options.history !== false) commitHistory(options.label || 'Agregar capa');
  };

  const addMany = (list, options = {}) => {
    if (editingLocked || !list.length) return;
    if (list.some((object) => !canMutateObject(object))) return;
    if (layerLimit > 0 && Object.keys(objectsRef.current).length + list.length > layerLimit) { setMediaStatus(`Esta acción supera el límite de ${layerLimit} capas del lienzo.`); return; }
    if (options.history !== false) beginHistory(options.label || 'Agregar capas');
    updateScene((current) => {
      const next = { ...current };
      list.forEach((object) => { next[object.id] = object; });
      return next;
    });
    list.forEach((object) => socket.emit('obj-upsert', object));
    setSelectedIds(list.map((object) => object.id));
    setSelectedId(list.at(-1)?.id || null);
    if (options.history !== false) commitHistory(options.label || 'Agregar capas');
  };

  const clear = () => {
    if (editingLocked) return;
    const currentObjects = Object.keys(objectsRef.current);
    if (!currentObjects.length) return;

    beginHistory('Vaciar lienzo');
    const fallbackLayer = makeDrawLayer({});
    const nextScene = { [fallbackLayer.id]: fallbackLayer };
    setScene(nextScene);
    setSelectedIds([fallbackLayer.id]);
    setSelectedId(fallbackLayer.id);
    setActiveDrawLayerId(fallbackLayer.id);
    setLiveStrokes({});
    socket.emit('scene-replace', { objects: [fallbackLayer], operation: 'reset' });
    commitHistory('Vaciar lienzo');
  };

  const syncHistoryResult = (result) => {
    const ensured = ensureSceneDrawLayer(result.next);
    const nextScene = ensured.scene;
    const previousSelection = selectedIds.filter((id) => nextScene[id]);
    const nextSelectionId = ensured.created
      ? ensured.drawLayer.id
      : fallbackSelectionId(nextScene, [...previousSelection, ...result.applied].reverse());

    setScene(nextScene);
    if (ensured.created) socket.emit('obj-upsert', ensured.drawLayer);
    result.removals.forEach((id) => socket.emit('obj-remove', { id }));
    result.upserts.forEach((object) => socket.emit('obj-upsert', object));
    result.drawRemovals.forEach((payload) => socket.emit('draw-remove', payload));
    result.drawCommits.forEach((payload) => socket.emit('draw-commit', payload));

    if (ensured.created) setSelection([ensured.drawLayer.id], ensured.drawLayer.id);
    else if (previousSelection.length) setSelection(previousSelection, previousSelection.at(-1));
    else if (nextSelectionId) setSelection([nextSelectionId], nextSelectionId);
    else setSelection([]);

    const activeDraw = nextSelectionId && isDrawLayer(nextScene[nextSelectionId])
      ? nextScene[nextSelectionId]
      : Object.values(nextScene).filter(isDrawLayer).sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0] || null;
    setActiveDrawLayerId(activeDraw?.id || null);
    setLiveStrokes({});
    return result;
  };

  const undo = () => {
    if (editingLocked) return;
    const entry = history.past.at(-1);
    if (!entry) return;
    cancelHistory();
    const result = syncHistoryResult(applyHistoryEntry(objectsRef.current, entry, 'undo'));
    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: result.applied.length ? [entry, ...current.future] : current.future
    }));
    if (result.skipped.length) setMediaStatus(`Deshacer parcial: ${result.skipped.length} capa(s) cambiaron desde otro editor.`);
  };

  const redo = () => {
    if (editingLocked) return;
    const entry = history.future[0];
    if (!entry) return;
    cancelHistory();
    const result = syncHistoryResult(applyHistoryEntry(objectsRef.current, entry, 'redo'));
    setHistory((current) => ({
      past: result.applied.length ? pushHistoryEntry(current.past, entry) : current.past,
      future: current.future.slice(1)
    }));
    if (result.skipped.length) setMediaStatus(`Rehacer parcial: ${result.skipped.length} capa(s) cambiaron desde otro editor.`);
  };

  const removeLayers = (ids = selectedIds, options = {}) => {
    if (editingLocked) return;
    const targets = [...new Set(ids)].filter((id) => objectsRef.current[id]);
    if (!targets.length) return;

    const survivors = Object.values(objectsRef.current).filter((object) => !targets.includes(object.id));
    const survivorScene = Object.fromEntries(survivors.map((object) => [object.id, object]));
    const ensured = ensureSceneDrawLayer(survivorScene);

    if (options.history !== false) beginHistory(options.label || 'Eliminar capas');
    if (ensured.created) socket.emit('obj-upsert', ensured.drawLayer);
    targets.forEach((id) => socket.emit('obj-remove', { id }));
    setScene(ensured.scene);

    const remainingSelection = selectedIds.filter((id) => !targets.includes(id));
    if (ensured.created) {
      setActiveDrawLayerId(ensured.drawLayer.id);
      setSelection([ensured.drawLayer.id], ensured.drawLayer.id);
    } else {
      const nextSelectionId = fallbackSelectionId(ensured.scene, remainingSelection);
      if (activeDrawLayerId && targets.includes(activeDrawLayerId)) {
        const nextDrawLayer = Object.values(ensured.scene)
          .filter(isDrawLayer)
          .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0] || null;
        setActiveDrawLayerId(nextDrawLayer?.id || null);
      }
      if (remainingSelection.length) setSelection(remainingSelection, remainingSelection.at(-1));
      else if (nextSelectionId) setSelection([nextSelectionId], nextSelectionId);
      else setSelection([]);
    }
    if (options.history !== false) commitHistory(options.label || 'Eliminar capas');
  };

  const groupSelection = () => {
    const transformable = selectedIds.filter((id) => {
      const object = objectsRef.current[id];
      return object && [object.x, object.y, object.w, object.h].every((value) => Number.isFinite(Number(value)));
    });
    if (transformable.length < 2) return;

    const result = createGroupPatches(objectsRef.current, transformable);
    if (!result.updates.length) return;
    beginHistory('Agrupar capas');
    applyUpdates(result.updates);
    commitHistory('Agrupar capas');
    setSelection(transformable, transformable.at(-1));
  };

  const ungroupSelection = () => {
    const updates = ungroupPatches(objectsRef.current, selectedIds);
    if (!updates.length) return;
    beginHistory('Desagrupar capas');
    applyUpdates(updates);
    commitHistory('Desagrupar capas');
  };

  const duplicateSelected = () => {
    const result = duplicateSelection(objectsRef.current, selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
    addMany(result.objects, { label: 'Duplicar capas' });
  };

  const copySelection = (clipboardEvent = null) => {
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    const payload = createClipboardPayload(objectsRef.current, ids);
    if (!payload) return null;

    const serialized = serializeClipboardPayload(payload);
    setClipboardPayload(payload);
    setPasteSerial(1);
    setMediaStatus(`Copiadas ${payload.objects.length} capa(s).`);

    if (clipboardEvent?.clipboardData) {
      clipboardEvent.clipboardData.setData('text/plain', serialized);
      clipboardEvent.preventDefault();
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(serialized).catch(() => {});
    }
    return payload;
  };

  const pasteClipboard = (payload = clipboardPayload, serial = pasteSerial) => {
    if (!payload?.objects?.length) return;
    const result = materializeClipboardPayload(payload, objectsRef.current, serial);
    if (!result.objects.length) return;
    addMany(result.objects, { label: 'Pegar capas' });
    setClipboardPayload(payload);
    setPasteSerial((current) => Math.max(current, serial) + 1);
    setTool('select');
    setMediaStatus(`Pegadas ${result.objects.length} capa(s).`);
  };

  const cutSelection = (clipboardEvent = null) => {
    const ids = selectedIds.length ? [...selectedIds] : selectedId ? [selectedId] : [];
    if (!ids.length) return;
    const payload = copySelection(clipboardEvent);
    if (!payload) return;
    removeLayers(ids, { label: 'Cortar capas' });
    setMediaStatus(`Cortadas ${ids.length} capa(s).`);
  };

  const selectAllLayers = () => {
    const ids = Object.values(objectsRef.current)
      .filter((object) => !object.hidden)
      .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))
      .map((object) => object.id);
    setSelection(ids, ids[0] || null);
  };

  const reorderLayers = (draggedId, destinationIndex) => {
    if (editingLocked) return;
    const updates = reorderLayerUnitToIndex(objectsRef.current, draggedId, destinationIndex);
    if (!updates.length) return;

    const before = Object.fromEntries(
      updates.map(({ id }) => [id, objectsRef.current[id]])
    );
    applyUpdates(updates);
    const after = Object.fromEntries(
      updates.map(({ id }) => [id, objectsRef.current[id]])
    );
    const entry = makeHistoryEntry(before, after, 'Ordenar capas');
    if (entry) setHistory((current) => ({ past: pushHistoryEntry(current.past, entry), future: [] }));
  };

  const moveSelectedLayer = (direction) => {
    if (editingLocked) return;
    const updates = moveSelectionOneLevel(objectsRef.current, selectedIds, direction);
    if (!updates.length) return;
    beginHistory('Mover capa');
    applyUpdates(updates);
    commitHistory('Mover capa');
  };

  const requestClear = async () => {
    if (editingLocked || !Object.keys(objectsRef.current).length) return;
    const confirmed = await confirmDialog({
      title: '¿Vaciar todo el lienzo?',
      message: 'Esto borra la escena actual para todos los clientes conectados. Puedes deshacerlo de inmediato si ningún colaborador cambia la escena.',
      confirmLabel: 'Vaciar lienzo',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!confirmed) return;
    clear();
  };

  const nudgeSelection = (dx, dy) => {
    if (editingLocked) return false;
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    const updates = ids
      .map((id) => objectsRef.current[id])
      .filter((object) => object && Number.isFinite(Number(object.x)) && Number.isFinite(Number(object.y)))
      .map((object) => ({
        id: object.id,
        patch: {
          x: Math.round((Number(object.x) || 0) + dx),
          y: Math.round((Number(object.y) || 0) + dy)
        }
      }));

    if (!updates.length) return false;
    if (!nudgeActiveRef.current) {
      beginHistory('Mover capas');
      nudgeActiveRef.current = true;
    }
    applyUpdates(updates);
    return true;
  };

  const finishNudge = () => {
    if (!nudgeActiveRef.current) return;
    nudgeActiveRef.current = false;
    commitHistory('Mover capas');
  };


  const activeDrawLayer = activeDrawLayerId && isDrawLayer(objects[activeDrawLayerId]) && !objects[activeDrawLayerId].hidden ? objects[activeDrawLayerId] : null;

  const createDrawLayer = () => {
    if (editingLocked) return null;
    if (layerLimit > 0 && Object.keys(objectsRef.current).length >= layerLimit) {
      setMediaStatus(`Llegaste al límite de ${layerLimit} capas de este lienzo.`);
      return null;
    }
    const layer = makeDrawLayer(objectsRef.current);
    beginHistory('Nueva capa de dibujo');
    upsert(layer);
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
    commitHistory('Nueva capa de dibujo');
    return layer;
  };

  const ensureDrawLayer = () => {
    if (activeDrawLayer) return activeDrawLayer;
    const existing = Object.values(objectsRef.current).filter((object) => isDrawLayer(object) && !object.hidden).sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0];
    if (existing) {
      setActiveDrawLayerId(existing.id);
      return existing;
    }
    return createDrawLayer();
  };

  const clearActiveDrawLayer = () => {
    if (editingLocked) return;
    const layer = ensureDrawLayer();
    if (!layer || !(layer.lineas || []).length) return;
    beginHistory('Limpiar capa de dibujo');
    upsert(clearDrawLayer(layer));
    commitHistory('Limpiar capa de dibujo');
  };

  const emitLiveStroke = (phase, stroke, layer, point = null) => {
    if (!stroke || !layer) return;
    socket.emit('draw-live', {
      phase,
      strokeId: stroke.id,
      layerId: layer.id,
      mode: stroke.mode,
      color: stroke.color,
      size: stroke.size,
      brush: stroke.brush,
      opacity: stroke.opacity,
      layerX: Number(layer.x) || 0,
      layerY: Number(layer.y) || 0,
      layerW: Number(layer.w) || 1920,
      layerH: Number(layer.h) || 1080,
      layerRotation: Number(layer.rotation) || 0,
      point
    });
  };

  const flushDrawPoint = (reliable = false) => {
    if (drawPointFrameRef.current != null) {
      cancelAnimationFrame(drawPointFrameRef.current);
      drawPointFrameRef.current = null;
    }
    const pending = pendingDrawPointRef.current;
    pendingDrawPointRef.current = null;
    if (!pending || !socket.connected) return;
    const event = { phase: 'point', strokeId: pending.strokeId, point: pending.point };
    if (reliable) socket.emit('draw-live', event);
    else socket.volatile.compress(false).emit('draw-live', event);
  };

  const scheduleDrawPoint = () => {
    if (drawPointFrameRef.current != null) return;
    const flush = (timestamp) => {
      if (timestamp - drawPointLastSentRef.current < GRAPHICS_FRAME_MS) {
        drawPointFrameRef.current = requestAnimationFrame(flush);
        return;
      }
      drawPointFrameRef.current = null;
      drawPointLastSentRef.current = timestamp;
      flushDrawPoint(false);
    };
    drawPointFrameRef.current = requestAnimationFrame(flush);
  };

  const startDrawStroke = (stroke, layer) => {
    if (editingLocked) return;
    const feature = stroke?.mode === 'erase' ? 'editor.eraser' : 'editor.brush';
    if (!requireFrontendFeature(feature, FEATURE_LABELS[feature])) return;
    pendingDrawPointRef.current = null;
    emitLiveStroke('start', stroke, layer, stroke.points?.[0]);
  };

  const continueDrawStroke = (strokeId, point) => {
    if (editingLocked) return;
    const layer = activeDrawLayerId ? objectsRef.current[activeDrawLayerId] : null;
    if (!layer) return;
    pendingDrawPointRef.current = { strokeId, point };
    scheduleDrawPoint();
  };

  const cancelDrawStroke = (stroke) => {
    if (!stroke) return;
    pendingDrawPointRef.current = null;
    if (drawPointFrameRef.current != null) {
      cancelAnimationFrame(drawPointFrameRef.current);
      drawPointFrameRef.current = null;
    }
    const layer = objectsRef.current[stroke.layerId];
    if (layer) emitLiveStroke('cancel', stroke, layer);
  };

  const commitDrawStroke = (stroke) => {
    if (editingLocked) return;
    const feature = stroke?.mode === 'erase' ? 'editor.eraser' : 'editor.brush';
    if (!requireFrontendFeature(feature, FEATURE_LABELS[feature], { silent: true })) return;
    const layer = objectsRef.current[stroke.layerId];
    if (!layer || !isDrawLayer(layer)) return;
    flushDrawPoint(true);

    const nextLayer = appendStrokeToLayer(layer, stroke);
    if (JSON.stringify(nextLayer).length > DRAW_LAYER_MAX_BYTES) {
      emitLiveStroke('cancel', stroke, layer);
      setMediaStatus('Esta capa de dibujo alcanzó su límite. Crea una capa nueva para seguir dibujando.');
      return;
    }

    updateScene((current) => ({ ...current, [layer.id]: nextLayer }));
    socket.timeout(6000).emit('draw-commit', { layerId: layer.id, stroke }, (error, response) => {
      if (error) {
        setMediaStatus('El trazo quedó local, pero el canal no confirmó la sincronización. Revisa tu conexión.');
        return;
      }
      if (!response?.ok) setMediaStatus(response?.message || 'El canal rechazó el trazo.');
      if (response?.control) applyControlState(response.control);
    });
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
    const historyEntry = makeDrawStrokeHistoryEntry(layer.id, stroke, stroke.mode === 'erase' ? 'Borrar trazo' : 'Dibujar trazo');
    if (historyEntry) setHistory((current) => ({ past: pushHistoryEntry(current.past, historyEntry), future: [] }));
  };

  useEffect(() => {
    if (tool !== 'draw' && tool !== 'eraser') return;
    ensureDrawLayer();
  }, [tool]);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveStrokes((current) => pruneLiveStrokes(current)), 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('TRAZIO.editor.snap', snapEnabled ? 'on' : 'off'); } catch { /* noop */ }
  }, [snapEnabled]);

  useEffect(() => {
    let active = true;
    getChannels().then((data) => {
      if (!active) return;
      const ownedChannels = data.ownedChannels || (data.owned ? [data.owned] : []);
      setIsOwner(ownedChannels.some((channel) => channel.publicKey === publicKey));
      const allChannels = [...ownedChannels, ...(data.collaborations || [])].filter(Boolean);
      const nextChannelUuid = allChannels.find((channel) => channel.publicKey === publicKey)?.uuid || null;
      setChannelUuid(nextChannelUuid);
      if (!nextChannelUuid) {
        setRecentDesigns([]);
        return;
      }
      markChannelUsed(nextChannelUuid).catch(() => {});
    }).catch(() => {
      if (!active) return;
      setIsOwner(false);
      setChannelUuid(null);
      setEntitlements(EMPTY_CHANNEL_ENTITLEMENTS);
      setRecentDesigns([]);
    });
    return () => { active = false; };
  }, [publicKey]);

  useEffect(() => {
    if (!channelUuid) return undefined;
    let active = true;
    getChannelEntitlements(channelUuid, { force: true })
      .then((value) => { if (active) setEntitlements(normalizeChannelEntitlements(value)); })
      .catch(() => { if (active) { setEntitlements(EMPTY_CHANNEL_ENTITLEMENTS); setMediaStatus('No se pudieron cargar los permisos del lienzo.'); } });
    return () => { active = false; };
  }, [channelUuid]);


  const effectiveWorkspaceMode = entitlementsReady && workspaceMode === 'launchpad' && canFeature('editor.launchpad') ? 'launchpad' : 'canvas';

  useEditorHotkeys({
    guides, workspaceMode: effectiveWorkspaceMode, editingLocked, hotkeysOpen, setHotkeysOpen, tool, setTool, setGuide, setMediaStatus,
    setImagePickerRequest, requestClear, redo, undo, selectAllLayers, moveSelectedLayer,
    ungroupSelection, groupSelection, duplicateSelected, nudgeSelection, removeLayers, setSelection,
    finishNudge, copySelection, cutSelection, setClipboardPayload, pasteClipboard,
    isToolEnabled: (toolId) => entitlementsReady && canFeature(TOOL_FEATURE[toolId]),
    guidesEnabled: canFeature('editor.guides'),
    onLockedFeature: (feature, label) => showLockedFeature(feature, label)
  });

  const { uploadFile, importRemote } = useEditorMedia({ channelUuid, editingLocked, imageConfig, add, setTool, openPropertiesAt, setMediaStatus });

  const commitText = ({ id, x, y, text, config }) => {
    if (!requireFrontendFeature('editor.text', 'Texto')) return;
    if (id && objectsRef.current[id]) {
      beginHistory('Editar texto');
      upsert(updateTextContent({ ...objectsRef.current[id], x, y }, text, config));
      commitHistory('Editar texto');
      setSelection([id], id);
    } else {
      add(makeText(x, y, text, config));
    }
    setTool('select');
  };


  const buildDesignSnapshot = () => ({
    version: 1,
    scene: { objects: cloneValue(Object.values(objectsRef.current)) },
    editor: {
      tool,
      guide,
      activeDrawLayerId
    }
  });

  const loadDesignSnapshot = async (rawState, design) => {
    if (!requireFrontendFeature('editor.designs', 'Diseños')) throw new Error('Diseños está bloqueado en este lienzo.');
    if (editingLocked) throw new Error('Espera a que el canal vuelva a Live antes de cargar un diseño.');
    const state = decodeDesignSnapshot(rawState);
    const list = state.scene.objects;
    const rawScene = Object.fromEntries(list.filter((object) => object?.id).map((object) => [object.id, object]));
    if (Object.keys(rawScene).length !== list.length) throw new Error('La copia guardada contiene una capa inválida y no se cargó.');
    if (layerLimit > 0 && list.length > layerLimit) throw new Error(`El diseño usa ${list.length} capas y este lienzo admite ${layerLimit}.`);
    const blockedObject = list.find((object) => { const feature = objectFeature(object); return feature && !canFeature(feature); });
    if (blockedObject) throw new Error(`${FEATURE_LABELS[objectFeature(blockedObject)] || 'Una herramienta'} está bloqueado en este lienzo.`);
    const ensured = ensureSceneDrawLayer(rawScene);
    const next = ensured.scene;
    if (!socket.connected) throw new Error('TRAZIO perdió conexión con el canal. Vuelve a intentarlo en un momento.');

    await new Promise((resolve, reject) => {
      socket.timeout(6000).emit('scene-replace', { objects: Object.values(next) }, (error, response) => {
        if (error) { reject(new Error('El canal no confirmó la carga del diseño. Vuelve a intentarlo.')); return; }
        if (!response?.ok) { reject(new Error(response?.message || 'El canal rechazó la escena guardada.')); return; }
        resolve(response);
      });
    });

    cancelHistory();
    setScene(next);
    setLiveStrokes({});
    setHistory({ past: [], future: [] });
    setClipboardPayload(null);
    setPasteSerial(1);

    const editor = state.editor || {};
    const savedActiveDraw = editor.activeDrawLayerId && isDrawLayer(next[editor.activeDrawLayerId]) ? next[editor.activeDrawLayerId] : null;
    const activeDraw = ensured.created ? ensured.drawLayer : savedActiveDraw || ensured.drawLayer;
    const selectionId = ensured.created ? ensured.drawLayer.id : fallbackSelectionId(next, [savedActiveDraw?.id].filter(Boolean));
    if (selectionId) setSelection([selectionId], selectionId);
    else setSelection([]);
    setGuide(editor.guide || 'none');
    setActiveDrawLayerId(activeDraw?.id || null);
    const savedTool = editor.tool && editor.tool !== 'image' && TOOL_LABELS[editor.tool] ? editor.tool : 'select';
    setTool(canFeature(TOOL_FEATURE[savedTool]) ? savedTool : 'select');
    setMediaStatus(`Diseño cargado: ${design?.name || 'sin nombre'}.`);
  };

  const loadRecentDesign = async (design) => {
    if (!design || !channelUuid) return;
    if (Object.keys(objectsRef.current).length) {
      const accepted = await confirmDialog({
        title: `¿Cargar “${design.name}”?`,
        message: liveEnabled ? 'El lienzo actual será reemplazado para todos los editores y el overlay conectado.' : 'El lienzo actual será reemplazado para todos los editores. Estás en modo Estudio, así que el overlay conservará lo publicado hasta que presiones Publicar.',
        confirmLabel: 'Cargar diseño',
        cancelLabel: 'Cancelar'
      });
      if (!accepted) return;
    }

    setMediaStatus(`Cargando “${design.name}”...`);
    try {
      const fullDesign = await getSavedDesign(channelUuid, design.uuid);
      await loadDesignSnapshot(fullDesign.state, fullDesign);
      refreshRecentDesigns();
    } catch (error) {
      setMediaStatus(error?.response?.data?.message || error?.response?.data?.error || error?.message || 'No se pudo cargar el diseño.');
    }
  };

  const singleSelected = selectedIds.length === 1 ? objects[selectedId] : null;

  const patchSelectedText = (patchData) => {
    const current = singleSelected;
    if (!current || (current.tipo !== 'text' && current.tipo !== 'texto')) return;
    beginHistory('Estilo de texto');
    upsert(applyTextStyle(current, patchData));
    commitHistory('Estilo de texto');
  };

  const createTimer = (point) => {
    if (!requireFrontendFeature('editor.timer', 'Temporizador')) return;
    add(makeTimer(point.x, point.y, timerConfig));
    setTool('select');
  };

  const patchSelectedTimer = (patchData) => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    beginHistory('Editar temporizador');
    upsert(applyTimerConfig(current, patchData));
    commitHistory('Editar temporizador');
  };

  const toggleSelectedTimer = () => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    beginHistory('Pausar / iniciar temporizador');
    upsert(toggleTimer(current));
    commitHistory('Pausar / iniciar temporizador');
  };

  const adjustSelectedTimer = (deltaSeconds) => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    beginHistory('Ajustar temporizador');
    upsert(adjustTimerSeconds(current, deltaSeconds));
    commitHistory('Ajustar temporizador');
  };

  if (denied) return <div className="fixed inset-0 grid place-content-center bg-[var(--dc-bg)] text-center text-[var(--dc-text)]">NO TIENES ACCESO A ESTE CANAL // <Link className="text-[var(--dc-accent-four)]" to="/app">VOLVER AL INICIO</Link></div>;

  return (
    <div className={`dc-editor ${editingLocked ? 'is-collab-locked' : ''} ${effectiveWorkspaceMode === 'launchpad' ? 'is-launchpad-mode' : ''}`}>
      <div className="dc-editor-toolbar">
        <Toolbar
          key={editingLocked ? 'locked' : 'active'}
          tool={tool}
          setTool={setTool}
          guide={guide}
          guides={guides}
          setGuide={setGuide}
          onSaveGuide={() => { setGuidesOpen(true); void refreshGuides(); }}
          onSaveDesign={() => openDesigns('save')}
          onLoadDesigns={() => openDesigns('load')}
          onLoadRecent={loadRecentDesign}
          onFileOpen={refreshRecentDesigns}
          recentDesigns={recentDesigns}
          onInsertTool={openInsertProperties}
          onImageFile={uploadFile}
          imagePickerRequest={imagePickerRequest}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled((value) => !value)}
          liveEnabled={liveEnabled}
          liveRequired={liveRequired}
          hasDraftChanges={hasDraftChanges}
          onToggleLive={toggleLiveMode}
          onPublish={publishScene}
          isOwner={isOwner}
          overlayHidden={overlayHidden}
          onTogglePanic={togglePanic}
          controlBusy={controlBusy}
          connected={connected && entitlementsReady}
          editorLocked={editingLocked}
          editors={presence.editorList || []}
          workspaceMode={effectiveWorkspaceMode}
          onToggleWorkspaceMode={handleToggleWorkspaceMode}
          soundSlots={soundSlotItems}
          onPlaySound={playSound}
          soundPlayback={soundPlayback}
          soundMonitorEnabled={soundMonitorEnabled}
          onToggleSoundMonitor={() => setSoundMonitorEnabled((value) => !value)}
          onAssignSounds={openSoundAssignments}
          onAssignLaunchpadSounds={openLaunchpadAssignments}
          entitlementsReady={entitlementsReady}
          isFeatureEnabled={canFeature}
          onLockedFeature={showLockedFeature}
          guideSlotLimit={guideSlotLimit}
          quickSoundSlotLimit={quickSoundSlotLimit}
        />
      </div>

      <main className={`dc-workspace ${effectiveWorkspaceMode === 'launchpad' ? 'is-launchpad' : ''}`}>
        {/* <div className="dc-watermark">TRAZIO <span>// DannDato</span></div> */}

        {effectiveWorkspaceMode === 'launchpad' ? (
          <LaunchpadSurface
            sounds={allSounds}
            slots={launchpadSlots}
            connected={connected}
            disabled={overlayHidden || launchpadConfigOpen || !canFeature('editor.launchpad')}
            onPlaySound={(soundId) => playSound(soundId, 'launchpad')}
            soundPlayback={soundPlayback}
          />
        ) : <>
        <CanvasStage
          objects={objects}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          onOpenProperties={openPropertiesAt}
          onPatchObjects={applyTransformUpdates}
          onTransformStart={beginTransform}
          onTransformEnd={finishTransform}
          snapEnabled={snapEnabled}
          tool={tool}
          drawConfig={drawConfig}
          activeDrawLayer={activeDrawLayer}
          liveStrokes={liveStrokes}
          onDrawStart={startDrawStroke}
          onDrawPoint={continueDrawStroke}
          onDrawCommit={commitDrawStroke}
          onDrawCancel={cancelDrawStroke}
          lineConfig={lineConfig}
          shapeConfig={shapeConfig}
          onShapeCreate={(draft) => {
            add(makeShape(draft));
            setTool('select');
          }}
          textConfig={textConfig}
          onTextCommit={commitText}
          onTimerCreate={createTimer}
          onMediaDrop={({ file, url, point }) => { if (!requireFrontendFeature('editor.image', 'Imagen / GIF')) return; return file ? uploadFile(file, point) : importRemote(url, point); }}
          guideImageUrl={guideImageUrl}
          remoteCursors={remoteCursorList}
          onCursorMove={broadcastCursor}
          onCursorLeave={broadcastCursorLeave}
          interactionDisabled={editingLocked}
          fitViewRequest={fitViewRequest}
        />

        {propertiesOpen && !editingLocked && <Inspector
          open
          anchor={propertiesAnchor}
          onClose={() => setPropertiesOpen(false)}
          tool={tool}
          selected={singleSelected}
          selectedObjects={selectedIds.map((id) => objects[id]).filter(Boolean)}
          selectionCount={selectedIds.length}
          selectedGroupCount={selectedGroupIds(objects, selectedIds).length}
          drawConfig={drawConfig}
          setDrawConfig={setDrawConfig}
          shapeConfig={shapeConfig}
          setShapeConfig={setShapeConfig}
          lineConfig={lineConfig}
          setLineConfig={setLineConfig}
          imageConfig={imageConfig}
          setImageConfig={setImageConfig}
          textConfig={textConfig}
          setTextConfig={setTextConfig}
          timerConfig={timerConfig}
          setTimerConfig={setTimerConfig}
          channelUuid={channelUuid}
          onUploadFile={uploadFile}
          onImportUrl={importRemote}
          onPatch={(patchData) => selectedId && patchWithHistory(selectedId, patchData, 'Editar capa')}
          onPatchText={patchSelectedText}
          onPatchTimer={patchSelectedTimer}
          onToggleTimer={toggleSelectedTimer}
          onAdjustTimer={adjustSelectedTimer}
          onDelete={() => removeLayers()}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={duplicateSelected}
          onMoveLayer={moveSelectedLayer}
          activeDrawLayer={activeDrawLayer}
          onNewDrawLayer={createDrawLayer}
          onClearDrawLayer={clearActiveDrawLayer}
          onSelectDraw={() => requireFrontendFeature('editor.brush', 'Pincel') && setTool('draw')}
          onSelectEraser={() => requireFrontendFeature('editor.eraser', 'Borrador') && setTool('eraser')}
        />}


        {editingLocked && (
          <div className="dc-collab-lock-overlay" role="status" aria-live="polite">
            <div className="dc-collab-lock-card">
              <span className="dc-collab-lock-kicker">MODO ESTUDIO EN USO</span>
              <strong>{studioEditor?.username ? `@${studioEditor.username}` : 'Otro editor'} está preparando cambios</strong>
              <p>Este editor queda en espera para no mezclar escenas. Se habilitará automáticamente cuando el workspace se publique y el canal vuelva a Live.</p>
              <span className="dc-collab-lock-wait"><i /> Esperando Live...</span>
            </div>
          </div>
        )}

        </>}

        <div className="dc-status">
          <div className="dc-status-history" aria-label="Historial">
            <button type="button" className="dc-status-action" onClick={undo} disabled={!connected || editingLocked || history.past.length === 0} title="Deshacer // Ctrl+Z" aria-label="Deshacer">
              <Undo2 size={14} />
            </button>
            <button type="button" className="dc-status-action" onClick={redo} disabled={!connected || editingLocked || history.future.length === 0} title="Rehacer // Ctrl+Shift+Z / Ctrl+Y" aria-label="Rehacer">
              <Redo2 size={14} />
            </button>
          </div>

          <div className="dc-status-info">
            {effectiveWorkspaceMode === 'canvas' && TOOL_LABELS[tool] && <span className="dc-status-presence">Herramienta: {TOOL_LABELS[tool]} //</span>}
            {effectiveWorkspaceMode === 'canvas' && selectedIds.length > 0 && <span className="dc-status-presence">Seleccionada: {selectedIds.length} //</span>}
            <span className="dc-status-presence">Conectados: {presence.clients} // Editores: {presence.editors} // OBS: {presence.overlays}</span>
            {mediaStatus && <span className="dc-media-status">{mediaStatus}</span>}
          </div>

          <button type="button" className="dc-status-hotkeys" onClick={() => setHotkeysOpen(true)}>ATAJOS [?]</button>
        </div>
      </main>

      {effectiveWorkspaceMode === 'canvas' && <div className="dc-editor-layers-sidebar">
        <LayersPanel
          objects={objects}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          onPatch={(id, patchData) => patchWithHistory(id, patchData, 'Editar capa')}
          onPatchMany={(updates) => applyUpdatesWithHistory(updates, 'Editar capas')}
          onRemove={removeLayers}
          onReorder={reorderLayers}
          onNewDrawLayer={createDrawLayer}
          onMoveLayer={moveSelectedLayer}
          canMoveLayer={selectedIds.length > 0}
          onProperties={toggleProperties}
          propertiesOpen={propertiesOpen}
          onClearAll={requestClear}
          disabled={!connected || editingLocked}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={duplicateSelected}
          layerLimit={layerLimit}
          onLayerLimit={() => setMediaStatus(`Llegaste al límite de ${layerLimit} capas de este lienzo.`)}
        />
      </div>}

      {guidesOpen && <GuidesModal guides={guides} onSave={saveGuide} onDelete={deleteGuide} onClose={() => setGuidesOpen(false)} disabled={!channelUuid || editingLocked} slotLimit={guideSlotLimit} />}
      <HotkeysModal open={hotkeysOpen} onClose={() => setHotkeysOpen(false)} />
      {soundsOpen && <SoundSlotsModal sounds={soundLibrary} customSounds={customSoundLibrary} slots={soundSlots} slotCount={quickSoundSlotLimit} customSoundsEnabled={canFeature('editor.custom_sounds')} customSoundLimit={customSoundLimit} onLockedFeature={showLockedFeature} onClose={() => setSoundsOpen(false)} onRefresh={refreshSoundLibrary} resolveSoundUrl={resolveSoundUrl} onUpload={uploadOwnSound} onDelete={deleteOwnSound} onSave={saveSoundAssignments} />}
      {launchpadConfigOpen && <LaunchpadConfigModal sounds={soundLibrary} customSounds={customSoundLibrary} slots={launchpadSlots} padCount={launchpadPadLimit} customSoundsEnabled={canFeature('editor.custom_sounds')} customSoundLimit={customSoundLimit} onLockedFeature={showLockedFeature} onClose={() => setLaunchpadConfigOpen(false)} onRefresh={refreshSoundLibrary} resolveSoundUrl={resolveSoundUrl} onUpload={uploadOwnSound} onDelete={deleteOwnSound} onSave={saveLaunchpadAssignments} />}
      {designsOpen && <SavedDesignsModal maxSlots={designSlotLimit} initialView={designsIntent} onClose={() => { setDesignsOpen(false); refreshRecentDesigns(); }} channelUuid={channelUuid} buildSnapshot={buildDesignSnapshot} onLoad={loadDesignSnapshot} hasScene={Object.keys(objects).length > 0} liveEnabled={liveEnabled} />}
    </div>
  );
}
