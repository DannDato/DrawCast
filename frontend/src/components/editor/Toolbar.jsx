import { createElement, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Clock3,
  Eraser,
  EyeOff,
  File,
  FolderOpen,
  Grid3X3,
  Hand,
  Image,
  Lock,
  Magnet,
  MousePointer2,
  Pencil,
  Plus,
  Radio,
  Save,
  Play,
  Settings2,
  Power,
  Shapes,
  Slash,
  Timer,
  Type,
  Volume2,
  VolumeX
} from 'lucide-react';
import { GUIDE_SHORTCUTS, TOOL_SHORTCUTS } from './hotkeys/shortcuts';
import { PresenceStack } from '../ui/PresenceAvatar';

const directTools = [
  { id: 'select', label: 'Seleccionar / mover', icon: MousePointer2 },
  { id: 'hand', label: 'Manita / mover lienzo', icon: Hand },
  { id: 'draw', label: 'Lápiz / pincel', icon: Pencil },
  { id: 'eraser', label: 'Borrador', icon: Eraser },
  { id: 'text', label: 'Texto', icon: Type }
];

const insertTools = [
  { id: 'image', label: 'Imagen / GIF', icon: Image },
  { id: 'shape', label: 'Forma', icon: Shapes },
  { id: 'line', label: 'Línea', icon: Slash },
  { id: 'timer', label: 'Temporizador', icon: Timer }
];

function PremiumLock() {
  return <span className="dc-plus-lock" aria-hidden="true"><Lock size={10} /></span>;
}

function IconButton({ label, icon, onClick, disabled = false, active = false, danger = false, locked = false, className = '' }) {
  return (
    <button type="button" className={`dc-toolbar-icon ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${locked ? 'dc-plus-locked' : ''} ${className}`} onClick={onClick} disabled={disabled && !locked} aria-disabled={disabled || locked} title={locked ? `${label} // Lienzo Plus` : label} aria-label={label}>
      {createElement(icon, { size: 16 })}
      {locked && <PremiumLock />}
    </button>
  );
}

function lockedClass(locked, className = '') {
  return `${locked ? 'dc-plus-locked' : ''} ${className}`.trim();
}

