const KEY = 'pendingVerifyAccess';
const TTL_MS = 15 * 60 * 1000;

export function setPendingVerifyAccess(payload) {
  sessionStorage.setItem(KEY, JSON.stringify({
    challengeId: payload.challengeId,
    emailHint: payload.emailHint || 'tu correo',
    resendAvailableAt: Date.now() + Number(payload.resendAvailableInSeconds || 60) * 1000,
    createdAt: Date.now()
  }));
}

export function getPendingVerifyAccess() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!value?.challengeId || !value?.createdAt || Date.now() - value.createdAt > TTL_MS) {
      clearPendingVerifyAccess();
      return null;
    }
    return value;
  } catch {
    clearPendingVerifyAccess();
    return null;
  }
}

export function updatePendingVerifyAccess(values) {
  const current = getPendingVerifyAccess();
  if (!current) return;
  sessionStorage.setItem(KEY, JSON.stringify({ ...current, ...values }));
}

export function clearPendingVerifyAccess() {
  sessionStorage.removeItem(KEY);
}
