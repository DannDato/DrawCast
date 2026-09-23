import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';

export const DEFAULT_LINE_CONFIG = { strokeColor: DEFAULT_EDITOR_PREFERENCES.drawing.color, strokeWidth: 4 };

export function buildLineFromDrag(start, end, options = DEFAULT_LINE_CONFIG, snapAngle = false) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return null;
  const angle = snapAngle ? Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4) : Math.atan2(dy, dx);
  const strokeWidth = Math.max(1, Math.min(64, Number(options.strokeWidth) || DEFAULT_LINE_CONFIG.strokeWidth));
  const height = Math.max(8, strokeWidth);

  return {
    tipo: 'shape',
    shapeType: 'line',
    x: start.x + Math.cos(angle) * length / 2 - length / 2,
    y: start.y + Math.sin(angle) * length / 2 - height / 2,
    w: length,
    h: height,
    rotation: angle * 180 / Math.PI,
    fillColor: null,
    strokeColor: options.strokeColor || DEFAULT_LINE_CONFIG.strokeColor,
    strokeWidth,
    borderRadius: 0
  };
}
