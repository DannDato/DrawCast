import { drawShape, traceRoundedRect } from './shapeRenderer';
import { drawTextLayer } from './textRenderer';
import { getTimerText } from '../tools/timer/timerTool';
import { getDrawLayerBounds, isDrawLayer } from '../tools/drawing/drawingTool';
import { boundsCenter, unrotatePointAround } from './transformUtils';
import { getThemeColor } from '../../../utils/theme';

const images = new Map();
const drawLayerCache = new Map();
const DRAW_LAYER_CACHE_LIMIT = 6;
const DRAW_LAYER_CACHE_MAX_PIXELS = 4_200_000;
let drawCacheTick = 0;

function getObjectType(object) {
  const type = object?.tipo;
  if (type === 'forma') return 'shape';
  if (type === 'imagen') return 'image';
  if (type === 'texto') return 'text';
  if (type === 'trazo') return 'draw';
  return type;
}

function getImage(url) {
  if (!url) return null;
  let image = images.get(url);
  if (!image) {
    image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    images.set(url, image);
  }
  return image;
}

export async function preloadSceneImages(objects) {
  const urls = [...new Set(Object.values(objects).filter((object) => !object.hidden && getObjectType(object) === 'image').map((object) => object.url))];
  await Promise.all(urls.map(async (url) => {
    const image = getImage(url);
    if (!image) throw new Error('Hay una imagen sin cargar en el lienzo.');
    try { await image.decode(); } catch { throw new Error('No se pudo cargar una imagen del lienzo para guardar la guía.'); }
  }));
}

