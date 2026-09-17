import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Group, Layers3, Trash2, Ungroup } from 'lucide-react';
import { getGroupName } from './groups/groupUtils';
import { layerUnits, orderedLayerObjects } from './layers/layerUtils';
import { textValue } from './tools/text/textTool';

const VIEW_MODE_KEY = 'drawcast.layers.view.mode';
const COLLAPSED_KEY = 'drawcast.layers.collapsed.groups';

function layerLabel(object) {
  if (object.layerName) return object.layerName;
  if (object.tipo === 'text' || object.tipo === 'texto') return textValue(object).replace(/\s+/g, ' ').trim() || 'TEXTO';
  if (object.tipo === 'timer') return 'TEMPORIZADOR';
  if (object.tipo === 'shape' || object.tipo === 'forma') return object.shapeType || object.shape || 'FORMA';
  return object.fileName || object.name || object.tipo || object.id.slice(-6);
}

function layerType(object) {
  if (object.mediaKind === 'gif') return 'GIF';
  if (object.tipo === 'text' || object.tipo === 'texto') return 'TEXTO';
  if (object.tipo === 'timer') return 'TEMPORIZADOR';
  if (object.tipo === 'shape' || object.tipo === 'forma') return 'FORMA';
  if (object.tipo === 'draw' || object.tipo === 'trazo') return 'DIBUJO';
  if (object.tipo === 'image' || object.tipo === 'imagen') return 'IMAGEN';
  return String(object.tipo || 'OBJETO').toUpperCase();
}

