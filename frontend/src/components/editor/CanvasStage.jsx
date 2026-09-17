import { useEffect, useRef, useState } from 'react';
import { drawObject, hitObject } from './renderer/drawObject';
import { orderedObjects, renderScene } from './renderer/sceneRenderer';
import { boundsOverlap, drawMarquee, drawMultiSelection, getObjectBounds, getObjectFrame, getSelectionBounds, hitResizeHandle, hitRotateHandle, resizeCursorForHandle, resizeSelectionFromHandle, rotateSelection } from './renderer/selectionRenderer';
import { buildShapeFromDrag } from './tools/shapes/shapeTool';
import InlineTextEditor from './tools/text/InlineTextEditor';
import { textConfigFromObject } from './tools/text/textTool';
import { appendStrokePoint, hitDrawLayer, isDrawLayer, makeStroke } from './tools/drawing/drawingTool';
import { boundsCenter, unrotatePointAround } from './renderer/transformUtils';
import { buildSnapTargets, drawSnapGuides, SNAP_THRESHOLD_PX, snapMove, snapResizePointer } from './renderer/snapUtils';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FRAME_MS = 1000 / 30;

export default function CanvasStage({
  objects,
  selectedId,
  selectedIds = [],
  onSelect,
  onSelectMany,
  onOpenProperties,
  onPatchObjects,
  onTransformStart,
  onTransformEnd,
  snapEnabled = true,
  tool,
  drawConfig,
  activeDrawLayer,
  liveStrokes = {},
  onDrawStart,
  onDrawPoint,
  onDrawCommit,
  shapeConfig,
  onShapeCreate,
  textConfig,
  onTextCommit,
  onTimerCreate,
  onMediaDrop,
  guide,
  remoteCursors = [],
  onCursorMove,
  onCursorLeave,
  interactionDisabled = false
}) {
  const canvasRef = useRef(null);
  const interaction = useRef(null);
  const drawing = useRef(null);
  const shapePreview = useRef(null);
  const marquee = useRef(null);
  const snapGuides = useRef(null);
  const guideImage = useRef(null);
  const remoteCursorsRef = useRef(remoteCursors);
  const [mediaDragging, setMediaDragging] = useState(false);
  const [textEditor, setTextEditor] = useState(null);
  const [pointerCursor, setPointerCursor] = useState('');

  useEffect(() => { remoteCursorsRef.current = remoteCursors; }, [remoteCursors]);

  useEffect(() => {
    if (!guide || guide === 'none') {
      guideImage.current = null;
      return;
    }

    const image = new Image();
    image.src = `/img/${guide}`;
    guideImage.current = image;
  }, [guide]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrame;
    let lastFrame = 0;
    let active = true;

    const render = (timestamp = 0) => {
      if (!active || !canvas.isConnected) return;
      if (timestamp - lastFrame >= FRAME_MS || timestamp === 0) {
        renderScene(ctx, objects, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, grid: true, now: Date.now(), liveStrokes });

        const activeGuide = guideImage.current;
        if (activeGuide?.complete && activeGuide.naturalWidth) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.drawImage(activeGuide, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.restore();
        }

        if (drawing.current) {
          drawObject(ctx, { id: 'draw_preview', tipo: 'draw', x: Number(activeDrawLayer?.x) || 0, y: Number(activeDrawLayer?.y) || 0, w: Number(activeDrawLayer?.w) || CANVAS_WIDTH, h: Number(activeDrawLayer?.h) || CANVAS_HEIGHT, sourceWidth: Number(activeDrawLayer?.sourceWidth) || CANVAS_WIDTH, sourceHeight: Number(activeDrawLayer?.sourceHeight) || CANVAS_HEIGHT, rotation: Number(activeDrawLayer?.rotation) || 0, lineas: [drawing.current], zIndex: Number.MAX_SAFE_INTEGER });
        }

        if (shapePreview.current) {
          ctx.save();
          ctx.globalAlpha = 0.72;
          drawObject(ctx, shapePreview.current);
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--dc-accent').trim() || '#ff315c';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.strokeRect(shapePreview.current.x - 4, shapePreview.current.y - 4, shapePreview.current.w + 8, shapePreview.current.h + 8);
          ctx.restore();
        }

        const accent = getComputedStyle(document.documentElement).getPropertyValue('--dc-accent').trim() || '#ff315c';
        const selection = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
        const cssScale = Math.max(0.01, canvas.getBoundingClientRect().width / CANVAS_WIDTH);
        drawMultiSelection(ctx, selection.map((id) => objects[id]).filter(Boolean), accent, { handleSize: 10 / cssScale, rotateHandleDistance: 34 / cssScale });
        drawSnapGuides(ctx, snapGuides.current, accent, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

        const cursorScale = 1 / cssScale;
        const now = Date.now();
        remoteCursorsRef.current.forEach((cursor) => {
          if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return;
          const age = Math.max(0, now - Number(cursor.at || now));
          if (age > 12000) return;
          const alpha = age > 7000 ? Math.max(0, 1 - ((age - 7000) / 5000)) : 1;
          const color = cursor.color || '#4cc9f0';
          const name = String(cursor.cursorLabel || 'Editor').slice(0, 32);

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cursor.x, cursor.y);
          ctx.scale(cursorScale, cursorScale);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(3, 20);
          ctx.lineTo(8, 15);
          ctx.lineTo(13, 24);
          ctx.lineTo(17, 22);
          ctx.lineTo(12, 13);
          ctx.lineTo(20, 12);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.strokeStyle = '#090a0c';
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          ctx.font = '700 12px Outfit, sans-serif';
          const textWidth = Math.ceil(ctx.measureText(name).width);
          const labelX = 17;
          const labelY = 18;
          ctx.fillStyle = '#090a0c';
          ctx.fillRect(labelX, labelY - 13, textWidth + 14, 22);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(labelX, labelY - 13, textWidth + 14, 22);
          ctx.fillStyle = color;
          ctx.fillText(name, labelX + 7, labelY + 2);
          ctx.restore();
        });

        if (marquee.current) drawMarquee(ctx, marquee.current.start, marquee.current.end, accent);
        lastFrame = timestamp;
      }

      if (active && canvas.isConnected) animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [objects, selectedId, selectedIds, liveStrokes, activeDrawLayer]);

  const pointFromEvent = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * CANVAS_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * CANVAS_HEIGHT / bounds.height
    };
  };

  const topObjectAt = (point) => orderedObjects(objects).reverse().find((object) => isDrawLayer(object) ? hitDrawLayer(object, point.x, point.y) : hitObject(object, point.x, point.y));

  const pointForDrawLayer = (point, layer = activeDrawLayer) => {
    if (!layer) return point;
    const sourceWidth = Math.max(1, Number(layer.sourceWidth) || CANVAS_WIDTH);
    const sourceHeight = Math.max(1, Number(layer.sourceHeight) || CANVAS_HEIGHT);
    const scaleX = Math.max(0.0001, (Number(layer.w) || sourceWidth) / sourceWidth);
    const scaleY = Math.max(0.0001, (Number(layer.h) || sourceHeight) / sourceHeight);
    const frame = getObjectFrame(layer);
    const canvasPoint = frame && Number(layer.rotation) ? unrotatePointAround(point, boundsCenter(frame), Number(layer.rotation) || 0) : point;
    return { x: (canvasPoint.x - (Number(layer.x) || 0)) / scaleX, y: (canvasPoint.y - (Number(layer.y) || 0)) / scaleY };
  };

  const groupIdsForObject = (object) => {
    if (!object?.groupId) return object?.id ? [object.id] : [];
    return Object.values(objects).filter((candidate) => candidate?.groupId === object.groupId).map((candidate) => candidate.id);
  };

  const openTextEditor = (point, object = null) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    const scale = bounds.width / CANVAS_WIDTH;
    const x = object ? Number(object.x) || point.x : point.x;
    const y = object ? Number(object.y) || point.y : point.y;

    setTextEditor({
      id: object?.id || `new_${Date.now()}`,
      objectId: object?.id || null,
      x,
      y,
      screenX: bounds.left + (x * scale),
      screenY: bounds.top + (y * scale),
      scale,
      initialText: object?.text ?? object?.texto ?? '',
      config: object ? textConfigFromObject(object) : textConfig
    });
  };

  const onPointerDown = (event) => {
    if (interactionDisabled || event.button !== 0) return;

    const canvas = canvasRef.current;
    const point = pointFromEvent(event);
    canvas.setPointerCapture?.(event.pointerId);

    if (tool === 'draw' || tool === 'eraser') {
      if (!activeDrawLayer) return;
      const localPoint = pointForDrawLayer(point);
      drawing.current = makeStroke({
        layerId: activeDrawLayer.id,
        mode: tool === 'eraser' ? 'erase' : 'paint',
        config: drawConfig,
        point: localPoint
      });
      onDrawStart?.(drawing.current, activeDrawLayer);
      return;
    }

    if (tool === 'shape') {
      interaction.current = { type: 'shape', start: point };
      shapePreview.current = buildShapeFromDrag(point, point, shapeConfig, event.shiftKey, event.altKey);
      return;
    }

    if (tool === 'text') {
      setTextEditor(null);
      openTextEditor(point);
      return;
    }

    if (tool === 'timer') {
      onTimerCreate?.(point);
      return;
    }

    if (tool !== 'select') return;

    const selection = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    const selectionObjects = selection.map((id) => objects[id]).filter(Boolean);
    const selectionBounds = getSelectionBounds(selectionObjects);
    const selectionTarget = selectionObjects.length === 1 ? selectionObjects[0] : selectionBounds;
    const canvasBounds = canvas.getBoundingClientRect();
    const cssScale = Math.max(0.01, canvasBounds.width / CANVAS_WIDTH);
    const rotateDistance = 34 / cssScale;
    const rotateHandle = selectionTarget ? hitRotateHandle(selectionTarget, point.x, point.y, 14 / cssScale, rotateDistance) : false;
    const resizeHandle = selectionTarget ? hitResizeHandle(selectionTarget, point.x, point.y, 12 / cssScale) : null;
    const append = event.ctrlKey || event.metaKey || event.shiftKey;

    if (selectionBounds && rotateHandle) {
      const items = selectionObjects.filter((object) => [object?.x, object?.y].every((value) => Number.isFinite(Number(value))));
      if (items.length) {
        const center = boundsCenter(selectionBounds);
        onTransformStart?.(items.length > 1 ? 'Rotar selección' : 'Rotar capa');
        interaction.current = {
          type: 'rotate',
          start: point,
          startAngle: Math.atan2(point.y - center.y, point.x - center.x),
          bounds: { ...selectionBounds },
          items: items.map((object) => ({ ...object })),
          changed: false
        };
        setPointerCursor('grabbing');
        return;
      }
    }

    if (selectionBounds && resizeHandle) {
      const items = selectionObjects.filter((object) => [object?.x, object?.y, object?.w, object?.h].every((value) => Number.isFinite(Number(value))));
      if (items.length) {
        onTransformStart?.(items.length > 1 ? 'Redimensionar selección' : 'Redimensionar capa');
        interaction.current = {
          type: 'resize',
          handle: resizeHandle,
          start: point,
          bounds: { ...selectionBounds },
          items: items.map((object) => ({ ...object })),
          snapTargets: snapEnabled ? buildSnapTargets(objects, selection, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }) : null,
          snapAllowed: items.length > 1 || !(Number(items[0]?.rotation) || 0),
          changed: false
        };
        snapGuides.current = null;
        setPointerCursor(resizeCursorForHandle(resizeHandle, selectionTarget));
        return;
      }
    }

    const startMove = (ids) => {
      const movingObjects = ids
        .map((id) => objects[id])
        .filter((object) => object && Number.isFinite(Number(object.x)) && Number.isFinite(Number(object.y)));
      const items = movingObjects.map((object) => ({ id: object.id, x: Number(object.x) || 0, y: Number(object.y) || 0 }));
      if (!items.length) return false;

      onTransformStart?.(items.length > 1 ? 'Mover selección' : 'Mover capa');
      interaction.current = {
        type: 'move',
        start: point,
        items,
        bounds: getSelectionBounds(movingObjects),
        snapTargets: snapEnabled ? buildSnapTargets(objects, ids, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }) : null,
        changed: false
      };
      snapGuides.current = null;
      setPointerCursor('grabbing');
      return true;
    };

    // Una selección activa se comporta como un bloque: una vez seleccionada,
    // cualquier arrastre dentro de su cuadro mueve toda la selección, incluso
    // si el puntero cae en una zona transparente entre trazos u objetos.
    if (!append && selection.length) {
      const padding = 4;
      const insideSelection = selectionBounds
        && point.x >= selectionBounds.x - padding
        && point.x <= selectionBounds.x + selectionBounds.w + padding
        && point.y >= selectionBounds.y - padding
        && point.y <= selectionBounds.y + selectionBounds.h + padding;

      if (insideSelection && startMove(selection)) return;
    }

    const hit = topObjectAt(point);

    if (hit) {
      if (append) {
        onSelect?.(hit.id, { append: true });
        interaction.current = null;
        return;
      }

      const groupedIds = groupIdsForObject(hit);
      const movingIds = selection.includes(hit.id) ? selection : groupedIds;
      if (!selection.includes(hit.id)) {
        if (groupedIds.length > 1) onSelectMany?.(groupedIds, hit.id);
        else onSelect?.(hit.id);
      }
      startMove(movingIds);
      return;
    }

    if (!append) onSelect?.(null);
    marquee.current = { start: point, end: point };
    interaction.current = { type: 'marquee', append, initialIds: append ? selection : [] };
  };

  const onPointerMove = (event) => {
    const point = pointFromEvent(event);
    if (!interactionDisabled) onCursorMove?.(point);
    if (interactionDisabled) return;

    if (drawing.current) {
      const localPoint = pointForDrawLayer(point);
      const before = drawing.current.points.length;
      appendStrokePoint(drawing.current, localPoint);
      if (drawing.current.points.length > before) onDrawPoint?.(drawing.current.id, localPoint);
      return;
    }

    const active = interaction.current;
    if (!active) {
      if (tool !== 'select') {
        if (pointerCursor) setPointerCursor('');
        return;
      }

      const selection = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
      const selectedObjects = selection.map((id) => objects[id]).filter(Boolean);
      const selectionBounds = getSelectionBounds(selectedObjects);
      const selectionTarget = selectedObjects.length === 1 ? selectedObjects[0] : selectionBounds;
      if (!selectionBounds || !selectionTarget) {
        if (pointerCursor) setPointerCursor('');
        return;
      }

      const canvasBounds = canvasRef.current.getBoundingClientRect();
      const cssScale = Math.max(0.01, canvasBounds.width / CANVAS_WIDTH);
      if (hitRotateHandle(selectionTarget, point.x, point.y, 14 / cssScale, 34 / cssScale)) {
        if (pointerCursor !== 'grab') setPointerCursor('grab');
        return;
      }
      const handle = hitResizeHandle(selectionTarget, point.x, point.y, 12 / cssScale);
      if (handle) {
        const nextCursor = resizeCursorForHandle(handle, selectionTarget);
        if (pointerCursor !== nextCursor) setPointerCursor(nextCursor);
        return;
      }

      const padding = 4 / cssScale;
      const insideSelection = point.x >= selectionBounds.x - padding
        && point.x <= selectionBounds.x + selectionBounds.w + padding
        && point.y >= selectionBounds.y - padding
        && point.y <= selectionBounds.y + selectionBounds.h + padding;
      const nextCursor = insideSelection ? 'move' : '';
      if (pointerCursor !== nextCursor) setPointerCursor(nextCursor);
      return;
    }

    if (active.type === 'shape') {
      shapePreview.current = buildShapeFromDrag(active.start, point, shapeConfig, event.shiftKey, event.altKey);
      return;
    }

    if (active.type === 'move') {
      let dx = point.x - active.start.x;
      let dy = point.y - active.start.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        snapGuides.current = null;
        return;
      }

      if (snapEnabled && !event.altKey && active.bounds && active.snapTargets) {
        const canvasBounds = canvasRef.current.getBoundingClientRect();
        const cssScale = Math.max(0.01, canvasBounds.width / CANVAS_WIDTH);
        const snapped = snapMove(active.bounds, dx, dy, active.snapTargets, SNAP_THRESHOLD_PX / cssScale);
        dx = snapped.dx;
        dy = snapped.dy;
        snapGuides.current = snapped.guides;
      } else {
        snapGuides.current = null;
      }

      active.changed = true;
      setPointerCursor('grabbing');
      onPatchObjects?.(active.items.map((item) => ({ id: item.id, patch: { x: item.x + dx, y: item.y + dy } })));
      return;
    }

    if (active.type === 'resize') {
      let resizePoint = point;
      if (snapEnabled && !event.altKey && active.snapAllowed && active.snapTargets) {
        const canvasBounds = canvasRef.current.getBoundingClientRect();
        const cssScale = Math.max(0.01, canvasBounds.width / CANVAS_WIDTH);
        const snapped = snapResizePointer(active.bounds, active.handle, point, active.start, active.snapTargets, SNAP_THRESHOLD_PX / cssScale);
        resizePoint = snapped.point;
        snapGuides.current = snapped.guides;
      } else {
        snapGuides.current = null;
      }

      const updates = resizeSelectionFromHandle(active.items, active.bounds, active.handle, resizePoint, active.start, event.shiftKey);
      if (!updates.length) return;
      active.changed = true;
      setPointerCursor(resizeCursorForHandle(active.handle, active.items.length === 1 ? active.items[0] : null));
      onPatchObjects?.(updates);
      return;
    }

    if (active.type === 'rotate') {
      snapGuides.current = null;
      const updates = rotateSelection(active.items, active.bounds, point, active.start, active.startAngle, event.shiftKey);
      if (!updates.length) return;
      active.changed = true;
      setPointerCursor('grabbing');
      onPatchObjects?.(updates);
      return;
    }

    if (active.type === 'marquee') {
      marquee.current = { ...marquee.current, end: point };
    }
  };

  const finishInteraction = (event) => {
    if (interactionDisabled) return;
    if (drawing.current) {
      if (drawing.current.points.length > 1) onDrawCommit?.(drawing.current);
      drawing.current = null;
    }

    if (interaction.current?.type === 'shape' && shapePreview.current) {
      onShapeCreate(shapePreview.current);
      shapePreview.current = null;
    }

    if (interaction.current?.type === 'marquee' && marquee.current) {
      const active = interaction.current;
      const box = {
        x: Math.min(marquee.current.start.x, marquee.current.end.x),
        y: Math.min(marquee.current.start.y, marquee.current.end.y),
        w: Math.abs(marquee.current.end.x - marquee.current.start.x),
        h: Math.abs(marquee.current.end.y - marquee.current.start.y)
      };
      const captured = orderedObjects(objects)
        .filter((object) => boundsOverlap(box, getObjectBounds(object)))
        .map((object) => object.id);
      const next = active.append ? [...new Set([...active.initialIds, ...captured])] : captured;
      onSelectMany?.(next, next.at(-1) || null);
      marquee.current = null;
    }

    const finished = interaction.current;
    if (finished?.type === 'move' || finished?.type === 'resize' || finished?.type === 'rotate') onTransformEnd?.({ type: finished.type, changed: Boolean(finished.changed) });

    interaction.current = null;
    snapGuides.current = null;
    setPointerCursor('');
    if (event?.pointerId != null && canvasRef.current.hasPointerCapture?.(event.pointerId)) canvasRef.current.releasePointerCapture?.(event.pointerId);
  };

  const onDoubleClick = (event) => {
    if (interactionDisabled || tool !== 'select') return;
    const point = pointFromEvent(event);
    const hit = topObjectAt(point);
    if (!hit || (hit.tipo !== 'text' && hit.tipo !== 'texto')) return;

    event.preventDefault();
    onSelect?.(hit.id);
    openTextEditor(point, hit);
  };

  const onContextMenu = (event) => {
    event.preventDefault();
    if (interactionDisabled) return;

    if (tool === 'draw' || tool === 'eraser') {
      onOpenProperties?.({ clientX: event.clientX, clientY: event.clientY, hasSelectionTarget: false });
      return;
    }

    const point = pointFromEvent(event);
    const selection = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    const selectedObjects = selection.map((id) => objects[id]).filter(Boolean);
    const selectionBounds = getSelectionBounds(selectedObjects);
    const padding = 4;
    const insideSelection = selectionBounds
      && point.x >= selectionBounds.x - padding
      && point.x <= selectionBounds.x + selectionBounds.w + padding
      && point.y >= selectionBounds.y - padding
      && point.y <= selectionBounds.y + selectionBounds.h + padding;

    let hasSelectionTarget = Boolean(insideSelection && selection.length);

    if (!hasSelectionTarget) {
      const hit = topObjectAt(point);
      if (hit) {
        if (!selection.includes(hit.id)) {
          const groupedIds = groupIdsForObject(hit);
          if (groupedIds.length > 1) onSelectMany?.(groupedIds, hit.id);
          else onSelect?.(hit.id);
        }
        hasSelectionTarget = true;
      } else {
        onSelect?.(null);
      }
    }

    onOpenProperties?.({
      clientX: event.clientX,
      clientY: event.clientY,
      canvasPoint: point,
      hasSelectionTarget
    });
  };

  const onDragOver = (event) => {
    if (interactionDisabled) return;
    const transfer = event.dataTransfer;
    if (!transfer) return;
    event.preventDefault();
    transfer.dropEffect = 'copy';
    setMediaDragging(true);
  };

  const onDrop = (event) => {
    event.preventDefault();
    if (interactionDisabled) return;
    setMediaDragging(false);

    const point = pointFromEvent(event);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      onMediaDrop?.({ file, point });
      return;
    }

    const url = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain');
    if (url && /^https?:\/\//i.test(url.trim())) onMediaDrop?.({ url: url.trim(), point });
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`dc-canvas tool-${tool} ${mediaDragging ? 'is-media-dragging' : ''}`}
        style={pointerCursor ? { cursor: pointerCursor } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        onPointerLeave={() => { if (!interaction.current) setPointerCursor(''); onCursorLeave?.(); }}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragEnter={(event) => { if (interactionDisabled) return; event.preventDefault(); setMediaDragging(true); }}
        onDragOver={onDragOver}
        onDragLeave={() => { if (!interactionDisabled) setMediaDragging(false); }}
        onDrop={onDrop}
      />

      <InlineTextEditor
        editor={textEditor}
        onCancel={() => setTextEditor(null)}
        onCommit={(value) => {
          onTextCommit?.({
            id: textEditor.objectId,
            x: textEditor.x,
            y: textEditor.y,
            text: value,
            config: textEditor.config
          });
          setTextEditor(null);
        }}
      />

      <div className={`dc-drop-overlay ${mediaDragging ? 'show' : ''}`}>SUELTA LA IMAGEN AQUÍ 🖼️</div>
    </>
  );
}
