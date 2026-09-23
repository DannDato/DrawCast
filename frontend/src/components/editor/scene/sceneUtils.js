import { isDrawLayer, makeDrawLayer } from '../tools/drawing/drawingTool';

export function decodeDesignSnapshot(value) {
  let current = value;
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { throw new Error('La copia guardada no contiene un estado válido.'); }
  }

  if (Array.isArray(current)) return { version: 1, scene: { objects: current }, editor: {} };
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('La copia guardada no contiene un estado válido.');
  if (Array.isArray(current.scene?.objects)) return current;
  if (Array.isArray(current.objects)) return { version: Number(current.version || 1), scene: { objects: current.objects }, editor: current.editor || {} };
  throw new Error('La copia guardada no contiene una escena válida.');
}

export function ensureSceneDrawLayer(scene = {}) {
  const drawLayer = Object.values(scene)
    .filter(isDrawLayer)
    .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))[0];
  if (drawLayer) return { scene, drawLayer, created: false };

  const fallback = makeDrawLayer(scene);
  return {
    scene: { ...scene, [fallback.id]: fallback },
    drawLayer: fallback,
    created: true
  };
}

