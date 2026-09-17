import { getGroupId } from '../groups/groupUtils.js';

export function orderedLayerObjects(objects) {
  return Object.values(objects || {}).sort((a, b) => {
    const z = (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0);
    if (z !== 0) return z;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

export function layerUnits(objects) {
  const ordered = orderedLayerObjects(objects);
  const seenGroups = new Set();
  const units = [];

  for (const object of ordered) {
    const groupId = getGroupId(object);
    if (!groupId) {
      units.push({ key: `layer:${object.id}`, type: 'layer', ids: [object.id] });
      continue;
    }

    if (seenGroups.has(groupId)) continue;
    seenGroups.add(groupId);
    units.push({
      key: `group:${groupId}`,
      type: 'group',
      groupId,
      ids: ordered.filter((candidate) => getGroupId(candidate) === groupId).map((candidate) => candidate.id)
    });
  }

  return units;
}

function unitKeyForObject(objects, id) {
  const object = objects?.[id];
  if (!object) return null;
  const groupId = getGroupId(object);
  return groupId ? `group:${groupId}` : `layer:${id}`;
}

export function reorderLayerUnits(objects, draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return [];

  const sourceKey = unitKeyForObject(objects, draggedId);
  const targetKey = unitKeyForObject(objects, targetId);
  if (!sourceKey || !targetKey || sourceKey === targetKey) return [];

  const units = layerUnits(objects);
  const sourceIndex = units.findIndex((unit) => unit.key === sourceKey);
  const targetIndex = units.findIndex((unit) => unit.key === targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return [];

  const [source] = units.splice(sourceIndex, 1);
  units.splice(targetIndex, 0, source);

  const flattened = units.flatMap((unit) => unit.ids);
  const total = flattened.length;
  return flattened
    .map((id, index) => ({ id, patch: { zIndex: total - index } }))
    .filter(({ id, patch }) => Number(objects?.[id]?.zIndex) !== patch.zIndex);
}

export function reorderLayerUnitToIndex(objects, draggedId, destinationIndex) {
  if (!draggedId || !Number.isFinite(Number(destinationIndex))) return [];

  const sourceKey = unitKeyForObject(objects, draggedId);
  if (!sourceKey) return [];

  const units = layerUnits(objects);
  const sourceIndex = units.findIndex((unit) => unit.key === sourceKey);
  if (sourceIndex < 0) return [];

  const [source] = units.splice(sourceIndex, 1);
  const nextIndex = Math.max(0, Math.min(units.length, Math.trunc(Number(destinationIndex))));
  if (nextIndex === sourceIndex) return [];

  units.splice(nextIndex, 0, source);
  const flattened = units.flatMap((unit) => unit.ids);
  const total = flattened.length;
  return flattened
    .map((id, index) => ({ id, patch: { zIndex: total - index } }))
    .filter(({ id, patch }) => Number(objects?.[id]?.zIndex) !== patch.zIndex);
}

export function moveSelectionOneLevel(objects, ids, direction) {
  const selected = ids.filter((id) => objects?.[id]);
  if (!selected.length) return [];

  const keys = new Set(selected.map((id) => unitKeyForObject(objects, id)).filter(Boolean));
  if (keys.size !== 1) return [];

  const units = layerUnits(objects);
  const index = units.findIndex((unit) => keys.has(unit.key));
  if (index < 0) return [];

  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= units.length) return [];

  const [unit] = units.splice(index, 1);
  units.splice(nextIndex, 0, unit);
  const flattened = units.flatMap((item) => item.ids);
  const total = flattened.length;
  return flattened.map((id, itemIndex) => ({ id, patch: { zIndex: total - itemIndex } }));
}
