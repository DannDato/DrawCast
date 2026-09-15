import { DEFAULT_SHAPE_CONFIG, getShapeLabel } from './tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG, clampImageConfig, getImageKind, imageLayerName } from './tools/images/imageTool';

const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makeText = (x, y, text = 'TEXT') => ({
  id: id('text'),
  tipo: 'text',
  x,
  y,
  w: 420,
  h: 100,
  text,
  color: '#ffffff',
  stroke: '#000000',
  strokeSize: 6,
  fontSize: 64,
  font: 'Outfit',
  zIndex: Date.now()
});

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

export const makeTimer = (x, y) => ({
  id: id('timer'),
  tipo: 'timer',
  x,
  y,
  w: 500,
  h: 110,
  mode: 'up',
  startSeconds: 0,
  limitSeconds: 359999,
  running: false,
  baseSeconds: 0,
  startedAt: null,
  color: '#ffffff',
  fontSize: 72,
  font: 'Outfit',
  zIndex: Date.now()
});

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
