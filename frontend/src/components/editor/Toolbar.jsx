import { createElement, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Eraser,
  EyeOff,
  FolderOpen,
  Image,
  Keyboard,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Shapes,
  Timer,
  Trash2,
  Type,
  Undo2
} from 'lucide-react';
import { GUIDE_SHORTCUTS, TOOL_SHORTCUTS } from './hotkeys/shortcuts';

const directTools = [
  { id: 'select', label: 'Seleccionar / mover', icon: MousePointer2 },
  { id: 'draw', label: 'Lápiz / pincel', icon: Pencil },
  { id: 'eraser', label: 'Borrador', icon: Eraser }
];

const insertTools = [
  { id: 'image', label: 'Imagen / GIF', icon: Image },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'shape', label: 'Forma', icon: Shapes },
  { id: 'timer', label: 'Temporizador', icon: Timer }
];

const guides = [
  { id: 'none', label: 'Sin guía', text: null },
  { id: 'canva-guide.png', label: 'Guía 1', text: 'G1' },
  { id: 'canva-guide2.png', label: 'Guía 2', text: 'G2' },
  { id: 'canva-guide3.png', label: 'Guía 3', text: 'G3' }
];

function IconButton({ label, icon, onClick, disabled = false, active = false, danger = false }) {
  return (
    <button type="button" className={`dc-toolbar-icon ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      {createElement(icon, { size: 16 })}
    </button>
  );
}

export default function Toolbar({
  tool,
  setTool,
  guide,
  setGuide,
  onClear,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onHotkeys,
  onDesigns,
  onProperties,
  propertiesOpen = false,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  connected
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);
  const insertActive = insertTools.some((item) => item.id === tool);

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

  const chooseTool = (id) => {
    setTool(id);
    setOpenMenu(null);
  };

  return (
    <div className="dc-toolbar-horizontal" ref={rootRef}>
      <div className="dc-toolbar-group dc-toolbar-tools" aria-label="Herramientas">
        {directTools.map(({ id, label, icon }) => (
          <IconButton key={id} label={`${label} // ${TOOL_SHORTCUTS[id]}`} icon={icon} active={tool === id} onClick={() => chooseTool(id)} />
        ))}
      </div>

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${insertActive ? 'active' : ''}`} onClick={() => setOpenMenu((current) => current === 'insert' ? null : 'insert')} aria-expanded={openMenu === 'insert'}>
          <Plus size={15} />
          <span>Añadir</span>
          <ChevronDown size={13} />
        </button>
        {openMenu === 'insert' && (
          <div className="dc-toolbar-popover dc-toolbar-insert-menu">
            {insertTools.map(({ id, label, icon }) => (
              <button key={id} type="button" className={tool === id ? 'active' : ''} onClick={() => chooseTool(id)}>
                {createElement(icon, { size: 15 })}
                <span>{label}</span>
                <kbd>{TOOL_SHORTCUTS[id]}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="dc-toolbar-separator" />

      <div className="dc-toolbar-group">
        <IconButton label="Deshacer // Ctrl+Z" icon={Undo2} onClick={onUndo} disabled={!canUndo} />
        <IconButton label="Rehacer // Ctrl+Shift+Z / Ctrl+Y" icon={Redo2} onClick={onRedo} disabled={!canRedo} />
      </div>

      <span className="dc-toolbar-separator" />

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className={`dc-toolbar-menu-trigger ${guide !== 'none' ? 'active' : ''}`} onClick={() => setOpenMenu((current) => current === 'guides' ? null : 'guides')} aria-expanded={openMenu === 'guides'}>
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

      <button type="button" className="dc-toolbar-wide" onClick={onDesigns} title="Guardar, cargar o borrar diseños">
        <FolderOpen size={15} />
        <span>Diseños</span>
      </button>

      <button type="button" className={`dc-toolbar-wide ${propertiesOpen ? 'active' : ''}`} onClick={onProperties} title={propertiesOpen ? 'Ocultar propiedades' : 'Mostrar propiedades'} aria-pressed={propertiesOpen}>
        <SlidersHorizontal size={15} />
        <span>Propiedades</span>
      </button>

      <div className="dc-toolbar-spacer" />

      <div className="dc-toolbar-group dc-toolbar-menu-wrap">
        <button type="button" className="dc-toolbar-menu-trigger compact" onClick={() => setOpenMenu((current) => current === 'more' ? null : 'more')} aria-expanded={openMenu === 'more'} title="Más acciones">
          <MoreHorizontal size={17} />
          <span>Más</span>
          <ChevronDown size={13} />
        </button>
        {openMenu === 'more' && (
          <div className="dc-toolbar-popover dc-toolbar-more-menu align-right">
            <button type="button" disabled={!canCopy} onClick={() => { onCopy(); setOpenMenu(null); }}><ClipboardCopy size={15} /><span>Copiar</span><kbd>Ctrl+C</kbd></button>
            <button type="button" disabled={!canCopy} onClick={() => { onCut(); setOpenMenu(null); }}><Scissors size={15} /><span>Cortar</span><kbd>Ctrl+X</kbd></button>
            <button type="button" disabled={!canPaste} onClick={() => { onPaste(); setOpenMenu(null); }}><ClipboardPaste size={15} /><span>Pegar</span><kbd>Ctrl+V</kbd></button>
            <span className="dc-toolbar-popover-separator" />
            <button type="button" onClick={() => { onHotkeys(); setOpenMenu(null); }}><Keyboard size={15} /><span>Ver atajos</span><kbd>?</kbd></button>
            <button type="button" className="danger" onClick={() => { onClear(); setOpenMenu(null); }}><Trash2 size={15} /><span>Vaciar lienzo</span></button>
          </div>
        )}
      </div>

      <span className={`dc-toolbar-live ${connected ? 'online' : ''}`} title={connected ? 'Conectado al canal' : 'Sin conexión'}>
        <i />
        <span>{connected ? 'En línea' : 'Sin conexión'}</span>
      </span>
    </div>
  );
}
