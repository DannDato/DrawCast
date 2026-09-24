import { getThemeColor } from '../../../utils/theme';
import { drawObject } from './drawObject';

export function orderedObjects(objects) {
  return Object.values(objects || {}).sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
}


export function sceneHasRunningTimers(objects) {
  const list = Array.isArray(objects) ? objects : Object.values(objects || {});
  return list.some((object) => object && !object.hidden && object.tipo === 'timer' && Boolean(object.timerRunning ?? object.running));
}

export function drawGrid(ctx, width = 1920, height = 1080, step = 96) {
  ctx.save();
  ctx.strokeStyle = getThemeColor('--dc-editor-grid', '--dc-line-soft');
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.restore();
}

export function renderScene(ctx, objects, options = {}) {
  const width = options.width || 1920;
  const height = options.height || 1080;
  if (options.clear !== false) ctx.clearRect(0, 0, width, height);
  if (options.grid) drawGrid(ctx, width, height, options.gridStep || 96);
  const sceneObjects = Array.isArray(options.orderedObjects) ? options.orderedObjects : orderedObjects(objects);
  for (const object of sceneObjects) drawObject(ctx, object, options);

  for (const stroke of Object.values(options.liveStrokes || {})) {
    drawObject(ctx, {
      id: `live_${stroke.id}`,
      tipo: 'draw',
      x: Number(stroke.layerX) || 0,
      y: Number(stroke.layerY) || 0,
      w: Number(stroke.layerW) || 1920,
      h: Number(stroke.layerH) || 1080,
      sourceWidth: 1920,
      sourceHeight: 1080,
      rotation: Number(stroke.layerRotation) || 0,
      lineas: [stroke],
      zIndex: Number.MAX_SAFE_INTEGER
    }, options);
  }
}