function drawImage(ctx, object) {
  const image = getImage(object.url);
  if (!image?.complete || !image.naturalWidth) return;
  const opacity = Math.max(0, Math.min(1, Number.isFinite(object.opacity) ? object.opacity : 1));
  const radius = Math.max(0, Number(object.borderRadius ?? object.radius) || 0);
  const x = Number(object.x) || 0;
  const y = Number(object.y) || 0;
  const w = Math.max(1, Number(object.w) || 1);
  const h = Math.max(1, Number(object.h) || 1);
  ctx.save();
  ctx.globalAlpha = opacity;
  if (radius > 0) {
    traceRoundedRect(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
}

function strokePoints(line) {
  if (Array.isArray(line?.points)) return line.points;
  if ([line?.x1, line?.y1, line?.x2, line?.y2].every((value) => Number.isFinite(Number(value)))) {
    return [{ x: Number(line.x1), y: Number(line.y1) }, { x: Number(line.x2), y: Number(line.y2) }];
  }
  return [];
}

function drawStroke(ctx, line, options = {}) {
  const points = strokePoints(line);
  if (points.length < 2) return;

  const scaleX = Number(options.scaleX) || 1;
  const scaleY = Number(options.scaleY) || 1;
  const offsetX = Number(options.offsetX) || 0;
  const offsetY = Number(options.offsetY) || 0;
  const erase = line.mode === 'erase' || line.modo === 'borrar';

  ctx.save();
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  ctx.globalAlpha = erase ? 1 : Math.max(0.05, Math.min(1, Number(line.opacity) || 1));
  ctx.strokeStyle = line.color || getThemeColor('--dc-object-text', '--dc-text');
  ctx.lineWidth = (Number(line.size ?? line.grosor) || 8) * ((scaleX + scaleY) / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = offsetX + Number(point.x) * scaleX;
    const y = offsetY + Number(point.y) * scaleY;
    if (index === 0) ctx.moveTo(x, y);
    else if (index === points.length - 1 || points.length < 3) ctx.lineTo(x, y);
    else {
      const next = points[index + 1] || point;
      const midX = offsetX + ((Number(point.x) + Number(next.x)) / 2) * scaleX;
      const midY = offsetY + ((Number(point.y) + Number(next.y)) / 2) * scaleY;
      ctx.quadraticCurveTo(x, y, midX, midY);
    }
  });
  ctx.stroke();
  ctx.restore();
}

function createRasterCanvas(width, height) {
  if (width * height > DRAW_LAYER_CACHE_MAX_PIXELS || width > 4096 || height > 4096) return null;
  try {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } catch {
    return null;
  }
}

function evictOldDrawCaches() {
  while (drawLayerCache.size > DRAW_LAYER_CACHE_LIMIT) {
    let oldestId = null;
    let oldestTick = Infinity;
    drawLayerCache.forEach((entry, id) => {
      if (entry.lastUsed < oldestTick) {
        oldestTick = entry.lastUsed;
        oldestId = id;
      }
    });
    if (!oldestId) return;
    const entry = drawLayerCache.get(oldestId);
    drawLayerCache.delete(oldestId);
    if (entry?.canvas && 'width' in entry.canvas) {
      entry.canvas.width = 1;
      entry.canvas.height = 1;
    }
  }
}

function cachedDrawLayer(object, sourceWidth, sourceHeight) {
  if (!object?.id || !object.compuesto) return null;
  const lines = Array.isArray(object.lineas) ? object.lineas : [];
  let entry = drawLayerCache.get(object.id);

  if (!entry || entry.sourceWidth !== sourceWidth || entry.sourceHeight !== sourceHeight) {
    const canvas = createRasterCanvas(sourceWidth, sourceHeight);
    const rasterContext = canvas?.getContext?.('2d');
    if (!canvas || !rasterContext) return null;
    entry = { canvas, ctx: rasterContext, sourceWidth, sourceHeight, linesRef: null, lineCount: 0, lastLineRef: null, lastUsed: 0 };
    drawLayerCache.set(object.id, entry);
  }

  entry.lastUsed = ++drawCacheTick;
  if (entry.linesRef !== lines) {
    const canAppendOne = lines.length === entry.lineCount + 1
      && (entry.lineCount === 0 || entry.lastLineRef === lines[entry.lineCount - 1]);

    if (canAppendOne) {
      drawStroke(entry.ctx, lines.at(-1));
    } else {
      entry.ctx.setTransform(1, 0, 0, 1, 0, 0);
      entry.ctx.globalCompositeOperation = 'source-over';
      entry.ctx.globalAlpha = 1;
      entry.ctx.clearRect(0, 0, sourceWidth, sourceHeight);
      lines.forEach((line) => drawStroke(entry.ctx, line));
    }

    entry.linesRef = lines;
    entry.lineCount = lines.length;
    entry.lastLineRef = lines.at(-1) || null;
  }

  evictOldDrawCaches();
  return entry.canvas;
}

export function drawStrokeLayer(ctx, object) {
  const lines = object.lineas || [];
  const sourceWidth = Math.max(1, Math.round(Number(object.sourceWidth) || 1920));
  const sourceHeight = Math.max(1, Math.round(Number(object.sourceHeight) || 1080));
  const width = Math.max(1, Number(object.w) || sourceWidth);
  const height = Math.max(1, Number(object.h) || sourceHeight);
  const scaleX = Math.max(0.0001, width / sourceWidth);
  const scaleY = Math.max(0.0001, height / sourceHeight);
  const offsetX = Number(object.x) || 0;
  const offsetY = Number(object.y) || 0;
  const raster = cachedDrawLayer(object, sourceWidth, sourceHeight);

  if (raster) {
    ctx.drawImage(raster, offsetX, offsetY, width, height);
    return;
  }

  for (const line of lines) drawStroke(ctx, line, { scaleX, scaleY, offsetX, offsetY });
}

function transformFrame(object) {
  if (isDrawLayer(object)) return getDrawLayerBounds(object);
  const x = Number(object?.x);
  const y = Number(object?.y);
  const w = Number(object?.w);
  const h = Number(object?.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x, y, w, h };
}

function applyObjectRotation(ctx, object) {
  const rotation = Number(object?.rotation) || 0;
  if (!rotation) return;
  const frame = transformFrame(object);
  if (!frame) return;
  const center = boundsCenter(frame);
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.translate(-center.x, -center.y);
}

export function drawObject(ctx, object, options = {}) {
  if (!object || object.hidden) return;
  const type = getObjectType(object);
  ctx.save();
  applyObjectRotation(ctx, object);
  if (type === 'shape') drawShape(ctx, object);
  else if (type === 'image') drawImage(ctx, object);
  else if (type === 'text') drawTextLayer(ctx, object, object.text ?? object.texto ?? '');
  else if (type === 'timer') drawTextLayer(ctx, object, getTimerText(object, options.now));
  else if (type === 'draw') drawStrokeLayer(ctx, object);
  ctx.restore();
}

export function hitObject(object, x, y) {
  if (!object || object.hidden || getObjectType(object) === 'draw') return false;
  const ox = Number(object.x) || 0;
  const oy = Number(object.y) || 0;
  const ow = Number(object.w) || 0;
  const oh = Number(object.h) || 0;
  const frame = transformFrame(object);
  const point = frame && Number(object.rotation) ? unrotatePointAround({ x, y }, boundsCenter(frame), Number(object.rotation) || 0) : { x, y };
  if (object.shapeType === 'line') {
    const tolerance = Math.max(6, (Number(object.strokeWidth) || 4) / 2 + 2);
    const closestX = Math.max(ox, Math.min(ox + ow, point.x));
    return Math.hypot(point.x - closestX, point.y - (oy + oh / 2)) <= tolerance;
  }
  return point.x >= ox && point.x <= ox + ow && point.y >= oy && point.y <= oy + oh;
}
