import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, Music2, Radio, RefreshCw, Settings2, Volume2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getChannelEntitlements, getChannels } from '../api/channels';
import { getUserSettings, saveLaunchpadSlots as saveUserLaunchpadSlots } from '../api/settings';
import { getSoundLibrary } from '../api/sounds';
import { useChannelSocket } from '../hooks/useChannelSocket';
import LaunchpadConfigModal from '../components/editor/sounds/LaunchpadConfigModal';
import { entitlementLimit, featureEnabled, normalizeChannelEntitlements } from '../components/editor/entitlements/editorEntitlements';

const MAX_PAD_COUNT = 24;
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

export default function Launchpad() {
  const { publicKey } = useParams();
  const [sounds, setSounds] = useState([]);
  const [slots, setSlots] = useState(Array(MAX_PAD_COUNT).fill(null));
  const [padCount, setPadCount] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [outputCount, setOutputCount] = useState(0);
  const [status, setStatus] = useState('Cargando Launchpad...');
  const [channelName, setChannelName] = useState('Launchpad');
  const [activePads, setActivePads] = useState(() => new Set());

  const handlers = useMemo(() => ({
    'sound-output-presence': ({ count } = {}) => setOutputCount(Math.max(0, Number(count) || 0))
  }), []);
  const { socket, connected, denied } = useChannelSocket(publicKey, 'soundboard', handlers);

  const outputUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/launchpad/${encodeURIComponent(publicKey || '')}/output`;
  }, [publicKey]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [library, settings, channels] = await Promise.all([
          getSoundLibrary(),
          getUserSettings({ force: true }),
          getChannels({ force: true }).catch(() => null)
        ]);
        if (!active) return;

        const available = new Set(library.map((sound) => sound.id));
        const hasSaved = Array.isArray(settings?.launchpadSlots);
        const nextSlots = hasSaved
          ? Array.from({ length: MAX_PAD_COUNT }, (_, index) => available.has(settings.launchpadSlots[index]) ? settings.launchpadSlots[index] : null)
          : Array.from({ length: MAX_PAD_COUNT }, (_, index) => library[index]?.id || null);

        const channelRows = [...(channels?.ownedChannels || []), ...(channels?.collaborations || [])];
        const channel = channelRows.find((item) => item.publicKey === publicKey);
        const rawEntitlements = channel?.uuid ? await getChannelEntitlements(channel.uuid, { force: true }) : null;
        if (!active) return;
        const entitlements = normalizeChannelEntitlements(rawEntitlements || {});
        const launchpadEnabled = featureEnabled(entitlements, 'editor.launchpad');
        const nextPadCount = launchpadEnabled ? Math.min(MAX_PAD_COUNT, entitlementLimit(entitlements, 'limit.launchpad_pads')) : 0;

        setSounds(library);
        setSlots(nextSlots);
        setConfigured(hasSaved);
        setPadCount(nextPadCount);

        if (channel?.name) setChannelName(channel.name);
        setStatus(!launchpadEnabled
          ? 'Launchpad está bloqueado en este lienzo.'
          : library.length ? `Launchpad listo · ${nextPadCount} pads disponibles.` : 'La biblioteca todavía no tiene sonidos.');
      } catch (error) {
        if (active) setStatus(error?.response?.data?.message || error?.message || 'No se pudo cargar el Launchpad.');
      }
    };

    void load();
    return () => { active = false; };
  }, [publicKey]);

  const soundMap = useMemo(() => new Map(sounds.map((sound) => [sound.id, sound])), [sounds]);
  const padItems = useMemo(() => Array.from({ length: padCount }, (_, index) => ({
    index,
    key: PAD_KEYS[index],
    sound: soundMap.get(slots[index]) || null
  })), [padCount, slots, soundMap]);

  const flashPad = useCallback((index) => {
    setActivePads((current) => new Set(current).add(index));
    window.setTimeout(() => setActivePads((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    }), 170);
  }, []);

  const playPad = useCallback(async (index) => {
    const soundId = slots[index];
    const sound = soundMap.get(soundId);
    if (index < 0 || index >= padCount || !sound || !connected || denied) return;

    flashPad(index);
    try {
      await new Promise((resolve, reject) => {
        socket.timeout(4000).emit('sound-play', { soundId }, (error, result) => {
          if (error) { reject(new Error('TRAZIO no confirmó el sonido.')); return; }
          if (!result?.ok) { reject(new Error(result?.message || 'No se pudo reproducir el sonido.')); return; }
          resolve(result);
        });
      });
      setStatus(outputCount > 0 ? `Sonando: ${sound.name}` : `${sound.name} listo, pero no hay una fuente Launchpad conectada en OBS.`);
    } catch (error) {
      setStatus(error.message || 'No se pudo reproducir el sonido.');
    }
  }, [connected, denied, flashPad, outputCount, padCount, slots, socket, soundMap]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (configOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const index = PAD_KEYS.indexOf(event.key.toLowerCase());
      if (index < 0 || index >= padCount) return;
      event.preventDefault();
      playPad(index);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [configOpen, padCount, playPad]);

  const refreshSounds = async () => {
    const library = await getSoundLibrary();
    const available = new Set(library.map((sound) => sound.id));
    setSounds(library);
    setSlots((current) => configured
      ? Array.from({ length: MAX_PAD_COUNT }, (_, index) => available.has(current[index]) ? current[index] : null)
      : Array.from({ length: MAX_PAD_COUNT }, (_, index) => library[index]?.id || null));
    return library;
  };

  const saveAssignments = async (nextSlots) => {
    const available = new Set(sounds.map((sound) => sound.id));
    const cleanSlots = Array.from({ length: MAX_PAD_COUNT }, (_, index) => index < padCount
      ? (available.has(nextSlots[index]) ? nextSlots[index] : null)
      : slots[index] || null);
    const saved = await saveUserLaunchpadSlots(cleanSlots);
    setSlots(Array.from({ length: MAX_PAD_COUNT }, (_, index) => saved[index] || null));
    setConfigured(true);
    setConfigOpen(false);
    setStatus('Launchpad guardado en tu cuenta.');
  };

  const copyOutputUrl = async () => {
    try {
      await navigator.clipboard.writeText(outputUrl);
      setStatus('URL de la fuente OBS copiada.');
    } catch {
      setStatus('No pude copiar la URL automáticamente. Selecciónala manualmente.');
    }
  };

  if (denied) return <div className="dc-launchpad-denied">NO TIENES ACCESO A ESTE LAUNCHPAD // <Link to="/app/editor">VOLVER A EDITORES</Link></div>;

  return (
    <div className="dc-launchpad-page">
      <header className="dc-launchpad-header">
        <div className="dc-launchpad-title-block">
          <Link to={`/app/editor/${publicKey}`} className="dc-launchpad-back"><ArrowLeft size={16} /> Editor</Link>
          <span className="dc-launchpad-kicker"><Volume2 size={15} /> AUDIO EN VIVO</span>
          <h1>LAUNCHPAD <b>//</b> <span>{channelName}</span></h1>
          <p>Dispara sonidos desde aquí sin ocupar un editor adicional. Cada colaborador puede usar su propia distribución de pads.</p>
        </div>
        <div className="dc-launchpad-header-actions">
          <span className={`dc-launchpad-output-status ${outputCount > 0 ? 'online' : ''}`}><Radio size={14} /> {outputCount > 0 ? `${outputCount} FUENTE${outputCount === 1 ? '' : 'S'} OBS` : 'SIN FUENTE OBS'}</span>
          <button type="button" onClick={() => setConfigOpen(true)} disabled={!padCount}><Settings2 size={15} /> Configurar pads</button>
        </div>
      </header>

      <section className="dc-launchpad-obs-card">
        <div><b>FUENTE PARA OBS</b><span>Agrega esta URL como Browser Source. Esta fuente sólo reproduce el audio disparado desde el Launchpad.</span></div>
        <code>{outputUrl}</code>
        <div className="dc-launchpad-obs-actions"><button type="button" onClick={copyOutputUrl}><Copy size={14} /> Copiar URL</button><a href={outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir</a></div>
      </section>

      <main className="dc-launchpad-main">
        <div className="dc-launchpad-meta"><span>{sounds.length} sonidos en biblioteca</span><span>{slots.slice(0, padCount).filter(Boolean).length}/{padCount} pads asignados</span><button type="button" onClick={async () => { try { await refreshSounds(); setStatus('Biblioteca actualizada.'); } catch { setStatus('No se pudo actualizar la biblioteca.'); } }}><RefreshCw size={13} /> Actualizar biblioteca</button></div>
        <div className="dc-launchpad-grid" aria-label="Launchpad de sonidos">
          {padItems.map(({ index, key, sound }) => (
            <button key={index} type="button" className={`${sound ? 'assigned' : 'empty'} ${activePads.has(index) ? 'is-playing' : ''}`} onPointerDown={(event) => { if (event.button === 0 && sound) playPad(index); }} disabled={!sound || !connected || denied} style={{ '--dc-pad-accent': `var(--dc-accent-${['one', 'two', 'three', 'four'][index % 4]})` }}>
              <span className="dc-launchpad-pad-number">{String(index + 1).padStart(2, '0')}</span>
              <Music2 size={20} />
              <b>{sound?.name || 'Sin asignar'}</b>
              <kbd>{key.toUpperCase()}</kbd>
            </button>
          ))}
        </div>
      </main>

      <footer className="dc-launchpad-statusbar"><span className={connected ? 'online' : ''}>{connected ? 'CONECTADO' : 'CONECTANDO...'}</span><p>{status}</p></footer>

      {configOpen && <LaunchpadConfigModal sounds={sounds} slots={slots} padCount={padCount} onClose={() => setConfigOpen(false)} onRefresh={refreshSounds} onSave={saveAssignments} />}
    </div>
  );
}
