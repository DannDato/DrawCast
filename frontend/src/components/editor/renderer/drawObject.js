import { drawShape, traceRoundedRect } from './shapeRenderer';
import { drawTextLayer } from './textRenderer';
import { getTimerText } from '../tools/timer/timerTool';

const images = new Map();

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

export function drawStrokeLayer(ctx, object) {
  const lines = object.lineas || [];
  const sourceWidth = Math.max(1, Number(object.sourceWidth) || 1920);
  const sourceHeight = Math.max(1, Number(object.sourceHeight) || 1080);
  const scaleX = Math.max(0.0001, (Number(object.w) || sourceWidth) / sourceWidth);
  const scaleY = Math.max(0.0001, (Number(object.h) || sourceHeight) / sourceHeight);
  const offsetX = Number(object.x) || 0;
  const offsetY = Number(object.y) || 0;

  for (const line of lines) {
    const points = strokePoints(line);
    if (points.length < 2) continue;
    const erase = line.mode === 'erase' || line.modo === 'borrar';
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.globalAlpha = erase ? 1 : Math.max(0.05, Math.min(1, Number(line.opacity) || 1));
    ctx.strokeStyle = line.color || '#ffffff';
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
}

export function drawObject(ctx, object, options = {}) {
  if (!object || object.hidden) return;
  const type = getObjectType(object);
  ctx.save();
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
  return x >= ox && x <= ox + ow && y >= oy && y <= oy + oh;
}
