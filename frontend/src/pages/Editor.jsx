import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { importChannelImageUrl, uploadChannelImage } from '../api/media';
import { useChannelSocket } from '../hooks/useChannelSocket';
import CanvasStage from '../components/editor/CanvasStage';
import Inspector from '../components/editor/Inspector';
import LayersPanel from '../components/editor/LayersPanel';
import Toolbar from '../components/editor/Toolbar';
import { makeImage, makeShape, makeText, makeTimer } from '../components/editor/objectFactory';
import { createGroupPatches, duplicateSelection, selectedGroupIds, ungroupPatches } from '../components/editor/groups/groupUtils';
import { moveSelectionOneLevel, reorderLayerUnits } from '../components/editor/layers/layerUtils';
import { DEFAULT_SHAPE_CONFIG } from '../components/editor/tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG, fitImageSize, getImageKind, loadImageMetadata, validateImageFile } from '../components/editor/tools/images/imageTool';
import { DEFAULT_TEXT_CONFIG, applyTextStyle, updateTextContent } from '../components/editor/tools/text/textTool';
import { DEFAULT_TIMER_CONFIG, adjustTimerSeconds, applyTimerConfig, toggleTimer } from '../components/editor/tools/timer/timerTool';
import { DEFAULT_DRAW_CONFIG, appendStrokeToLayer, clearDrawLayer, isDrawLayer, makeDrawLayer, pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';

export default function Editor() {
  const { publicKey } = useParams();
  const [channelId, setChannelId] = useState(null);
  const [objects, setObjects] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const [guide, setGuide] = useState('none');
  const [drawConfig, setDrawConfig] = useState(DEFAULT_DRAW_CONFIG);
  const [activeDrawLayerId, setActiveDrawLayerId] = useState(null);
  const [liveStrokes, setLiveStrokes] = useState({});
  const [shapeConfig, setShapeConfig] = useState(DEFAULT_SHAPE_CONFIG);
  const [imageConfig, setImageConfig] = useState(DEFAULT_IMAGE_CONFIG);
  const [textConfig, setTextConfig] = useState(DEFAULT_TEXT_CONFIG);
  const [timerConfig, setTimerConfig] = useState(DEFAULT_TIMER_CONFIG);
  const [history, setHistory] = useState([]);
  const [mediaStatus, setMediaStatus] = useState('');

  const handlers = useMemo(() => ({
    'sync-state': ({ objects: list }) => setObjects(Object.fromEntries(list.map((object) => [object.id, object]))),
    'obj-upsert': (object) => setObjects((current) => ({ ...current, [object.id]: object })),
    'obj-remove': ({ id }) => {
      setObjects((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setSelectedIds((current) => {
        const next = current.filter((item) => item !== id);
        setSelectedId((primary) => primary === id ? next.at(-1) || null : primary);
        return next;
      });
    },
    'draw-live': (payload) => setLiveStrokes((current) => reduceLiveStrokeMap(current, payload)),
    'clear-all': () => {
      setObjects({});
      setSelectedIds([]);
      setSelectedId(null);
      setLiveStrokes({});
    }
  }), []);

  const { socket, presence, connected, denied } = useChannelSocket(publicKey, 'editor', handlers);

  const snapshot = () => setHistory((current) => [...current.slice(-29), objects]);

  const setSelection = (ids = [], primaryId = null) => {
    const unique = [...new Set(ids)].filter((id) => objects[id]);
    const primary = primaryId && unique.includes(primaryId) ? primaryId : unique.at(-1) || null;
    setSelectedIds(unique);
    setSelectedId(primary);
  };

  const select = (id, options = {}) => {
    const { append = false } = options;
    if (id && isDrawLayer(objects[id])) setActiveDrawLayerId(id);
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
    setObjects((current) => ({ ...current, [object.id]: object }));
    socket.emit('obj-upsert', object);
  };

  const applyUpdates = (updates = []) => {
    const valid = updates.filter(({ id }) => objects[id]);
    if (!valid.length) return;

    const nextObjects = valid.map(({ id, patch }) => ({ ...objects[id], ...patch }));
    setObjects((current) => {
      const next = { ...current };
      nextObjects.forEach((object) => { next[object.id] = { ...next[object.id], ...object }; });
      return next;
    });
    nextObjects.forEach((object) => socket.emit('obj-upsert', object));
  };

  const patch = (id, patchData) => applyUpdates([{ id, patch: patchData }]);

  const add = (object) => {
    snapshot();
    upsert(object);
    setSelectedIds([object.id]);
    setSelectedId(object.id);
  };

  const addMany = (list, options = {}) => {
    if (!list.length) return;
    if (options.snapshot !== false) snapshot();
    setObjects((current) => {
      const next = { ...current };
      list.forEach((object) => { next[object.id] = object; });
      return next;
    });
    list.forEach((object) => socket.emit('obj-upsert', object));
    setSelectedIds(list.map((object) => object.id));
    setSelectedId(list.at(-1)?.id || null);
  };

  const clear = () => {
    snapshot();
    setObjects({});
    setSelectedIds([]);
    setSelectedId(null);
    setActiveDrawLayerId(null);
    setLiveStrokes({});
    socket.emit('clear-all');
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setObjects(previous);
    setSelectedIds([]);
    setSelectedId(null);
    setActiveDrawLayerId(null);
    setLiveStrokes({});
    socket.emit('clear-all');
    Object.values(previous).forEach((object) => socket.emit('obj-upsert', object));
  };

  const removeLayers = (ids = selectedIds) => {
    const targets = [...new Set(ids)].filter((id) => objects[id]);
    if (!targets.length) return;
    snapshot();
    targets.forEach((id) => socket.emit('obj-remove', { id }));
    setObjects((current) => {
      const next = { ...current };
      targets.forEach((id) => delete next[id]);
      return next;
    });
    const remainingSelection = selectedIds.filter((id) => !targets.includes(id));
    if (activeDrawLayerId && targets.includes(activeDrawLayerId)) setActiveDrawLayerId(null);
    setSelectedIds(remainingSelection);
    setSelectedId(remainingSelection.at(-1) || null);
  };

  const groupSelection = () => {
    const transformable = selectedIds.filter((id) => {
      const object = objects[id];
      return object && [object.x, object.y, object.w, object.h].every((value) => Number.isFinite(Number(value)));
    });
    if (transformable.length < 2) return;

    const result = createGroupPatches(objects, transformable);
    if (!result.updates.length) return;
    snapshot();
    applyUpdates(result.updates);
    setSelection(transformable, transformable.at(-1));
  };

  const ungroupSelection = () => {
    const updates = ungroupPatches(objects, selectedIds);
    if (!updates.length) return;
    snapshot();
    applyUpdates(updates);
  };

  const duplicateSelected = () => {
    const result = duplicateSelection(objects, selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
    addMany(result.objects);
  };

  const reorderLayers = (draggedId, targetId) => {
    const updates = reorderLayerUnits(objects, draggedId, targetId);
    if (!updates.length) return;
    snapshot();
    applyUpdates(updates);
  };

  const moveSelectedLayer = (direction) => {
    const updates = moveSelectionOneLevel(objects, selectedIds, direction);
    if (!updates.length) return;
    snapshot();
    applyUpdates(updates);
  };


  const activeDrawLayer = activeDrawLayerId && isDrawLayer(objects[activeDrawLayerId]) ? objects[activeDrawLayerId] : null;

  const createDrawLayer = () => {
    const layer = makeDrawLayer(objects);
    snapshot();
    upsert(layer);
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
    return layer;
  };

  const ensureDrawLayer = () => {
    if (activeDrawLayer) return activeDrawLayer;
    const existing = Object.values(objects).filter(isDrawLayer).sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0];
    if (existing) {
      setActiveDrawLayerId(existing.id);
      return existing;
    }
    return createDrawLayer();
  };

  const clearActiveDrawLayer = () => {
    const layer = ensureDrawLayer();
    if (!layer || !(layer.lineas || []).length) return;
    snapshot();
    upsert(clearDrawLayer(layer));
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
    const layer = activeDrawLayerId ? objects[activeDrawLayerId] : null;
    if (!layer) return;
    socket.emit('draw-live', { phase: 'point', strokeId, point });
  };
  const commitDrawStroke = (stroke) => {
    const layer = objects[stroke.layerId];
    if (!layer || !isDrawLayer(layer)) return;
    snapshot();
    upsert(appendStrokeToLayer(layer, stroke));
    emitLiveStroke('end', stroke, layer);
    setActiveDrawLayerId(layer.id);
    setSelection([layer.id], layer.id);
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
    api.get('/channels/mine').then(({ data }) => {
      const allChannels = [data.owned, ...(data.collaborations || [])].filter(Boolean);
      setChannelId(allChannels.find((channel) => channel.publicKey === publicKey)?.id || null);
    });
  }, [publicKey]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return;

      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier && event.key.toLowerCase() === 'p') { setTool('draw'); return; }
      if (!modifier && event.key.toLowerCase() === 'e') { setTool('eraser'); return; }
      if (modifier && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        if (event.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeLayers();
        return;
      }
      if (event.key === 'Escape') setSelection([]);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    if (id && objects[id]) {
      snapshot();
      upsert(updateTextContent({ ...objects[id], x, y }, text, config));
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
    upsert(applyTextStyle(current, patchData));
  };

  const createTimer = (point) => {
    add(makeTimer(point.x, point.y, timerConfig));
    setTool('select');
  };

  const patchSelectedTimer = (patchData) => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    upsert(applyTimerConfig(current, patchData));
  };

  const toggleSelectedTimer = () => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    upsert(toggleTimer(current));
  };

  const adjustSelectedTimer = (deltaSeconds) => {
    const current = singleSelected;
    if (!current || current.tipo !== 'timer') return;
    upsert(adjustTimerSeconds(current, deltaSeconds));
  };

  if (denied) return <div className="dc-denied">ACCESS DENIED // <Link to="/app">RETURN</Link></div>;

  return (
    <div className="dc-editor">
      <Toolbar tool={tool} setTool={setTool} guide={guide} setGuide={setGuide} onClear={clear} onUndo={undo} connected={connected} />

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
          onTransformStart={snapshot}
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
          <b>{connected ? 'ONLINE' : 'OFFLINE'}</b>
          CLIENTS {presence.clients} // EDITORS {presence.editors} // OBS {presence.overlays}
          {mediaStatus && <span className="dc-media-status"> // {mediaStatus}</span>}
        </div>

        <LayersPanel
          objects={objects}
          selectedIds={selectedIds}
          onSelect={select}
          onSelectMany={setSelection}
          onPatch={patch}
          onPatchMany={applyUpdates}
          onRemove={removeLayers}
          onReorder={reorderLayers}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={duplicateSelected}
        />
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
        onPatch={(patchData) => selectedId && patch(selectedId, patchData)}
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
    </div>
  );
}
