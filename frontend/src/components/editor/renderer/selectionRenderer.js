import { getDrawLayerBounds, isDrawLayer } from '../tools/drawing/drawingTool';
import { boundsCenter, normalizeRotation, rotatePointAround, rotatedRectBounds, rotatedRectCorners, unrotatePointAround } from './transformUtils';
import { getThemeColor } from '../../../utils/theme';

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
  const handles = target.shapeType === 'line' ? ['w', 'e'] : RESIZE_HANDLES;
  return handles.map((id) => ({ id, ...rotatePointAround(points[id], center, rotation) }));
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
      ctx.fillStyle = getThemeColor('--dc-selection-handle', '--dc-text-strong');
      ctx.beginPath();
      ctx.arc(rotateHandle.x, rotateHandle.y, Math.max(6, boxSize * 0.65), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const handle of getResizeHandles(target)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = getThemeColor('--dc-selection-handle', '--dc-text-strong');
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, boxSize * 0.18);
      ctx.fillRect(handle.x - half, handle.y - half, boxSize, boxSize);
      ctx.strokeRect(handle.x - half, handle.y - half, boxSize, boxSize);
    }
  }

  ctx.restore();
}

export function drawSelection(ctx, object, accent = getThemeColor('--dc-accent'), options = {}) {
  if (!getObjectFrame(object)) return;
  strokeFrame(ctx, object, accent, { handles: options.handles !== false, handleSize: options.handleSize, rotateHandleDistance: options.rotateHandleDistance });
}

export function drawMultiSelection(ctx, objects, accent = getThemeColor('--dc-accent'), options = {}) {
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

export function drawMarquee(ctx, start, end, accent = getThemeColor('--dc-accent')) {
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
  const minSize = 8;
  const left = original.x;
  const top = original.y;
  const right = original.x + original.w;
  const bottom = original.y + original.h;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  // El borde contrario al handle es el ancla del resize. Nunca se mueve.
  if (handle.includes('e')) nextRight = Math.max(left + minSize, right + dx);
  if (handle.includes('w')) nextLeft = Math.min(right - minSize, left + dx);
  if (handle.includes('s')) nextBottom = Math.max(top + minSize, bottom + dy);
  if (handle.includes('n')) nextTop = Math.min(bottom - minSize, top + dy);

  if (!keepAspect || original.h <= 0) {
    return {
      x: nextLeft,
      y: nextTop,
      w: Math.max(minSize, nextRight - nextLeft),
      h: Math.max(minSize, nextBottom - nextTop)
    };
  }

  const aspect = original.w / original.h;
  const horizontalHandle = handle === 'e' || handle === 'w';
  const verticalHandle = handle === 'n' || handle === 's';

  if (horizontalHandle) {
    const width = Math.max(minSize, nextRight - nextLeft);
    const height = Math.max(minSize, width / aspect);
    const centerY = top + original.h / 2;
    return {
      x: nextLeft,
      y: centerY - height / 2,
      w: width,
      h: height
    };
  }

  if (verticalHandle) {
    const height = Math.max(minSize, nextBottom - nextTop);
    const width = Math.max(minSize, height * aspect);
    const centerX = left + original.w / 2;
    return {
      x: centerX - width / 2,
      y: nextTop,
      w: width,
      h: height
    };
  }

  // En esquinas se conserva la esquina diagonal como ancla absoluta.
  const anchorX = handle.includes('w') ? right : left;
  const anchorY = handle.includes('n') ? bottom : top;
  const desiredWidth = Math.max(minSize, Math.abs((handle.includes('w') ? nextLeft : nextRight) - anchorX));
  const desiredHeight = Math.max(minSize, Math.abs((handle.includes('n') ? nextTop : nextBottom) - anchorY));
  const widthScale = desiredWidth / original.w;
  const heightScale = desiredHeight / original.h;
  const scale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale;
  const width = Math.max(minSize, original.w * scale);
  const height = Math.max(minSize, original.h * scale);

  return {
    x: handle.includes('w') ? anchorX - width : anchorX,
    y: handle.includes('n') ? anchorY - height : anchorY,
    w: width,
    h: height
  };
}

function resizeRotatedFrame(frame, rotation, handle, pointer, startPointer, keepAspect = false) {
  if (!frame) return null;
  if (!rotation) return resizeFromHandle(frame, handle, pointer, startPointer, keepAspect);

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
    x: nextCenter.x - resized.w / 2,
    y: nextCenter.y - resized.h / 2,
    w: Math.max(8, resized.w),
    h: Math.max(8, resized.h)
  };
}

function patchObjectToFrame(object, originalFrame, nextFrame) {
  if (!object?.id || !originalFrame || !nextFrame) return null;

  if (isDrawLayer(object)) {
    const objectX = Number(object.x) || 0;
    const objectY = Number(object.y) || 0;
    const objectW = Math.max(8, Number(object.w) || 8);
    const objectH = Math.max(8, Number(object.h) || 8);
    const scaleX = nextFrame.w / Math.max(1, originalFrame.w);
    const scaleY = nextFrame.h / Math.max(1, originalFrame.h);
    const visibleOffsetX = originalFrame.x - objectX;
    const visibleOffsetY = originalFrame.y - objectY;

    return {
      id: object.id,
      patch: {
        x: nextFrame.x - visibleOffsetX * scaleX,
        y: nextFrame.y - visibleOffsetY * scaleY,
        w: Math.max(8, objectW * scaleX),
        h: Math.max(8, objectH * scaleY)
      }
    };
  }

  return {
    id: object.id,
    patch: {
      x: nextFrame.x,
      y: nextFrame.y,
      w: Math.max(8, nextFrame.w),
      h: Math.max(8, nextFrame.h)
    }
  };
}

export function resizeSelectionFromHandle(objects, selectionBounds, handle, pointer, startPointer, keepAspect = false) {
  if (!selectionBounds || !(objects || []).length) return [];

  if (objects.length === 1) {
    const object = objects[0];
    const frame = getObjectFrame(object);
    if (!frame) return [];
    const targetFrame = resizeRotatedFrame(frame, Number(object.rotation) || 0, handle, pointer, startPointer, keepAspect);
    const update = patchObjectToFrame(object, frame, targetFrame);
    return update ? [update] : [];
  }

  const target = resizeFromHandle(selectionBounds, handle, pointer, startPointer, keepAspect);
  const scaleX = target.w / Math.max(1, selectionBounds.w);
  const scaleY = target.h / Math.max(1, selectionBounds.h);

  return objects.map((object) => {
    const frame = getObjectFrame(object);
    const center = getObjectTransformCenter(object);
    if (!frame || !center) return null;

    const nextCenter = {
      x: target.x + (center.x - selectionBounds.x) * scaleX,
      y: target.y + (center.y - selectionBounds.y) * scaleY
    };
    const nextFrame = {
      x: nextCenter.x - (frame.w * scaleX) / 2,
      y: nextCenter.y - (frame.h * scaleY) / 2,
      w: Math.max(8, frame.w * scaleX),
      h: Math.max(8, frame.h * scaleY)
    };

    return patchObjectToFrame(object, frame, nextFrame);
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
