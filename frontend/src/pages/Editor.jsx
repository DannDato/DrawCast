import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { importChannelImageUrl, uploadChannelImage } from '../api/media';
import { getSavedDesign, getSavedDesigns } from '../api/designs';
import { getChannels, markChannelUsed } from '../api/channels';
import { getUserSettings } from '../api/settings';
import { useChannelSocket } from '../hooks/useChannelSocket';
import CanvasStage from '../components/editor/CanvasStage';
import Inspector from '../components/editor/Inspector';
import LayersPanel from '../components/editor/LayersPanel';
import Toolbar from '../components/editor/Toolbar';
import HotkeysModal from '../components/editor/hotkeys/HotkeysModal';
import SavedDesignsModal from '../components/editor/SavedDesignsModal';
import { useSystemAlert } from '../components/ui/SystemAlert';
import { makeImage, makeShape, makeText, makeTimer } from '../components/editor/objectFactory';
import { createGroupPatches, duplicateSelection, selectedGroupIds, ungroupPatches } from '../components/editor/groups/groupUtils';
import { moveSelectionOneLevel, reorderLayerUnitToIndex } from '../components/editor/layers/layerUtils';
import { DEFAULT_SHAPE_CONFIG } from '../components/editor/tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG, fitImageSize, getImageKind, loadImageMetadata, validateImageFile } from '../components/editor/tools/images/imageTool';
import { DEFAULT_TEXT_CONFIG, applyTextStyle, resolveTextFontFamily, updateTextContent } from '../components/editor/tools/text/textTool';
import { DEFAULT_TIMER_CONFIG, adjustTimerSeconds, applyTimerConfig, toggleTimer } from '../components/editor/tools/timer/timerTool';
import { DEFAULT_DRAW_CONFIG, appendStrokeToLayer, clearDrawLayer, isDrawLayer, makeDrawLayer, pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';
import { applyHistoryEntry, cloneValue, makeHistoryEntry, pushHistoryEntry } from '../components/editor/history/historyUtils';
import { createClipboardPayload, materializeClipboardPayload, parseClipboardText, serializeClipboardPayload } from '../components/editor/clipboard/clipboardUtils';
import { getCursorThemeColor } from '../utils/theme';
import { normalizeEditorPreferences } from '../components/editor/editorDefaults';

const TOOL_LABELS = { select: 'Selección', hand: 'Manita', draw: 'Pincel', eraser: 'Borrador', image: 'Imagen / GIF', shape: 'Formas', text: 'Texto', timer: 'Temporizador' };

function decodeDesignSnapshot(value) {
  let current = value;
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { throw new Error('La copia guardada no contiene un estado válido.'); }
  }

  if (Array.isArray(current)) return { version: 1, scene: { objects: current }, editor: {} };
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('La copia guardada no contiene un estado válido.');
  if (Array.isArray(current.scene?.objects)) return current;
  if (Array.isArray(current.objects)) return { version: Number(current.version || 1), scene: { objects: current.objects }, editor: current.editor || {} };
  throw new Error('La copia guardada no contiene una escena válida.');
}

function ensureSceneDrawLayer(scene = {}) {
  const drawLayer = Object.values(scene)
    .filter(isDrawLayer)
    .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0];
  if (drawLayer) return { scene, drawLayer, created: false };

  const fallback = makeDrawLayer(scene);
  return {
    scene: { ...scene, [fallback.id]: fallback },
    drawLayer: fallback,
    created: true
  };
}

