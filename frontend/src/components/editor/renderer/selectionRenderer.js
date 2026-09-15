export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_SIZE = 16;

export function getResizeHandles(object) {
  if (!object || object.hidden || object.tipo === 'draw' || object.tipo === 'trazo') return [];
  const x = Number(object.x) || 0;
  const y = Number(object.y) || 0;
  const w = Number(object.w) || 0;
  const h = Number(object.h) || 0;
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

export function drawSelection(ctx, object, accent = '#ff315c') {
  if (!object || object.hidden || object.tipo === 'draw' || object.tipo === 'trazo') return;

  const x = Number(object.x) || 0;
  const y = Number(object.y) || 0;
  const w = Number(object.w) || 0;
  const h = Number(object.h) || 0;

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 7]);
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.setLineDash([]);

  for (const handle of getResizeHandles(object)) {
    ctx.fillStyle = '#090a0c';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.fillRect(handle.x - 7, handle.y - 7, 14, 14);
    ctx.strokeRect(handle.x - 7, handle.y - 7, 14, 14);
  }

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
      const targetH = Math.max(8, w / aspect);
      h = targetH;
      if (handle.includes('n')) y = original.y + original.h - h;
      if (handle.includes('w')) x = original.x + original.w - w;
    }
  }

  return { x, y, w, h };
}
