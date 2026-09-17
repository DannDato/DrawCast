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

export function makeHistoryEntry(beforeScene, afterScene, label = 'Editar') {
  const before = beforeScene || {};
  const after = afterScene || {};
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];

  ids.forEach((id) => {
    const previous = before[id] ?? null;
    const next = after[id] ?? null;
    if (objectsEqual(previous, next)) return;
    changes.push({ id, before: cloneValue(previous), after: cloneValue(next) });
  });

  if (!changes.length) return null;
  return {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: Date.now(),
    changes
  };
}

export function pushHistoryEntry(stack, entry, limit = HISTORY_LIMIT) {
  if (!entry) return stack;
  return [...stack, entry].slice(-limit);
}

export function applyHistoryEntry(scene, entry, direction = 'undo') {
  const current = scene || {};
  const next = { ...current };
  const upserts = [];
  const removals = [];
  const skipped = [];
  const applied = [];

  for (const change of entry?.changes || []) {
    const expected = direction === 'undo' ? change.after : change.before;
    const replacement = direction === 'undo' ? change.before : change.after;
    const actual = current[change.id] ?? null;

    // A collaborator may have edited the same object after this local action.
    // In that case history refuses to overwrite their newer state.
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

  return { next, upserts, removals, skipped, applied };
}
