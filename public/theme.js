// Szinkron betöltődik a <head>-ben, hogy ne villanjon fel rossz téma.
(function () {
  var KT = 'impix.theme', KA = 'impix.accent';
  var THEMES = ['dark', 'light', 'auto'];
  var ACCENTS = ['red', 'blue', 'purple', 'green', 'orange'];
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read(k, def, allowed) {
    try { var v = localStorage.getItem(k); return allowed.indexOf(v) > -1 ? v : def; } catch (e) { return def; }
  }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* tiltott tárhely */ } }

  function apply() {
    var theme = read(KT, 'dark', THEMES);
    var effective = theme === 'auto' ? (mq && !mq.matches ? 'light' : 'dark') : theme;
    document.documentElement.dataset.theme = effective;
    document.documentElement.dataset.accent = read(KA, 'red', ACCENTS);
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);

  window.ImpixTheme = {
    THEMES: THEMES,
    ACCENTS: ACCENTS,
    get theme() { return read(KT, 'dark', THEMES); },
    get accent() { return read(KA, 'red', ACCENTS); },
    get effective() { return document.documentElement.dataset.theme; },
    set: function (theme, accent) {
      if (THEMES.indexOf(theme) > -1) write(KT, theme);
      if (ACCENTS.indexOf(accent) > -1) write(KA, accent);
      apply();
    },
  };
  apply();
})();
