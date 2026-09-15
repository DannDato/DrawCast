import { Eye, EyeOff } from 'lucide-react';

function layerLabel(object) {
  if (object.layerName) return object.layerName;
  if (object.tipo === 'shape' || object.tipo === 'forma') return object.shapeType || object.shape || 'shape';
  return object.text || object.layerName || object.fileName || object.name || object.tipo || object.id.slice(-6);
}

export default function LayersPanel({ objects, selectedId, onSelect, onPatch }) {
  const ordered = Object.values(objects).sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));

  return (
    <div className="dc-layers">
      <header>LAYERS // {ordered.length}</header>
      {ordered.map((object) => (
        <button key={object.id} className={selectedId === object.id ? 'selected' : ''} onClick={() => onSelect(object.id)}>
          <span>{object.mediaKind === 'gif' ? 'GIF' : String(object.tipo || 'object').toUpperCase()} // {layerLabel(object)}</span>
          <i onClick={(event) => { event.stopPropagation(); onPatch(object.id, { hidden: !object.hidden }); }}>
            {object.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </i>
        </button>
      ))}
    </div>
  );
}
