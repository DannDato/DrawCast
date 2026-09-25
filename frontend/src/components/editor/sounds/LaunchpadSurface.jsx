import { useEffect, useMemo } from 'react';

const PAD_COUNT = 24;
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

function soundLabel(sound) {
  const value = String(sound?.name || sound?.id || '').replace(/\.mp3$/i, '').trim();
  return value || 'Sin asignar';
}

function soundColor(sound) {
  const name = soundLabel(sound).normalize('NFC').toLowerCase();
  let hash = 2166136261;
  for (const character of name) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return `hsl(${(hash >>> 0) % 360} 62% 48%)`;
}

export default function LaunchpadSurface({ sounds = [], slots = [], padCount = 0, connected = false, disabled = false, onPlaySound, soundPlayback = {} }) {
  const visiblePadCount = Math.max(0, Math.min(PAD_COUNT, Math.trunc(Number(padCount) || 0)));
  const soundMap = useMemo(() => new Map(sounds.map((sound) => [sound.id, sound])), [sounds]);
  const pads = useMemo(() => Array.from({ length: visiblePadCount }, (_, index) => soundMap.get(slots[index]) || null), [slots, soundMap, visiblePadCount]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (disabled || !connected || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const index = PAD_KEYS.indexOf(event.key.toLowerCase());
      if (index < 0 || !pads[index]) return;
      event.preventDefault();
      onPlaySound?.(pads[index].id, index);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [connected, disabled, onPlaySound, pads]);

  return (
    <div className="dc-launchpad-workspace" aria-label="Launchpad de sonidos">
      <div className="dc-launchpad-pad-grid">
        {pads.map((sound, index) => {
          const playback = sound ? soundPlayback[sound.id] : null;
          return (
            <button
              key={index}
              type="button"
              className={`dc-launchpad-pad ${playback ? 'is-playing' : ''}`}
              style={{ '--dc-pad-color': sound ? soundColor(sound) : undefined, '--dc-sound-duration': playback?.durationMs ? `${playback.durationMs}ms` : undefined }}
              aria-pressed={Boolean(playback)}
              disabled={!sound || !connected || disabled}
              onPointerDown={(event) => {
                if (event.button !== 0 || !sound || !connected || disabled) return;
                onPlaySound?.(sound.id, index);
              }}
              title={sound ? soundLabel(sound) : 'Sin asignar'}
            >
              <span>{soundLabel(sound)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
