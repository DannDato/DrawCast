let rootComputedStyles = null;

function getRootComputedStyles() {
  if (typeof document === 'undefined') return null;
  if (!rootComputedStyles) rootComputedStyles = getComputedStyle(document.documentElement);
  return rootComputedStyles;
}

export function getThemeColor(name, fallbackName = '--dc-text') {
  const styles = getRootComputedStyles();
  if (!styles) return '';
  return styles.getPropertyValue(name).trim() || (fallbackName ? styles.getPropertyValue(fallbackName).trim() : '');
}

export function getCursorThemeColor(slot = 1) {
  const safe = Math.max(1, Math.min(12, Number(slot) || 1));
  return getThemeColor(`--dc-cursor-${safe}`, '--dc-remote-cursor-fallback');
}
