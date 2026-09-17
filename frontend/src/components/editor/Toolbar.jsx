import { createElement, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  EyeOff,
  Eraser,
  Image,
  Keyboard,
  MousePointer2,
  Pencil,
  Redo2,
  Scissors,
  Shapes,
  Timer,
  Trash2,
  Type,
  Undo2
} from 'lucide-react';
import { GUIDE_SHORTCUTS, TOOL_SHORTCUTS } from './hotkeys/shortcuts';

const primaryTools = [
  { id: 'select', label: 'Seleccionar / mover', icon: MousePointer2 },
  { id: 'draw', label: 'Lápiz / pincel', icon: Pencil },
  { id: 'image', label: 'Imagen / GIF', icon: Image },
  { id: 'text', label: 'Texto', icon: Type }
];

const extraTools = [
  { id: 'eraser', label: 'Borrador', icon: Eraser },
  { id: 'shape', label: 'Formas', icon: Shapes },
  { id: 'timer', label: 'Temporizador', icon: Timer }
];

const guides = [
  { id: 'none', label: 'Sin guía', text: null },
  { id: 'canva-guide.png', label: 'Guía 1', text: 'G1' },
  { id: 'canva-guide2.png', label: 'Guía 2', text: 'G2' },
  { id: 'canva-guide3.png', label: 'Guía 3', text: 'G3' }
];

function Tip({ children }) {
  return <span className="dc-tool-tip">{children}</span>;
}

function SectionDivider({ children }) {
  return <div className="dc-toolbar-divider"><span>{children}</span></div>;
}

function ActionButton({ label, icon, onClick, disabled = false, className = '' }) {
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label}>
      {createElement(icon)}
      <Tip>{label}</Tip>
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
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  connected
}) {
  const [expanded, setExpanded] = useState(false);
  const toolButton = ({ id, label, icon }) => (
    <button key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)} aria-label={`${label} // ${TOOL_SHORTCUTS[id]}`}>
      {createElement(icon)}
      <Tip>{label} // {TOOL_SHORTCUTS[id]}</Tip>
    </button>
  );

  return (
    <aside className={`dc-toolbar ${expanded ? 'is-expanded' : ''}`}>
      <div className="dc-toolbar-head">
        <div className="dc-logo" aria-label="DrawCast">▦</div>
        <span className={`dc-connection-dot ${connected ? 'online' : ''}`} title={connected ? 'Conectado' : 'Sin conexión'} />
      </div>

      <SectionDivider>Herramientas</SectionDivider>
      <div className="dc-toolbar-grid">{primaryTools.map(toolButton)}</div>

      {expanded && (
        <div className="dc-toolbar-expanded">
          <SectionDivider>Más herramientas</SectionDivider>
          <div className="dc-toolbar-grid">{extraTools.map(toolButton)}</div>

          <SectionDivider>Guías</SectionDivider>
          <div className="dc-toolbar-grid">
            {guides.map((item) => (
              <button key={item.id} className={`dc-guide-btn ${guide === item.id ? 'active' : ''}`} onClick={() => setGuide(item.id)} aria-label={`${item.label} // ${GUIDE_SHORTCUTS[item.id]}`}>
                {item.text ? <span className="dc-guide-label">{item.text}</span> : <EyeOff />}
                <Tip>{item.label} // {GUIDE_SHORTCUTS[item.id]}</Tip>
              </button>
            ))}
          </div>

          <SectionDivider>Edición</SectionDivider>
          <div className="dc-toolbar-grid">
            <ActionButton label="Deshacer // Ctrl+Z" icon={Undo2} onClick={onUndo} disabled={!canUndo} />
            <ActionButton label="Rehacer // Ctrl+Shift+Z / Ctrl+Y" icon={Redo2} onClick={onRedo} disabled={!canRedo} />
            <ActionButton label="Copiar // Ctrl+C" icon={ClipboardCopy} onClick={onCopy} disabled={!canCopy} />
            <ActionButton label="Cortar // Ctrl+X" icon={Scissors} onClick={onCut} disabled={!canCopy} />
            <ActionButton label="Pegar // Ctrl+V" icon={ClipboardPaste} onClick={onPaste} disabled={!canPaste} />
            <ActionButton label="Atajos // ? / F1" icon={Keyboard} onClick={onHotkeys} />
            <ActionButton label="Vaciar el lienzo // Ctrl+Shift+Supr" icon={Trash2} onClick={onClear} className="danger" />
          </div>
        </div>
      )}

      <button type="button" className="dc-toolbar-more" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>{expanded ? 'Ver menos' : 'Ver más'}</span>
      </button>
    </aside>
  );
}
