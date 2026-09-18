export function getThemeColor(name, fallbackName = '--dc-text') {
  if (typeof document === 'undefined') return '';
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue(name).trim() || (fallbackName ? styles.getPropertyValue(fallbackName).trim() : '');
}

export function getCursorThemeColor(slot = 1) {
  const safe = Math.max(1, Math.min(12, Number(slot) || 1));
  return getThemeColor(`--dc-cursor-${safe}`, '--dc-remote-cursor-fallback');
}
