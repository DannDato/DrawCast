const makeToken = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function makeGroupId() {
  return `group_${makeToken()}`;
}

export function getGroupId(object) {
  return typeof object?.groupId === 'string' && object.groupId ? object.groupId : null;
}

export function getGroupName(object) {
  return typeof object?.groupName === 'string' && object.groupName.trim() ? object.groupName.trim() : null;
}

export function groupMembers(objects, groupId) {
  if (!groupId) return [];
  return Object.values(objects || {})
    .filter((object) => getGroupId(object) === groupId)
    .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));
}

export function nextGroupName(objects) {
  const regex = /^(?:GROUP|GRUPO)\s+(\d+)$/i;
  let max = 0;

  Object.values(objects || {}).forEach((object) => {
    const match = getGroupName(object)?.match(regex);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  });

  return `GRUPO ${String(max + 1).padStart(2, '0')}`;
}

export function createGroupPatches(objects, ids) {
  const uniqueIds = [...new Set(ids)].filter((id) => objects?.[id]);
  if (uniqueIds.length < 2) return { groupId: null, groupName: null, updates: [] };

  const groupId = makeGroupId();
  const groupName = nextGroupName(objects);
  const orderedTop = Object.values(objects)
    .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))
    .map((object) => object.id);
  const selectedSet = new Set(uniqueIds);
  const selectedOrdered = orderedTop.filter((id) => selectedSet.has(id));
  const firstIndex = Math.max(0, orderedTop.findIndex((id) => selectedSet.has(id)));
  const remaining = orderedTop.filter((id) => !selectedSet.has(id));
  const flattened = [...remaining.slice(0, firstIndex), ...selectedOrdered, ...remaining.slice(firstIndex)];
  const total = flattened.length;

  return {
    groupId,
    groupName,
    updates: flattened.map((id, index) => ({
      id,
      patch: {
        zIndex: total - index,
        ...(selectedSet.has(id) ? { groupId, groupName } : {})
      }
    }))
  };
}

export function ungroupPatches(objects, ids) {
  const selected = ids.map((id) => objects?.[id]).filter(Boolean);
  const groupIds = new Set(selected.map(getGroupId).filter(Boolean));
  if (!groupIds.size) return [];

  return Object.values(objects || {})
    .filter((object) => groupIds.has(getGroupId(object)))
    .map((object) => ({ id: object.id, patch: { groupId: null, groupName: null } }));
}

export function selectedGroupIds(objects, ids) {
  return [...new Set(ids.map((id) => getGroupId(objects?.[id])).filter(Boolean))];
}

export function groupSelectionIds(objects, groupId) {
  return groupMembers(objects, groupId).map((object) => object.id);
}

function cloneId(object) {
  const type = String(object?.tipo || 'object').replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'object';
  return `${type}_${makeToken()}`;
}

export function duplicateSelection(objects, ids, offset = 28) {
  const selected = ids
    .map((id) => objects?.[id])
    .filter(Boolean)
    .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));

  if (!selected.length) return { objects: [], ids: [] };

  const maxZ = Math.max(0, ...Object.values(objects || {}).map((object) => Number(object.zIndex) || 0));
  const sourceGroups = new Set(selected.map(getGroupId).filter(Boolean));
  const sourceGroupId = sourceGroups.size === 1 ? [...sourceGroups][0] : null;
  const shouldCreateGroup = selected.length > 1 && Boolean(sourceGroupId) && selected.every((object) => getGroupId(object) === sourceGroupId);
  const newGroupId = shouldCreateGroup ? makeGroupId() : null;
  const newGroupName = shouldCreateGroup ? nextGroupName(objects) : null;

  const copies = selected.map((source, index) => {
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = cloneId(source);
    copy.x = (Number(source.x) || 0) + offset;
    copy.y = (Number(source.y) || 0) + offset;
    copy.zIndex = maxZ + index + 1;
    copy.hidden = false;
    copy.layerName = source.layerName ? `${source.layerName} COPIA` : source.layerName;
    copy.groupId = newGroupId;
    copy.groupName = newGroupName;
    return copy;
  });

  return { objects: copies, ids: copies.map((object) => object.id) };
}
