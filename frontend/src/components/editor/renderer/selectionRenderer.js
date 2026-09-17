import { getDrawLayerBounds, isDrawLayer } from '../tools/drawing/drawingTool';
import { boundsCenter, normalizeRotation, rotatePointAround, rotatedRectBounds, rotatedRectCorners, unrotatePointAround } from './transformUtils';

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const RESIZE_CURSORS = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize'
};

const RESIZE_CURSOR_BY_ANGLE = ['ew-resize', 'nesw-resize', 'ns-resize', 'nwse-resize'];
const HANDLE_AXIS_ANGLE = { e: 0, w: 0, ne: 45, sw: 45, n: 90, s: 90, nw: 135, se: 135 };

export function resizeCursorForHandle(handle, target = null) {
  const rotation = target && (target.id || target.tipo || target.type) ? Number(target.rotation) || 0 : 0;
  const angle = ((((HANDLE_AXIS_ANGLE[handle] || 0) + rotation) % 180) + 180) % 180;
  const index = Math.round(angle / 45) % 4;
  return RESIZE_CURSOR_BY_ANGLE[index] || RESIZE_CURSORS[handle] || 'default';
}

export function getObjectFrame(object) {
  if (!object || object.hidden) return null;
  if (isDrawLayer(object)) return getDrawLayerBounds(object);
  const x = Number(object.x);
  const y = Number(object.y);
  const w = Number(object.w);
  const h = Number(object.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

export function getObjectBounds(object) {
  const frame = getObjectFrame(object);
  if (!frame) return null;
  return rotatedRectBounds(frame, Number(object.rotation) || 0);
}

export function getObjectTransformCenter(object) {
  const frame = getObjectFrame(object);
  return frame ? boundsCenter(frame) : null;
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

function targetFrame(target) {
  const objectLike = target && (target.id || target.tipo || target.type);
  const frame = objectLike ? getObjectFrame(target) : target;
  return frame ? {
    frame,
    rotation: objectLike ? Number(target.rotation) || 0 : Number(target.rotation) || 0
  } : null;
}

export function getResizeHandles(target) {
  const data = targetFrame(target);
  if (!data) return [];
  const { frame, rotation } = data;
  const { x, y, w, h } = frame;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points = {
    nw: { x, y }, n: { x: cx, y }, ne: { x: x + w, y }, e: { x: x + w, y: cy },
    se: { x: x + w, y: y + h }, s: { x: cx, y: y + h }, sw: { x, y: y + h }, w: { x, y: cy }
  };
  const center = { x: cx, y: cy };
  return RESIZE_HANDLES.map((id) => ({ id, ...rotatePointAround(points[id], center, rotation) }));
}

export function getRotateHandle(target, distance = 42) {
  const data = targetFrame(target);
  if (!data) return null;
  const { frame, rotation } = data;
  const center = boundsCenter(frame);
  const top = rotatePointAround({ x: center.x, y: frame.y }, center, rotation);
  const handle = rotatePointAround({ x: center.x, y: frame.y - distance }, center, rotation);
  return { id: 'rotate', x: handle.x, y: handle.y, topX: top.x, topY: top.y, centerX: center.x, centerY: center.y };
}

export function hitResizeHandle(target, x, y, tolerance = 16) {
  return getResizeHandles(target).find((handle) => Math.abs(handle.x - x) <= tolerance && Math.abs(handle.y - y) <= tolerance)?.id || null;
}

export function hitRotateHandle(target, x, y, tolerance = 18, distance = 42) {
  const handle = getRotateHandle(target, distance);
  if (!handle) return false;
  return Math.hypot(handle.x - x, handle.y - y) <= tolerance;
}

function strokeFrame(ctx, target, accent, options = {}) {
  const { handles = false, outer = false, handleSize = 16, rotateHandleDistance = 42 } = options;
  const data = targetFrame(target);
  if (!data) return;
  const { frame, rotation } = data;
  const boxSize = Math.max(10, Number(handleSize) || 16);
  const half = boxSize / 2;
  const corners = rotatedRectCorners(frame, rotation);

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = outer ? 3 : 2;
  ctx.globalAlpha = outer ? 0.95 : 0.72;
  ctx.setLineDash(outer ? [14, 8] : [10, 7]);
  ctx.beginPath();
  corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  if (handles) {
    const rotateHandle = getRotateHandle(target, rotateHandleDistance);
    if (rotateHandle) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, boxSize * 0.16);
      ctx.beginPath();
      ctx.moveTo(rotateHandle.topX, rotateHandle.topY);
      ctx.lineTo(rotateHandle.x, rotateHandle.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4f5f7';
      ctx.beginPath();
      ctx.arc(rotateHandle.x, rotateHandle.y, Math.max(6, boxSize * 0.65), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const handle of getResizeHandles(target)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4f5f7';
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, boxSize * 0.18);
      ctx.fillRect(handle.x - half, handle.y - half, boxSize, boxSize);
      ctx.strokeRect(handle.x - half, handle.y - half, boxSize, boxSize);
    }
  }

  ctx.restore();
}

export function drawSelection(ctx, object, accent = '#ff315c', options = {}) {
  if (!getObjectFrame(object)) return;
  strokeFrame(ctx, object, accent, { handles: options.handles !== false, handleSize: options.handleSize, rotateHandleDistance: options.rotateHandleDistance });
}

export function drawMultiSelection(ctx, objects, accent = '#ff315c', options = {}) {
  const visible = (objects || []).filter((object) => getObjectFrame(object));
  if (!visible.length) return;

  if (visible.length === 1) {
    drawSelection(ctx, visible[0], accent, { handles: true, handleSize: options.handleSize, rotateHandleDistance: options.rotateHandleDistance });
    return;
  }

  visible.forEach((object) => drawSelection(ctx, object, accent, { handles: false }));
  const bounds = getSelectionBounds(visible);
  if (bounds) strokeFrame(ctx, bounds, accent, { outer: true, handles: true, handleSize: options.handleSize, rotateHandleDistance: options.rotateHandleDistance });
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
      x = original.x + (original.w - w) / 2;
    } else if (handle === 'e' || handle === 'w') {
      h = Math.max(8, w / aspect);
      y = original.y + (original.h - h) / 2;
    } else {
      const widthFromPointer = Math.max(8, w);
      const heightFromPointer = Math.max(8, h);
      if (Math.abs(widthFromPointer - original.w) >= Math.abs(heightFromPointer - original.h) * aspect) h = Math.max(8, widthFromPointer / aspect);
      else w = Math.max(8, heightFromPointer * aspect);
      if (handle.includes('n')) y = original.y + original.h - h;
      if (handle.includes('w')) x = original.x + original.w - w;
    }
  }

  return { x, y, w, h };
}

