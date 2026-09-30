const operations = new Map();
const listeners = new Set();
const idle = { active: false, message: 'Cargando...' };
let snapshot = idle;
let hideTimer;

function publish() {
  const messages = [...operations.values()];
  snapshot = { active: messages.length > 0, message: messages.length ? messages[messages.length - 1] : snapshot.message };
  listeners.forEach((listener) => listener());
}

export function subscribeLoading(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getLoadingSnapshot = () => snapshot;

export function startLoading(message = 'Cargando...') {
  const token = Symbol('loading');
  clearTimeout(hideTimer);
  operations.set(token, message);
  publish();

  return () => {
    if (!operations.delete(token)) return;
    if (operations.size) publish();
    else hideTimer = setTimeout(publish, 250);
  };
}

export async function withLoading(action, message) {
  const finish = startLoading(message);
  try {
    return await action();
  } finally {
    finish();
  }
}
