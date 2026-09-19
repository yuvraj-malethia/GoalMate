// Runs before the app loads so dark mode and the accent colour apply on first paint.
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('goalmate-ui') || '{}').state || {};
    var t = s.theme || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    if (s.accent) document.documentElement.dataset.accent = s.accent;
  } catch (e) {
    /* storage unavailable: fall back to light theme */
  }
})();
