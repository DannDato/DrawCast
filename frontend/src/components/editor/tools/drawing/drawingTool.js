import { boundsCenter, unrotatePointAround } from '../../renderer/transformUtils';
import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

const token = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const BRUSH_PRESETS = [
  { value: 'pencil', label: 'LÁPIZ', opacity: 1 },
  { value: 'marker', label: 'MARCADOR', opacity: 0.78 },
  { value: 'highlighter', label: 'RESALTADOR', opacity: 0.36 }
];

export const DEFAULT_DRAW_CONFIG = {
  color: DEFAULT_EDITOR_PREFERENCES.colors.drawing,
  size: 10,
  brush: 'pencil',
  opacity: 1
};

export function isDrawLayer(object) {
  return Boolean(object) && (object.tipo === 'draw' || object.tipo === 'trazo') && Boolean(object.compuesto ?? true);
}

export function normalizeDrawConfig(config = {}) {
  const brush = BRUSH_PRESETS.some((item) => item.value === config.brush) ? config.brush : 'pencil';
  const preset = BRUSH_PRESETS.find((item) => item.value === brush) || BRUSH_PRESETS[0];
  const size = Math.max(2, Math.min(100, Number(config.size ?? config.grosor) || DEFAULT_DRAW_CONFIG.size));
  const opacity = Math.max(0.05, Math.min(1, Number(config.opacity ?? preset.opacity) || preset.opacity));
  return {
    color: /^#[0-9a-f]{6}$/i.test(String(config.color || '')) ? config.color : DEFAULT_DRAW_CONFIG.color,
    size,
    brush,
    opacity
  };
}

export function nextDrawLayerName(objects = {}) {
  const regex = /^DIBUJO\s+(\d+)$/i;
  let max = 0;
  Object.values(objects).forEach((object) => {
    if (!isDrawLayer(object)) return;
    const match = String(object.layerName || '').match(regex);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  });
  return `DIBUJO ${max + 1}`;
}

export function makeDrawLayer(objects = {}, options = {}) {
  const maxZ = Math.max(0, ...Object.values(objects).map((object) => Number(object?.zIndex) || 0));
  return {
    id: token('draw_layer'),
    tipo: 'draw',
    compuesto: true,
    x: Number(options.x) || 0,
    y: Number(options.y) || 0,
    w: CANVAS_WIDTH,
    h: CANVAS_HEIGHT,
    sourceWidth: CANVAS_WIDTH,
    sourceHeight: CANVAS_HEIGHT,
    rotation: 0,
    lineas: [],
    hidden: false,
    layerName: options.layerName || nextDrawLayerName(objects),
    zIndex: Number.isFinite(options.zIndex) ? options.zIndex : maxZ + 1
  };
}

export function makeStroke({ layerId, mode = 'paint', config = DEFAULT_DRAW_CONFIG, point }) {
  const normalized = normalizeDrawConfig(config);
  return {
    id: token('stroke'),
    layerId,
    mode: mode === 'erase' ? 'erase' : 'paint',
    modo: mode === 'erase' ? 'borrar' : 'pintar',
    color: normalized.color,
    size: normalized.size,
    grosor: normalized.size,
    brush: normalized.brush,
    opacity: mode === 'erase' ? 1 : normalized.opacity,
    points: point ? [{ x: Number(point.x) || 0, y: Number(point.y) || 0 }] : []
  };
}

export function appendStrokePoint(stroke, point, minimumDistance = 0.8) {
  if (!stroke || !point) return stroke;
  const points = stroke.points || (stroke.points = []);
  const next = { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  const previous = points.at(-1);
  if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < minimumDistance) return stroke;
  points.push(next);
  return stroke;
}

