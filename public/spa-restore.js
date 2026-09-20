// A 404.html által a főoldalra irányított cím (/?/plans) visszaállítása a valódi címre (/plans).
// A GitHub Pages nem ismeri az alkalmazás belső útvonalait, ezért a 404.html átirányít, ez pedig helyreállítja a címet.
// Ennek a szkriptnek az index.html-ben az elsők között kell futnia (az alkalmazás előtt).
(function (l) {
  if (l.search[1] === '/') {
    var decoded = l.search
      .slice(1)
      .split('&')
      .map(function (s) { return s.replace(/~and~/g, '&'); })
      .join('?');
    window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
  }
}(window.location));
