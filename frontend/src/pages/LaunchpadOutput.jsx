import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getSoundUrl } from '../api/sounds';
import { useChannelSocket } from '../hooks/useChannelSocket';

export default function LaunchpadOutput() {
  const { publicKey } = useParams();
  const activeAudioRef = useRef(new Set());

  const stopAllSounds = useCallback(() => {
    activeAudioRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudioRef.current.clear();
  }, []);

  const playSound = useCallback(({ soundId, version } = {}) => {
    if (!soundId) return;
    const audio = new Audio(getSoundUrl(soundId, version));
    audio.preload = 'auto';

    const cleanup = () => {
      activeAudioRef.current.delete(audio);
      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
    };

    activeAudioRef.current.add(audio);
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    const playback = audio.play();
    playback?.catch(cleanup);
  }, []);

  const handlers = useMemo(() => ({ 'sound-play': playSound }), [playSound]);
  useChannelSocket(publicKey, 'sound-output', handlers);

  useEffect(() => {
    document.documentElement.classList.add('dc-overlay-page');
    document.body.classList.add('dc-overlay-page');
    return () => {
      document.documentElement.classList.remove('dc-overlay-page');
      document.body.classList.remove('dc-overlay-page');
      stopAllSounds();
    };
  }, [stopAllSounds]);

  return <div className="fixed inset-0 bg-transparent" aria-hidden="true" />;
}
