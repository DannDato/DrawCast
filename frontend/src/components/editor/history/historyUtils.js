export const HISTORY_LIMIT = 50;

export function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* fallback below */ }
  }
  return JSON.parse(JSON.stringify(value));
}

export function objectsEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function fieldChanges(previous, next) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  const fields = [];

  for (const key of keys) {
    const before = previous?.[key];
    const after = next?.[key];
    if (before === after || objectsEqual(before, after)) continue;
    fields.push({ key, before: cloneValue(before), after: cloneValue(after) });
  }

  return fields;
}

export function makeHistoryEntry(beforeScene, afterScene, label = 'Editar') {
  const before = beforeScene || {};
  const after = afterScene || {};
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];

  ids.forEach((id) => {
    const previous = before[id] ?? null;
    const next = after[id] ?? null;
    if (previous === next) return;

    if (previous == null || next == null) {
      if (objectsEqual(previous, next)) return;
      changes.push({
        id,
        kind: previous == null ? 'create' : 'remove',
        before: cloneValue(previous),
        after: cloneValue(next)
      });
      return;
    }

    const fields = fieldChanges(previous, next);
    if (fields.length) changes.push({ id, kind: 'patch', fields });
  });

  if (!changes.length) return null;
  return {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: Date.now(),
    changes
  };
}

export function makeDrawStrokeHistoryEntry(layerId, stroke, label = 'Dibujar trazo') {
  if (!layerId || !stroke?.id) return null;
  return {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: Date.now(),
    changes: [{ id: layerId, kind: 'draw-stroke', stroke: cloneValue(stroke) }]
  };
}

export function pushHistoryEntry(stack, entry, limit = HISTORY_LIMIT) {
  if (!entry) return stack;
  return [...stack, entry].slice(-limit);
}

function patchMatches(object, fields, side) {
  if (!object) return false;
  return fields.every((field) => objectsEqual(object[field.key], field[side]));
}

function applyFields(object, fields, side) {
  const next = { ...object };
  fields.forEach((field) => {
    const value = field[side];
    if (typeof value === 'undefined') delete next[field.key];
    else next[field.key] = cloneValue(value);
  });
  return next;
}

export function applyHistoryEntry(scene, entry, direction = 'undo') {
  const current = scene || {};
  const next = { ...current };
  const upserts = [];
  const removals = [];
  const drawCommits = [];
  const drawRemovals = [];
  const skipped = [];
  const applied = [];

  for (const change of entry?.changes || []) {
    const actual = next[change.id] ?? null;

    if (change.kind === 'draw-stroke') {
      if (!actual || (actual.tipo !== 'draw' && actual.tipo !== 'trazo')) {
        skipped.push(change.id);
        continue;
      }

      const strokes = actual.lineas || [];
      const index = strokes.findIndex((stroke) => stroke?.id === change.stroke?.id);
      if (direction === 'undo') {
        if (index < 0) {
          skipped.push(change.id);
          continue;
        }
        next[change.id] = { ...actual, lineas: strokes.filter((_, strokeIndex) => strokeIndex !== index) };
        drawRemovals.push({ layerId: change.id, strokeId: change.stroke.id });
      } else {
        if (index >= 0) {
          skipped.push(change.id);
          continue;
        }
        const stroke = cloneValue(change.stroke);
        next[change.id] = { ...actual, lineas: [...strokes, stroke] };
        drawCommits.push({ layerId: change.id, stroke });
      }
      applied.push(change.id);
      continue;
    }

    if (change.kind === 'patch') {
      const expectedSide = direction === 'undo' ? 'after' : 'before';
      const replacementSide = direction === 'undo' ? 'before' : 'after';
      if (!patchMatches(actual, change.fields || [], expectedSide)) {
        skipped.push(change.id);
        continue;
      }
      const object = applyFields(actual, change.fields || [], replacementSide);
      next[change.id] = object;
      upserts.push(object);
      applied.push(change.id);
      continue;
    }

    const expected = direction === 'undo' ? change.after : change.before;
    const replacement = direction === 'undo' ? change.before : change.after;
    if (!objectsEqual(actual, expected)) {
      skipped.push(change.id);
      continue;
    }

    if (replacement == null) {
      delete next[change.id];
      removals.push(change.id);
    } else {
      const object = cloneValue(replacement);
      next[change.id] = object;
      upserts.push(object);
    }
    applied.push(change.id);
  }

  return { next, upserts, removals, drawCommits, drawRemovals, skipped, applied };
}
