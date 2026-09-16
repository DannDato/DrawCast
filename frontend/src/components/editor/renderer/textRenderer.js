import { normalizeTextConfig } from '../tools/text/textTool';

export function drawTextLayer(ctx, object, value) {
  const config = normalizeTextConfig(object);
  const x = Number(object.x) || 0;
  const y = Number(object.y) || 0;
  const lineHeight = config.fontSize * 1.18;
  const lines = String(value || '').split(/\r?\n/);

  ctx.font = `900 ${config.fontSize}px ${config.fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = config.color;
  ctx.lineWidth = config.strokeWidth;
  ctx.strokeStyle = config.strokeColor;
  ctx.lineJoin = 'round';

  lines.forEach((line, index) => {
    const lineY = y + (index * lineHeight);
    if (config.strokeWidth > 0) ctx.strokeText(line, x, lineY);
    ctx.fillText(line, x, lineY);
  });
}
