// Jobb klikk és fejlesztői eszközök gyorsbillentyűinek tiltása.
// FIGYELEM: ez csak elrettentés a hétköznapi felhasználóknak. A böngésző saját menüjéből
// (pl. „További eszközök”) vagy kikapcsolt JavaScripttel megkerülhető; a tartalom valódi védelme
// a szerveren történik (a videó csak érvényes előfizetéssel érhető el).
(function () {
  'use strict';

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Jobb klikk (egér, hosszú érintés, menü billentyű) mindenhol
  ['contextmenu', 'auxclick'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (type === 'auxclick' && e.button !== 2) return;
      stop(e);
    }, true);
  });
  window.oncontextmenu = function () { return false; };
  document.addEventListener('dragstart', stop, true);

  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    var code = e.code || '';
    var ctrl = e.ctrlKey || e.metaKey;
    var blocked =
      e.key === 'F12' || code === 'F12' ||
      // Chrome/Edge/Firefox: Ctrl+Shift+I / J / C / K / E / M (Cmd+Opt+… Mac-en)
      (ctrl && e.shiftKey && ['i', 'j', 'c', 'k', 'e', 'm'].indexOf(key) > -1) ||
      (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].indexOf(key) > -1) ||
      (e.metaKey && e.altKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyU'].indexOf(code) > -1) ||
      // Forrás megtekintése, oldal mentése
      (ctrl && ['u', 's'].indexOf(key) > -1) ||
      // Firefox: Shift+F5/F7/F9 eszközök
      (e.shiftKey && ['F5', 'F7', 'F9'].indexOf(e.key) > -1) ||
      // Menü billentyű, Shift+F10 (helyi menü)
      e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
    if (blocked) stop(e);
  }, true);
})();