export function appendStrokeToLayer(layer, stroke) {
  if (!isDrawLayer(layer) || !stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return layer;
  return { ...layer, lineas: [...(layer.lineas || []), stroke] };
}

export function clearDrawLayer(layer) {
  return isDrawLayer(layer) ? { ...layer, lineas: [] } : layer;
}

function strokeSegments(stroke) {
  if (Array.isArray(stroke?.points)) {
    const points = stroke.points;
    const segments = [];
    for (let index = 1; index < points.length; index += 1) {
      segments.push({
        x1: points[index - 1].x,
        y1: points[index - 1].y,
        x2: points[index].x,
        y2: points[index].y,
        size: Number(stroke.size ?? stroke.grosor) || 8,
        erase: stroke.mode === 'erase' || stroke.modo === 'borrar'
      });
    }
    return segments;
  }

  if ([stroke?.x1, stroke?.y1, stroke?.x2, stroke?.y2].every((value) => Number.isFinite(Number(value)))) {
    return [{
      x1: Number(stroke.x1), y1: Number(stroke.y1), x2: Number(stroke.x2), y2: Number(stroke.y2),
      size: Number(stroke.grosor ?? stroke.size) || 8,
      erase: stroke.modo === 'borrar' || stroke.mode === 'erase'
    }];
  }

  return [];
}

export function getDrawLayerBounds(layer) {
  if (!isDrawLayer(layer) || !(layer.lineas || []).length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of layer.lineas || []) {
    for (const segment of strokeSegments(stroke)) {
      if (segment.erase) continue;
      const half = Math.max(2, segment.size / 2);
      minX = Math.min(minX, segment.x1 - half, segment.x2 - half);
      minY = Math.min(minY, segment.y1 - half, segment.y2 - half);
      maxX = Math.max(maxX, segment.x1 + half, segment.x2 + half);
      maxY = Math.max(maxY, segment.y1 + half, segment.y2 + half);
    }
  }

  if (!Number.isFinite(minX)) return null;
  const sourceWidth = Math.max(1, Number(layer.sourceWidth ?? CANVAS_WIDTH));
  const sourceHeight = Math.max(1, Number(layer.sourceHeight ?? CANVAS_HEIGHT));
  const scaleX = Math.max(0.0001, Number(layer.w ?? sourceWidth) / sourceWidth);
  const scaleY = Math.max(0.0001, Number(layer.h ?? sourceHeight) / sourceHeight);
  const x = Number(layer.x) || 0;
  const y = Number(layer.y) || 0;

  return {
    x: x + minX * scaleX,
    y: y + minY * scaleY,
    w: Math.max(1, (maxX - minX) * scaleX),
    h: Math.max(1, (maxY - minY) * scaleY)
  };
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitDrawLayer(layer, x, y) {
  if (!isDrawLayer(layer) || layer.hidden) return false;
  const sourceWidth = Math.max(1, Number(layer.sourceWidth ?? CANVAS_WIDTH));
  const sourceHeight = Math.max(1, Number(layer.sourceHeight ?? CANVAS_HEIGHT));
  const scaleX = Math.max(0.0001, Number(layer.w ?? sourceWidth) / sourceWidth);
  const scaleY = Math.max(0.0001, Number(layer.h ?? sourceHeight) / sourceHeight);
  const frame = getDrawLayerBounds(layer);
  const canvasPoint = frame && Number(layer.rotation) ? unrotatePointAround({ x, y }, boundsCenter(frame), Number(layer.rotation) || 0) : { x, y };
  const localX = (canvasPoint.x - (Number(layer.x) || 0)) / scaleX;
  const localY = (canvasPoint.y - (Number(layer.y) || 0)) / scaleY;

  for (let strokeIndex = (layer.lineas || []).length - 1; strokeIndex >= 0; strokeIndex -= 1) {
    const segments = strokeSegments(layer.lineas[strokeIndex]);
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      if (segment.erase) continue;
      const tolerance = Math.max(7, segment.size * 0.8);
      if (distancePointToSegment(localX, localY, segment.x1, segment.y1, segment.x2, segment.y2) <= tolerance) return true;
    }
  }
  return false;
}

export function reduceLiveStrokeMap(current, payload) {
  if (!payload?.strokeId) return current;
  const next = { ...current };
  if (payload.phase === 'end' || payload.phase === 'cancel') {
    delete next[payload.strokeId];
    return next;
  }

  if (payload.phase === 'start') {
    next[payload.strokeId] = {
      id: payload.strokeId,
      layerId: payload.layerId,
      mode: payload.mode === 'erase' ? 'erase' : 'paint',
      color: payload.color || DEFAULT_EDITOR_PREFERENCES.colors.drawing,
      size: Math.max(2, Math.min(100, Number(payload.size) || 10)),
      brush: payload.brush || 'pencil',
      opacity: Math.max(0.05, Math.min(1, Number(payload.opacity) || 1)),
      layerX: Number(payload.layerX) || 0,
      layerY: Number(payload.layerY) || 0,
      layerW: Number(payload.layerW) || 1920,
      layerH: Number(payload.layerH) || 1080,
      layerRotation: Number(payload.layerRotation) || 0,
      points: payload.point ? [payload.point] : [],
      updatedAt: Date.now()
    };
    return next;
  }

  if (payload.phase === 'point' && next[payload.strokeId] && payload.point) {
    next[payload.strokeId] = {
      ...next[payload.strokeId],
      points: [...next[payload.strokeId].points, payload.point],
      updatedAt: Date.now()
    };
  }
  return next;
}

export function pruneLiveStrokes(strokes, maxAgeMs = 5000) {
  const now = Date.now();
  return Object.fromEntries(Object.entries(strokes || {}).filter(([, stroke]) => now - (stroke.updatedAt || 0) < maxAgeMs));
}
