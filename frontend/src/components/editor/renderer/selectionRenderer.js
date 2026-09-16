import { getDrawLayerBounds, isDrawLayer } from '../tools/drawing/drawingTool';
export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_SIZE = 16;

export function getObjectBounds(object) {
  if (!object || object.hidden) return null;
  if (isDrawLayer(object)) return getDrawLayerBounds(object);
  const x = Number(object.x);
  const y = Number(object.y);
  const w = Number(object.w);
  const h = Number(object.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

export function getSelectionBounds(objects) {
  const bounds = (objects || []).map(getObjectBounds).filter(Boolean);
  if (!bounds.length) return null;

  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.w));
  const maxY = Math.max(...bounds.map((item) => item.y + item.h));

  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function boundsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function getResizeHandles(object) {
  const bounds = getObjectBounds(object);
  if (!bounds || object.tipo === 'draw' || object.tipo === 'trazo') return [];
  const { x, y, w, h } = bounds;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const points = {
    nw: [x, y], n: [cx, y], ne: [x + w, y], e: [x + w, cy],
    se: [x + w, y + h], s: [cx, y + h], sw: [x, y + h], w: [x, cy]
  };

  return RESIZE_HANDLES.map((id) => ({ id, x: points[id][0], y: points[id][1] }));
}

export function hitResizeHandle(object, x, y) {
  const tolerance = HANDLE_SIZE;
  return getResizeHandles(object).find((handle) => Math.abs(handle.x - x) <= tolerance && Math.abs(handle.y - y) <= tolerance)?.id || null;
}

function strokeBounds(ctx, bounds, accent, options = {}) {
  const { handles = false, outer = false } = options;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = outer ? 3 : 2;
  ctx.globalAlpha = outer ? 0.95 : 0.72;
  ctx.setLineDash(outer ? [14, 8] : [10, 7]);
  ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
  ctx.setLineDash([]);

  if (handles) {
    for (const handle of getResizeHandles(bounds)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#090a0c';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.fillRect(handle.x - 7, handle.y - 7, 14, 14);
      ctx.strokeRect(handle.x - 7, handle.y - 7, 14, 14);
    }
  }

  ctx.restore();
}

export function drawSelection(ctx, object, accent = '#ff315c', options = {}) {
  const bounds = getObjectBounds(object);
  if (!bounds) return;
  const drawLayer = isDrawLayer(object);
  strokeBounds(ctx, bounds, accent, { handles: drawLayer ? false : options.handles !== false });
}

export function drawMultiSelection(ctx, objects, accent = '#ff315c') {
  const visible = (objects || []).filter((object) => getObjectBounds(object));
  if (!visible.length) return;

  visible.forEach((object) => drawSelection(ctx, object, accent, { handles: false }));
  if (visible.length > 1) {
    const bounds = getSelectionBounds(visible);
    if (bounds) strokeBounds(ctx, bounds, accent, { outer: true });
  }
}

export function drawMarquee(ctx, start, end, accent = '#ff315c') {
  if (!start || !end) return;
  const bounds = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y)
  };

  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
}

export function resizeFromHandle(object, handle, pointer, startPointer, keepAspect = false) {
  const original = {
    x: Number(object.x) || 0,
    y: Number(object.y) || 0,
    w: Math.max(8, Number(object.w) || 8),
    h: Math.max(8, Number(object.h) || 8)
  };
  const dx = pointer.x - startPointer.x;
  const dy = pointer.y - startPointer.y;
  let { x, y, w, h } = original;

  if (handle.includes('e')) w = Math.max(8, original.w + dx);
  if (handle.includes('s')) h = Math.max(8, original.h + dy);
  if (handle.includes('w')) {
    w = Math.max(8, original.w - dx);
    x = original.x + (original.w - w);
  }
  if (handle.includes('n')) {
    h = Math.max(8, original.h - dy);
    y = original.y + (original.h - h);
  }

  if (keepAspect && original.h > 0) {
    const aspect = original.w / original.h;
    if (handle === 'n' || handle === 's') {
      w = Math.max(8, h * aspect);
      if (handle === 'n') x = original.x + (original.w - w) / 2;
    } else if (handle === 'e' || handle === 'w') {
      h = Math.max(8, w / aspect);
      y = original.y + (original.h - h) / 2;
    } else {
      h = Math.max(8, w / aspect);
      if (handle.includes('n')) y = original.y + original.h - h;
      if (handle.includes('w')) x = original.x + original.w - w;
    }
  }

  return { x, y, w, h };
}
