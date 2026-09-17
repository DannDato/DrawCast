const CLIPBOARD_PREFIX = 'DRAWCAST_CLIPBOARD_V1:';
const makeToken = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* fallback below */ }
  }
  return JSON.parse(JSON.stringify(value));
}

function nextId(object) {
  const type = String(object?.tipo || 'object').replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'object';
  return `${type}_${makeToken()}`;
}

function groupMembers(objects, groupId) {
  return Object.values(objects || {}).filter((object) => object?.groupId === groupId);
}

function normalizeCopiedObject(object, objects, selectedSet) {
  const copy = cloneValue(object);
  const groupId = copy.groupId;
  if (groupId) {
    const members = groupMembers(objects, groupId);
    const wholeGroupCopied = members.length > 1 && members.every((member) => selectedSet.has(member.id));
    if (!wholeGroupCopied) {
      copy.groupId = null;
      copy.groupName = null;
    }
  }
  return copy;
}

export function createClipboardPayload(objects, selectedIds) {
  const selectedSet = new Set(selectedIds || []);
  const copied = (selectedIds || [])
    .map((id) => objects?.[id])
    .filter(Boolean)
    .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0))
    .map((object) => normalizeCopiedObject(object, objects, selectedSet));

  if (!copied.length) return null;
  return {
    version: 1,
    source: 'drawcast',
    createdAt: Date.now(),
    objects: copied
  };
}

export function serializeClipboardPayload(payload) {
  if (!payload?.objects?.length) return '';
  return `${CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
}

export function parseClipboardText(text) {
  if (typeof text !== 'string' || !text.startsWith(CLIPBOARD_PREFIX)) return null;
  try {
    const payload = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
    if (payload?.version !== 1 || payload?.source !== 'drawcast' || !Array.isArray(payload.objects) || !payload.objects.length) return null;
    return payload;
  } catch {
    return null;
  }
}

function nextGroupName(sourceName, serial) {
  const base = String(sourceName || 'GRUPO').replace(/\s+(?:COPY|COPIA)(?:\s+\d+)?$/i, '').trim() || 'GRUPO';
  return serial <= 1 ? `${base} COPIA` : `${base} COPIA ${serial}`;
}

function nextLayerName(sourceName, serial) {
  if (!sourceName) return sourceName;
  const base = String(sourceName).replace(/\s+(?:COPY|COPIA)(?:\s+\d+)?$/i, '').trim();
  return serial <= 1 ? `${base} COPIA` : `${base} COPIA ${serial}`;
}

export function materializeClipboardPayload(payload, existingObjects, pasteSerial = 1, offsetStep = 28) {
  if (!payload?.objects?.length) return { objects: [], ids: [] };
  const maxZ = Math.max(0, ...Object.values(existingObjects || {}).map((object) => Number(object.zIndex) || 0));
  const offset = Math.max(1, pasteSerial) * offsetStep;
  const groupMap = new Map();
  const sourceGroups = new Map();

  payload.objects.forEach((object) => {
    if (!object.groupId) return;
    if (!sourceGroups.has(object.groupId)) sourceGroups.set(object.groupId, []);
    sourceGroups.get(object.groupId).push(object);
  });

  const copies = payload.objects.map((source, index) => {
    const copy = cloneValue(source);
    copy.id = nextId(source);
    copy.x = (Number(source.x) || 0) + offset;
    copy.y = (Number(source.y) || 0) + offset;
    copy.zIndex = maxZ + index + 1;
    copy.hidden = false;
    copy.layerName = nextLayerName(source.layerName, pasteSerial);

    if (source.groupId && (sourceGroups.get(source.groupId)?.length || 0) > 1) {
      if (!groupMap.has(source.groupId)) {
        groupMap.set(source.groupId, {
          id: `group_${makeToken()}`,
          name: nextGroupName(source.groupName, pasteSerial)
        });
      }
      const mapped = groupMap.get(source.groupId);
      copy.groupId = mapped.id;
      copy.groupName = mapped.name;
    } else {
      copy.groupId = null;
      copy.groupName = null;
    }

    return copy;
  });

  return { objects: copies, ids: copies.map((object) => object.id) };
}
