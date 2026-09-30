import { getRouletteRotation, normalizeRouletteConfig, rouletteColors, rouletteEntries, rouletteResultRevealProgress, rouletteWinnerAtRotation } from './rouletteTool';

function fitLabel(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `700 ${size}px "Segoe UI", sans-serif`;
  while (size > 11 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `700 ${size}px "Segoe UI", sans-serif`;
  }
  return size;
}


function drawWinner(ctx, object, config, cx, cy, radius, nowMs) {
  const winnerData = rouletteWinnerAtRotation(object);
  const progress = rouletteResultRevealProgress(object, nowMs);
  if (!winnerData || progress == null) return;

  const eased = 1 - Math.pow(1 - progress, 3);
  const pulse = progress < 1 ? Math.sin(Math.min(1, progress) * Math.PI) : 0;
  const scale = 0.84 + (0.16 * eased) + (0.055 * pulse);
  const alpha = Math.min(1, 0.15 + (eased * 0.85));
  const winner = String(winnerData.text || '').trim();
  if (!winner) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  const panelRadius = radius * 0.38;
  ctx.beginPath();
  ctx.arc(0, 0, panelRadius, 0, Math.PI * 2);
  ctx.fillStyle = config.centerColor || '#111111';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = config.textColor || '#ffffff';
  ctx.font = `800 ${Math.max(10, radius * 0.055)}px "Segoe UI", sans-serif`;
  ctx.globalAlpha = alpha * 0.78;
  ctx.fillText('GANADOR', 0, -radius * 0.105);

  const maxWidth = Math.max(50, panelRadius * 1.55);
  const fontSize = fitLabel(ctx, winner, maxWidth, Math.max(18, Math.min(58, radius * 0.17)));
  ctx.font = `900 ${fontSize}px "Segoe UI", sans-serif`;
  ctx.fillStyle = config.textColor || '#ffffff';
  ctx.globalAlpha = alpha;
  ctx.fillText(winner, 0, radius * 0.035, maxWidth);
  ctx.restore();
}

export function drawRoulette(ctx, object, nowMs = Date.now()) {
  const config = normalizeRouletteConfig(object);
  const entries = rouletteEntries(config.entriesText);
  if (!entries.length) return;

  const x = Number(object.x) || 0;
  const y = Number(object.y) || 0;
  const w = Math.max(1, Number(object.w) || 1);
  const h = Math.max(1, Number(object.h) || 1);
  const size = Math.min(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = size / 2;
  const colors = rouletteColors(config);
  const rotation = getRouletteRotation(object, nowMs) * Math.PI / 180;
  const segment = (Math.PI * 2) / entries.length;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  entries.forEach((entry, index) => {
    const start = -Math.PI / 2 + index * segment;
    const end = start + segment;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    if (config.strokeWidth > 0) {
      ctx.strokeStyle = config.strokeColor;
      ctx.lineWidth = config.strokeWidth;
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(start + segment / 2);
    ctx.translate(radius * 0.62, 0);
    const maxWidth = Math.max(30, radius * 0.62);
    const fontSize = fitLabel(ctx, entry, maxWidth, Math.max(12, Math.min(34, radius * 0.085)));
    ctx.font = `700 ${fontSize}px "Segoe UI", sans-serif`;
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry, 0, 0, maxWidth);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = config.centerColor;
  ctx.fill();
  ctx.restore();

  const pointerW = Math.max(12, radius * 0.10);
  const pointerH = Math.max(18, radius * 0.15);
  ctx.save();
  ctx.translate(cx, cy - radius + pointerH * 0.18);
  ctx.beginPath();
  ctx.moveTo(0, pointerH);
  ctx.lineTo(-pointerW / 2, 0);
  ctx.lineTo(pointerW / 2, 0);
  ctx.closePath();
  ctx.fillStyle = config.pointerColor;
  ctx.fill();
  ctx.restore();

  drawWinner(ctx, object, config, cx, cy, radius, nowMs);
}