export default function Toolbar({
  tool,
  setTool,
  guide,
  guides = [],
  setGuide,
  onSaveGuide,
  onSaveDesign,
  onLoadDesigns,
  onLoadRecent,
  onFileOpen,
  recentDesigns = [],
  onInsertTool,
  onImageFile,
  imagePickerRequest = 0,
  snapEnabled = true,
  onToggleSnap,
  liveEnabled = true,
  liveRequired = false,
  hasDraftChanges = false,
  onToggleLive,
  onPublish,
  isOwner = false,
  overlayHidden = false,
  onTogglePanic,
  controlBusy = '',
  connected,
  editorLocked = false,
  editors = [],
  workspaceMode = 'canvas',
  onToggleWorkspaceMode,
  soundSlots = [],
  onPlaySound,
  soundPlayback = {},
  soundMonitorEnabled = true,
  onToggleSoundMonitor,
  onAssignSounds,
  onAssignLaunchpadSounds,
  entitlementsReady = false,
  isFeatureEnabled = () => false,
  onLockedFeature,
  guideSlotLimit = 0,
  quickSoundSlotLimit = 0
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);
  const imageInputRef = useRef(null);
  const insertActive = insertTools.some((item) => item.id === tool);
  const controlDisabled = !connected || Boolean(controlBusy);
  const workspaceDisabled = controlDisabled || editorLocked;
  const audioDisabled = controlDisabled;
  const launchpadMode = workspaceMode === 'launchpad';
  const liveSwitchDisabled = controlDisabled || editorLocked;
  const featureLocked = (feature) => !entitlementsReady || !isFeatureEnabled(feature);
  const lockedAction = (feature, label, action) => (event) => {
    event?.preventDefault?.();
    if (featureLocked(feature)) {
      onLockedFeature?.(feature, label);
      return;
    }
    action?.(event);
  };

  useEffect(() => {
    if (!imagePickerRequest || workspaceDisabled || !entitlementsReady || !isFeatureEnabled('editor.image')) return;
    imageInputRef.current?.click();
  }, [entitlementsReady, imagePickerRequest, isFeatureEnabled, workspaceDisabled]);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeEscape);
    };
  }, []);

  const toggleMenu = (menu) => {
    if (menu === 'sounds' ? audioDisabled : workspaceDisabled) return;
    const next = openMenu === menu ? null : menu;
    if (next === 'file') onFileOpen?.();
    setOpenMenu(next);
  };

  const toggleWorkspaceMode = () => {
    setOpenMenu(null);
    onToggleWorkspaceMode?.();
  };

  const chooseDirectTool = (id) => {
    if (workspaceDisabled) return;
    const feature = { select: 'editor.select', hand: 'editor.pan', draw: 'editor.brush', eraser: 'editor.eraser', text: 'editor.text' }[id];
    if (featureLocked(feature)) return onLockedFeature?.(feature, directTools.find((item) => item.id === id)?.label || id);
    setTool(id);
    setOpenMenu(null);
  };

  const chooseInsertTool = (id, event) => {
    if (workspaceDisabled) return;
    const feature = { image: 'editor.image', shape: 'editor.shape', line: 'editor.line', timer: 'editor.timer' }[id];
    if (featureLocked(feature)) return onLockedFeature?.(feature, insertTools.find((item) => item.id === id)?.label || id);
    setOpenMenu(null);

    if (id === 'image') {
      imageInputRef.current?.click();
      return;
    }

    setTool(id);
    onInsertTool?.({ id, clientX: event?.clientX, clientY: event?.clientY });
  };

  const onImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && !workspaceDisabled && !featureLocked('editor.image')) await onImageFile?.(file);
  };

  return (
    <div className={`dc-toolbar-horizontal ${editorLocked ? 'is-editor-locked' : ''}`} ref={rootRef}>
      {launchpadMode ? (
        <button type="button" className={lockedClass(featureLocked('editor.launchpad'), 'dc-toolbar-wide')} onClick={lockedAction('editor.launchpad', 'Launchpad', onAssignLaunchpadSounds)} disabled={audioDisabled && !featureLocked('editor.launchpad')} aria-disabled={audioDisabled || featureLocked('editor.launchpad')}>
          <Settings2 size={15} />
          <span>Asignar sonidos</span>
          {featureLocked('editor.launchpad') && <PremiumLock />}
        </button>
      ) : <>
      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${openMenu === 'file' || openMenu === 'save-as' ? 'active' : ''}`} onClick={() => toggleMenu('file')} aria-expanded={openMenu === 'file' || openMenu === 'save-as'} disabled={workspaceDisabled}>
          <File size={15} />
          <span>Archivo</span>
          <ChevronDown size={13} />
        </button>

        {(openMenu === 'file' || openMenu === 'save-as') && (
          <div className="dc-toolbar-popover dc-toolbar-file-menu">
            <button type="button" onClick={() => setOpenMenu((current) => current === 'save-as' ? 'file' : 'save-as')} aria-expanded={openMenu === 'save-as'}><Save size={15} /><span>Guardar como</span><ChevronDown size={13} /></button>
            {openMenu === 'save-as' && <>
              <button type="button" className={lockedClass(featureLocked('editor.designs'), 'dc-toolbar-save-option')} onClick={lockedAction('editor.designs', 'Diseños', () => { onSaveDesign?.(); setOpenMenu(null); })}><Save size={15} /><span>Lienzo</span>{featureLocked('editor.designs') && <PremiumLock />}</button>
              <button type="button" className={lockedClass(featureLocked('editor.guides'), 'dc-toolbar-save-option')} onClick={lockedAction('editor.guides', 'Guías', () => { onSaveGuide?.(); setOpenMenu(null); })}><Grid3X3 size={15} /><span>Guía</span>{featureLocked('editor.guides') && <PremiumLock />}</button>
              <span className="dc-toolbar-popover-separator" />
            </>}
            <button type="button" className={lockedClass(featureLocked('editor.designs'))} onClick={lockedAction('editor.designs', 'Diseños', () => { onLoadDesigns?.(); setOpenMenu(null); })}><FolderOpen size={15} /><span>Cargar diseño...</span>{featureLocked('editor.designs') && <PremiumLock />}</button>
            <span className="dc-toolbar-popover-separator" />
            <button
              type="button"
              className={`dc-file-live-toggle ${liveEnabled ? 'is-live' : 'is-studio'} ${liveEnabled && liveRequired ? 'is-required' : ''} ${featureLocked('editor.live_studio') ? 'dc-plus-locked' : ''}`}
              onClick={lockedAction('editor.live_studio', 'Live / Estudio', () => { onToggleLive?.(); setOpenMenu(null); })}
              disabled={liveSwitchDisabled && !featureLocked('editor.live_studio')}
              aria-disabled={liveSwitchDisabled || featureLocked('editor.live_studio')}
              aria-pressed={liveEnabled}
              title={liveEnabled && liveRequired ? 'Live es obligatorio mientras haya otro colaborador conectado' : liveEnabled ? 'Live activado: los cambios se reflejan al instante en el overlay' : 'Modo Estudio: prepara cambios sin mostrarlos hasta publicar'}
            >
              <Radio size={15} />
              <span>{liveEnabled ? 'Live' : 'Estudio'}</span>
              <span className="dc-live-switch-track" aria-hidden="true"><i /></span>
              {featureLocked('editor.live_studio') && <PremiumLock />}
            </button>
            <span className="dc-toolbar-popover-separator" />
            <div className={lockedClass(featureLocked('editor.designs'), 'dc-toolbar-file-label')}><Clock3 size={13} /><span>Recientes</span>{featureLocked('editor.designs') && <PremiumLock />}</div>
            {!featureLocked('editor.designs') && (recentDesigns.length > 0 ? recentDesigns.slice(0, 5).map((design) => (
              <button key={design.uuid} type="button" className="dc-toolbar-recent" title={`Cargar ${design.name}`} onClick={() => { onLoadRecent?.(design); setOpenMenu(null); }}>
                <Clock3 size={14} />
                <span>{design.name}</span>
              </button>
            )) : <div className="dc-toolbar-file-empty">Todavía no hay diseños guardados.</div>)}
          </div>
        )}
      </div>

      <span className="dc-toolbar-separator mx-3" />

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger dc-toolbar-mobile-hidden ${guide !== 'none' ? 'active' : ''} ${featureLocked('editor.guides') ? 'dc-plus-locked' : ''}`} onClick={lockedAction('editor.guides', 'Guías', () => toggleMenu('guides'))} aria-expanded={openMenu === 'guides'} disabled={workspaceDisabled && !featureLocked('editor.guides')} aria-disabled={workspaceDisabled || featureLocked('editor.guides')}>
          <EyeOff size={15} />
          <span>Guías</span>
          <ChevronDown size={13} />
          {featureLocked('editor.guides') && <PremiumLock />}
        </button>
        {openMenu === 'guides' && (
          <div className="dc-toolbar-popover dc-toolbar-guides-menu">
            {[{ id: 'none', label: 'Sin guía', text: null }, ...Array.from({ length: guideSlotLimit }, (_, index) => index + 1).map((slot) => {
              const saved = guides.find((item) => item.slot === slot);
              return { id: String(slot), label: saved ? `Guía ${slot}` : `Guía ${slot} · Sin guardar`, text: `G${slot}`, disabled: !saved };
            })].map((item) => (
              <button key={item.id} type="button" className={guide === item.id ? 'active' : ''} disabled={item.disabled} onClick={() => { setGuide(item.id); setOpenMenu(null); }}>
                <span className="dc-toolbar-guide-mark">{item.text || '—'}</span>
                <span>{item.label}</span>
                <kbd>{GUIDE_SHORTCUTS[item.id]}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${openMenu === 'sounds' ? 'active' : ''} ${featureLocked('editor.quick_sounds') ? 'dc-plus-locked' : ''}`} onClick={lockedAction('editor.quick_sounds', 'Sonidos rápidos', () => toggleMenu('sounds'))} aria-expanded={openMenu === 'sounds'} disabled={audioDisabled && !featureLocked('editor.quick_sounds')} aria-disabled={audioDisabled || featureLocked('editor.quick_sounds')}>
          <Volume2 size={15} />
          <span>Sonidos</span>
          <ChevronDown size={13} />
          {featureLocked('editor.quick_sounds') && <PremiumLock />}
        </button>
        {openMenu === 'sounds' && (
          <div className="dc-toolbar-popover dc-toolbar-sounds-menu">
            {Array.from({ length: quickSoundSlotLimit }, (_, index) => {
              const sound = soundSlots[index];
              const playback = sound ? soundPlayback[sound.id] : null;
              return (
                <button
                  key={index}
                  type="button"
                  className={playback ? 'is-playing' : ''}
                  style={playback?.durationMs ? { '--dc-sound-duration': `${playback.durationMs}ms` } : undefined}
                  aria-pressed={Boolean(playback)}
                  disabled={!sound}
                  onClick={() => { if (sound) onPlaySound?.(sound.id, 'quick'); }}
                >
                  <span className="dc-toolbar-sound-mark">{index + 1}</span>
                  <span>{sound?.name || 'Sin asignar'}</span>
                  <Volume2 size={13} />
                </button>
              );
            })}
            <span className="dc-toolbar-popover-separator" />
            <button type="button" onClick={() => { onAssignSounds?.(); setOpenMenu(null); }}>
              <Settings2 size={15} />
              <span>Asignar sonidos</span>
            </button>
            <button type="button" className={lockedClass(featureLocked('editor.launchpad'))} onClick={lockedAction('editor.launchpad', 'Launchpad', toggleWorkspaceMode)}>
              <Grid3X3 size={15} />
              <span>Abrir Launchpad</span>
              {featureLocked('editor.launchpad') && <PremiumLock />}
            </button>
          </div>
        )}
      </div>

      <div className="dc-toolbar-group dc-toolbar-tools" aria-label="Herramientas">
        {directTools.map(({ id, label, icon }) => (
          <IconButton key={id} label={`${label} // ${TOOL_SHORTCUTS[id]}`} icon={icon} active={tool === id} onClick={() => chooseDirectTool(id)} locked={featureLocked({ select: 'editor.select', hand: 'editor.pan', draw: 'editor.brush', eraser: 'editor.eraser', text: 'editor.text' }[id])} disabled={workspaceDisabled} className={id === 'hand' || id === 'text' ? 'dc-toolbar-mobile-collapse' : ''} />
        ))}
      </div>

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${insertActive ? 'active' : ''}`} onClick={() => toggleMenu('insert')} aria-expanded={openMenu === 'insert'} disabled={workspaceDisabled}>
          <Plus size={15} />
          <span>Añadir</span>
          <ChevronDown size={13} />
        </button>
        {openMenu === 'insert' && (
          <div className="dc-toolbar-popover dc-toolbar-insert-menu">
            {directTools.filter(({ id }) => id === 'hand' || id === 'text').map(({ id, label, icon }) => (
              <button key={`mobile-${id}`} type="button" className={`dc-toolbar-mobile-only ${tool === id ? 'active' : ''} ${featureLocked({ hand: 'editor.pan', text: 'editor.text' }[id]) ? 'dc-plus-locked' : ''}`} onClick={() => chooseDirectTool(id)}>
                {createElement(icon, { size: 15 })}
                <span>{label}</span>
                <kbd>{TOOL_SHORTCUTS[id]}</kbd>
                {featureLocked({ hand: 'editor.pan', text: 'editor.text' }[id]) && <PremiumLock />}
              </button>
            ))}
            {insertTools.map(({ id, label, icon }) => (
              <button key={id} type="button" className={`${tool === id ? 'active' : ''} ${featureLocked({ image: 'editor.image', shape: 'editor.shape', line: 'editor.line', timer: 'editor.timer' }[id]) ? 'dc-plus-locked' : ''}`} onClick={(event) => chooseInsertTool(id, event)}>
                {createElement(icon, { size: 15 })}
                <span>{label}</span>
                <kbd>{TOOL_SHORTCUTS[id]}</kbd>
                {featureLocked({ image: 'editor.image', shape: 'editor.shape', line: 'editor.line', timer: 'editor.timer' }[id]) && <PremiumLock />}
              </button>
            ))}
          </div>
        )}
      </div>
      <input ref={imageInputRef} className="dc-hidden-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.gif" onChange={onImageChange} disabled={workspaceDisabled} />

      <IconButton label={snapEnabled ? 'Imán activado // Alt para ignorarlo mientras arrastras' : 'Imán desactivado'} icon={Magnet} active={snapEnabled} onClick={lockedAction('editor.snap', 'Imán', onToggleSnap)} locked={featureLocked('editor.snap')} disabled={workspaceDisabled} className="dc-toolbar-mobile-hidden" />

      {!liveEnabled && (
        <button
          type="button"
          className={`dc-publish-button ${hasDraftChanges ? 'has-changes' : ''} ${featureLocked('editor.live_studio') ? 'dc-plus-locked' : ''}`}
          onClick={lockedAction('editor.live_studio', 'Live / Estudio', onPublish)}
          disabled={(workspaceDisabled || !hasDraftChanges) && !featureLocked('editor.live_studio')}
          title={editorLocked ? 'Espera a que el editor en modo Estudio publique y active Live' : hasDraftChanges ? 'Enviar al overlay todo lo que tienes preparado' : 'El overlay ya tiene la última versión publicada'}
        >
          <Play size={14} />
          <span>{controlBusy === 'publish' ? 'Enviando...' : hasDraftChanges ? 'Publicar' : 'Publicado'}</span>
        </button>
      )}
      </>}

      {isOwner ? (
        <button
          type="button"
          className={`dc-panic-button ${overlayHidden ? 'active' : ''}`}
          onClick={onTogglePanic}
          disabled={controlDisabled}
          title={overlayHidden ? 'Encender overlay y volver a mostrar la salida publicada' : 'Apagar overlay inmediatamente sin borrar el workspace'}
          aria-pressed={overlayHidden}
        >
          <Power size={15} />
          <span>{overlayHidden ? 'Encender overlay' : 'Apagar overlay'}</span>
        </button>
      ) : overlayHidden ? (
        <span className="dc-overlay-hidden-badge" title="El propietario apagó temporalmente la salida del overlay"><Power size={13} /> OVERLAY APAGADO</span>
      ) : null}

      <div className="dc-toolbar-spacer" />

      <IconButton
        label={soundMonitorEnabled ? 'Monitoreo activado // Click para silenciar el audio local' : 'Monitoreo silenciado // Click para escuchar el audio local'}
        icon={soundMonitorEnabled ? Volume2 : VolumeX}
        active={soundMonitorEnabled}
        onClick={onToggleSoundMonitor}
        className="dc-toolbar-monitor-toggle"
      />

      <button type="button" className={`dc-toolbar-mode-toggle ${launchpadMode ? 'active' : ''} ${!launchpadMode && featureLocked('editor.launchpad') ? 'dc-plus-locked' : ''}`} onClick={launchpadMode ? toggleWorkspaceMode : lockedAction('editor.launchpad', 'Launchpad', toggleWorkspaceMode)} disabled={!connected && !featureLocked('editor.launchpad')} aria-disabled={!connected || (!launchpadMode && featureLocked('editor.launchpad'))} title={launchpadMode ? 'Volver al lienzo' : featureLocked('editor.launchpad') ? 'Launchpad // Lienzo Plus' : 'Abrir Launchpad'}>
        {launchpadMode ? <Pencil size={15} /> : <Grid3X3 size={15} />}
        <span>{launchpadMode ? 'Lienzo' : 'Launchpad'}</span>
        {!launchpadMode && featureLocked('editor.launchpad') && <PremiumLock />}
      </button>

      <span className="dc-toolbar-separator" />

      <div className="dc-toolbar-presence" aria-label={`${editors.length} editor${editors.length === 1 ? '' : 'es'} conectado${editors.length === 1 ? '' : 's'}`}>
        {editors.length > 0 && (
          <PresenceStack editors={editors} max={5} />
        )}
        <span className={`dc-toolbar-live ${connected ? 'online' : ''}`} title={connected ? 'Conectado al canal' : 'Sin conexión'}>
          <i />
          <span>{connected ? 'En línea' : 'Sin conexión'}</span>
        </span>
      </div>
    </div>
  );
}
