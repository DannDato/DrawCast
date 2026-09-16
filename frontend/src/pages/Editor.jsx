import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { importChannelImageUrl, uploadChannelImage } from '../api/media';
import { useChannelSocket } from '../hooks/useChannelSocket';
import CanvasStage from '../components/editor/CanvasStage';
import Inspector from '../components/editor/Inspector';
import LayersPanel from '../components/editor/LayersPanel';
import Toolbar from '../components/editor/Toolbar';
import HotkeysModal from '../components/editor/hotkeys/HotkeysModal';
import { makeImage, makeShape, makeText, makeTimer } from '../components/editor/objectFactory';
import { createGroupPatches, duplicateSelection, selectedGroupIds, ungroupPatches } from '../components/editor/groups/groupUtils';
import { moveSelectionOneLevel, reorderLayerUnits } from '../components/editor/layers/layerUtils';
import { DEFAULT_SHAPE_CONFIG } from '../components/editor/tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG, fitImageSize, getImageKind, loadImageMetadata, validateImageFile } from '../components/editor/tools/images/imageTool';
import { DEFAULT_TEXT_CONFIG, applyTextStyle, updateTextContent } from '../components/editor/tools/text/textTool';
import { DEFAULT_TIMER_CONFIG, adjustTimerSeconds, applyTimerConfig, toggleTimer } from '../components/editor/tools/timer/timerTool';
import { DEFAULT_DRAW_CONFIG, appendStrokeToLayer, clearDrawLayer, isDrawLayer, makeDrawLayer, pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';
import { applyHistoryEntry, cloneValue, makeHistoryEntry, pushHistoryEntry } from '../components/editor/history/historyUtils';
import { createClipboardPayload, materializeClipboardPayload, parseClipboardText, serializeClipboardPayload } from '../components/editor/clipboard/clipboardUtils';

export default function Editor() {
  const { publicKey } = useParams();
  const [channelId, setChannelId] = useState(null);
  const [objects, setObjects] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const [guide, setGuide] = useState(() => {
    try { return localStorage.getItem('drawcast.editor.guide') || 'none'; } catch { return 'none'; }
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
  const objectsRef = useRef({});
  const historyStartRef = useRef(null);
  const nudgeActiveRef = useRef(false);

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
    'sync-state': ({ objects: list }) => {
      const next = Object.fromEntries(list.map((object) => [object.id, object]));
      objectsRef.current = next;
      setObjects(next);
      setHistory({ past: [], future: [] });
      historyStartRef.current = null;
    },
    'obj-upsert': (object) => {
      if (historyStartRef.current) historyStartRef.current.before[object.id] = cloneValue(object);
      const next = { ...objectsRef.current, [object.id]: object };
      objectsRef.current = next;
      setObjects(next);
    },
    'obj-remove': ({ id }) => {
      if (historyStartRef.current) delete historyStartRef.current.before[id];
      const next = { ...objectsRef.current };
      delete next[id];
      objectsRef.current = next;
      setObjects(next);
      setSelectedIds((current) => {
        const selected = current.filter((item) => item !== id);
        setSelectedId((primary) => primary === id ? selected.at(-1) || null : primary);
        return selected;
      });
    },
    'draw-live': (payload) => setLiveStrokes((current) => reduceLiveStrokeMap(current, payload)),
    'clear-all': () => {
      if (historyStartRef.current) historyStartRef.current.before = {};
      objectsRef.current = {};
      setObjects({});
      setSelectedIds([]);
      setSelectedId(null);
      setLiveStrokes({});
    }
  }), []);

  const { socket, presence, connected, denied } = useChannelSocket(publicKey, 'editor', handlers);

  const beginHistory = (label = 'EDIT') => {
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
    if (!object?.id) return;
    updateScene((current) => ({ ...current, [object.id]: object }));
    socket.emit('obj-upsert', object);
  };

  const applyUpdates = (updates = []) => {
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

  const patchWithHistory = (id, patchData, label = 'LAYER EDIT') => {
    if (!objectsRef.current[id]) return;
    beginHistory(label);
    patch(id, patchData);
    commitHistory(label);
  };

  const applyUpdatesWithHistory = (updates = [], label = 'LAYERS EDIT') => {
    if (!updates.some(({ id }) => objectsRef.current[id])) return;
    beginHistory(label);
    applyUpdates(updates);
    commitHistory(label);
  };

  const add = (object, options = {}) => {
    if (!object?.id) return;
    if (options.history !== false) beginHistory(options.label || 'ADD LAYER');
    upsert(object);
    setSelectedIds([object.id]);
    setSelectedId(object.id);
    if (options.history !== false) commitHistory(options.label || 'ADD LAYER');
  };

  const addMany = (list, options = {}) => {
    if (!list.length) return;
    if (options.history !== false) beginHistory(options.label || 'ADD LAYERS');
    updateScene((current) => {
      const next = { ...current };
      list.forEach((object) => { next[object.id] = object; });
      return next;
    });
    list.forEach((object) => socket.emit('obj-upsert', object));
    setSelectedIds(list.map((object) => object.id));
    setSelectedId(list.at(-1)?.id || null);
    if (options.history !== false) commitHistory(options.label || 'ADD LAYERS');
  };

  const clear = () => {
    if (!Object.keys(objectsRef.current).length) return;
    beginHistory('PURGE CANVAS');
    setScene({});
    setSelectedIds([]);
    setSelectedId(null);
    setActiveDrawLayerId(null);
    setLiveStrokes({});
    socket.emit('clear-all');
    commitHistory('PURGE CANVAS');
  };

  const syncHistoryResult = (result) => {
    setScene(result.next);
    result.removals.forEach((id) => socket.emit('obj-remove', { id }));
    result.upserts.forEach((object) => socket.emit('obj-upsert', object));
    setSelectedIds([]);
    setSelectedId(null);
    setActiveDrawLayerId(null);
    setLiveStrokes({});
    return result;
  };

  const undo = () => {
    const entry = history.past.at(-1);
    if (!entry) return;
    cancelHistory();
    const result = syncHistoryResult(applyHistoryEntry(objectsRef.current, entry, 'undo'));
    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: result.applied.length ? [entry, ...current.future] : current.future
    }));
    if (result.skipped.length) setMediaStatus(`UNDO PARTIAL // ${result.skipped.length} LAYER(S) CHANGED BY COLLABORATOR`);
  };

  const redo = () => {
    const entry = history.future[0];
    if (!entry) return;
    cancelHistory();
    const result = syncHistoryResult(applyHistoryEntry(objectsRef.current, entry, 'redo'));
    setHistory((current) => ({
      past: result.applied.length ? pushHistoryEntry(current.past, entry) : current.past,
      future: current.future.slice(1)
    }));
    if (result.skipped.length) setMediaStatus(`REDO PARTIAL // ${result.skipped.length} LAYER(S) CHANGED BY COLLABORATOR`);
  };

  const removeLayers = (ids = selectedIds, options = {}) => {
    const targets = [...new Set(ids)].filter((id) => objectsRef.current[id]);
    if (!targets.length) return;
    if (options.history !== false) beginHistory(options.label || 'DELETE LAYERS');
    targets.forEach((id) => socket.emit('obj-remove', { id }));
    updateScene((current) => {
      const next = { ...current };
      targets.forEach((id) => delete next[id]);
      return next;
    });
    const remainingSelection = selectedIds.filter((id) => !targets.includes(id));
    if (activeDrawLayerId && targets.includes(activeDrawLayerId)) setActiveDrawLayerId(null);
    setSelectedIds(remainingSelection);
    setSelectedId(remainingSelection.at(-1) || null);
    if (options.history !== false) commitHistory(options.label || 'DELETE LAYERS');
  };

  const groupSelection = () => {
    const transformable = selectedIds.filter((id) => {
      const object = objectsRef.current[id];
      return object && [object.x, object.y, object.w, object.h].every((value) => Number.isFinite(Number(value)));
    });
    if (transformable.length < 2) return;

    const result = createGroupPatches(objectsRef.current, transformable);
    if (!result.updates.length) return;
    beginHistory('GROUP LAYERS');
    applyUpdates(result.updates);
    commitHistory('GROUP LAYERS');
    setSelection(transformable, transformable.at(-1));
  };

  const ungroupSelection = () => {
    const updates = ungroupPatches(objectsRef.current, selectedIds);
    if (!updates.length) return;
    beginHistory('UNGROUP LAYERS');
    applyUpdates(updates);
    commitHistory('UNGROUP LAYERS');
  };

  const duplicateSelected = () => {
    const result = duplicateSelection(objectsRef.current, selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
    addMany(result.objects, { label: 'DUPLICATE LAYERS' });
  };

  const copySelection = (clipboardEvent = null) => {
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    const payload = createClipboardPayload(objectsRef.current, ids);
    if (!payload) return null;

    const serialized = serializeClipboardPayload(payload);
    setClipboardPayload(payload);
    setPasteSerial(1);
    setMediaStatus(`COPIED // ${payload.objects.length} LAYER(S)`);

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
    addMany(result.objects, { label: 'PASTE LAYERS' });
    setClipboardPayload(payload);
    setPasteSerial((current) => Math.max(current, serial) + 1);
    setTool('select');
    setMediaStatus(`PASTED // ${result.objects.length} LAYER(S)`);
  };

  const cutSelection = (clipboardEvent = null) => {
    const ids = selectedIds.length ? [...selectedIds] : selectedId ? [selectedId] : [];
    if (!ids.length) return;
    const payload = copySelection(clipboardEvent);
    if (!payload) return;
    removeLayers(ids, { label: 'CUT LAYERS' });
    setMediaStatus(`CUT // ${ids.length} LAYER(S)`);
  };

  const selectAllLayers = () => {
    const ids = Object.values(objectsRef.current)
      .filter((object) => !object.hidden)
      .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))
      .map((object) => object.id);
    setSelection(ids, ids[0] || null);
  };

  const reorderLayers = (draggedId, targetId) => {
    const updates = reorderLayerUnits(objectsRef.current, draggedId, targetId);
    if (!updates.length) return;
    beginHistory('REORDER LAYERS');
    applyUpdates(updates);
    commitHistory('REORDER LAYERS');
  };

  const moveSelectedLayer = (direction) => {
    const updates = moveSelectionOneLevel(objectsRef.current, selectedIds, direction);
    if (!updates.length) return;
    beginHistory('MOVE LAYER');
    applyUpdates(updates);
    commitHistory('MOVE LAYER');
  };

  const requestClear = () => {
    if (!Object.keys(objectsRef.current).length) return;
    const confirmed = window.confirm('PURGE CANVA DATA?\n\nThis clears the current runtime canvas for every connected client. You can Undo immediately after if no collaborator changes the scene.');
    if (!confirmed) return;
    clear();
  };

  const nudgeSelection = (dx, dy) => {
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
      beginHistory('NUDGE LAYERS');
      nudgeActiveRef.current = true;
    }
    applyUpdates(updates);
    return true;
  };

  const finishNudge = () => {
    if (!nudgeActiveRef.current) return;
    nudgeActiveRef.current = false;
    commitHistory('NUDGE LAYERS');
  };


  const activeDrawLayer = activeDrawLayerId && isDrawLayer(objects[activeDrawLayerId]) ? objects[activeDrawLayerId] : null;

  const createDrawLayer = () => {
    const layer = makeDrawLayer(objectsRef.current);
    beginHistory('NEW DRAW LAYER');
    upsert(layer);
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
    commitHistory('NEW DRAW LAYER');
    return layer;
  };

  const ensureDrawLayer = () => {
    if (activeDrawLayer) return activeDrawLayer;
    const existing = Object.values(objectsRef.current).filter(isDrawLayer).sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0];
    if (existing) {
      setActiveDrawLayerId(existing.id);
      return existing;
    }
    return createDrawLayer();
  };

  const clearActiveDrawLayer = () => {
    const layer = ensureDrawLayer();
    if (!layer || !(layer.lineas || []).length) return;
    beginHistory('CLEAR DRAW LAYER');
    upsert(clearDrawLayer(layer));
    commitHistory('CLEAR DRAW LAYER');
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
      point
    });
  };

  const startDrawStroke = (stroke, layer) => emitLiveStroke('start', stroke, layer, stroke.points?.[0]);
  const continueDrawStroke = (strokeId, point) => {
    const layer = activeDrawLayerId ? objectsRef.current[activeDrawLayerId] : null;
    if (!layer) return;
    socket.emit('draw-live', { phase: 'point', strokeId, point });
  };
  const commitDrawStroke = (stroke) => {
    const layer = objectsRef.current[stroke.layerId];
    if (!layer || !isDrawLayer(layer)) return;
    beginHistory(stroke.mode === 'erase' ? 'ERASE STROKE' : 'DRAW STROKE');
    upsert(appendStrokeToLayer(layer, stroke));
    emitLiveStroke('end', stroke, layer);
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
    commitHistory(stroke.mode === 'erase' ? 'ERASE STROKE' : 'DRAW STROKE');
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
    try { localStorage.setItem('drawcast.editor.guide', guide); } catch { /* noop */ }
  }, [guide]);

  useEffect(() => {
    api.get('/channels/mine').then(({ data }) => {
      const allChannels = [data.owned, ...(data.collaborations || [])].filter(Boolean);
      setChannelId(allChannels.find((channel) => channel.publicKey === publicKey)?.id || null);
    });
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
      p: 'draw',
      e: 'eraser',
      i: 'image',
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
      if (isEditableTarget(event.target)) return;

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
        setMediaStatus(guideByKey[event.key] === 'none' ? 'GUIDE // OFF' : `GUIDE // ${event.key}`);
        return;
      }

      if (!modifier && !event.altKey && !event.shiftKey && toolByKey[key]) {
        event.preventDefault();
        setTool(toolByKey[key]);
        setMediaStatus(`TOOL // ${toolByKey[key].toUpperCase()}`);
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
          setMediaStatus('TOOL // SELECT');
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
    const rawX = point && Number.isFinite(point.x) ? point.x : 200;
    const rawY = point && Number.isFinite(point.y) ? point.y : 200;
    const x = Math.max(0, Math.min(1920 - size.w, rawX));
    const y = Math.max(0, Math.min(1080 - size.h, rawY));

    add(makeImage(x, y, url, name, {
      ...imageConfig,
      ...size,
      ...metadata,
      mimeType,
      mediaKind: getImageKind(mimeType, name)
    }));
    setTool('select');
  };

  const uploadFile = async (file, point = null) => {
    if (!channelId) {
      setMediaStatus('CHANNEL NOT READY');
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setMediaStatus(validationError);
      return;
    }

    setMediaStatus(`UPLOADING // ${file.name}`);
    try {
      const data = await uploadChannelImage(channelId, file);
      await addMediaObject({ url: data.url, name: file.name, mimeType: data.mimeType || file.type, point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'IMAGE'} READY // ${file.name}`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'UPLOAD FAILED');
    }
  };

  const importRemote = async (url, point = null) => {
    if (!channelId) {
      setMediaStatus('CHANNEL NOT READY');
      return;
    }

    setMediaStatus('IMPORTING REMOTE IMAGE...');
    try {
      const data = await importChannelImageUrl(channelId, url);
      const name = data.fileName || 'Imagen web';
      await addMediaObject({ url: data.url, name, mimeType: data.mimeType || '', point });
      setMediaStatus(`${data.mediaKind === 'gif' ? 'GIF' : 'IMAGE'} IMPORTED`);
    } catch (error) {
      setMediaStatus(error.response?.data?.message || error.response?.data?.error || 'REMOTE IMPORT FAILED');
    }
  };

  const commitText = ({ id, x, y, text, config }) => {
    if (id && objectsRef.current[id]) {
      beginHistory('EDIT TEXT');
      upsert(updateTextContent({ ...objectsRef.current[id], x, y }, text, config));
      commitHistory('EDIT TEXT');
      setSelection([id], id);
    } else {
      add(makeText(x, y, text, config));
    }
    setTool('select');
  };

  const singleSelected = selectedIds.length === 1 ? objects[selectedId] : null;

  const patchSelectedText = (patchData) => {
    const current = singleSelected;
    if (!current || (current.tipo !== 'text' && current.tipo !== 'texto')) return;
    beginHistory('TEXT STYLE');
    upsert(applyTextStyle(current, patchData));
    commitHistory('TEXT STYLE');
  };

  const createTimer = (point) => {
    add(makeTimer(point.x, point.y, timerConfig));
    setTool('select');
  };

  const patchSelectedTimer = (patchData) => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    beginHistory('TIMER EDIT');
    upsert(applyTimerConfig(current, patchData));
    commitHistory('TIMER EDIT');
  };

  const toggleSelectedTimer = () => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    beginHistory('TIMER TOGGLE');
    upsert(toggleTimer(current));
    commitHistory('TIMER TOGGLE');
  };

  const adjustSelectedTimer = (deltaSeconds) => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    beginHistory('TIMER ADJUST');
    upsert(adjustTimerSeconds(current, deltaSeconds));
    commitHistory('TIMER ADJUST');
  };

  if (denied) return <div className="dc-denied">ACCESS DENIED // <Link to="/app">RETURN</Link></div>;

  return (
    <div className="dc-editor">
      <aside className="dc-editor-sidebar">
        <Toolbar tool={tool} setTool={setTool} guide={guide} setGuide={setGuide} onClear={requestClear} onUndo={undo} onRedo={redo} onCopy={() => copySelection()} onCut={() => cutSelection()} onPaste={() => pasteClipboard()} onHotkeys={() => setHotkeysOpen(true)} canUndo={history.past.length > 0} canRedo={history.future.length > 0} canCopy={selectedIds.length > 0} canPaste={Boolean(clipboardPayload?.objects?.length)} connected={connected} />

        <LayersPanel
          objects={objects}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          onPatch={(id, patchData) => patchWithHistory(id, patchData, 'LAYER EDIT')}
          onPatchMany={(updates) => applyUpdatesWithHistory(updates, 'LAYERS EDIT')}
          onRemove={removeLayers}
          onReorder={reorderLayers}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={duplicateSelected}
        />
      </aside>

      <main className="dc-workspace">
        <div className="dc-watermark">DrawCast <span>// DannDato</span></div>

        <CanvasStage
          objects={objects}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          onPatchObject={patch}
          onPatchObjects={applyUpdates}
          onTransformStart={() => beginHistory('TRANSFORM')}
          onTransformEnd={() => commitHistory('TRANSFORM')}
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
        />

        <div className="dc-status">
          <span className={`dc-status-chip connection ${connected ? 'online' : 'offline'}`}>{connected ? 'ONLINE' : 'OFFLINE'}</span>
          <span className="dc-status-chip">TOOL // {tool.toUpperCase()}</span>
          <span className="dc-status-chip">SELECTED // {selectedIds.length}</span>
          <span className="dc-status-presence">CLIENTS {presence.clients} // EDITORS {presence.editors} // OBS {presence.overlays}</span>
          {mediaStatus && <span className="dc-media-status">{mediaStatus}</span>}
          <button type="button" className="dc-status-hotkeys" onClick={() => setHotkeysOpen(true)}>HOTKEYS [?]</button>
        </div>

      </main>

      <Inspector
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
        channelId={channelId}
        onUploadFile={uploadFile}
        onImportUrl={importRemote}
        onPatch={(patchData) => selectedId && patchWithHistory(selectedId, patchData, 'LAYER EDIT')}
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
      />

      <HotkeysModal open={hotkeysOpen} onClose={() => setHotkeysOpen(false)} />
    </div>
  );
}
