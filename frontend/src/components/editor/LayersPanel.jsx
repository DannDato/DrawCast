import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Group, Layers3, Plus, Trash2, Ungroup } from 'lucide-react';
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

function LayerRow({ object, index, selected, compact, onSelect, onPatch, onRemove, onDragPointerDown, unitKey = null }) {
  return (
    <div
      className={`dc-layer-row ${selected ? 'selected' : ''} ${object.hidden ? 'is-hidden' : ''} ${compact ? 'compact' : ''}`}
      data-layer-unit-key={unitKey || undefined}
      onClick={(event) => onSelect(object.id, { append: event.ctrlKey || event.metaKey || event.shiftKey })}
    >
      <span
        className="dc-layer-grip"
        title="Arrastra para cambiar el orden"
        onPointerDown={(event) => onDragPointerDown(event, object.id)}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical size={14} />
      </span>
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
  onNewDrawLayer,
  onGroup,
  onUngroup,
  onDuplicate
}) {
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) !== 'expanded'; } catch { return true; }
  });
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
  const [dragState, setDragState] = useState(null);
  const listRef = useRef(null);
  const ghostRef = useRef(null);
  const dragRef = useRef(null);
  const dragRafRef = useRef(0);
  const pendingPointerRef = useRef(null);
  const previousUnitRectsRef = useRef(new Map());
  const ordered = useMemo(() => orderedLayerObjects(objects), [objects]);
  const units = useMemo(() => layerUnits(objects), [objects]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedObjects = selectedIds.map((id) => objects[id]).filter(Boolean);
  const canUngroup = selectedObjects.some((object) => object.groupId);
  const canGroup = selectedObjects.filter((object) => [object?.x, object?.y, object?.w, object?.h].every((value) => Number.isFinite(Number(value)))).length >= 2;
  const dragSourceKey = dragState?.sourceKey || null;
  const dragInsertIndex = dragState?.insertIndex ?? null;

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, compact ? 'compact' : 'expanded'); } catch { /* noop */ }
  }, [compact]);

  useLayoutEffect(() => {
    if (!dragSourceKey || !listRef.current) {
      previousUnitRectsRef.current = new Map();
      return;
    }

    const nextRects = new Map();
    listRef.current.querySelectorAll('[data-layer-unit-key]').forEach((element) => {
      const key = element.dataset.layerUnitKey;
      if (!key) return;
      const rect = element.getBoundingClientRect();
      nextRects.set(key, rect);
      const previous = previousUnitRectsRef.current.get(key);
      if (!previous) return;
      const deltaY = previous.top - rect.top;
      if (Math.abs(deltaY) < 1 || typeof element.animate !== 'function') return;
      element.animate(
        [{ transform: `translate3d(0, ${deltaY}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 150, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    });
    previousUnitRectsRef.current = nextRects;
  }, [dragInsertIndex, dragSourceKey]);

  useEffect(() => {
    if (!dragState?.pointerId) return undefined;

    const processPointer = (clientY) => {
      const active = dragRef.current;
      const list = listRef.current;
      if (!active || !list) return active?.insertIndex ?? 0;

      const listRect = list.getBoundingClientRect();
      const edge = Math.min(52, Math.max(34, listRect.height * 0.12));
      if (clientY < listRect.top + edge) list.scrollTop -= Math.max(4, Math.min(16, Math.round((listRect.top + edge - clientY) / 4)));
      else if (clientY > listRect.bottom - edge) list.scrollTop += Math.max(4, Math.min(16, Math.round((clientY - (listRect.bottom - edge)) / 4)));

      const nodes = [...list.querySelectorAll('[data-layer-unit-key]')].filter((element) => element.dataset.layerUnitKey !== active.sourceKey);
      let insertIndex = nodes.length;
      for (let i = 0; i < nodes.length; i += 1) {
        const rect = nodes[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          insertIndex = i;
          break;
        }
      }

      if (insertIndex !== active.insertIndex) {
        active.insertIndex = insertIndex;
        setDragState((current) => current ? { ...current, insertIndex } : current);
      }
      return insertIndex;
    };

    const flushPointer = () => {
      dragRafRef.current = 0;
      const pending = pendingPointerRef.current;
      const active = dragRef.current;
      if (!pending || !active) return;
      if (ghostRef.current) ghostRef.current.style.transform = `translate3d(0, ${pending.clientY - active.offsetY}px, 0)`;
      processPointer(pending.clientY);
    };

    const handlePointerMove = (event) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== active.pointerId) return;
      pendingPointerRef.current = { clientY: event.clientY };
      if (!dragRafRef.current) dragRafRef.current = requestAnimationFrame(flushPointer);
    };

    const finishDrag = (event, cancelled = false) => {
      const active = dragRef.current;
      if (!active || (event?.pointerId != null && event.pointerId !== active.pointerId)) return;
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      if (!cancelled && event?.clientY != null) processPointer(event.clientY);
      const destinationIndex = active.insertIndex;
      const sourceId = active.sourceId;
      document.body.classList.remove('dc-layer-reordering');
      dragRef.current = null;
      pendingPointerRef.current = null;
      previousUnitRectsRef.current = new Map();
      setDragState(null);
      if (!cancelled) onReorder(sourceId, destinationIndex);
    };

    const handlePointerUp = (event) => finishDrag(event, false);
    const handlePointerCancel = (event) => finishDrag(event, true);
    const handleBlur = () => finishDrag(null, true);
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finishDrag(null, true);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      document.body.classList.remove('dc-layer-reordering');
    };
  }, [dragState?.pointerId, onReorder]);

  const toggleCollapsed = (groupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

  const unitLabel = (unit) => {
    if (!unit) return 'CAPA';
    if (unit.type === 'group') {
      const members = unit.ids.map((id) => objects[id]).filter(Boolean);
      return members.map(getGroupName).find(Boolean) || `GRUPO · ${members.length} CAPAS`;
    }
    return layerLabel(objects[unit.ids[0]] || { id: unit.ids[0], tipo: 'capa' });
  };

  const startPointerDrag = (event, sourceId) => {
    if (event.button !== 0 || dragRef.current) return;
    const unitElement = event.currentTarget.closest('[data-layer-unit-key]');
    const sourceKey = unitElement?.dataset.layerUnitKey;
    const sourceIndex = units.findIndex((unit) => unit.key === sourceKey);
    if (!unitElement || !sourceKey || sourceIndex < 0) return;

    const rect = unitElement.getBoundingClientRect();
    const sourceUnit = units[sourceIndex];
    const next = {
      pointerId: event.pointerId,
      sourceId,
      sourceKey,
      sourceIndex,
      insertIndex: sourceIndex,
      height: Math.max(32, rect.height),
      width: rect.width,
      left: rect.left,
      offsetY: 17,
      initialTop: event.clientY - 17,
      label: unitLabel(sourceUnit),
      type: sourceUnit.type
    };

    event.preventDefault();
    event.stopPropagation();
    dragRef.current = next;
    pendingPointerRef.current = { clientY: event.clientY };
    document.body.classList.add('dc-layer-reordering');
    setDragState(next);
  };

  const setGroupVisibility = (memberIds) => {
    const members = memberIds.map((id) => objects[id]).filter(Boolean);
    const shouldHide = members.some((object) => !object.hidden);
    onPatchMany(members.map((object) => ({ id: object.id, patch: { hidden: shouldHide } })));
  };

  const renderUnit = (unit) => {
    if (unit.type === 'layer') {
      const object = objects[unit.ids[0]];
      const index = ordered.findIndex((item) => item.id === object.id) + 1;
      return (
        <LayerRow
          key={unit.key}
          unitKey={unit.key}
          object={object}
          index={ordered.length - index + 1}
          selected={selectedSet.has(object.id)}
          compact={compact}
          onSelect={onSelect}
          onPatch={onPatch}
          onRemove={onRemove}
          onDragPointerDown={startPointerDrag}
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
      <section key={unit.key} className={`dc-layer-group ${allSelected ? 'selected' : ''}`} data-layer-unit-key={unit.key}>
        <div className="dc-layer-group-head" onClick={() => onSelectMany(unit.ids, representativeId)}>
          <button type="button" className="dc-layer-icon-btn" title={collapsed ? 'Abrir grupo' : 'Cerrar grupo'} onClick={(event) => { event.stopPropagation(); toggleCollapsed(unit.groupId); }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="dc-layer-grip" title="Arrastra para cambiar el orden" onPointerDown={(event) => representativeId && startPointerDrag(event, representativeId)} onClick={(event) => event.stopPropagation()}><GripVertical size={14} /></span>
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
                  onDragPointerDown={startPointerDrag}
                />
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const visibleUnits = dragState ? units.filter((unit) => unit.key !== dragState.sourceKey) : units;
  const unitNodes = [];
  visibleUnits.forEach((unit, index) => {
    if (dragState && dragState.insertIndex === index) {
      unitNodes.push(
        <div key="__drop_slot__" className="dc-layer-drop-placeholder" style={{ height: `${dragState.height}px` }}>
          <span> </span>
        </div>
      );
    }
    unitNodes.push(renderUnit(unit));
  });
  if (dragState && dragState.insertIndex === visibleUnits.length) {
    unitNodes.push(
      <div key="__drop_slot_end__" className="dc-layer-drop-placeholder" style={{ height: `${dragState.height}px` }}>
        <span> </span>
      </div>
    );
  }

  return (
    <aside className={`dc-layers ${compact ? 'is-compact' : ''} ${dragState ? 'is-reordering' : ''}`}>
      <header className="dc-layers-head">
        <span><Layers3 size={14} /> Capas <b>· {ordered.length}</b></span>
        <div className="dc-layers-head-actions">
          <button type="button" onClick={() => setCompact((value) => !value)}>{compact ? 'Detalle' : 'Compactar'}</button>
        </div>
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

      <div ref={listRef} className="dc-layer-list">
        {!units.length && <div className="dc-layers-empty">No hay capas.</div>}
        {unitNodes}
      </div>
      <div className="dc-layers-new-footer">
        <button type="button" className="dc-layers-new-layer" onClick={onNewDrawLayer} title="Nueva capa de dibujo" aria-label="Nueva capa de dibujo">
          <span className="dc-layers-new-layer-icon"><Plus size={15} /></span>
          <span className="dc-layers-new-layer-copy"><b>Nueva capa</b><small>Dibujo</small></span>
        </button>
      </div>

      {dragState && (
        <div
          ref={ghostRef}
          className={`dc-layer-drag-ghost ${dragState.type === 'group' ? 'is-group' : ''}`}
          style={{ left: `${dragState.left}px`, width: `${dragState.width}px`, transform: `translate3d(0, ${dragState.initialTop}px, 0)` }}
        >
          <GripVertical size={15} />
          <span><b>{dragState.label}</b><small>{dragState.type === 'group' ? 'MOVER GRUPO' : 'MOVER CAPA'}</small></span>
        </div>
      )}
    </aside>
  );
}
