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
  { id: 'select', label: 'SELECT // MOVE', icon: MousePointer2 },
  { id: 'draw', label: 'DRAW // BRUSH', icon: Pencil },
  { id: 'image', label: 'IMPORT IMAGE / GIF', icon: Image },
  { id: 'text', label: 'TEXT GENERATOR', icon: Type }
];

const extraTools = [
  { id: 'eraser', label: 'DRAW // ERASER', icon: Eraser },
  { id: 'shape', label: 'SHAPES', icon: Shapes },
  { id: 'timer', label: 'TIMER', icon: Timer }
];

const guides = [
  { id: 'none', label: 'DISABLE CANVA GUIDE', text: null },
  { id: 'canva-guide.png', label: 'CANVA GUIDE 01', text: 'G1' },
  { id: 'canva-guide2.png', label: 'CANVA GUIDE 02', text: 'G2' },
  { id: 'canva-guide3.png', label: 'CANVA GUIDE 03', text: 'G3' }
];

function Tip({ children }) {
  return <span className="dc-tool-tip">{children}</span>;
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
      

      <div className="dc-toolbar-grid">{primaryTools.map(toolButton)}</div>

      <button type="button" className="dc-toolbar-more" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>{expanded ? 'VER MENOS' : 'VER MÁS'}</span>
      </button>

      {expanded && (
        <div className="dc-toolbar-expanded">
          <div className="dc-toolbar-grid">{extraTools.map(toolButton)}</div>
          <div className="dc-sep" />
          <div className="dc-toolbar-grid">
            {guides.map((item) => (
              <button key={item.id} className={`dc-guide-btn ${guide === item.id ? 'active' : ''}`} onClick={() => setGuide(item.id)} aria-label={`${item.label} // ${GUIDE_SHORTCUTS[item.id]}`}>
                {item.text ? <span className="dc-guide-label">{item.text}</span> : <EyeOff />}
                <Tip>{item.label} // {GUIDE_SHORTCUTS[item.id]}</Tip>
              </button>
            ))}
          </div>
          <div className="dc-sep" />
          <div className="dc-toolbar-grid">
            <ActionButton label="UNDO // CTRL+Z" icon={Undo2} onClick={onUndo} disabled={!canUndo} />
            <ActionButton label="REDO // CTRL+SHIFT+Z / CTRL+Y" icon={Redo2} onClick={onRedo} disabled={!canRedo} />
            <ActionButton label="COPY // CTRL+C" icon={ClipboardCopy} onClick={onCopy} disabled={!canCopy} />
            <ActionButton label="CUT // CTRL+X" icon={Scissors} onClick={onCut} disabled={!canCopy} />
            <ActionButton label="PASTE // CTRL+V" icon={ClipboardPaste} onClick={onPaste} disabled={!canPaste} />
            <ActionButton label="HOTKEYS // ? / F1" icon={Keyboard} onClick={onHotkeys} />
            <ActionButton label="PURGE CANVA DATA // CTRL+SHIFT+DEL" icon={Trash2} onClick={onClear} className="danger" />
          </div>
        </div>
      )}
    </aside>
  );
}
