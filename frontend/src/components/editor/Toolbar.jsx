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
  Timer,
  Type,
  Volume2
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
  { id: 'timer', label: 'Temporizador', icon: Timer }
];

const guides = [
  { id: 'none', label: 'Sin guía', text: null },
  { id: 'canva-guide.png', label: 'Guía 1', text: 'G1' },
  { id: 'canva-guide2.png', label: 'Guía 2', text: 'G2' },
  { id: 'canva-guide3.png', label: 'Guía 3', text: 'G3' }
];

function IconButton({ label, icon, onClick, disabled = false, active = false, danger = false, className = '' }) {
  return (
    <button type="button" className={`dc-toolbar-icon ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${className}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      {createElement(icon, { size: 16 })}
    </button>
  );
}

export default function Toolbar({
  tool,
  setTool,
  guide,
  setGuide,
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
  onAssignSounds,
  onAssignLaunchpadSounds
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);
  const imageInputRef = useRef(null);
  const insertActive = insertTools.some((item) => item.id === tool);
  const controlDisabled = !connected || Boolean(controlBusy);
  const workspaceDisabled = controlDisabled || editorLocked;
  const audioDisabled = controlDisabled;
  const launchpadMode = workspaceMode === 'launchpad';
  const liveSwitchDisabled = controlDisabled || editorLocked || (liveEnabled && liveRequired);

  useEffect(() => {
    if (!imagePickerRequest || workspaceDisabled) return;
    imageInputRef.current?.click();
  }, [imagePickerRequest, workspaceDisabled]);

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
    setTool(id);
    setOpenMenu(null);
  };

  const chooseInsertTool = (id, event) => {
    if (workspaceDisabled) return;
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
    if (file && !workspaceDisabled) await onImageFile?.(file);
  };

  return (
    <div className={`dc-toolbar-horizontal ${editorLocked ? 'is-editor-locked' : ''}`} ref={rootRef}>
      {launchpadMode ? (
        <button type="button" className="dc-toolbar-wide" onClick={onAssignLaunchpadSounds} disabled={audioDisabled}>
          <Settings2 size={15} />
          <span>Asignar sonidos</span>
        </button>
      ) : <>
      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${openMenu === 'file' ? 'active' : ''}`} onClick={() => toggleMenu('file')} aria-expanded={openMenu === 'file'} disabled={workspaceDisabled}>
          <File size={15} />
          <span>Archivo</span>
          <ChevronDown size={13} />
        </button>

        {openMenu === 'file' && (
          <div className="dc-toolbar-popover dc-toolbar-file-menu">
            <button type="button" onClick={() => { onSaveDesign?.(); setOpenMenu(null); }}><Save size={15} /><span>Guardar diseño...</span></button>
            <button type="button" onClick={() => { onLoadDesigns?.(); setOpenMenu(null); }}><FolderOpen size={15} /><span>Cargar diseño...</span></button>
            <span className="dc-toolbar-popover-separator" />
            <button
              type="button"
              className={`dc-file-live-toggle ${liveEnabled ? 'is-live' : 'is-studio'} ${liveEnabled && liveRequired ? 'is-required' : ''}`}
              onClick={() => { onToggleLive?.(); setOpenMenu(null); }}
              disabled={liveSwitchDisabled}
              aria-pressed={liveEnabled}
              title={liveEnabled && liveRequired ? 'Live es obligatorio mientras haya más de un editor conectado' : liveEnabled ? 'Live activado: los cambios se reflejan al instante en el overlay' : 'Modo Estudio: prepara cambios sin mostrarlos hasta publicar'}
            >
              <Radio size={15} />
              <span>{liveEnabled ? 'Live' : 'Estudio'}</span>
              <span className="dc-live-switch-track" aria-hidden="true"><i /></span>
            </button>
            <span className="dc-toolbar-popover-separator" />
            <div className="dc-toolbar-file-label"><Clock3 size={13} /><span>Recientes</span></div>
            {recentDesigns.length > 0 ? recentDesigns.slice(0, 5).map((design) => (
              <button key={design.uuid} type="button" className="dc-toolbar-recent" title={`Cargar ${design.name}`} onClick={() => { onLoadRecent?.(design); setOpenMenu(null); }}>
                <Clock3 size={14} />
                <span>{design.name}</span>
              </button>
            )) : <div className="dc-toolbar-file-empty">Todavía no hay diseños guardados.</div>}
          </div>
        )}
      </div>

      <span className="dc-toolbar-separator mx-3" />

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger dc-toolbar-mobile-hidden ${guide !== 'none' ? 'active' : ''}`} onClick={() => toggleMenu('guides')} aria-expanded={openMenu === 'guides'} disabled={workspaceDisabled}>
          <EyeOff size={15} />
          <span>Guías</span>
          <ChevronDown size={13} />
        </button>
        {openMenu === 'guides' && (
          <div className="dc-toolbar-popover dc-toolbar-guides-menu">
            {guides.map((item) => (
              <button key={item.id} type="button" className={guide === item.id ? 'active' : ''} onClick={() => { setGuide(item.id); setOpenMenu(null); }}>
                <span className="dc-toolbar-guide-mark">{item.text || '—'}</span>
                <span>{item.label}</span>
                <kbd>{GUIDE_SHORTCUTS[item.id]}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${openMenu === 'sounds' ? 'active' : ''}`} onClick={() => toggleMenu('sounds')} aria-expanded={openMenu === 'sounds'} disabled={audioDisabled}>
          <Volume2 size={15} />
          <span>Sonidos</span>
          <ChevronDown size={13} />
        </button>
        {openMenu === 'sounds' && (
          <div className="dc-toolbar-popover dc-toolbar-sounds-menu">
            {Array.from({ length: 5 }, (_, index) => {
              const sound = soundSlots[index];
              return (
                <button key={index} type="button" disabled={!sound} onClick={() => { if (sound) onPlaySound?.(sound.id); setOpenMenu(null); }}>
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
            <button type="button" onClick={toggleWorkspaceMode}>
              <Grid3X3 size={15} />
              <span>Abrir Launchpad</span>
            </button>
          </div>
        )}
      </div>

      <div className="dc-toolbar-group dc-toolbar-tools" aria-label="Herramientas">
        {directTools.map(({ id, label, icon }) => (
          <IconButton key={id} label={`${label} // ${TOOL_SHORTCUTS[id]}`} icon={icon} active={tool === id} onClick={() => chooseDirectTool(id)} disabled={workspaceDisabled} className={id === 'hand' || id === 'text' ? 'dc-toolbar-mobile-collapse' : ''} />
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
              <button key={`mobile-${id}`} type="button" className={`dc-toolbar-mobile-only ${tool === id ? 'active' : ''}`} onClick={() => chooseDirectTool(id)}>
                {createElement(icon, { size: 15 })}
                <span>{label}</span>
                <kbd>{TOOL_SHORTCUTS[id]}</kbd>
              </button>
            ))}
            {insertTools.map(({ id, label, icon }) => (
              <button key={id} type="button" className={tool === id ? 'active' : ''} onClick={(event) => chooseInsertTool(id, event)}>
                {createElement(icon, { size: 15 })}
                <span>{label}</span>
                <kbd>{TOOL_SHORTCUTS[id]}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>
      <input ref={imageInputRef} className="dc-hidden-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.gif" onChange={onImageChange} disabled={workspaceDisabled} />

      <IconButton label={snapEnabled ? 'Imán activado // Alt para ignorarlo mientras arrastras' : 'Imán desactivado'} icon={Magnet} active={snapEnabled} onClick={onToggleSnap} disabled={workspaceDisabled} className="dc-toolbar-mobile-hidden" />

      {!liveEnabled && (
        <button
          type="button"
          className={`dc-publish-button ${hasDraftChanges ? 'has-changes' : ''}`}
          onClick={onPublish}
          disabled={workspaceDisabled || !hasDraftChanges}
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

      <button type="button" className={`dc-toolbar-mode-toggle ${launchpadMode ? 'active' : ''}`} onClick={toggleWorkspaceMode} disabled={!connected} title={launchpadMode ? 'Volver al lienzo' : 'Abrir Launchpad'}>
        {launchpadMode ? <Pencil size={15} /> : <Grid3X3 size={15} />}
        <span>{launchpadMode ? 'Lienzo' : 'Launchpad'}</span>
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