function readCollapsedGroups() {
  try {
    const value = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function LayerRow({ object, index, selected, compact, onSelect, onPatch, onRemove, onDragStart, onDrop }) {
  return (
    <div
      className={`dc-layer-row ${selected ? 'selected' : ''} ${object.hidden ? 'is-hidden' : ''} ${compact ? 'compact' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, object.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDrop(event, object.id)}
      onClick={(event) => onSelect(object.id, { append: event.ctrlKey || event.metaKey || event.shiftKey })}
    >
      <span className="dc-layer-grip" title="Arrastra para cambiar el orden"><GripVertical size={14} /></span>
      <span className="dc-layer-index">{String(index).padStart(2, '0')}</span>
      <span className="dc-layer-copy">
        <b>{layerLabel(object)}</b>
        {!compact && <small>{layerType(object)}{object.groupName ? ` // ${object.groupName}` : ''}</small>}
      </span>
      <button
        type="button"
        className="dc-layer-icon-btn"
        title={object.hidden ? 'Mostrar capa' : 'Ocultar capa'}
        onClick={(event) => {
          event.stopPropagation();
          onPatch(object.id, { hidden: !object.hidden });
        }}
      >
        {object.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button
        type="button"
        className="dc-layer-icon-btn danger"
        title="Eliminar capa"
        onClick={(event) => {
          event.stopPropagation();
          onRemove([object.id]);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function LayersPanel({
  objects,
  selectedIds = [],
  onSelect,
  onSelectMany,
  onPatch,
  onPatchMany,
  onRemove,
  onReorder,
  onGroup,
  onUngroup,
  onDuplicate
}) {
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) !== 'expanded'; } catch { return true; }
  });
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
  const ordered = useMemo(() => orderedLayerObjects(objects), [objects]);
  const units = useMemo(() => layerUnits(objects), [objects]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedObjects = selectedIds.map((id) => objects[id]).filter(Boolean);
  const canUngroup = selectedObjects.some((object) => object.groupId);
  const canGroup = selectedObjects.filter((object) => [object?.x, object?.y, object?.w, object?.h].every((value) => Number.isFinite(Number(value)))).length >= 2;

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, compact ? 'compact' : 'expanded'); } catch { /* noop */ }
  }, [compact]);

  const toggleCollapsed = (groupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

  const startDrag = (event, id) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-drawcast-layer', id);
    event.dataTransfer.setData('text/plain', id);
  };

  const dropLayer = (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('application/x-drawcast-layer') || event.dataTransfer.getData('text/plain');
    if (sourceId) onReorder(sourceId, targetId);
  };

  const setGroupVisibility = (memberIds) => {
    const members = memberIds.map((id) => objects[id]).filter(Boolean);
    const shouldHide = members.some((object) => !object.hidden);
    onPatchMany(members.map((object) => ({ id: object.id, patch: { hidden: shouldHide } })));
  };

  return (
    <aside className={`dc-layers ${compact ? 'is-compact' : ''}`}>
      <header className="dc-layers-head">
        <span><Layers3 size={14} /> Capas <b>· {ordered.length}</b></span>
        <button type="button" onClick={() => setCompact((value) => !value)}>{compact ? 'Detalle' : 'Compactar'}</button>
      </header>

      {selectedIds.length > 0 && (
        <div className="dc-layer-selection-actions">
          <span>{selectedIds.length} seleccionada{selectedIds.length === 1 ? '' : 's'}</span>
          {canGroup && <button type="button" title="Agrupar selección" onClick={onGroup}><Group size={14} /></button>}
          {canUngroup && <button type="button" title="Desagrupar" onClick={onUngroup}><Ungroup size={14} /></button>}
          <button type="button" title="Duplicar" onClick={onDuplicate}><Copy size={14} /></button>
          <button type="button" className="danger" title="Eliminar" onClick={() => onRemove(selectedIds)}><Trash2 size={14} /></button>
        </div>
      )}

      <div className="dc-layer-list">
        {!units.length && <div className="dc-layers-empty">Todavía no hay capas en el lienzo.</div>}

        {units.map((unit) => {
          if (unit.type === 'layer') {
            const object = objects[unit.ids[0]];
            const index = ordered.findIndex((item) => item.id === object.id) + 1;
            return (
              <LayerRow
                key={unit.key}
                object={object}
                index={ordered.length - index + 1}
                selected={selectedSet.has(object.id)}
                compact={compact}
                onSelect={onSelect}
                onPatch={onPatch}
                onRemove={onRemove}
                onDragStart={startDrag}
                onDrop={dropLayer}
              />
            );
          }

          const members = unit.ids.map((id) => objects[id]).filter(Boolean);
          const groupName = members.map(getGroupName).find(Boolean) || 'GRUPO';
          const collapsed = collapsedGroups.has(unit.groupId);
          const allSelected = members.length > 0 && members.every((object) => selectedSet.has(object.id));
          const anyVisible = members.some((object) => !object.hidden);
          const representativeId = members[0]?.id;

          return (
            <section
              key={unit.key}
              className={`dc-layer-group ${allSelected ? 'selected' : ''}`}
              draggable={Boolean(representativeId)}
              onDragStart={(event) => representativeId && startDrag(event, representativeId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => representativeId && dropLayer(event, representativeId)}
            >
              <div className="dc-layer-group-head" onClick={() => onSelectMany(unit.ids, representativeId)}>
                <button type="button" className="dc-layer-icon-btn" title={collapsed ? 'Abrir grupo' : 'Cerrar grupo'} onClick={(event) => { event.stopPropagation(); toggleCollapsed(unit.groupId); }}>
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="dc-layer-grip" title="Arrastra para cambiar el orden"><GripVertical size={14} /></span>
                <Group size={14} />
                <span className="dc-layer-copy"><b>{groupName}</b>{!compact && <small>{members.length} CAPAS</small>}</span>
                <button type="button" className="dc-layer-icon-btn" title={anyVisible ? 'Ocultar grupo' : 'Mostrar grupo'} onClick={(event) => { event.stopPropagation(); setGroupVisibility(unit.ids); }}>
                  {anyVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>

              {!collapsed && (
                <div className="dc-layer-group-members">
                  {members.map((object) => {
                    const index = ordered.findIndex((item) => item.id === object.id) + 1;
                    return (
                      <LayerRow
                        key={object.id}
                        object={object}
                        index={ordered.length - index + 1}
                        selected={selectedSet.has(object.id)}
                        compact={compact}
                        onSelect={onSelect}
                        onPatch={onPatch}
                        onRemove={onRemove}
                        onDragStart={startDrag}
                        onDrop={dropLayer}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
