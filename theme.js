const ThemeManager = (() => {
  const STORAGE_KEY = 'sidebar_theme';
  const DEFAULTS = { text: '#333333', bg: '#ffffff', primary: '#fbeb98', primaryText: '#333333' };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(theme) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }

  function _darken(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - 30);
    const g = Math.max(0, ((n >> 8) & 0xff) - 30);
    const b = Math.max(0, (n & 0xff) - 30);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function _lighten(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const mix = (c) => Math.min(255, Math.round(c * 0.1 + 255 * 0.9));
    const r = mix(n >> 16);
    const g = mix((n >> 8) & 0xff);
    const b = mix(n & 0xff);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function _toRgba(hex, alpha) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${n >> 16},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
  }

  function apply(theme) {
    const root = document.documentElement;
    root.style.setProperty('--color-text', theme.text);
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-hover', _darken(theme.primary));
    root.style.setProperty('--color-primary-light', _lighten(theme.primary));
    root.style.setProperty('--color-primary-text', theme.primaryText);
    root.style.setProperty('--color-primary-text-muted', _toRgba(theme.primaryText, 0.7));
  }

  // 로드 시 즉시 적용
  apply(load());

  // 부모(sidebar.js)에서 postMessage로 전달받은 테마 업데이트 반영
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'theme-update') {
      apply(e.data.theme);
    }
  });

  return { load, save, apply, DEFAULTS };
})();
