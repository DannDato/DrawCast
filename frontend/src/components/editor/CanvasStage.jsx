import { useEffect, useRef, useState } from 'react';
import { drawObject, hitObject } from './renderer/drawObject';
import { orderedObjects, renderScene } from './renderer/sceneRenderer';
import { drawSelection, hitResizeHandle, resizeFromHandle } from './renderer/selectionRenderer';
import { buildShapeFromDrag } from './tools/shapes/shapeTool';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FRAME_MS = 1000 / 30;

export default function CanvasStage({
  objects,
  selectedId,
  onSelect,
  onPatchObject,
  onTransformStart,
  tool,
  drawConfig,
  onDraw,
  shapeConfig,
  onShapeCreate,
  onMediaDrop,
  guide
}) {
  const canvasRef = useRef(null);
  const interaction = useRef(null);
  const drawing = useRef(null);
  const shapePreview = useRef(null);
  const guideImage = useRef(null);
  const [mediaDragging, setMediaDragging] = useState(false);

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
        renderScene(ctx, objects, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, grid: true, now: Date.now() });

        const activeGuide = guideImage.current;
        if (activeGuide?.complete && activeGuide.naturalWidth) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.drawImage(activeGuide, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.restore();
        }

        if (drawing.current) {
          drawObject(ctx, { id: 'draw_preview', tipo: 'draw', lineas: [drawing.current], zIndex: Number.MAX_SAFE_INTEGER });
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

        const selected = objects[selectedId];
        if (selected) {
          const accent = getComputedStyle(document.documentElement).getPropertyValue('--dc-accent').trim() || '#ff315c';
          drawSelection(ctx, selected, accent);
        }

        lastFrame = timestamp;
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [objects, selectedId]);

  const pointFromEvent = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * CANVAS_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * CANVAS_HEIGHT / bounds.height
    };
  };

  const topObjectAt = (point) => orderedObjects(objects).reverse().find((object) => hitObject(object, point.x, point.y));

  const onPointerDown = (event) => {
    const canvas = canvasRef.current;
    const point = pointFromEvent(event);
    canvas.setPointerCapture?.(event.pointerId);

    if (tool === 'draw') {
      drawing.current = { color: drawConfig.color, size: drawConfig.size, points: [point] };
      return;
    }

    if (tool === 'shape') {
      interaction.current = { type: 'shape', start: point };
      shapePreview.current = buildShapeFromDrag(point, point, shapeConfig, event.shiftKey, event.altKey);
      return;
    }

    if (tool !== 'select') return;

    const selected = objects[selectedId];
    const resizeHandle = selected ? hitResizeHandle(selected, point.x, point.y) : null;

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

    const hit = topObjectAt(point);
    onSelect(hit?.id || null);

    if (hit) {
      onTransformStart?.();
      interaction.current = {
        type: 'move',
        id: hit.id,
        start: point,
        original: { ...hit }
      };
    }
  };

  const onPointerMove = (event) => {
    const point = pointFromEvent(event);

    if (drawing.current) {
      drawing.current.points.push(point);
      return;
    }

    const active = interaction.current;
    if (!active) return;

    if (active.type === 'shape') {
      shapePreview.current = buildShapeFromDrag(active.start, point, shapeConfig, event.shiftKey, event.altKey);
      return;
    }

    if (active.type === 'move') {
      onPatchObject(active.id, {
        x: (Number(active.original.x) || 0) + point.x - active.start.x,
        y: (Number(active.original.y) || 0) + point.y - active.start.y
      });
      return;
    }

    if (active.type === 'resize') {
      onPatchObject(active.id, resizeFromHandle(active.original, active.handle, point, active.start, event.shiftKey));
    }
  };

  const finishInteraction = (event) => {
    if (drawing.current) {
      if (drawing.current.points.length > 1) onDraw([drawing.current]);
      drawing.current = null;
    }

    if (interaction.current?.type === 'shape' && shapePreview.current) {
      onShapeCreate(shapePreview.current);
      shapePreview.current = null;
    }

    interaction.current = null;
    if (event?.pointerId != null) canvasRef.current.releasePointerCapture?.(event.pointerId);
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
        onDragEnter={(event) => { event.preventDefault(); setMediaDragging(true); }}
        onDragOver={onDragOver}
        onDragLeave={() => setMediaDragging(false)}
        onDrop={onDrop}
      />
      <div className={`dc-drop-overlay ${mediaDragging ? 'show' : ''}`}>READY TO DECODE IMAGE 🖼️</div>
    </>
  );
}
