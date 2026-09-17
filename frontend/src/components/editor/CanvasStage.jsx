import { useEffect, useRef, useState } from 'react';
import { drawObject, hitObject } from './renderer/drawObject';
import { orderedObjects, renderScene } from './renderer/sceneRenderer';
import { boundsOverlap, drawMarquee, drawMultiSelection, getObjectBounds, getSelectionBounds, hitResizeHandle, resizeFromHandle } from './renderer/selectionRenderer';
import { buildShapeFromDrag } from './tools/shapes/shapeTool';
import InlineTextEditor from './tools/text/InlineTextEditor';
import { textConfigFromObject } from './tools/text/textTool';
import { appendStrokePoint, hitDrawLayer, isDrawLayer, makeStroke } from './tools/drawing/drawingTool';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FRAME_MS = 1000 / 30;

export default function CanvasStage({
  objects,
  selectedId,
  selectedIds = [],
  onSelect,
  onSelectMany,
  onPatchObject,
  onPatchObjects,
  onTransformStart,
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
  guide
}) {
  const canvasRef = useRef(null);
  const interaction = useRef(null);
  const drawing = useRef(null);
  const shapePreview = useRef(null);
  const marquee = useRef(null);
  const guideImage = useRef(null);
  const [mediaDragging, setMediaDragging] = useState(false);
  const [textEditor, setTextEditor] = useState(null);

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

    const render = (timestamp = 0) => {
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
          drawObject(ctx, { id: 'draw_preview', tipo: 'draw', x: Number(activeDrawLayer?.x) || 0, y: Number(activeDrawLayer?.y) || 0, w: Number(activeDrawLayer?.w) || CANVAS_WIDTH, h: Number(activeDrawLayer?.h) || CANVAS_HEIGHT, sourceWidth: Number(activeDrawLayer?.sourceWidth) || CANVAS_WIDTH, sourceHeight: Number(activeDrawLayer?.sourceHeight) || CANVAS_HEIGHT, lineas: [drawing.current], zIndex: Number.MAX_SAFE_INTEGER });
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
        drawMultiSelection(ctx, selection.map((id) => objects[id]).filter(Boolean), accent);

        if (marquee.current) drawMarquee(ctx, marquee.current.start, marquee.current.end, accent);
        lastFrame = timestamp;
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [objects, selectedId, selectedIds, liveStrokes]);

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
    return { x: (point.x - (Number(layer.x) || 0)) / scaleX, y: (point.y - (Number(layer.y) || 0)) / scaleY };
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
    const selected = selection.length === 1 ? objects[selection[0]] : null;
    const resizeHandle = selected ? hitResizeHandle(selected, point.x, point.y) : null;
    const append = event.ctrlKey || event.metaKey || event.shiftKey;

    if (selected && resizeHandle) {
      onTransformStart?.();
      interaction.current = {
        type: 'resize',
        id: selected.id,
        handle: resizeHandle,
        start: point,
        original: { ...selected }
      };
      return;
    }

    const startMove = (ids) => {
      const items = ids
        .map((id) => objects[id])
        .filter((object) => object && Number.isFinite(Number(object.x)) && Number.isFinite(Number(object.y)))
        .map((object) => ({ id: object.id, x: Number(object.x) || 0, y: Number(object.y) || 0 }));
      if (!items.length) return false;

      onTransformStart?.();
      interaction.current = { type: 'move', start: point, items };
      return true;
    };

    // Una selección activa se comporta como un bloque: una vez seleccionada,
    // cualquier arrastre dentro de su cuadro mueve toda la selección, incluso
    // si el puntero cae en una zona transparente entre trazos u objetos.
    if (!append && selection.length) {
      const selectionBounds = getSelectionBounds(selection.map((id) => objects[id]).filter(Boolean));
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

      const movingIds = selection.includes(hit.id) ? selection : [hit.id];
      if (!selection.includes(hit.id)) onSelect?.(hit.id);
      startMove(movingIds);
      return;
    }

    if (!append) onSelect?.(null);
    marquee.current = { start: point, end: point };
    interaction.current = { type: 'marquee', append, initialIds: append ? selection : [] };
  };

  const onPointerMove = (event) => {
    const point = pointFromEvent(event);

    if (drawing.current) {
      const localPoint = pointForDrawLayer(point);
      const before = drawing.current.points.length;
      appendStrokePoint(drawing.current, localPoint);
      if (drawing.current.points.length > before) onDrawPoint?.(drawing.current.id, localPoint);
      return;
    }

    const active = interaction.current;
    if (!active) return;

    if (active.type === 'shape') {
      shapePreview.current = buildShapeFromDrag(active.start, point, shapeConfig, event.shiftKey, event.altKey);
      return;
    }

    if (active.type === 'move') {
      const dx = point.x - active.start.x;
      const dy = point.y - active.start.y;
      onPatchObjects?.(active.items.map((item) => ({ id: item.id, patch: { x: item.x + dx, y: item.y + dy } })));
      return;
    }

    if (active.type === 'resize') {
      onPatchObject(active.id, resizeFromHandle(active.original, active.handle, point, active.start, event.shiftKey));
      return;
    }

    if (active.type === 'marquee') {
      marquee.current = { ...marquee.current, end: point };
    }
  };

  const finishInteraction = (event) => {
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

    interaction.current = null;
    if (event?.pointerId != null) canvasRef.current.releasePointerCapture?.(event.pointerId);
  };

  const onDoubleClick = (event) => {
    if (tool !== 'select') return;
    const point = pointFromEvent(event);
    const hit = topObjectAt(point);
    if (!hit || (hit.tipo !== 'text' && hit.tipo !== 'texto')) return;

    event.preventDefault();
    onSelect?.(hit.id);
    openTextEditor(point, hit);
  };

  const onDragOver = (event) => {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    event.preventDefault();
    transfer.dropEffect = 'copy';
    setMediaDragging(true);
  };

  const onDrop = (event) => {
    event.preventDefault();
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        onDoubleClick={onDoubleClick}
        onDragEnter={(event) => { event.preventDefault(); setMediaDragging(true); }}
        onDragOver={onDragOver}
        onDragLeave={() => setMediaDragging(false)}
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
