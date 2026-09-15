import { drawObject } from './drawObject';

export function orderedObjects(objects) {
  return Object.values(objects || {}).sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
}

export function drawGrid(ctx, width = 1920, height = 1080, step = 96) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

export function renderScene(ctx, objects, options = {}) {
  const width = options.width || 1920;
  const height = options.height || 1080;
  ctx.clearRect(0, 0, width, height);
  if (options.grid) drawGrid(ctx, width, height, options.gridStep || 96);

  for (const object of orderedObjects(objects)) drawObject(ctx, object, options);
}
