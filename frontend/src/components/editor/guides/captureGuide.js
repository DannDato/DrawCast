import { renderScene } from '../renderer/sceneRenderer';
import { preloadSceneImages } from '../renderer/drawObject';

export async function captureGuide(objects) {
  const scene = structuredClone(objects);
  await document.fonts.ready;
  await preloadSceneImages(scene);
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo capturar el lienzo.');
  renderScene(context, scene, { width: 1920, height: 1080, now: Date.now() });
  try {
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error('No se pudo guardar la guía. Vuelve a subir las imágenes del lienzo e inténtalo de nuevo.');
  }
}
