import { useEffect, useMemo, useRef, useState } from 'react';
import { saveLaunchpadSlots as saveUserLaunchpadSlots, saveSoundSlots as saveUserSoundSlots } from '../../../api/settings';
import { deleteChannelSound, getChannelSoundLibrary, getSoundLibrary, getSoundUrl, uploadChannelSound } from '../../../api/sounds';

export default function useEditorSounds({ userSettings, channelUuid, publicKey, connected, overlayHidden, presence, emitChannelAction, setMediaStatus }) {
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [launchpadConfigOpen, setLaunchpadConfigOpen] = useState(false);
  const [soundLibrary, setSoundLibrary] = useState([]);
  const [customSoundLibrary, setCustomSoundLibrary] = useState([]);
  const [soundSlots, setSoundSlots] = useState([null, null, null, null, null]);
  const [soundPlayback, setSoundPlayback] = useState({});
  const [soundMonitorEnabled, setSoundMonitorEnabled] = useState(() => {
    try { return localStorage.getItem('TRAZIO.editor.soundMonitor') !== 'off'; } catch { return true; }
  });
  const [soundSlotsConfigured, setSoundSlotsConfigured] = useState(false);
  const [launchpadSlots, setLaunchpadSlots] = useState(Array(24).fill(null));
  const [launchpadSlotsConfigured, setLaunchpadSlotsConfigured] = useState(false);
  const monitoredAudioRef = useRef(new Map());

  useEffect(() => {
    if (userSettings === undefined) return undefined;
    let active = true;
    const settings = userSettings;
    const loadSoundSettings = async () => {
      try {
        const sounds = await getSoundLibrary();
        if (!active) return;
        setSoundLibrary(sounds);

        const quickConfigured = Array.isArray(settings?.soundSlots);
        setSoundSlotsConfigured(quickConfigured);
        setSoundSlots(quickConfigured
          ? Array.from({ length: 5 }, (_, index) => typeof settings.soundSlots[index] === 'string' ? settings.soundSlots[index] : null)
          : Array.from({ length: 5 }, (_, index) => sounds[index]?.id || null));

        const launchpadConfigured = Array.isArray(settings?.launchpadSlots);
        setLaunchpadSlotsConfigured(launchpadConfigured);
        setLaunchpadSlots(launchpadConfigured
          ? Array.from({ length: 24 }, (_, index) => typeof settings.launchpadSlots[index] === 'string' ? settings.launchpadSlots[index] : null)
          : Array.from({ length: 24 }, (_, index) => sounds[index]?.id || null));
      } catch {
        if (active) setSoundLibrary([]);
      }
    };

    loadSoundSettings();
    return () => { active = false; };
  }, [userSettings]);

  const allSounds = useMemo(() => [...soundLibrary, ...customSoundLibrary], [soundLibrary, customSoundLibrary]);
  const soundSlotItems = useMemo(() => {
    const byId = new Map(allSounds.map((sound) => [sound.id, sound]));
    return Array.from({ length: 5 }, (_, index) => byId.get(soundSlots[index]) || null);
  }, [allSounds, soundSlots]);

  const refreshSoundLibrary = async () => {
    const [sounds, ownSounds] = await Promise.all([
      getSoundLibrary(),
      channelUuid ? getChannelSoundLibrary(channelUuid) : Promise.resolve([])
    ]);
    setSoundLibrary(sounds);
    setCustomSoundLibrary(ownSounds);
    const available = new Set([...sounds, ...ownSounds].map((sound) => sound.id));
    setSoundSlots((current) => soundSlotsConfigured
      ? Array.from({ length: 5 }, (_, index) => available.has(current[index]) ? current[index] : null)
      : Array.from({ length: 5 }, (_, index) => sounds[index]?.id || null));
    setLaunchpadSlots((current) => launchpadSlotsConfigured
      ? Array.from({ length: 24 }, (_, index) => available.has(current[index]) ? current[index] : null)
      : Array.from({ length: 24 }, (_, index) => sounds[index]?.id || null));
    return { sounds, ownSounds };
  };

  const stopMonitoredSound = (soundId) => {
    const current = monitoredAudioRef.current.get(soundId);
    if (!current) return false;
    monitoredAudioRef.current.delete(soundId);
    current.audio.pause();
    current.audio.currentTime = 0;
    current.cleanup();
    setSoundPlayback((state) => {
      if (!state[soundId]) return state;
      const next = { ...state };
      delete next[soundId];
      return next;
    });
    return true;
  };

  const startMonitoredSound = (sound) => {
    if (!sound?.id) return false;
    const audioUrl = getSoundUrl(sound.id, sound.version, sound.scope || 'library', publicKey);
    if (!audioUrl) return false;

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.muted = !soundMonitorEnabled;
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      audio.removeEventListener('loadedmetadata', handleMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleEnded);
    };
    const handleMetadata = () => {
      if (monitoredAudioRef.current.get(sound.id)?.audio !== audio) return;
      const durationMs = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : 0;
      setSoundPlayback((state) => ({ ...state, [sound.id]: { durationMs } }));
    };
    const handleEnded = () => {
      if (monitoredAudioRef.current.get(sound.id)?.audio === audio) monitoredAudioRef.current.delete(sound.id);
      cleanup();
      setSoundPlayback((state) => {
        if (!state[sound.id]) return state;
        const next = { ...state };
        delete next[sound.id];
        return next;
      });
    };

    monitoredAudioRef.current.set(sound.id, { audio, cleanup });
    audio.addEventListener('loadedmetadata', handleMetadata);
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleEnded, { once: true });
    audio.play()?.catch(handleEnded);
    return true;
  };

  const playSound = async (soundId) => {
    if (!connected) return;

    const sound = allSounds.find((item) => item.id === soundId);
    if (!sound) {
      setMediaStatus('Ese sonido ya no está disponible. Actualiza la biblioteca.');
      return;
    }

    if (monitoredAudioRef.current.has(soundId)) {
      stopMonitoredSound(soundId);
      try {
        await emitChannelAction('sound-stop', { soundId });
        setMediaStatus(`Sonido detenido: ${sound.name}`);
      } catch (error) {
        setMediaStatus(error.message || 'No se pudo detener el sonido en el overlay.');
      }
      return;
    }

    if (overlayHidden) {
      setMediaStatus('El overlay está apagado. Enciéndelo antes de reproducir sonidos.');
      return;
    }

    if (!startMonitoredSound(sound)) return;
    try {
      await emitChannelAction('sound-play', { soundId });
      setMediaStatus(presence.overlays > 0 ? `Sonido enviado: ${sound.name}` : `Monitoreo: ${sound.name}. No hay un overlay conectado.`);
    } catch (error) {
      stopMonitoredSound(soundId);
      setMediaStatus(error.message || 'No se pudo reproducir el sonido.');
    }
  };

  const openSoundAssignments = async () => {
    setSoundsOpen(true);
    try {
      await refreshSoundLibrary();
    } catch {
      setMediaStatus('No se pudo actualizar la biblioteca de sonidos.');
    }
  };

  const saveSoundAssignments = async (nextSlots) => {
    const available = new Set(allSounds.map((sound) => sound.id));
    const cleanSlots = Array.from({ length: 5 }, (_, index) => available.has(nextSlots[index]) ? nextSlots[index] : null);
    const saved = await saveUserSoundSlots(cleanSlots);
    setSoundSlots(Array.from({ length: 5 }, (_, index) => saved[index] || null));
    setSoundSlotsConfigured(true);
    setSoundsOpen(false);
    setMediaStatus('Asignación de sonidos guardada.');
  };

  const uploadOwnSound = async (file) => {
    if (!channelUuid) throw new Error('No pudimos identificar este lienzo.');
    const sound = await uploadChannelSound(channelUuid, file);
    if (!sound) throw new Error('No se pudo guardar el sonido.');
    setCustomSoundLibrary((current) => [sound, ...current.filter((item) => item.id !== sound.id)]);
    return sound;
  };

  const deleteOwnSound = async (soundId) => {
    if (!channelUuid) throw new Error('No pudimos identificar este lienzo.');
    await deleteChannelSound(channelUuid, soundId);
    setCustomSoundLibrary((current) => current.filter((sound) => sound.id !== soundId));
  };

  const openLaunchpadAssignments = async () => {
    setLaunchpadConfigOpen(true);
    try {
      await refreshSoundLibrary();
    } catch {
      setMediaStatus('No se pudo actualizar la biblioteca de sonidos.');
    }
  };

  const saveLaunchpadAssignments = async (nextSlots) => {
    const available = new Set(allSounds.map((sound) => sound.id));
    const cleanSlots = Array.from({ length: 24 }, (_, index) => available.has(nextSlots[index]) ? nextSlots[index] : null);
    const saved = await saveUserLaunchpadSlots(cleanSlots);
    setLaunchpadSlots(Array.from({ length: 24 }, (_, index) => saved[index] || null));
    setLaunchpadSlotsConfigured(true);
    setLaunchpadConfigOpen(false);
    setMediaStatus('Launchpad actualizado.');
  };

  useEffect(() => {
    let active = true;
    (channelUuid ? getChannelSoundLibrary(channelUuid) : Promise.resolve([]))
      .then((sounds) => { if (active) setCustomSoundLibrary(sounds); })
      .catch(() => { if (active) setCustomSoundLibrary([]); });
    return () => { active = false; };
  }, [channelUuid]);

  useEffect(() => () => {
    monitoredAudioRef.current.forEach(({ audio, cleanup }) => {
      audio.pause();
      audio.currentTime = 0;
      cleanup();
    });
    monitoredAudioRef.current.clear();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('TRAZIO.editor.soundMonitor', soundMonitorEnabled ? 'on' : 'off'); } catch { /* La preferencia sigue funcionando durante la sesión. */ }
    monitoredAudioRef.current.forEach(({ audio }) => {
      audio.muted = !soundMonitorEnabled;
    });
  }, [soundMonitorEnabled]);


  const resolveSoundUrl = (sound) => getSoundUrl(sound.id, sound.version, sound.scope || 'library', publicKey);

  return {
    soundsOpen, setSoundsOpen, launchpadConfigOpen, setLaunchpadConfigOpen,
    soundLibrary, customSoundLibrary, soundSlots, launchpadSlots, allSounds, soundSlotItems,
    soundPlayback, soundMonitorEnabled, setSoundMonitorEnabled, playSound,
    openSoundAssignments, saveSoundAssignments, openLaunchpadAssignments, saveLaunchpadAssignments,
    refreshSoundLibrary, uploadOwnSound, deleteOwnSound, resolveSoundUrl
  };
}