function resizeRotatedObject(object, handle, pointer, startPointer, keepAspect = false) {
  const frame = getObjectFrame(object);
  const rotation = Number(object.rotation) || 0;
  if (!frame || !rotation || isDrawLayer(object)) return null;

  const center = boundsCenter(frame);
  const localStart = unrotatePointAround(startPointer, center, rotation);
  const localPointer = unrotatePointAround(pointer, center, rotation);
  const localRect = { x: -frame.w / 2, y: -frame.h / 2, w: frame.w, h: frame.h };
  const localStartCentered = { x: localStart.x - center.x, y: localStart.y - center.y };
  const localPointerCentered = { x: localPointer.x - center.x, y: localPointer.y - center.y };
  const resized = resizeFromHandle(localRect, handle, localPointerCentered, localStartCentered, keepAspect);
  const localCenter = { x: resized.x + resized.w / 2, y: resized.y + resized.h / 2 };
  const globalCenterOffset = rotatePointAround(localCenter, { x: 0, y: 0 }, rotation);
  const nextCenter = { x: center.x + globalCenterOffset.x, y: center.y + globalCenterOffset.y };

  return {
    id: object.id,
    patch: {
      x: nextCenter.x - resized.w / 2,
      y: nextCenter.y - resized.h / 2,
      w: Math.max(8, resized.w),
      h: Math.max(8, resized.h)
    }
  };
}

export function resizeSelectionFromHandle(objects, selectionBounds, handle, pointer, startPointer, keepAspect = false) {
  if (!selectionBounds || !(objects || []).length) return [];
  if (objects.length === 1) {
    const rotated = resizeRotatedObject(objects[0], handle, pointer, startPointer, keepAspect);
    if (rotated) return [rotated];
  }

  const target = resizeFromHandle(selectionBounds, handle, pointer, startPointer, keepAspect);
  const scaleX = target.w / Math.max(1, selectionBounds.w);
  const scaleY = target.h / Math.max(1, selectionBounds.h);

  return objects.map((object) => {
    const x = Number(object.x);
    const y = Number(object.y);
    const w = Number(object.w);
    const h = Number(object.h);
    const center = getObjectTransformCenter(object);
    if (![x, y, w, h].every(Number.isFinite) || !center) return null;
    const nextCenter = {
      x: target.x + (center.x - selectionBounds.x) * scaleX,
      y: target.y + (center.y - selectionBounds.y) * scaleY
    };
    const dx = nextCenter.x - center.x;
    const dy = nextCenter.y - center.y;
    return {
      id: object.id,
      patch: {
        x: x + dx,
        y: y + dy,
        w: Math.max(8, w * scaleX),
        h: Math.max(8, h * scaleY)
      }
    };
  }).filter(Boolean);
}

export function rotateSelection(objects, selectionBounds, pointer, startPointer, startAngle = null, snap = false) {
  if (!selectionBounds || !(objects || []).length) return [];
  const center = boundsCenter(selectionBounds);
  const initialAngle = Number.isFinite(startAngle) ? startAngle : Math.atan2(startPointer.y - center.y, startPointer.x - center.x);
  const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
  let deltaDegrees = (currentAngle - initialAngle) * 180 / Math.PI;
  if (snap) deltaDegrees = Math.round(deltaDegrees / 15) * 15;

  return objects.map((object) => {
    const objectCenter = getObjectTransformCenter(object);
    if (!objectCenter) return null;
    const nextCenter = rotatePointAround(objectCenter, center, deltaDegrees);
    return {
      id: object.id,
      patch: {
        x: (Number(object.x) || 0) + (nextCenter.x - objectCenter.x),
        y: (Number(object.y) || 0) + (nextCenter.y - objectCenter.y),
        rotation: normalizeRotation((Number(object.rotation) || 0) + deltaDegrees)
      }
    };
  }).filter(Boolean);
}
