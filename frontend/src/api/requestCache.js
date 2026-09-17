const cache = new Map();
const inflight = new Map();

function now() {
  return Date.now();
}

export async function cachedRequest(key, loader, { ttl = 1500, force = false } = {}) {
  const current = cache.get(key);
  if (!force && current && current.expiresAt > now()) return current.value;
  if (!force && inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expiresAt: now() + Math.max(0, Number(ttl) || 0) });
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateRequestCache(keyOrPrefix) {
  const prefix = String(keyOrPrefix || '');
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix)) cache.delete(key);
  }
}
