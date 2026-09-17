export function normalizeRotation(value = 0) {
  const rotation = Number(value) || 0;
  return ((((rotation + 180) % 360) + 360) % 360) - 180;
}

export function rotationRadians(value = 0) {
  return (Number(value) || 0) * Math.PI / 180;
}

export function rotatePointAround(point, center, degrees = 0) {
  const angle = rotationRadians(degrees);
  if (!angle) return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = (Number(point.x) || 0) - (Number(center.x) || 0);
  const dy = (Number(point.y) || 0) - (Number(center.y) || 0);
  return {
    x: (Number(center.x) || 0) + (dx * cos) - (dy * sin),
    y: (Number(center.y) || 0) + (dx * sin) + (dy * cos)
  };
}

export function unrotatePointAround(point, center, degrees = 0) {
  return rotatePointAround(point, center, -(Number(degrees) || 0));
}

export function boundsCenter(bounds) {
  return {
    x: (Number(bounds?.x) || 0) + (Number(bounds?.w) || 0) / 2,
    y: (Number(bounds?.y) || 0) + (Number(bounds?.h) || 0) / 2
  };
}

export function rotatedRectCorners(bounds, degrees = 0) {
  if (!bounds) return [];
  const x = Number(bounds.x) || 0;
  const y = Number(bounds.y) || 0;
  const w = Math.max(0, Number(bounds.w) || 0);
  const h = Math.max(0, Number(bounds.h) || 0);
  const center = boundsCenter({ x, y, w, h });
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ].map((point) => rotatePointAround(point, center, degrees));
}

export function boundsFromPoints(points = []) {
  if (!points.length) return null;
  const xs = points.map((point) => Number(point.x)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point.y)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function rotatedRectBounds(bounds, degrees = 0) {
  if (!bounds) return null;
  if (!(Number(degrees) || 0)) return { ...bounds };
  return boundsFromPoints(rotatedRectCorners(bounds, degrees));
}
