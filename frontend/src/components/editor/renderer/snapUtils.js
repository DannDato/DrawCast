import { getObjectBounds } from './selectionRenderer';

export const SNAP_THRESHOLD_PX = 8;

function axisPoints(bounds, axis) {
  if (!bounds) return [];
  if (axis === 'x') {
    return [
      { value: bounds.x, edge: 'start' },
      { value: bounds.x + bounds.w / 2, edge: 'center' },
      { value: bounds.x + bounds.w, edge: 'end' }
    ];
  }
  return [
    { value: bounds.y, edge: 'start' },
    { value: bounds.y + bounds.h / 2, edge: 'center' },
    { value: bounds.y + bounds.h, edge: 'end' }
  ];
}

function dedupeTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = Math.round(target.value * 100) / 100;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSnapTargets(objects, excludedIds = [], canvas = { width: 1920, height: 1080 }) {
  const excluded = new Set(excludedIds);
  const vertical = [
    { value: 0, source: 'canvas', edge: 'start' },
    { value: canvas.width / 2, source: 'canvas', edge: 'center' },
    { value: canvas.width, source: 'canvas', edge: 'end' }
  ];
  const horizontal = [
    { value: 0, source: 'canvas', edge: 'start' },
    { value: canvas.height / 2, source: 'canvas', edge: 'center' },
    { value: canvas.height, source: 'canvas', edge: 'end' }
  ];

  Object.values(objects || {}).forEach((object) => {
    if (!object?.id || excluded.has(object.id) || object.hidden) return;
    const bounds = getObjectBounds(object);
    if (!bounds) return;
    axisPoints(bounds, 'x').forEach((point) => vertical.push({ ...point, source: object.id }));
    axisPoints(bounds, 'y').forEach((point) => horizontal.push({ ...point, source: object.id }));
  });

  return { vertical: dedupeTargets(vertical), horizontal: dedupeTargets(horizontal) };
}

function nearestSnap(points, targets, threshold) {
  let best = null;
  points.forEach((point) => {
    targets.forEach((target) => {
      const delta = target.value - point.value;
      const distance = Math.abs(delta);
      if (distance > threshold) return;
      if (!best || distance < best.distance) best = { delta, distance, target, point };
    });
  });
  return best;
}

export function snapMove(selectionBounds, dx, dy, targets, threshold) {
  if (!selectionBounds || !targets) return { dx, dy, guides: null };

  const moved = {
    x: selectionBounds.x + dx,
    y: selectionBounds.y + dy,
    w: selectionBounds.w,
    h: selectionBounds.h
  };
  const snapX = nearestSnap(axisPoints(moved, 'x'), targets.vertical || [], threshold);
  const snapY = nearestSnap(axisPoints(moved, 'y'), targets.horizontal || [], threshold);

  return {
    dx: dx + (snapX?.delta || 0),
    dy: dy + (snapY?.delta || 0),
    guides: {
      vertical: snapX ? [{ value: snapX.target.value, edge: snapX.target.edge, source: snapX.target.source }] : [],
      horizontal: snapY ? [{ value: snapY.target.value, edge: snapY.target.edge, source: snapY.target.source }] : []
    }
  };
}


export function snapResizePointer(selectionBounds, handle, pointer, startPointer, targets, threshold) {
  if (!selectionBounds || !handle || !targets) return { point: pointer, guides: null };

  const dx = pointer.x - startPointer.x;
  const dy = pointer.y - startPointer.y;
  const nextPoint = { ...pointer };
  let vertical = [];
  let horizontal = [];

  if (handle.includes('e') || handle.includes('w')) {
    const edgeX = handle.includes('e') ? selectionBounds.x + selectionBounds.w + dx : selectionBounds.x + dx;
    const snapX = nearestSnap([{ value: edgeX, edge: handle.includes('e') ? 'end' : 'start' }], targets.vertical || [], threshold);
    if (snapX) {
      nextPoint.x += snapX.delta;
      vertical = [{ value: snapX.target.value, edge: snapX.target.edge, source: snapX.target.source }];
    }
  }

  if (handle.includes('s') || handle.includes('n')) {
    const edgeY = handle.includes('s') ? selectionBounds.y + selectionBounds.h + dy : selectionBounds.y + dy;
    const snapY = nearestSnap([{ value: edgeY, edge: handle.includes('s') ? 'end' : 'start' }], targets.horizontal || [], threshold);
    if (snapY) {
      nextPoint.y += snapY.delta;
      horizontal = [{ value: snapY.target.value, edge: snapY.target.edge, source: snapY.target.source }];
    }
  }

  return { point: nextPoint, guides: { vertical, horizontal } };
}

export function drawSnapGuides(ctx, guides, accent = '#ff315c', canvas = { width: 1920, height: 1080 }) {
  if (!ctx || !guides) return;
  const vertical = guides.vertical || [];
  const horizontal = guides.horizontal || [];
  if (!vertical.length && !horizontal.length) return;

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.92;
  ctx.setLineDash([9, 7]);

  vertical.forEach(({ value }) => {
    ctx.beginPath();
    ctx.moveTo(value, 0);
    ctx.lineTo(value, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillRect(value - 3, canvas.height / 2 - 3, 6, 6);
    ctx.setLineDash([9, 7]);
  });

  horizontal.forEach(({ value }) => {
    ctx.beginPath();
    ctx.moveTo(0, value);
    ctx.lineTo(canvas.width, value);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillRect(canvas.width / 2 - 3, value - 3, 6, 6);
    ctx.setLineDash([9, 7]);
  });

  ctx.restore();
}
