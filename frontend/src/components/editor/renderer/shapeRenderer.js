import { getThemeColor } from '../../../utils/theme';
function clampRadius(radius, max) {
  return Math.max(0, Math.min(Number(radius) || 0, max));
}

export function traceRoundedPolygon(ctx, points, radius = 0) {
  if (!points || points.length < 3) return;

  if (radius <= 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    return;
  }

  const corners = points.map((current, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const toPreviousX = previous.x - current.x;
    const toPreviousY = previous.y - current.y;
    const toNextX = next.x - current.x;
    const toNextY = next.y - current.y;
    const previousLength = Math.hypot(toPreviousX, toPreviousY) || 1;
    const nextLength = Math.hypot(toNextX, toNextY) || 1;
    const cornerRadius = Math.min(radius, previousLength / 2, nextLength / 2);

    return {
      inPoint: {
        x: current.x + (toPreviousX / previousLength) * cornerRadius,
        y: current.y + (toPreviousY / previousLength) * cornerRadius
      },
      outPoint: {
        x: current.x + (toNextX / nextLength) * cornerRadius,
        y: current.y + (toNextY / nextLength) * cornerRadius
      }
    };
  });

  ctx.beginPath();
  ctx.moveTo(corners[0].outPoint.x, corners[0].outPoint.y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(corners[i].inPoint.x, corners[i].inPoint.y);
    ctx.quadraticCurveTo(points[i].x, points[i].y, corners[i].outPoint.x, corners[i].outPoint.y);
  }

  ctx.lineTo(corners[0].inPoint.x, corners[0].inPoint.y);
  ctx.quadraticCurveTo(points[0].x, points[0].y, corners[0].outPoint.x, corners[0].outPoint.y);
  ctx.closePath();
}

export function traceRoundedRect(ctx, x, y, w, h, radius = 0) {
  const r = clampRadius(radius, Math.min(Math.abs(w), Math.abs(h)) / 2);
  ctx.beginPath();

  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function traceShapePath(ctx, shape) {
  const x = Number(shape.x) || 0;
  const y = Number(shape.y) || 0;
  const w = Math.max(2, Number(shape.w) || 2);
  const h = Math.max(2, Number(shape.h) || 2);
  const shapeType = shape.shapeType || shape.shape || 'square';
  const borderRadius = clampRadius(shape.borderRadius ?? shape.radius, Math.min(w, h) / 2);

  if (shapeType === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + (w / 2), y + (h / 2), w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }

  if (shapeType === 'triangle') {
    traceRoundedPolygon(ctx, [
      { x: x + (w / 2), y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ], borderRadius);
    return;
  }

  if (shapeType === 'star') {
    const cx = x + (w / 2);
    const cy = y + (h / 2);
    const outerRadius = Math.min(w, h) / 2;
    const innerRadius = outerRadius * 0.5;
    const points = [];
    let angle = -Math.PI / 2;

    for (let i = 0; i < 5; i += 1) {
      points.push({ x: cx + Math.cos(angle) * outerRadius, y: cy + Math.sin(angle) * outerRadius });
      angle += Math.PI / 5;
      points.push({ x: cx + Math.cos(angle) * innerRadius, y: cy + Math.sin(angle) * innerRadius });
      angle += Math.PI / 5;
    }

    traceRoundedPolygon(ctx, points, borderRadius);
    return;
  }

  traceRoundedRect(ctx, x, y, w, h, borderRadius);
}

export function drawShape(ctx, shape) {
  if (shape.shapeType === 'line') {
    const x = Number(shape.x) || 0;
    const y = (Number(shape.y) || 0) + (Number(shape.h) || 8) / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Number(shape.w) || 0), y);
    ctx.strokeStyle = shape.strokeColor || getThemeColor('--dc-object-text', '--dc-text');
    ctx.lineWidth = Math.max(1, Number(shape.strokeWidth) || 4);
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }

  traceShapePath(ctx, shape);

  const fillColor = shape.fillColor ?? shape.fill ?? getThemeColor('--dc-object-fill', '--dc-text');
  const strokeColor = shape.strokeColor ?? shape.stroke ?? getThemeColor('--dc-object-stroke', '--dc-bg');
  const strokeWidth = Math.max(0, Number(shape.strokeWidth ?? shape.strokeSize) || 0);

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
}
