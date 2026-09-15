import { drawShape, traceRoundedRect } from './shapeRenderer';

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

export function timerText(object, now = Date.now()) {
  const mode = object.timerMode || object.mode || 'up';
  const startSeconds = Math.max(0, Number(object.startSeconds ?? object.baseSeconds) || 0);
  const limitSeconds = Math.max(0, Number(object.limitSeconds ?? 359999) || 0);
  const running = Boolean(object.timerRunning ?? object.running);
  const fallbackCurrent = Number.isFinite(object.timerCurrentSeconds) ? object.timerCurrentSeconds : startSeconds;
  let current = fallbackCurrent;

  if (running) {
    const resumeSeconds = Number.isFinite(object.timerResumeSeconds) ? object.timerResumeSeconds : fallbackCurrent;
    const startedAt = Number.isFinite(object.startedAtMs) ? object.startedAtMs : Number(object.startedAt) || now;
    const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
    current = mode === 'down' ? Math.max(limitSeconds, resumeSeconds - elapsed) : Math.min(limitSeconds, resumeSeconds + elapsed);
  }

  const safe = Math.max(0, Math.floor(current));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function drawText(ctx, object, value) {
  const fontSize = Number(object.fontSize) || 64;
  const fontFamily = object.fontFamily || object.font || 'Outfit';
  const strokeWidth = Math.max(0, Number(object.strokeWidth ?? object.strokeSize) || 0);

  ctx.font = `900 ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = object.color || '#ffffff';
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = object.strokeColor || object.stroke || '#000000';

  if (strokeWidth > 0) ctx.strokeText(value || '', object.x || 0, object.y || 0);
  ctx.fillText(value || '', object.x || 0, object.y || 0);
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

function drawStrokeLayer(ctx, object) {
  const lines = object.lineas || [];
  for (const line of lines) {
    if (Array.isArray(line.points)) {
      if (line.points.length < 2) continue;
      ctx.save();
      ctx.globalCompositeOperation = line.mode === 'erase' || line.modo === 'borrar' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = line.color || '#ffffff';
      ctx.lineWidth = Number(line.size ?? line.grosor) || 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      line.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalCompositeOperation = line.modo === 'borrar' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = line.color || '#ffffff';
    ctx.lineWidth = Number(line.grosor) || 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((object.x || 0) + (line.x1 || 0), (object.y || 0) + (line.y1 || 0));
    ctx.lineTo((object.x || 0) + (line.x2 || 0), (object.y || 0) + (line.y2 || 0));
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
  else if (type === 'text') drawText(ctx, object, object.text ?? object.texto ?? '');
  else if (type === 'timer') drawText(ctx, object, timerText(object, options.now));
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
