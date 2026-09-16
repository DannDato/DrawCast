import { DEFAULT_SHAPE_CONFIG, getShapeLabel } from './tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG, clampImageConfig, getImageKind, imageLayerName } from './tools/images/imageTool';
import { DEFAULT_TEXT_CONFIG, measureTextBounds, normalizeTextConfig, textLayerName } from './tools/text/textTool';
import { DEFAULT_TIMER_CONFIG, normalizeTimerConfig, timerBounds } from './tools/timer/timerTool';

const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makeText = (x, y, text = 'TEXT', options = {}) => {
  const config = normalizeTextConfig({ ...DEFAULT_TEXT_CONFIG, ...options });
  const bounds = measureTextBounds(text, config);

  return {
    id: id('text'),
    tipo: 'text',
    x,
    y,
    ...bounds,
    text,
    ...config,
    hidden: false,
    layerName: textLayerName(text, 'TEXTO'),
    zIndex: Date.now()
  };
};

export const makeShape = (draft = {}) => {
  const shape = { ...DEFAULT_SHAPE_CONFIG, ...draft };
  const shapeType = shape.shapeType || shape.shape || 'square';

  return {
    id: id('shape'),
    tipo: 'shape',
    shapeType,
    x: Number(shape.x) || 0,
    y: Number(shape.y) || 0,
    w: Math.max(8, Number(shape.w) || 220),
    h: Math.max(8, Number(shape.h) || 180),
    fillColor: shape.fillColor ?? shape.fill ?? DEFAULT_SHAPE_CONFIG.fillColor,
    strokeColor: shape.strokeColor ?? shape.stroke ?? DEFAULT_SHAPE_CONFIG.strokeColor,
    strokeWidth: Number(shape.strokeWidth ?? shape.strokeSize) || 0,
    borderRadius: Number(shape.borderRadius ?? shape.radius) || 0,
    hidden: false,
    layerName: `${getShapeLabel(shapeType)} ${Date.now().toString().slice(-4)}`,
    zIndex: Date.now()
  };
};

export const makeTimer = (x, y, options = {}) => {
  const config = normalizeTimerConfig({ ...DEFAULT_TIMER_CONFIG, ...options });
  const bounds = timerBounds(config);

  return {
    id: id('timer'),
    tipo: 'timer',
    x,
    y,
    ...bounds,
    ...config,
    timerCurrentSeconds: config.startSeconds,
    timerResumeSeconds: config.startSeconds,
    startedAtMs: null,
    timerRunning: false,
    hidden: false,
    layerName: `TIMER ${Date.now().toString().slice(-4)}`,
    zIndex: Date.now()
  };
};

export const makeImage = (x, y, url, name = 'IMAGE', options = {}) => {
  const config = clampImageConfig({ ...DEFAULT_IMAGE_CONFIG, ...options });
  const mimeType = options.mimeType || '';
  const mediaKind = options.mediaKind || getImageKind(mimeType, name);

  return {
    id: id('image'),
    tipo: 'image',
    x: Number(x) || 0,
    y: Number(y) || 0,
    w: Math.max(8, Number(options.w) || 400),
    h: Math.max(8, Number(options.h) || 300),
    url,
    name,
    fileName: name,
    mimeType,
    mediaKind,
    naturalWidth: Number(options.naturalWidth) || undefined,
    naturalHeight: Number(options.naturalHeight) || undefined,
    borderRadius: config.borderRadius,
    opacity: config.opacity,
    hidden: false,
    layerName: options.layerName || imageLayerName(name, mimeType),
    zIndex: Date.now()
  };
};

export const makeDraw = (lines) => ({
  id: id('draw'),
  tipo: 'draw',
  lineas: lines,
  zIndex: Date.now()
});