export default function Editor() {
  const { publicKey } = useParams();
  const { confirmDialog, showAlert } = useSystemAlert();
  const [channelUuid, setChannelUuid] = useState(null);
  const [objects, setObjects] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const [imagePickerRequest, setImagePickerRequest] = useState(0);
  const [guide, setGuide] = useState(() => {
    try { return localStorage.getItem('TRAZIO.editor.guide') || 'none'; } catch { return 'none'; }
  });
  const [drawConfig, setDrawConfig] = useState(DEFAULT_DRAW_CONFIG);
  const [activeDrawLayerId, setActiveDrawLayerId] = useState(null);
  const [liveStrokes, setLiveStrokes] = useState({});
  const [shapeConfig, setShapeConfig] = useState(DEFAULT_SHAPE_CONFIG);
  const [imageConfig, setImageConfig] = useState(DEFAULT_IMAGE_CONFIG);
  const [textConfig, setTextConfig] = useState(DEFAULT_TEXT_CONFIG);
  const [timerConfig, setTimerConfig] = useState(DEFAULT_TIMER_CONFIG);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [clipboardPayload, setClipboardPayload] = useState(null);
  const [pasteSerial, setPasteSerial] = useState(1);
  const [mediaStatus, setMediaStatus] = useState('');
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
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
  const pendingDrawFallbackSelectionRef = useRef(false);

  useEffect(() => {
    let active = true;
    getUserSettings()
      .then((data) => {
        if (!active) return;
        const preferences = normalizeEditorPreferences(data.editor);
        setDrawConfig({ ...DEFAULT_DRAW_CONFIG, ...preferences.drawing });
        setShapeConfig({ ...DEFAULT_SHAPE_CONFIG, ...preferences.shape });
        setImageConfig({ ...DEFAULT_IMAGE_CONFIG, ...preferences.image });
        setTextConfig({ ...DEFAULT_TEXT_CONFIG, ...preferences.text, fontFamily: resolveTextFontFamily(preferences.text.fontKey) });
        setTimerConfig({ ...DEFAULT_TIMER_CONFIG, ...preferences.timer, fontFamily: resolveTextFontFamily(preferences.timer.fontKey) });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

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
      if (historyStartRef.current) historyStartRef.current.before[object.id] = cloneValue(object);
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
    'draw-live': (payload) => setLiveStrokes((current) => reduceLiveStrokeMap(current, payload)),
    'cursor-move': (payload) => {
      if (!payload?.socketId || !Number.isFinite(Number(payload.x)) || !Number.isFinite(Number(payload.y))) return;
      setRemoteCursors((current) => ({ ...current, [payload.socketId]: { ...payload, x: Number(payload.x), y: Number(payload.y) } }));
    },
    'cursor-leave': ({ socketId } = {}) => {
      if (!socketId) return;
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
  const editingLocked = editorAccess.canEdit === false;
  const liveRequired = presence.editors > 1;
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
        reject(new Error(response?.message || 'El canal rechazó la acción.'));
        return;
      }
      applyControlState(response.control);
      resolve(response);
    });
  });

  const broadcastCursor = (point) => {
    if (editingLocked || !socket.connected || !point) return;
    pendingCursorRef.current = point;
    if (cursorFrameRef.current != null) return;

    const flush = (timestamp) => {
      if (timestamp - cursorLastSentRef.current < 32) {
        cursorFrameRef.current = requestAnimationFrame(flush);
        return;
      }
      cursorFrameRef.current = null;
      const next = pendingCursorRef.current;
      pendingCursorRef.current = null;
      if (!next || editingLocked || !socket.connected) return;
      cursorLastSentRef.current = timestamp;
      socket.volatile.emit('cursor-move', { x: next.x, y: next.y });
    };

    cursorFrameRef.current = requestAnimationFrame(flush);
  };

  const broadcastCursorLeave = () => {
    pendingCursorRef.current = null;
    if (cursorFrameRef.current != null) {
      cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }
    if (socket.connected) socket.volatile.emit('cursor-leave');
  };

  useEffect(() => () => {
    if (cursorFrameRef.current != null) cancelAnimationFrame(cursorFrameRef.current);
    cursorFrameRef.current = null;
    pendingCursorRef.current = null;
  }, []);

  const toggleLiveMode = async () => {
    if (controlBusy || !connected || editingLocked) return;
    const nextLive = !liveEnabled;
    if (!nextLive && liveRequired) {
      setMediaStatus('Live es obligatorio mientras haya más de un editor conectado.');
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

  const refreshRecentDesigns = async () => {
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
    setDesignsIntent(intent);
    setDesignsOpen(true);
  };

  const beginHistory = (label = 'Editar') => {
    if (historyStartRef.current) return;
    historyStartRef.current = { label, before: cloneValue(objectsRef.current) };
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
    if (editingLocked || !object?.id) return;
    updateScene((current) => ({ ...current, [object.id]: object }));
    socket.emit('obj-upsert', object);
  };

  const applyUpdates = (updates = []) => {
    if (editingLocked) return;
    const scene = objectsRef.current;
    const valid = updates.filter(({ id }) => scene[id]);
    if (!valid.length) return;

    const nextObjects = valid.map(({ id, patch }) => ({ ...scene[id], ...patch }));
    updateScene((current) => {
      const next = { ...current };
      nextObjects.forEach((object) => { next[object.id] = object; });
      return next;
    });
    nextObjects.forEach((object) => socket.emit('obj-upsert', object));
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
    if (editingLocked || !object?.id) return;
    if (options.history !== false) beginHistory(options.label || 'Agregar capa');
    upsert(object);
    setSelectedIds([object.id]);
    setSelectedId(object.id);
    if (options.history !== false) commitHistory(options.label || 'Agregar capa');
  };

  const addMany = (list, options = {}) => {
    if (editingLocked || !list.length) return;
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
    socket.emit('scene-replace', { objects: [fallbackLayer] });
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
      updates.map(({ id }) => [id, cloneValue(objectsRef.current[id])])
    );
    applyUpdates(updates);
    const after = Object.fromEntries(
      updates.map(({ id }) => [id, cloneValue(objectsRef.current[id])])
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

  const startDrawStroke = (stroke, layer) => { if (!editingLocked) emitLiveStroke('start', stroke, layer, stroke.points?.[0]); };
  const continueDrawStroke = (strokeId, point) => {
    if (editingLocked) return;
    const layer = activeDrawLayerId ? objectsRef.current[activeDrawLayerId] : null;
    if (!layer) return;
    socket.emit('draw-live', { phase: 'point', strokeId, point });
  };
  const commitDrawStroke = (stroke) => {
    if (editingLocked) return;
    const layer = objectsRef.current[stroke.layerId];
    if (!layer || !isDrawLayer(layer)) return;
    beginHistory(stroke.mode === 'erase' ? 'Borrar trazo' : 'Dibujar trazo');
    upsert(appendStrokeToLayer(layer, stroke));
    emitLiveStroke('end', stroke, layer);
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
    commitHistory(stroke.mode === 'erase' ? 'Borrar trazo' : 'Dibujar trazo');
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
    try { localStorage.setItem('TRAZIO.editor.guide', guide); } catch { /* noop */ }
  }, [guide]);

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
      getSavedDesigns(nextChannelUuid)
        .then((rows) => {
          if (active) setRecentDesigns([...rows].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
        })
        .catch(() => { if (active) setRecentDesigns([]); });
    }).catch(() => {
      if (!active) return;
      setIsOwner(false);
      setChannelUuid(null);
      setRecentDesigns([]);
    });
    return () => { active = false; };
  }, [publicKey]);

  useEffect(() => {
    const isEditableTarget = (target) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
    const guideByKey = {
      '0': 'none',
      '1': 'canva-guide.png',
      '2': 'canva-guide2.png',
      '3': 'canva-guide3.png'
    };
    const toolByKey = {
      v: 'select',
      h: 'hand',
      p: 'draw',
      e: 'eraser',
      s: 'shape',
      g: 'shape',
      t: 'text',
      r: 'timer'
    };

    const toggleHotkeys = (event) => {
      event.preventDefault();
      setHotkeysOpen((value) => !value);
    };

    const onKeyDown = (event) => {
      if (document.querySelector('.dc-system-alert-backdrop')) return;
      if (isEditableTarget(event.target)) return;
      if (editingLocked) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.key === 'F1' || (!modifier && !event.altKey && event.key === '?')) {
        toggleHotkeys(event);
        return;
      }

      if (hotkeysOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setHotkeysOpen(false);
        }
        return;
      }

      if (modifier && event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        requestClear();
        return;
      }
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && key === 'a') {
        event.preventDefault();
        selectAllLayers();
        return;
      }
      if (modifier && event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelectedLayer('up');
        return;
      }
      if (modifier && event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelectedLayer('down');
        return;
      }
      if (modifier && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (modifier && key === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      if (!modifier && !event.altKey && Object.prototype.hasOwnProperty.call(guideByKey, event.key)) {
        event.preventDefault();
        setGuide(guideByKey[event.key]);
        setMediaStatus(guideByKey[event.key] === 'none' ? 'Guías desactivadas.' : `Guía ${event.key} activada.`);
        return;
      }

      if (!modifier && !event.altKey && !event.shiftKey && key === 'i') {
        event.preventDefault();
        setImagePickerRequest((current) => current + 1);
        setMediaStatus('Selecciona una imagen o GIF para agregar.');
        return;
      }

      if (!modifier && !event.altKey && !event.shiftKey && toolByKey[key]) {
        event.preventDefault();
        setTool(toolByKey[key]);
        setMediaStatus(`Herramienta: ${TOOL_LABELS[toolByKey[key]] || toolByKey[key]}.`);
        return;
      }

      if (!modifier && !event.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0]
        }[event.key];
        if (nudgeSelection(delta[0], delta[1])) event.preventDefault();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeLayers();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (tool !== 'select') {
          setTool('select');
          setMediaStatus('Herramienta: Selección');
        } else {
          setSelection([]);
        }
      }
    };

    const onKeyUp = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) finishNudge();
    };

    const onCopy = (event) => {
      if (isEditableTarget(event.target) || hotkeysOpen) return;
      copySelection(event);
    };

    const onCut = (event) => {
      if (isEditableTarget(event.target) || hotkeysOpen) return;
      cutSelection(event);
    };

    const onPaste = (event) => {
      if (isEditableTarget(event.target) || hotkeysOpen) return;
      const parsed = parseClipboardText(event.clipboardData?.getData('text/plain') || '');
      if (!parsed) return;
      event.preventDefault();
      setClipboardPayload(parsed);
      pasteClipboard(parsed, 1);
    };

    const onWindowBlur = () => finishNudge();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCut);
    window.addEventListener('paste', onPaste);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCut);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('blur', onWindowBlur);
    };
  });

  const addMediaObject = async ({ url, name, mimeType, point }) => {
    const metadata = await loadImageMetadata(url);
    const size = fitImageSize(metadata.naturalWidth, metadata.naturalHeight);
    const x = point && Number.isFinite(point.x) ? point.x : 200;
    const y = point && Number.isFinite(point.y) ? point.y : 200;
    const object = makeImage(x, y, url, name, {
      ...imageConfig,
      ...size,
      ...metadata,
      mimeType,
      mediaKind: getImageKind(mimeType, name)
    });

    add(object);
    setTool('select');
    openPropertiesAt();
    return object;
  };

  const uploadFile = async (file, point = null) => {
    if (editingLocked) return;
    if (!channelUuid) {
      setMediaStatus('El canal todavía no está listo.');
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setMediaStatus(validationError);
      return;
    }

    setMediaStatus(`Subiendo ${file.name}...`);
    try {
      const data = await uploadChannelImage(channelUuid, file);
      await addMediaObject({ url: data.url, name: file.name, mimeType: data.mimeType || file.type, point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'Imagen'} lista: ${file.name}`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'No se pudo subir la imagen.');
    }
  };

  const importRemote = async (url, point = null) => {
    if (editingLocked) return;
    if (!channelUuid) {
      setMediaStatus('El canal todavía no está listo.');
      return;
    }

    setMediaStatus('Importando imagen desde la web...');
    try {
      const data = await importChannelImageUrl(channelUuid, url);
      const name = data.fileName || 'Imagen web';
      await addMediaObject({ url: data.url, name, mimeType: data.mimeType || '', point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'Imagen'} importada.`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'No se pudo importar la imagen.');
    }
  };

  const commitText = ({ id, x, y, text, config }) => {
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
    if (editingLocked) throw new Error('Espera a que el canal vuelva a Live antes de cargar un diseño.');
    const state = decodeDesignSnapshot(rawState);
    const list = state.scene.objects;
    const rawScene = Object.fromEntries(list.filter((object) => object?.id).map((object) => [object.id, object]));
    if (Object.keys(rawScene).length !== list.length) throw new Error('La copia guardada contiene una capa inválida y no se cargó.');
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
    setTool(editor.tool && editor.tool !== 'image' && TOOL_LABELS[editor.tool] ? editor.tool : 'select');
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
    <div className={`dc-editor ${editingLocked ? 'is-collab-locked' : ''}`}>
      <div className="dc-editor-toolbar">
        <Toolbar
          key={editingLocked ? 'locked' : 'active'}
          tool={tool}
          setTool={setTool}
          guide={guide}
          setGuide={setGuide}
          onClear={requestClear}
          onUndo={undo}
          onRedo={redo}
          onSaveDesign={() => openDesigns('save')}
          onLoadDesigns={() => openDesigns('load')}
          onLoadRecent={loadRecentDesign}
          onFileOpen={refreshRecentDesigns}
          recentDesigns={recentDesigns}
          onProperties={toggleProperties}
          onInsertTool={openInsertProperties}
          onImageFile={uploadFile}
          imagePickerRequest={imagePickerRequest}
          propertiesOpen={propertiesOpen}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled((value) => !value)}
          onMoveLayer={moveSelectedLayer}
          liveEnabled={liveEnabled}
          liveRequired={liveRequired}
          hasDraftChanges={hasDraftChanges}
          onToggleLive={toggleLiveMode}
          onPublish={publishScene}
          isOwner={isOwner}
          overlayHidden={overlayHidden}
          onTogglePanic={togglePanic}
          controlBusy={controlBusy}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          canMoveLayer={selectedIds.length > 0}
          connected={connected}
          editorLocked={editingLocked}
          editors={presence.editorList || []}
        />
      </div>

      <main className="dc-workspace">
        {/* <div className="dc-watermark">TRAZIO <span>// DannDato</span></div> */}

        <CanvasStage
          objects={objects}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          onOpenProperties={openPropertiesAt}
          onPatchObjects={applyUpdates}
          onTransformStart={(label) => beginHistory(label || 'Transformar capa')}
          onTransformEnd={() => commitHistory()}
          snapEnabled={snapEnabled}
          tool={tool}
          drawConfig={drawConfig}
          activeDrawLayer={activeDrawLayer}
          liveStrokes={liveStrokes}
          onDrawStart={startDrawStroke}
          onDrawPoint={continueDrawStroke}
          onDrawCommit={commitDrawStroke}
          shapeConfig={shapeConfig}
          onShapeCreate={(draft) => {
            add(makeShape(draft));
            setTool('select');
          }}
          textConfig={textConfig}
          onTextCommit={commitText}
          onTimerCreate={createTimer}
          onMediaDrop={({ file, url, point }) => file ? uploadFile(file, point) : importRemote(url, point)}
          guide={guide}
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
          onSelectDraw={() => setTool('draw')}
          onSelectEraser={() => setTool('eraser')}
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

        <div className="dc-status">
          {/* <span className={`dc-status-chip connection ${connected ? 'online' : 'offline'}`}>{connected ? 'EN LÍNEA' : 'SIN CONEXIÓN'}</span> */}
          {TOOL_LABELS[tool] && (
            <span className="dc-status-presence">Herramienta: {TOOL_LABELS[tool]} //</span>
          )}
          {selectedIds.length > 0 && (
            <span className="dc-status-presence">Seleccionada: {selectedIds.length} //</span>
          )}
          <span className="dc-status-presence">Conectados: {presence.clients} // Editores: {presence.editors} // OBS: {presence.overlays}</span>
          {mediaStatus && <span className="dc-media-status">{mediaStatus}</span>}
          
          <button type="button" className="dc-status-hotkeys" onClick={() => setHotkeysOpen(true)}>ATAJOS [?]</button>
        </div>
      </main>

      <div className="dc-editor-layers-sidebar">
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
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={duplicateSelected}
        />
      </div>

      <HotkeysModal open={hotkeysOpen} onClose={() => setHotkeysOpen(false)} />
      {designsOpen && <SavedDesignsModal initialView={designsIntent} onClose={() => { setDesignsOpen(false); refreshRecentDesigns(); }} channelUuid={channelUuid} buildSnapshot={buildDesignSnapshot} onLoad={loadDesignSnapshot} hasScene={Object.keys(objects).length > 0} liveEnabled={liveEnabled} />}
    </div>
  );
}
