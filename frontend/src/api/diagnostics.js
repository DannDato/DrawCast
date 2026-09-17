import api from './axios';

export async function getConnectionDiagnostics({ signal } = {}) {
  const startedAt = performance.now();
  const response = await api.get('/health/diagnostics', {
    signal,
    params: { t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  });
  return {
    ...response.data,
    roundTripMs: Math.max(0, performance.now() - startedAt)
  };
}
