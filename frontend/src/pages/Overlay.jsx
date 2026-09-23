import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChannelSocket } from '../hooks/useChannelSocket';
import { renderScene } from '../components/editor/renderer/sceneRenderer';
import { pruneLiveStrokes, reduceLiveStrokeMap } from '../components/editor/tools/drawing/drawingTool';
import { getSoundUrl } from '../api/sounds';

const FRAME_MS = 1000 / 30;

export default function Overlay() {
  const { publicKey } = useParams();
  const [objects, setObjects] = useState({});
  const [liveStrokes, setLiveStrokes] = useState({});
  const [overlayHidden, setOverlayHidden] = useState(false);
  const canvasRef = useRef(null);
  const activeAudioRef = useRef(new Map());

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
    'obj-remove': ({ id }) => setObjects((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    'draw-live': (payload) => setLiveStrokes((current) => reduceLiveStrokeMap(current, payload)),
    'sound-play': playSound,
    'sound-stop': stopSound,
    'overlay-visibility': ({ hidden } = {}) => {
      setOverlayHidden(Boolean(hidden));
      if (hidden) {
        setLiveStrokes({});
        stopAllSounds();
      }
    },
    'clear-all': () => { setObjects({}); setLiveStrokes({}); }
  }), [playSound, stopAllSounds, stopSound]);

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

  useEffect(() => () => stopAllSounds(), [stopAllSounds]);

  return <>
    <canvas ref={canvasRef} width="1920" height="1080" className="fixed inset-0 h-screen w-screen bg-transparent" />
  </>;
}
