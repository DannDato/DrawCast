import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChannelSocket } from '../hooks/useChannelSocket';
import { orderedObjects, renderScene, sceneHasRunningTimers } from '../components/editor/renderer/sceneRenderer';
import { pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';
import { getSoundUrl } from '../api/sounds';
import { createFrameLimiter, GRAPHICS_FRAME_MS } from '../utils/frameRate';

const WATERMARK_CORNERS = Object.freeze([
  { top: 20, left: 20 },
  { top: 20, right: 20 },
  { bottom: 20, right: 20 },
  { bottom: 20, left: 20 }
]);

function nextWatermarkCorner(current) {
  const offset = 1 + Math.floor(Math.random() * (WATERMARK_CORNERS.length - 1));
  return (current + offset) % WATERMARK_CORNERS.length;
}

export default function Overlay() {
  const { publicKey } = useParams();
  const [objects, setObjects] = useState({});
  const [liveStrokes, setLiveStrokes] = useState({});
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [watermarkRequired, setWatermarkRequired] = useState(null);
  const [watermarkCorner, setWatermarkCorner] = useState(() => Math.floor(Math.random() * WATERMARK_CORNERS.length));
  const canvasRef = useRef(null);
  const activeAudioRef = useRef(new Map());
  const inboundStrokeFrameRef = useRef(null);
  const inboundStrokeQueueRef = useRef([]);
  const inboundStrokeLastAppliedRef = useRef(0);
  const orderedSceneObjects = useMemo(() => orderedObjects(objects), [objects]);
  const renderStateRef = useRef({ objects, orderedObjects: orderedSceneObjects, liveStrokes, overlayHidden });
  const renderDirtyRef = useRef(true);
  const lastTimerSecondRef = useRef(-1);

  useEffect(() => {
    renderStateRef.current = { objects, orderedObjects: orderedSceneObjects, liveStrokes, overlayHidden };
    renderDirtyRef.current = true;
  }, [objects, orderedSceneObjects, liveStrokes, overlayHidden]);

  const stopAllSounds = useCallback(() => {
    activeAudioRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudioRef.current.clear();
  }, []);

  const stopSound = useCallback(({ playbackId } = {}) => {
    if (!playbackId) return;
    const audio = activeAudioRef.current.get(playbackId);
    if (!audio) return;
    activeAudioRef.current.delete(playbackId);
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const playSound = useCallback(({ soundId, version, scope = 'library', playbackId } = {}) => {
    if (!soundId || !playbackId) return;
    const audioUrl = getSoundUrl(soundId, version, scope, publicKey);
    if (!audioUrl) return;
    stopSound({ playbackId });

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';

    const cleanup = () => {
      if (activeAudioRef.current.get(playbackId) === audio) activeAudioRef.current.delete(playbackId);
      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
    };

    activeAudioRef.current.set(playbackId, audio);
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    const playback = audio.play();
    playback?.catch(cleanup);
  }, [publicKey, stopSound]);


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
    'obj-transform': ({ updates = [] } = {}) => setObjects((current) => {
      if (!Array.isArray(updates) || !updates.length) return current;
      let next = current;
      updates.forEach(({ id, patch }) => {
        if (!id || !current[id] || !patch || typeof patch !== 'object') return;
        if (next === current) next = { ...current };
        next[id] = { ...next[id], ...patch };
      });
      return next;
    }),
    'obj-remove': ({ id }) => setObjects((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    'draw-live': (payload) => {
      inboundStrokeQueueRef.current.push(payload);
      if (inboundStrokeFrameRef.current != null) return;
      const flush = (timestamp) => {
        if (timestamp - inboundStrokeLastAppliedRef.current < GRAPHICS_FRAME_MS) {
          inboundStrokeFrameRef.current = requestAnimationFrame(flush);
          return;
        }
        inboundStrokeFrameRef.current = null;
        inboundStrokeLastAppliedRef.current = timestamp;
        const queue = inboundStrokeQueueRef.current.splice(0);
        if (!queue.length) return;
        setLiveStrokes((current) => queue.reduce((next, event) => reduceLiveStrokeMap(next, event), current));
      };
      inboundStrokeFrameRef.current = requestAnimationFrame(flush);
    },
    'draw-commit': ({ layerId, stroke } = {}) => {
      if (!layerId || !stroke?.id) return;
      inboundStrokeQueueRef.current = inboundStrokeQueueRef.current.filter((event) => event?.strokeId !== stroke.id);
      setLiveStrokes((current) => reduceLiveStrokeMap(current, { phase: 'end', strokeId: stroke.id }));
      setObjects((current) => {
        const layer = current[layerId];
        if (!layer || (layer.tipo !== 'draw' && layer.tipo !== 'trazo') || (layer.lineas || []).some((item) => item?.id === stroke.id)) return current;
        return { ...current, [layerId]: { ...layer, lineas: [...(layer.lineas || []), stroke] } };
      });
    },
    'draw-remove': ({ layerId, strokeId } = {}) => {
      if (!layerId || !strokeId) return;
      inboundStrokeQueueRef.current = inboundStrokeQueueRef.current.filter((event) => event?.strokeId !== strokeId);
      setLiveStrokes((current) => reduceLiveStrokeMap(current, { phase: 'end', strokeId }));
      setObjects((current) => {
        const layer = current[layerId];
        if (!layer || (layer.tipo !== 'draw' && layer.tipo !== 'trazo') || !(layer.lineas || []).some((item) => item?.id === strokeId)) return current;
        return { ...current, [layerId]: { ...layer, lineas: (layer.lineas || []).filter((item) => item?.id !== strokeId) } };
      });
    },
    'sound-play': playSound,
    'sound-stop': stopSound,
    'overlay-branding': ({ watermark } = {}) => setWatermarkRequired(Boolean(watermark)),
    'overlay-visibility': ({ hidden } = {}) => {
      setOverlayHidden(Boolean(hidden));
      if (hidden) {
        setLiveStrokes({});
        stopAllSounds();
      }
    },
    'clear-all': () => { setObjects({}); setLiveStrokes({}); }
  }), [playSound, stopAllSounds, stopSound]);

  const { socket } = useChannelSocket(publicKey, 'overlay', handlers);

  useEffect(() => {
    const timer = window.setInterval(() => {
      socket.emit('refresh-overlay-branding');
      setWatermarkCorner((current) => watermarkRequired ? nextWatermarkCorner(current) : current);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [socket, watermarkRequired]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const shouldRenderFrame = createFrameLimiter();
    let animationFrame;
    let active = true;

    const render = (timestamp = 0) => {
      if (!active || !canvas.isConnected) return;
      if (shouldRenderFrame(timestamp)) {
        const state = renderStateRef.current;
        const now = Date.now();
        const timerSecond = Math.floor(now / 1000);
        if (sceneHasRunningTimers(state.orderedObjects, now) && timerSecond !== lastTimerSecondRef.current) renderDirtyRef.current = true;
        if (renderDirtyRef.current) {
          renderDirtyRef.current = false;
          lastTimerSecondRef.current = timerSecond;
          if (!state.overlayHidden) {
            renderScene(ctx, state.objects, {
              width: 1920,
              height: 1080,
              grid: false,
              now,
              liveStrokes: state.liveStrokes,
              orderedObjects: state.orderedObjects
            });
          }
        }
      }
      if (active && canvas.isConnected) animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    if (!overlayHidden) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [overlayHidden]);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveStrokes((current) => pruneLiveStrokes(current)), 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (inboundStrokeFrameRef.current != null) cancelAnimationFrame(inboundStrokeFrameRef.current);
    inboundStrokeFrameRef.current = null;
    inboundStrokeQueueRef.current = [];
  }, []);

  useEffect(() => () => stopAllSounds(), [stopAllSounds]);

  return <>
    <canvas ref={canvasRef} width="1920" height="1080" className="fixed inset-0 h-screen w-screen bg-transparent" />
    {watermarkRequired === true && (
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          width: 150,
          height: 50,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 2147483647,
          ...WATERMARK_CORNERS[watermarkCorner]
        }}
      >
        <img
          src="/img/trazio-watermark-light.png"
          alt=""
          draggable="false"
          className="dc-overlay-watermark-image dc-overlay-watermark-image-light"
        />
        <img
          src="/img/trazio-watermark-dark.png"
          alt=""
          draggable="false"
          className="dc-overlay-watermark-image dc-overlay-watermark-image-dark"
        />
      </div>
    )}
    <style>{`
      .dc-overlay-watermark-image{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:contain;
        pointer-events:none;
        user-select:none;
        will-change:opacity;
      }
      .dc-overlay-watermark-image-light{
        animation:dcOverlayWatermarkLight 30s ease-in-out infinite;
      }
      .dc-overlay-watermark-image-dark{
        animation:dcOverlayWatermarkDark 30s ease-in-out infinite;
      }
      @keyframes dcOverlayWatermarkLight{
        0%,12%{opacity:1}
        50%{opacity:0}
        88%,100%{opacity:1}
      }
      @keyframes dcOverlayWatermarkDark{
        0%,12%{opacity:0}
        50%{opacity:1}
        88%,100%{opacity:0}
      }
    `}</style>
  </>;
}
