import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';
export const SHAPE_TYPES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'circle', label: 'Círculo' },
  { value: 'triangle', label: 'Triángulo' },
  { value: 'star', label: 'Estrella' }
];

export const DEFAULT_SHAPE_CONFIG = {
  shapeType: 'square',
  fillColor: DEFAULT_EDITOR_PREFERENCES.colors.shapeFill,
  strokeColor: DEFAULT_EDITOR_PREFERENCES.colors.shapeStroke,
  strokeWidth: 0,
  borderRadius: 0
};

export function getShapeLabel(shapeType) {
  return SHAPE_TYPES.find((shape) => shape.value === shapeType)?.label || 'Forma';
}

export function buildShapeFromDrag(start, end, options = DEFAULT_SHAPE_CONFIG, constrainProportions = false, fromCenter = false) {
  const config = { ...DEFAULT_SHAPE_CONFIG, ...options };
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (fromCenter) {
    let halfW = Math.max(8, Math.abs(dx));
    let halfH = Math.max(8, Math.abs(dy));

    if (constrainProportions) {
      const size = Math.max(8, Math.min(Math.abs(dx), Math.abs(dy)));
      halfW = size;
      halfH = size;
    }

    return {
      tipo: 'shape',
      shapeType: config.shapeType,
      x: start.x - halfW,
      y: start.y - halfH,
      w: halfW * 2,
      h: halfH * 2,
      fillColor: config.fillColor,
      strokeColor: config.strokeColor,
      strokeWidth: Number(config.strokeWidth) || 0,
      borderRadius: Number(config.borderRadius) || 0
    };
  }

  let endX = end.x;
  let endY = end.y;

  if (constrainProportions) {
    const size = Math.max(8, Math.min(Math.abs(dx), Math.abs(dy)));
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    endX = start.x + (sx * size);
    endY = start.y + (sy * size);
  }

  return {
    tipo: 'shape',
    shapeType: config.shapeType,
    x: Math.min(start.x, endX),
    y: Math.min(start.y, endY),
    w: Math.max(8, Math.abs(endX - start.x)),
    h: Math.max(8, Math.abs(endY - start.y)),
    fillColor: config.fillColor,
    strokeColor: config.strokeColor,
    strokeWidth: Number(config.strokeWidth) || 0,
    borderRadius: Number(config.borderRadius) || 0
  };
}
