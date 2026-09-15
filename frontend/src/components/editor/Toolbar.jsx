import { createElement } from 'react';
import {
  EyeOff,
  Image,
  MousePointer2,
  Pencil,
  Shapes,
  Timer,
  Trash2,
  Type,
  Undo2
} from 'lucide-react';

const tools = [
  { id: 'select', label: 'SELECT // MOVE', icon: MousePointer2 },
  { id: 'draw', label: 'DRAW // PENCIL', icon: Pencil },
  { id: 'image', label: 'IMPORT IMAGE / GIF', icon: Image },
  { id: 'shape', label: 'SHAPES', icon: Shapes },
  { id: 'text', label: 'TEXT GENERATOR', icon: Type },
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

export default function Toolbar({ tool, setTool, guide, setGuide, onClear, onUndo, connected }) {
  return (
    <aside className="dc-toolbar">
      <div className="dc-logo" aria-label="DrawCast">▦</div>
      <div className="dc-sep" />

      {tools.map(({ id, label, icon }) => (
        <button key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)} aria-label={label}>
          {createElement(icon)}
          <Tip>{label}</Tip>
        </button>
      ))}

      <div className="dc-sep" />

      {guides.map((item) => (
        <button key={item.id} className={`dc-guide-btn ${guide === item.id ? 'active' : ''}`} onClick={() => setGuide(item.id)} aria-label={item.label}>
          {item.text ? <span className="dc-guide-label">{item.text}</span> : <EyeOff />}
          <Tip>{item.label}</Tip>
        </button>
      ))}

      <div className="dc-sep" />

      <button onClick={onUndo} aria-label="UNDO LAST ACTION">
        <Undo2 />
        <Tip>UNDO LAST ACTION</Tip>
      </button>

      <button className="danger" onClick={onClear} aria-label="PURGE CANVA DATA">
        <Trash2 />
        <Tip>PURGE CANVA DATA</Tip>
      </button>

      <span className={`dc-connection-dot ${connected ? 'online' : ''}`} title={connected ? 'SYS_STATUS: ONLINE' : 'SYS_STATUS: OFFLINE'} />
    </aside>
  );
}
