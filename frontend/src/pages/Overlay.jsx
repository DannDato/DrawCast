import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChannelSocket } from '../hooks/useChannelSocket';
import { renderScene } from '../components/editor/renderer/sceneRenderer';

const FRAME_MS = 1000 / 30;

export default function Overlay() {
  const { publicKey } = useParams();
  const [objects, setObjects] = useState({});
  const canvasRef = useRef(null);

  const handlers = useMemo(() => ({
    'sync-state': ({ objects: list }) => setObjects(Object.fromEntries(list.map((object) => [object.id, object]))),
    'obj-upsert': (object) => setObjects((current) => ({ ...current, [object.id]: object })),
    'obj-remove': ({ id }) => setObjects((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    'clear-all': () => setObjects({})
  }), []);

  useChannelSocket(publicKey, 'overlay', handlers);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrame;
    let lastFrame = 0;

    const render = (timestamp) => {
      if (timestamp - lastFrame >= FRAME_MS) {
        renderScene(ctx, objects, { width: 1920, height: 1080, grid: false, now: Date.now() });
        lastFrame = timestamp;
      }
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [objects]);

  return <canvas ref={canvasRef} width="1920" height="1080" className="dc-overlay-canvas" />;
}
