import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChannelSocket } from '../hooks/useChannelSocket';
import { renderScene } from '../components/editor/renderer/sceneRenderer';
import { pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';

const FRAME_MS = 1000 / 30;

export default function Overlay() {
  const { publicKey } = useParams();
  const [objects, setObjects] = useState({});
  const [liveStrokes, setLiveStrokes] = useState({});
  const [overlayHidden, setOverlayHidden] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add('dc-overlay-page');
    document.body.classList.add('dc-overlay-page');
    return () => {
      document.documentElement.classList.remove('dc-overlay-page');
      document.body.classList.remove('dc-overlay-page');
    };
  }, []);

  const handlers = useMemo(() => ({
    'sync-state': ({ objects: list }) => setObjects(Object.fromEntries(list.map((object) => [object.id, object]))),
    'obj-upsert': (object) => setObjects((current) => ({ ...current, [object.id]: object })),
    'obj-remove': ({ id }) => setObjects((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    'draw-live': (payload) => setLiveStrokes((current) => reduceLiveStrokeMap(current, payload)),
    'overlay-visibility': ({ hidden } = {}) => {
      setOverlayHidden(Boolean(hidden));
      if (hidden) setLiveStrokes({});
    },
    'clear-all': () => { setObjects({}); setLiveStrokes({}); }
  }), []);

  useChannelSocket(publicKey, 'overlay', handlers);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrame;
    let lastFrame = 0;
    let active = true;

    const render = (timestamp) => {
      if (!active || !canvas.isConnected) return;
      if (timestamp - lastFrame >= FRAME_MS) {
        if (overlayHidden) ctx.clearRect(0, 0, canvas.width, canvas.height);
        else renderScene(ctx, objects, { width: 1920, height: 1080, grid: false, now: Date.now(), liveStrokes });
        lastFrame = timestamp;
      }
      if (active && canvas.isConnected) animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [objects, liveStrokes, overlayHidden]);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveStrokes((current) => pruneLiveStrokes(current)), 2000);
    return () => window.clearInterval(timer);
  }, []);

  return <canvas ref={canvasRef} width="1920" height="1080" className="dc-overlay-canvas" />;
}
