'use strict';

/* ==========================================================
   Impix – kliensoldali alkalmazás (hash-alapú útvonalkezelés)
   ========================================================== */

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $modal = document.getElementById('modal-root');
const $toasts = document.getElementById('toasts');

// payments: 'stripe' (kártyás fizetés), 'demo' (ingyenes teszt), 'off' (nincs beállítva)
const state = { user: null, sub: null, plans: null, returnTo: null, newRecs: 0, payments: 'off' };

// ---------- Sablonkezelés: minden érték alapból escape-elt ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const raw = (s) => ({ __html: s });
function render(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (typeof v === 'object' && '__html' in v) return v.__html;
  return esc(v);
}
const html = (strings, ...vals) => raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? render(vals[i]) : ''), ''));

// ---------- Segédek ----------

// Az API címe a config.js-ből jön. Üres = ugyanaz a szerver szolgálja ki az oldalt és az API-t (süti alapú belépés).
// Kitöltve (pl. GitHub Pages + külön szerver) = tokenes belépés Authorization fejlécben, süti nélkül.
const API_BASE = String((window.IMPIX_CONFIG && window.IMPIX_CONFIG.apiBase) || '').replace(/\/+$/, '');
const CROSS_ORIGIN = API_BASE !== '';
const TOKEN_KEY = 'impix.token';

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* tiltott tárhely */ } };
const authHeaders = () => (CROSS_ORIGIN && getToken() ? { Authorization: `Bearer ${getToken()}` } : {});
// A feltöltött videók a szerver címén érhetők el (a szerver aláírt, lejáró linket ad)
const mediaUrl = (u) => (u && u.startsWith('/media/') ? API_BASE + u : u);

async function api(path, { method = 'GET', body } = {}) {
  const init = { method, credentials: CROSS_ORIGIN ? 'omit' : 'same-origin', headers: authHeaders() };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }
  if (CROSS_ORIGIN && (path === '/login' || path === '/register')) init.headers['X-Impix-Token'] = '1';
  const res = await fetch(API_BASE + '/api' + path, init);
  let data = null;
  try { data = await res.json(); } catch { /* üres válasz */ }
  if (!res.ok) {
    if (res.status === 401 && CROSS_ORIGIN && getToken()) setToken(null); // lejárt vagy érvénytelen token
    const err = new Error((data && data.error) || 'Hiba történt.');
    err.status = res.status;
    throw err;
  }
  if (data && data.token) { setToken(data.token); delete data.token; }
  return data;
}

const fmtDate = (ms) => new Date(ms).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtDateShort = (ms) => new Date(ms).toLocaleDateString('hu-HU');
const fmtMoney = (n) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft';
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fromDateInput = (s) => new Date(`${s}T23:59:59`).getTime();

const STATE_LABEL = { active: 'Aktív', cancelled: 'Lemondva', expired: 'Lejárt' };
const stateBadge = (s) => html`<span class="badge ${s || 'none'}">${STATE_LABEL[s] || 'Nincs'}</span>`;
const PAY_KIND = {
  subscribe: 'Előfizetés', renew: 'Megújítás', admin_grant: 'Admin által adva', admin_renew: 'Admin által megújítva',
  stripe_subscribe: 'Előfizetés (bankkártya)', stripe_renew: 'Automatikus megújítás (bankkártya)',
};
const QUALITY_NAME = { 720: 'HD', 1080: 'Full HD', 2160: '4K' };
const QUALITY_FULL = { 720: 'HD (720p)', 1080: 'Full HD (1080p)', 2160: 'Ultra HD (4K)' };

const hasAccess = () => !!state.user && (state.user.role === 'admin' || (!!state.sub && state.sub.state !== 'expired'));
const page = (view, mounted) => ({ html: view, mounted });

function toast(message, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  $toasts.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function refreshMe() {
  const d = await api('/me');
  state.user = d.user;
  state.sub = d.subscription;
  state.newRecs = d.newRecommendations || 0;
  state.payments = d.payments || 'off';
  return d;
}
async function getPlans(force) {
  if (!state.plans || force) state.plans = await api('/plans');
  return state.plans;
}
function applyServerPrefs(user) {
  const p = user && user.prefs;
  if (p && p.theme && p.accent) ImpixTheme.set(p.theme, p.accent);
}

// ---------- Vizuális elemek ----------

const poster = (t) => html`
  <div class="poster" style="--h:${t.hue}">
    <span class="poster-badge">${t.type === 'series' ? 'Sorozat' : 'Film'}</span>
    <strong>${t.title}</strong>
  </div>`;

const HEART = raw('<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1 4.2 2.3h.1C11.1 6 12.5 5 14.500 5c3.300 0 5.100 3.400 3.600 6.800C19.500 16.400 12 21 12 21z"/></svg>');

const favButton = (t, cls = '') => html`
  <button class="fav-btn ${cls} ${t.fav ? 'on' : ''}" data-action="toggleFav" data-id="${t.id}"
    aria-pressed="${t.fav ? 'true' : 'false'}" aria-label="Kedvencekhez adás" title="${t.fav ? 'Eltávolítás a kedvencekből' : 'Kedvencekhez adás'}">${HEART}</button>`;

const tile = (t) => html`
  <div class="tile-wrap">
    <a class="tile" href="#/title/${t.id}" aria-label="${t.title}">
      ${poster(t)}
      <div class="tile-meta">${t.year} · ${t.genre} · ${ageLabel(t.age)}</div>
    </a>
    ${favButton(t, 'on-tile')}
  </div>`;

const ageLabel = (a) => (a === 0 ? 'Korhatár nélkül' : `${a}+`);

const titleMeta = (t) => html`
  <div class="meta">
    <span>★ ${Number(t.rating).toFixed(1)}</span>
    <span>${t.year}</span>
    <span class="age" title="Ajánlott életkor">${ageLabel(t.age)}</span>
    <span>${t.genre}</span>
    <span>${t.type === 'movie' ? `${t.duration_min} perc` : `${t.episode_count} epizód`}</span>
    ${t.best_quality && html`<span class="quality-tag" title="A legjobb elérhető minőség (a csomagod szerint nézhető ennél lehet kevesebb)">${QUALITY_NAME[t.best_quality]}</span>`}
  </div>`;

const loading = () => html`<div class="loading">Betöltés…</div>`;
const emptyBox = (msg) => html`<div class="empty">${msg}</div>`;

// ---------- Útvonalkezelés ----------

const routes = [
  [/^\/$/, [], homePage],
  [/^\/login$/, [], loginPage],
  [/^\/register$/, [], registerPage],
  [/^\/plans$/, [], plansPage],
  [/^\/browse\/(all|movie|series)$/, ['type'], browsePage, 'auth'],
  [/^\/search(?:\/(.*))?$/, ['q'], searchPage, 'auth'],
  [/^\/favorites$/, [], favoritesPage, 'auth'],
  [/^\/recommend$/, [], recommendPage, 'auth'],
  [/^\/title\/(\d+)$/, ['id'], titlePage, 'auth'],
  [/^\/watch\/(\d+)(?:\/(\d+))?$/, ['id', 'ep'], watchPage, 'auth'],
  [/^\/checkout\/(\d+)$/, ['id'], checkoutPage, 'auth'],
  [/^\/payment\/return$/, [], paymentReturnPage, 'auth'],
  [/^\/account$/, [], accountPage, 'auth'],
  [/^\/admin(?:\/(\w+))?$/, ['tab'], adminPage, 'admin'],
];

let navId = 0;
let lastPath = null;

function currentRoute() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  return { path, query: new URLSearchParams(qs || '') };
}

async function route(keepScroll = false) {
  const my = ++navId;
  closeModal(true);
  const { path, query } = currentRoute();
  let handler = null;
  let params = { query };
  let guard = null;

  for (const [re, keys, fn, g] of routes) {
    const m = re.exec(path);
    if (m) { keys.forEach((k, i) => { params[k] = m[i + 1]; }); handler = fn; guard = g; break; }
  }

  if (guard && !state.user) { state.returnTo = location.hash || '#/'; location.hash = '#/login'; return; }
  if (guard === 'admin' && state.user.role !== 'admin') { location.hash = '#/'; return; }

  if (!path.startsWith('/watch/')) stopWatching(); // a lejátszó oldalról kilépve felszabadul a képernyő
  renderNav();
  if (path !== lastPath) $app.innerHTML = loading().__html;

  try {
    const result = handler ? await handler(params) : page(html`<div class="page center"><h1>404</h1><p class="muted">Ez az oldal nem található.</p><a class="btn" href="#/">Vissza a főoldalra</a></div>`);
    if (my !== navId) return;
    $app.innerHTML = result.html.__html;
    if (result.mounted) result.mounted();
    if (state.user && state.user.role === 'admin') renderNav(); // az ajánlás-jelvény frissítése
  } catch (err) {
    if (my !== navId) return;
    if (err.status === 401) {
      state.user = null; state.sub = null;
      state.returnTo = location.hash;
      location.hash = '#/login';
      return;
    }
    $app.innerHTML = html`<div class="page center"><h1>Hoppá!</h1><p class="muted">${err.message}</p><a class="btn" href="#/">Főoldal</a></div>`.__html;
  }

  if (!keepScroll && path !== lastPath) { window.scrollTo(0, 0); }
  lastPath = path;
  document.title = 'Impix';
}
const refresh = () => route(true);

// Ugyanarra a hash-re navigálva nincs hashchange esemény, ilyenkor kézzel frissítünk.
function goTo(hash) {
  if (location.hash === hash || (!location.hash && hash === '#/')) route();
  else location.hash = hash;
}

// ---------- Navigáció ----------

const svgIcon = (d) => raw(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
const ICON_SUN = svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
const ICON_MOON = svgIcon('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>');

function renderNav() {
  const { path } = currentRoute();
  const u = state.user;
  const link = (href, label) => html`<a href="#${href}" class="${(href === '/' ? path === '/' : path.startsWith(href)) ? 'active' : ''}">${label}</a>`;
  const links = html`
    ${u && link('/', 'Főoldal')}
    ${u && link('/browse/movie', 'Filmek')}
    ${u && link('/browse/series', 'Sorozatok')}
    ${u && link('/search', 'Keresés')}
    ${u && link('/favorites', 'Kedvencek')}
    ${u && link('/recommend', 'Ajánlás')}
    ${link('/plans', 'Csomagok')}
    ${u && u.role === 'admin' && link('/admin', html`Admin${state.newRecs > 0 && html` <span class="count-badge" title="Új ajánlások">${state.newRecs}</span>`}`)}`;
  const dark = ImpixTheme.effective === 'dark';

  $nav.innerHTML = html`
    <header class="nav">
      <a class="logo" href="#/" aria-label="Impix főoldal">IMPIX</a>
      <nav class="nav-links" aria-label="Fő navigáció">${links}</nav>
      <div class="nav-spacer"></div>
      ${u && html`<form class="nav-search" data-form="search" role="search">
        <input type="search" name="q" placeholder="Keresés…" aria-label="Keresés" autocomplete="off">
      </form>`}
      <div class="nav-right">
        <button class="icon-btn" data-action="toggleTheme" title="${dark ? 'Világos téma' : 'Sötét téma'}" aria-label="Téma váltása">${dark ? ICON_SUN : ICON_MOON}</button>
        ${u ? html`
          <div class="menu">
            <button class="avatar" data-action="toggleMenu" aria-label="Fiók menü">${u.name.trim()[0].toUpperCase()}</button>
            <div class="menu-panel">
              <div class="menu-head"><strong>${u.name}</strong><small>${u.email}</small></div>
              <a href="#/account">Fiók és előfizetés</a>
              ${u.role === 'admin' && html`<a href="#/admin">Admin panel</a>`}
              <button data-action="logout">Kijelentkezés</button>
            </div>
          </div>` : html`
          <a class="btn ghost" href="#/login">Belépés</a>
          <a class="btn primary" href="#/register">Regisztráció</a>`}
      </div>
    </header>
    <div class="mobile-links">${links}</div>`.__html;
}

// ---------- Modal ----------

let confirmResolve = null;
let modalCtx = null;

function showModal(content, wide = false) {
  $modal.innerHTML = html`<div class="modal-backdrop" data-action="backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${content}</div></div>`.__html;
  const first = $modal.querySelector('input:not([type=hidden]), select, textarea, button.primary');
  if (first) first.focus();
}
let onModalClose = null;
// silent: navigációkor a záráskori visszahívás nem fut le (különben végtelen frissítés lenne)
function closeModal(silent = false) {
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
  const cb = onModalClose;
  modalCtx = null;
  onModalClose = null;
  $modal.innerHTML = '';
  if (cb && !silent) cb();
}

function confirmDialog(message, { okLabel = 'Igen', danger = false } = {}) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    showModal(html`
      <h2>Megerősítés</h2>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-action="confirmNo">Mégse</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-action="confirmYes">${okLabel}</button>
      </div>`);
  });
}

function fieldHtml(f) {
  const id = `f_${f.name}`;
  const showIf = f.showIf ? `data-showif="${esc(f.showIf.name)}=${esc(f.showIf.value)}"` : '';
  const val = f.value ?? '';
  let control;
  if (f.type === 'select') {
    control = html`<select id="${id}" name="${f.name}">${f.options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(val) ? raw('selected') : ''}>${o.label}</option>`)}</select>`;
  } else if (f.type === 'textarea') {
    control = html`<textarea id="${id}" name="${f.name}" ${f.max ? raw(`maxlength="${+f.max}"`) : ''}>${val}</textarea>`;
  } else if (f.type === 'video') {
    control = html`
      <input id="${id}" name="${f.name}" type="text" value="${val}" maxlength="500" placeholder="https://videa.hu/videok/… vagy közvetlen .mp4 link" autocomplete="off">
      <div class="upload-row">
        <label class="btn sm" for="${id}_file">Videófájl feltöltése</label>
        <input class="sr-only" type="file" id="${id}_file" data-upload-for="${f.name}" accept=".mp4,.m4v,.webm,.ogv,video/mp4,video/webm,video/ogg">
        <span class="upload-status muted" aria-live="polite"></span>
      </div>
      <progress class="hidden" max="100" value="0"></progress>`;
  } else if (f.type === 'checkbox') {
    return html`<div class="field check" ${raw(showIf)}><input type="checkbox" id="${id}" name="${f.name}" ${val ? raw('checked') : ''}><label for="${id}">${f.label}</label></div>`;
  } else {
    control = html`<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${val}"
      ${f.min !== undefined ? raw(`min="${+f.min}"`) : ''} ${f.max !== undefined ? raw(`max="${+f.max}"`) : ''}
      ${f.step ? raw(`step="${esc(f.step)}"`) : ''} ${f.required === false ? '' : raw('required')}>`;
  }
  return html`<div class="field" ${raw(showIf)}><label for="${id}">${f.label}</label>${control}${f.hint && html`<span class="hint">${f.hint}</span>`}</div>`;
}

function openForm({ title, fields, submit = 'Mentés', note, wide, onSubmit, back }) {
  modalCtx = { fields, onSubmit, back };
  showModal(html`
    <h2>${title}</h2>
    ${note && html`<p class="muted">${note}</p>`}
    <form class="form" data-form="modal" novalidate>
      <div class="${wide ? 'grid-2' : 'form'}">${fields.map(fieldHtml)}</div>
      <p class="form-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="formCancel">Mégse</button>
        <button class="btn primary">${submit}</button>
      </div>
    </form>`, wide);
  syncShowIf();
}

// Egy mező láthatósága egy másik mező értékétől függhet (pl. film vs. sorozat)
function syncShowIf() {
  const form = $modal.querySelector('form[data-form="modal"]');
  if (!form) return;
  form.querySelectorAll('[data-showif]').forEach((el) => {
    const [name, value] = el.dataset.showif.split('=');
    const src = form.elements[name];
    el.classList.toggle('hidden', !src || src.value !== value);
  });
}

const fmtSize = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);

function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API_BASE}/api/admin/upload?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Impix-Upload', '1');
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* nem JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(new Error((data && data.error) || 'A feltöltés nem sikerült.'));
    };
    xhr.onerror = () => reject(new Error('A feltöltés megszakadt (hálózati hiba).'));
    xhr.send(file);
  });
}

async function handleUpload(input) {
  const file = input.files[0];
  const ctx = modalCtx;
  if (!file || !ctx) return;
  const form = input.closest('form');
  const field = input.closest('.field');
  const status = field.querySelector('.upload-status');
  const bar = field.querySelector('progress');
  ctx.uploading = (ctx.uploading || 0) + 1;
  bar.classList.remove('hidden');
  bar.value = 0;
  status.textContent = `Feltöltés: ${file.name}…`;
  try {
    const res = await uploadVideo(file, (p) => { bar.value = p; status.textContent = `Feltöltés: ${p}%`; });
    form.elements[input.dataset.uploadFor].value = res.url;
    status.textContent = `Feltöltve: ${file.name} (${fmtSize(res.size)})`;
  } catch (err) {
    status.textContent = '';
    toast(err.message, 'error');
  } finally {
    ctx.uploading -= 1;
    bar.classList.add('hidden');
    input.value = '';
  }
}

function readModalValues(form) {
  const out = {};
  for (const f of modalCtx.fields) {
    const el = form.elements[f.name];
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'number') out[f.name] = el.value === '' ? '' : Number(el.value);
    else out[f.name] = el.value;
  }
  return out;
}

// ---------- Eseménykezelés (delegált) ----------

const actions = {};
const forms = {};
const changes = {};

document.addEventListener('click', async (e) => {
  if (!e.target.closest('.menu')) document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'backdrop' && e.target !== el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  try { await fn(el, e); } catch (err) { toast(err.message, 'error'); }
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const handler = forms[form.dataset.form];
  if (!handler) return;
  const btn = form.querySelector('button:not([type=button])');
  const errBox = form.querySelector('.form-error');
  if (errBox) errBox.textContent = '';
  if (btn) btn.disabled = true;
  try {
    await handler(Object.fromEntries(new FormData(form)), form);
  } catch (err) {
    if (errBox) errBox.textContent = err.message; else toast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.matches && e.target.matches('[data-upload-for]')) { handleUpload(e.target); return; }
  if (e.target.closest('form[data-form="modal"]')) syncShowIf();
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) {
    try { await changes[el.dataset.change](el); } catch (err) { toast(err.message, 'error'); }
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
window.addEventListener('hashchange', () => route());

Object.assign(actions, {
  retryWatch: () => refresh(),
  closeModal: () => closeModal(),
  formCancel: () => (modalCtx && modalCtx.back ? modalCtx.back() : closeModal()),
  backdrop: () => closeModal(),
  confirmYes: () => { const r = confirmResolve; confirmResolve = null; $modal.innerHTML = ''; r && r(true); },
  confirmNo: () => closeModal(),
  toggleMenu: (el) => el.closest('.menu').classList.toggle('open'),

  async logout() {
    try { await api('/logout', { method: 'POST' }); } finally { setToken(null); }
    state.user = null; state.sub = null;
    goTo('#/');
    toast('Sikeresen kijelentkeztél.');
  },

  async toggleTheme() {
    await setAppearance(ImpixTheme.effective === 'dark' ? 'light' : 'dark', ImpixTheme.accent);
  },
  setTheme: (el) => setAppearance(el.dataset.v, ImpixTheme.accent),
  setAccent: (el) => setAppearance(ImpixTheme.theme, el.dataset.v),
});

async function setAppearance(theme, accent) {
  ImpixTheme.set(theme, accent);
  renderNav();
  if (state.user) {
    api('/me/prefs', { method: 'PATCH', body: { theme, accent } }).catch(() => {});
    state.user.prefs = { theme, accent };
  }
  if (currentRoute().path === '/account') refresh();
}

forms.search = (data) => {
  const q = (data.q || '').trim();
  if (q) location.hash = '#/search/' + encodeURIComponent(q);
};

// ==========================================================
//  Hitelesítés
// ==========================================================

function afterAuth(data) {
  state.user = data.user;
  state.sub = data.subscription;
  applyServerPrefs(data.user);
  const to = state.returnTo || '#/';
  state.returnTo = null;
  goTo(to);
  toast(`Szia, ${data.user.name}!`);
}

function loginPage() {
  if (state.user) { location.hash = '#/'; return page(loading()); }
  return page(html`
    <div class="page narrow">
      <div class="card">
        <h1 class="page-title">Belépés</h1>
        <form class="form" data-form="login">
          <div class="field"><label for="email">E-mail cím</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Jelszó</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
          <p class="form-error" role="alert"></p>
          <button class="btn primary lg">Belépés</button>
        </form>
        <p class="muted center" style="margin:18px 0 0">Még nincs fiókod? <a href="#/register" style="color:var(--accent)">Regisztrálj</a></p>
      </div>
    </div>`);
}
forms.login = async (data) => {
  const res = await api('/login', { method: 'POST', body: data });
  await refreshMe(); // admin: az új ajánlások száma a menühöz
  afterAuth(res);
};

function registerPage() {
  if (state.user) { location.hash = '#/'; return page(loading()); }
  return page(html`
    <div class="page narrow">
      <div class="card">
        <h1 class="page-title">Fiók létrehozása</h1>
        <form class="form" data-form="register">
          <div class="field"><label for="name">Név</label><input id="name" name="name" autocomplete="name" minlength="2" maxlength="60" required></div>
          <div class="field"><label for="email">E-mail cím</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="password">Jelszó</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required><span class="hint">Legalább 8 karakter.</span></div>
          <div class="field"><label for="password2">Jelszó megerősítése</label><input id="password2" name="password2" type="password" autocomplete="new-password" required></div>
          <p class="form-error" role="alert"></p>
          <button class="btn primary lg">Regisztráció</button>
        </form>
        <p class="muted center" style="margin:18px 0 0">Már van fiókod? <a href="#/login" style="color:var(--accent)">Belépés</a></p>
      </div>
    </div>`);
}
forms.register = async ({ name, email, password, password2 }) => {
  if (password !== password2) throw new Error('A két jelszó nem egyezik.');
  // Regisztráció után a csomagválasztás a természetes következő lépés.
  if (!state.returnTo) state.returnTo = '#/plans';
  afterAuth(await api('/register', { method: 'POST', body: { name, email, password } }));
};

// ==========================================================
//  Főoldal, katalógus, tartalom
// ==========================================================

async function homePage() {
  if (!state.user) return landingPage();

  const titles = await api('/titles');
  if (!titles.length) return page(html`<div class="page">${emptyBox('Még nincs feltöltött tartalom.')}</div>`);

  const hero = titles.find((t) => t.featured) || titles[0];
  const byRating = [...titles].sort((a, b) => b.rating - a.rating).slice(0, 12);
  const rail = (name, list) => list.length ? html`
    <section class="rail"><h2>${name}</h2><div class="rail-track">${list.map(tile)}</div></section>` : '';

  const genres = [...new Set(titles.map((t) => t.genre))];
  const subBanner = !hasAccess() && html`
    <div class="banner">
      <div><strong>${state.sub ? 'Az előfizetésed lejárt.' : 'Még nincs előfizetésed.'}</strong>
        <div class="muted">Válassz csomagot, és kezdd el nézni a filmeket és sorozatokat.</div></div>
      <a class="btn primary" href="#/plans">Csomagok megtekintése</a>
    </div>`;

  const favorites = titles.filter((t) => t.fav);

  return page(html`
    <section class="hero" style="--h:${hero.hue}">
      <div class="hero-inner">
        ${titleMeta(hero)}
        <h1>${hero.title}</h1>
        <p>${hero.description}</p>
        <div class="row">
          <a class="btn primary lg" href="${hasAccess() ? `#/watch/${hero.id}` : '#/plans'}">${hasAccess() ? '▶ Lejátszás' : 'Előfizetés a megtekintéshez'}</a>
          <a class="btn lg" href="#/title/${hero.id}">Részletek</a>
        </div>
      </div>
    </section>
    <div class="page">
      ${subBanner}
      ${rail('♥ Kedvenceim', favorites)}
      ${rail('Legjobbra értékelt', byRating)}
      ${rail('Filmek', titles.filter((t) => t.type === 'movie'))}
      ${rail('Sorozatok', titles.filter((t) => t.type === 'series'))}
      ${genres.map((g) => { const l = titles.filter((t) => t.genre === g); return l.length > 1 ? rail(g, l) : ''; })}
    </div>`);
}

async function landingPage() {
  const plans = await getPlans();
  return page(html`
    <section class="landing">
      <div>
        <h1>Filmek és sorozatok, korlátlanul.</h1>
        <p>Nézd, amit szeretsz, bármikor és bárhol. Hozz létre egy fiókot, válassz csomagot, és indulhat a nézés.</p>
        <div class="row" style="justify-content:center">
          <a class="btn primary lg" href="#/register">Kezdjük el</a>
          <a class="btn lg" href="#/login">Belépés</a>
        </div>
      </div>
    </section>
    <div class="page">
      <h2 class="page-title center">Válaszd ki a hozzád illő csomagot</h2>
      <div class="plans">${plans.map((p) => planCard(p, null))}</div>
      <p class="muted center" style="margin-top:20px">Bármikor lemondható. Bemutató verzió: valódi fizetés nem történik.</p>
    </div>`);
}

async function browsePage({ type, query }) {
  const titles = await api(`/titles${type === 'all' ? '' : `?type=${type}`}`);
  return page(catalogView(type === 'movie' ? 'Filmek' : type === 'series' ? 'Sorozatok' : 'Minden tartalom', titles, query, `#/browse/${type}`));
}

// Élő keresés: gépelés közben (rövid késleltetéssel) frissül a találati lista.
const searchState = { type: '', genre: '' };

async function searchPage({ q }) {
  let term = '';
  try { term = q ? decodeURIComponent(q) : ''; } catch { term = q || ''; }
  const genres = [...new Set((await api('/titles')).map((t) => t.genre))].sort();
  if (!genres.includes(searchState.genre)) searchState.genre = '';

  const view = html`
    <div class="page">
      <h1 class="page-title">Keresés</h1>
      <form class="search-big" data-form="searchBig" role="search">
        <input id="search-input" type="search" name="q" value="${term}" placeholder="Film vagy sorozat címe, műfaj, év vagy szó a leírásból…" autocomplete="off" aria-label="Keresés">
      </form>
      <div class="filters" id="search-type">
        ${[['', 'Minden'], ['movie', 'Filmek'], ['series', 'Sorozatok']].map(([v, l]) => html`<button type="button" class="chip ${searchState.type === v ? 'active' : ''}" data-action="searchType" data-v="${v}">${l}</button>`)}
      </div>
      <div class="filters" id="search-genre">
        <button type="button" class="chip ${searchState.genre === '' ? 'active' : ''}" data-action="searchGenre" data-v="">Minden műfaj</button>
        ${genres.map((g) => html`<button type="button" class="chip ${searchState.genre === g ? 'active' : ''}" data-action="searchGenre" data-v="${g}">${g}</button>`)}
      </div>
      <p class="muted" id="search-count" aria-live="polite"></p>
      <div id="search-results"></div>
    </div>`;

  return page(view, () => {
    const input = document.getElementById('search-input');
    let timer = null;
    let seq = 0;
    const run = async () => {
      const my = ++seq;
      const qs = new URLSearchParams();
      if (input.value.trim()) qs.set('q', input.value.trim());
      if (searchState.type) qs.set('type', searchState.type);
      if (searchState.genre) qs.set('genre', searchState.genre);
      let list;
      try { list = await api(`/titles?${qs}`); } catch (err) { toast(err.message, 'error'); return; }
      if (my !== seq || !document.getElementById('search-results')) return;
      document.getElementById('search-count').textContent = `${list.length} találat`;
      document.getElementById('search-results').innerHTML = (list.length
        ? html`<div class="grid-cards">${list.map(tile)}</div>`
        : emptyBox('Nincs a keresésnek megfelelő film vagy sorozat.')).__html;
      const v = input.value.trim();
      history.replaceState(null, '', v ? `#/search/${encodeURIComponent(v)}` : '#/search');
    };
    searchRun = run;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
    run();
    if (!term) input.focus();
  });
}
let searchRun = null;

function refreshSearchChips() {
  document.querySelectorAll('#search-type .chip').forEach((c) => c.classList.toggle('active', c.dataset.v === searchState.type));
  document.querySelectorAll('#search-genre .chip').forEach((c) => c.classList.toggle('active', c.dataset.v === searchState.genre));
}
forms.searchBig = () => searchRun && searchRun();
Object.assign(actions, {
  searchType(el) { searchState.type = el.dataset.v; refreshSearchChips(); searchRun && searchRun(); },
  searchGenre(el) { searchState.genre = el.dataset.v; refreshSearchChips(); searchRun && searchRun(); },

  async toggleFav(el) {
    const id = el.dataset.id;
    const on = !el.classList.contains('on');
    await api(`/favorites/${id}`, { method: on ? 'PUT' : 'DELETE' });
    document.querySelectorAll(`[data-action="toggleFav"][data-id="${id}"]`).forEach((b) => {
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? 'Eltávolítás a kedvencekből' : 'Kedvencekhez adás';
      const label = b.querySelector('.fav-label');
      if (label) label.textContent = on ? 'Kedvenc' : 'Kedvencekhez';
    });
    toast(on ? 'Hozzáadva a kedvencekhez.' : 'Eltávolítva a kedvencekből.');
    if (currentRoute().path === '/favorites') refresh();
  },
});

async function favoritesPage() {
  const titles = await api('/favorites');
  return page(html`
    <div class="page">
      <h1 class="page-title">♥ Kedvenceim</h1>
      ${titles.length
        ? html`<div class="grid-cards">${titles.map(tile)}</div>`
        : html`<div class="empty">Még nincs kedvenc filmed vagy sorozatod.<br>Nyomd meg a ♥ jelet egy borítón, és itt fog megjelenni.<br><br><a class="btn primary" href="#/browse/all">Böngészés</a></div>`}
    </div>`);
}

// ----- Ajánlás -----

const REC_STATUS = { new: ['Elküldve', 'info'], added: ['Felkerült a katalógusba', 'ok'], rejected: ['Elutasítva', 'bad'] };

async function recommendPage() {
  const mine = await api('/recommendations');
  return page(html`
    <div class="page medium">
      <h1 class="page-title">Ajánlj filmet vagy sorozatot</h1>
      <div class="card">
        <p class="muted">Ha hiányzik egy film vagy sorozat, írd meg nekünk! Az ajánlásokat az adminisztrátor átnézi, és ha lehet, felkerülnek az Impixre.</p>
        <form class="form" data-form="recommend">
          <div class="grid-2">
            <div class="field"><label for="r-title">Cím</label><input id="r-title" name="title" maxlength="120" required></div>
            <div class="field"><label for="r-type">Típus</label>
              <select id="r-type" name="type"><option value="movie">Film</option><option value="series">Sorozat</option></select></div>
          </div>
          <div class="field"><label for="r-link">Link (nem kötelező)</label><input id="r-link" name="link" type="url" placeholder="https://…" maxlength="500"><span class="hint">Például a Videa, YouTube vagy IMDb oldala a filmnek.</span></div>
          <div class="field"><label for="r-note">Megjegyzés (nem kötelező)</label><textarea id="r-note" name="note" maxlength="500" placeholder="Miért ajánlod? Miről szól?"></textarea></div>
          <p class="form-error" role="alert"></p>
          <div><button class="btn primary">Ajánlás elküldése</button></div>
        </form>
      </div>
      <div class="card">
        <h2>Az ajánlásaim</h2>
        ${mine.length ? html`<div class="table-wrap"><table>
          <thead><tr><th>Dátum</th><th>Cím</th><th>Típus</th><th>Állapot</th></tr></thead>
          <tbody>${mine.map((r) => html`<tr><td>${fmtDateShort(r.created_at)}</td><td>${r.title}</td><td>${r.type === 'movie' ? 'Film' : 'Sorozat'}</td>
            <td><span class="badge ${REC_STATUS[r.status][1]}">${REC_STATUS[r.status][0]}</span></td></tr>`)}</tbody></table></div>` : emptyBox('Még nem küldtél ajánlást.')}
      </div>
    </div>`);
}
forms.recommend = async (data, form) => {
  await api('/recommendations', { method: 'POST', body: data });
  toast('Köszönjük! Az ajánlásodat elküldtük az adminnak.');
  refresh();
};

function catalogView(heading, titles, query, base) {
  const genre = query.get('g');
  const genres = [...new Set(titles.map((t) => t.genre))].sort();
  const list = genre ? titles.filter((t) => t.genre === genre) : titles;
  return html`
    <div class="page">
      <h1 class="page-title">${heading}</h1>
      <div class="filters">
        <a class="chip ${!genre ? 'active' : ''}" href="${base}">Mind</a>
        ${genres.map((g) => html`<a class="chip ${g === genre ? 'active' : ''}" href="${base}?g=${encodeURIComponent(g)}">${g}</a>`)}
      </div>
      ${list.length ? html`<div class="grid-cards">${list.map(tile)}</div>` : emptyBox('Nincs megjeleníthető tartalom.')}
    </div>`;
}

async function titlePage({ id }) {
  const t = await api(`/titles/${id}`);
  const access = hasAccess();
  const first = t.episodes[0];
  const playHref = t.type === 'movie' ? `#/watch/${t.id}` : first ? `#/watch/${t.id}/${first.id}` : null;

  return page(html`
    <div class="page">
      <div class="detail">
        <div>${poster(t)}</div>
        <div>
          <h1 class="page-title" style="margin-bottom:10px">${t.title}</h1>
          ${titleMeta(t)}
          <p>${t.description}</p>
          <div class="row" style="margin-bottom:28px">
            ${access
              ? (playHref ? html`<a class="btn primary lg" href="${playHref}">▶ Lejátszás</a>` : html`<span class="muted">Ehhez a sorozathoz még nincs epizód.</span>`)
              : html`<a class="btn primary lg" href="#/plans">Előfizetés a megtekintéshez</a>`}
            <button class="btn lg fav-btn ${t.fav ? 'on' : ''}" data-action="toggleFav" data-id="${t.id}" aria-pressed="${t.fav ? 'true' : 'false'}">${HEART} <span class="fav-label">${t.fav ? 'Kedvenc' : 'Kedvencekhez'}</span></button>
            <a class="btn lg" href="#/browse/${t.type}">Vissza</a>
          </div>
          ${t.type === 'series' && t.episodes.length > 0 && html`
            <h2>Epizódok</h2>
            <div class="episode-list">
              ${t.episodes.map((ep) => html`
                <a class="episode" href="${access ? `#/watch/${t.id}/${ep.id}` : '#/plans'}">
                  <span class="num">${ep.season}×${ep.number}</span>
                  <span>${ep.name}</span>
                  <span class="muted" style="margin-left:auto">${access ? '▶' : '🔒'}</span>
                </a>`)}
            </div>`}
        </div>
      </div>
    </div>`);
}

// ---- Egyidejű lejátszások (képernyők) ----
// Minden lejátszó oldal egy azonosítót kap, és 45 másodpercenként jelez a szervernek. A szerver ebből számolja,
// hány képernyőn néz a felhasználó egyszerre. Epizódváltáskor ugyanazt az azonosítót használjuk tovább.
let activeWatch = null; // { stream, timer }
const newStreamId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

function endStream(stream) {
  try {
    fetch(`${API_BASE}/api/watch/end`, {
      method: 'POST', keepalive: true, credentials: CROSS_ORIGIN ? 'omit' : 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ stream }),
    }).catch(() => {});
  } catch { /* a lap már bezáródik */ }
}
function stopWatching() {
  if (!activeWatch) return;
  clearInterval(activeWatch.timer);
  const { stream } = activeWatch;
  activeWatch = null;
  endStream(stream);
}
function startWatching(stream, onDenied) {
  if (activeWatch) clearInterval(activeWatch.timer);
  activeWatch = {
    stream,
    timer: setInterval(async () => {
      try { await api('/watch/ping', { method: 'POST', body: { stream } }); }
      catch (err) { if (err.status === 429 || err.status === 402) onDenied(err); }
    }, 45_000),
  };
}
window.addEventListener('pagehide', () => { if (activeWatch) endStream(activeWatch.stream); });

async function watchPage({ id, ep }) {
  let data;
  const stream = activeWatch ? activeWatch.stream : newStreamId();
  try {
    data = await api(`/watch/${id}?stream=${stream}${ep ? `&episode=${ep}` : ''}`);
  } catch (err) {
    if (err.status === 429) { // túl sok képernyő
      return page(html`
        <div class="page medium"><div class="locked">
          <h1>Túl sok képernyő</h1>
          <p>${err.message}</p>
          <div class="row" style="justify-content:center">
            <button class="btn primary" data-action="retryWatch">Újrapróbálom</button>
            <a class="btn" href="#/plans">Csomagok</a>
          </div>
        </div></div>`);
    }
    if (err.status !== 402) throw err;
    return page(html`
      <div class="page medium"><div class="locked">
        <h1>Előfizetés szükséges</h1>
        <p class="muted">${state.sub ? 'Az előfizetésed lejárt. Új előfizetéssel folytathatod a nézést.' : 'A megtekintéshez válassz egy csomagot.'}</p>
        <a class="btn primary lg" href="#/plans">Csomagok</a>
      </div></div>`);
  }
  const eps = data.episodes;
  const idx = data.episode ? eps.findIndex((e) => e.id === data.episode.id) : -1;
  const next = idx > -1 ? eps[idx + 1] : null;

  return page(html`
    <div class="page">
      <div class="row between" style="margin-bottom:14px">
        <div>
          <h1 class="page-title" style="margin:0">${data.title}</h1>
          ${data.episode && html`<div class="muted">${data.episode.season}. évad ${data.episode.number}. rész – ${data.episode.name}</div>`}
        </div>
        <a class="btn" href="#/title/${id}">← Részletek</a>
      </div>
      <div class="player-wrap ${eps.length ? '' : 'solo'}">
        <div>
          ${data.kind === 'embed'
            ? html`<div class="embed-frame"><iframe id="player" src="${data.url}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${data.title}"></iframe></div>
                <p class="muted" style="font-size:.85rem;margin-top:8px">Külső lejátszó – a következő rész automatikus indítása ennél a videónál nem működik.</p>`
            : html`<video id="player" controls autoplay playsinline controlsList="nodownload noremoteplayback" src="${mediaUrl(data.url)}"></video>`}
          <p id="player-error" class="form-error"></p>
          <div class="row between" style="margin-top:10px">
            <span class="quality-tag" title="A csomagod által adott minőség">${data.qualityLabel}</span>
            ${data.higherQuality && html`<span class="muted" style="font-size:.9rem">Ez a tartalom ${QUALITY_FULL[data.higherQuality]} minőségben is elérhető nagyobb csomaggal. <a href="#/plans" style="color:var(--accent)">Csomagok</a></span>`}
          </div>
        </div>
        ${eps.length > 0 && html`
          <aside><h2>Epizódok</h2><div class="episode-list">
            ${eps.map((e) => html`<a class="episode ${data.episode && e.id === data.episode.id ? 'current' : ''}" href="#/watch/${id}/${e.id}">
              <span class="num">${e.season}×${e.number}</span><span>${e.name}</span></a>`)}
          </div></aside>`}
      </div>
    </div>`, () => {
    const v = document.getElementById('player');
    // Ha közben elfogyott a hely (másik eszközön is elindult a lejátszás), leállítjuk ezt a lejátszót
    startWatching(data.stream, (err) => {
      if (data.kind === 'embed') v.src = 'about:blank';
      else { v.pause(); v.removeAttribute('src'); v.load(); }
      document.getElementById('player-error').textContent = err.status === 402 ? 'Az előfizetésed lejárt.' : err.message;
      stopWatching();
    });
    if (data.kind === 'embed') return;
    v.addEventListener('error', () => { document.getElementById('player-error').textContent = 'A videó nem tölthető be. Próbáld újra később.'; });
    if (next) v.addEventListener('ended', () => { location.hash = `#/watch/${id}/${next.id}`; });
  });
}

// ==========================================================
//  Csomagok, fizetés
// ==========================================================

function planCard(p, sub) {
  const valid = sub && sub.state !== 'expired';
  const isCurrent = valid && sub.plan_id === p.id;
  const blocked = valid && sub.state === 'active' && !isCurrent; // aktív előfizetés mellett nem lehet másik csomagot venni

  let action;
  if (isCurrent && sub.state === 'active') action = html`<button class="btn" disabled>Jelenlegi csomag</button>`;
  else if (blocked) action = html`<button class="btn" disabled title="Csomagváltáshoz előbb mondd le a jelenlegi előfizetésedet">Előbb mondd le a jelenlegit</button>`;
  else action = html`<a class="btn primary" href="#/checkout/${p.id}">${isCurrent ? 'Lemondás visszavonása' : valid ? 'Váltás erre' : 'Előfizetés'}</a>`;

  return html`
    <div class="card plan ${isCurrent ? 'current' : ''}">
      <h2>${p.name}</h2>
      <div class="price">${fmtMoney(p.price)}<small> / hó</small></div>
      <p class="muted">${p.description}</p>
      <ul>
        <li>Legfeljebb <strong>${QUALITY_FULL[p.max_quality] || p.quality}</strong> minőség</li>
        <li><strong>${p.screens}</strong> egyidejű képernyő</li>
        <li>Korlátlan film és sorozat</li>
        <li>Bármikor lemondható</li>
      </ul>
      ${action}
    </div>`;
}

async function plansPage() {
  const plans = await getPlans(true);
  if (state.user) await refreshMe();
  const sub = state.sub;
  const active = sub && sub.state === 'active';
  const cancelled = sub && sub.state === 'cancelled';
  return page(html`
    <div class="page">
      <h1 class="page-title center">Csomagok</h1>
      <p class="muted center" style="margin-bottom:28px">Válaszd ki a számodra megfelelőt. Bármikor lemondható.</p>
      ${active && html`<div class="banner"><div><strong>Van aktív előfizetésed (${sub.plan_name}).</strong>
        <div class="muted">Másik csomagra váltáshoz előbb mondd le a jelenlegit a Fiók oldalon.</div></div>
        <a class="btn" href="#/account">Fiók</a></div>`}
      ${cancelled && html`<div class="banner"><div><strong>Az előfizetésed le van mondva (${fmtDate(sub.expires_at)}-ig érvényes).</strong>
        <div class="muted">Új csomag választásakor az azonnal indul, a jelenlegi hátralévő napjai elvesznek.</div></div></div>`}
      <div class="plans">${plans.map((p) => planCard(p, state.sub))}</div>
      <p class="muted center" style="margin-top:20px;font-size:.88rem">Az előfizetés havonta automatikusan megújul, amíg le nem mondod. A fizetést a Stripe kezeli, a kártyaadataidat mi nem látjuk.</p>
    </div>`);
}

async function checkoutPage({ id }) {
  const plans = await getPlans(true);
  await refreshMe();
  const plan = plans.find((p) => p.id === Number(id));
  if (!plan) return page(html`<div class="page center"><h1>A csomag nem található.</h1><a class="btn" href="#/plans">Vissza</a></div>`);

  const sub = state.sub;
  const valid = sub && sub.state !== 'expired';

  if (state.payments === 'off') {
    return page(html`<div class="page narrow"><div class="card center"><h1>A fizetés még nem elérhető</h1>
      <p class="muted">A bankkártyás fizetés beállítása folyamatban van. Kérjük, nézz vissza később.</p>
      <a class="btn" href="#/plans">Vissza</a></div></div>`);
  }
  // Aktív előfizetés mellett nem lehet másik csomagot venni: előbb le kell mondani
  if (valid && sub.state === 'active') {
    return page(html`<div class="page narrow"><div class="card center"><h1>Van aktív előfizetésed</h1>
      <p>Jelenleg a(z) <strong>${sub.plan_name}</strong> csomagod aktív (${fmtDate(sub.expires_at)}-ig).
        Csomagváltáshoz előbb mondd le, utána választhatsz újat.</p>
      <div class="row" style="justify-content:center"><a class="btn primary" href="#/account">Lemondás a Fiók oldalon</a><a class="btn" href="#/plans">Vissza</a></div></div></div>`);
  }

  const reactivate = valid && sub.plan_id === plan.id && sub.stripe; // lemondott, de még érvényes azonos csomag
  let notice = null;
  if (reactivate) {
    notice = `Az előfizetésed le van mondva, ${fmtDate(sub.expires_at)}-ig érvényes. A lemondás visszavonásával újra automatikusan megújul; most nem kell fizetned.`;
  } else if (valid) {
    notice = `Figyelem: a jelenlegi (${sub.plan_name}) előfizetésed le van mondva, ${fmtDate(sub.expires_at)}-ig érvényes. Az új csomag azonnal indul, a jelenlegi hátralévő napjai elvesznek.`;
  }

  return page(html`
    <div class="page narrow">
      <div class="card">
        <h1 class="page-title">${reactivate ? 'Lemondás visszavonása' : 'Előfizetés'}</h1>
        <div class="row between"><strong>${plan.name}</strong><span>${fmtMoney(plan.price)} / hó</span></div>
        <p class="muted">Legfeljebb ${QUALITY_FULL[plan.max_quality] || plan.quality} minőség · ${plan.screens} egyidejű képernyő</p>
        ${notice && html`<p class="banner" style="margin-bottom:16px">${notice}</p>`}
        ${!reactivate && html`<p class="muted" style="font-size:.9rem">Az előfizetés havonta automatikusan megújul, amíg le nem mondod (a Fiók oldalon bármikor). A bankkártyás fizetést a Stripe kezeli: a kártyaadataidat mi nem látjuk és nem tároljuk.</p>`}
        ${state.payments === 'demo' && html`<p class="muted" style="font-size:.88rem">Bemutató üzemmód: valódi fizetés nem történik.</p>`}
        <form class="form" data-form="checkout" data-plan="${plan.id}">
          <p class="form-error" role="alert"></p>
          <button class="btn primary lg">${reactivate ? 'Lemondás visszavonása' : state.payments === 'demo' ? 'Előfizetés (teszt)' : `Fizetés bankkártyával – ${fmtMoney(plan.price)}`}</button>
          <a class="btn ghost" href="#/plans">Mégse</a>
        </form>
      </div>
    </div>`);
}
forms.checkout = async (data, form) => {
  const planId = Number(form.dataset.plan);
  if (state.payments === 'demo') {
    const res = await api('/subscription', { method: 'POST', body: { planId } });
    state.sub = res.subscription;
    toast('Az előfizetés sikeresen frissítve.');
    goTo('#/account');
    return;
  }
  const res = await api('/checkout', { method: 'POST', body: { planId } });
  if (res.reactivated) {
    state.sub = res.subscription;
    toast('A lemondás visszavonva, az előfizetés újra megújul.');
    goTo('#/account');
    return;
  }
  location.href = res.url; // átirányítás a Stripe biztonságos fizetési oldalára
  await new Promise(() => {}); // a gomb maradjon letiltva az átirányításig
};

// A Stripe-ról visszatérve itt aktiváljuk az előfizetést (a webhooktól függetlenül működik)
async function paymentReturnPage() {
  const sessionId = new URLSearchParams(location.search).get('checkout_session');
  if (!sessionId) {
    return page(html`<div class="page narrow"><div class="card center"><h1>Nincs fizetési azonosító</h1>
      <a class="btn" href="#/plans">Csomagok</a></div></div>`);
  }
  let res;
  try {
    res = await api('/checkout/confirm', { method: 'POST', body: { sessionId } });
  } catch (err) {
    return page(html`<div class="page narrow"><div class="card center"><h1>A fizetés ellenőrzése nem sikerült</h1>
      <p class="muted">${err.message}</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-action="retryPayment">Újrapróbálom</button><a class="btn" href="#/account">Fiók</a></div></div></div>`);
  }
  if (res.status === 'open') {
    history.replaceState(null, '', location.pathname + location.hash);
    return page(html`<div class="page narrow"><div class="card center"><h1>A fizetés nem fejeződött be</h1>
      <p class="muted">Nem történt terhelés. Bármikor újra megpróbálhatod.</p><a class="btn primary" href="#/plans">Csomagok</a></div></div>`);
  }
  if (res.status === 'pending') {
    return page(html`<div class="page narrow"><div class="card center"><h1>A fizetés feldolgozás alatt van</h1>
      <p class="muted">A bank még nem igazolta vissza a fizetést. Ez pár percig is eltarthat, az előfizetésed automatikusan aktív lesz.</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-action="retryPayment">Frissítés</button><a class="btn" href="#/">Főoldal</a></div></div></div>`);
  }
  history.replaceState(null, '', location.pathname + location.hash);
  state.sub = res.subscription;
  const s = res.subscription;
  return page(html`<div class="page narrow"><div class="card center">
    <h1>Sikeres fizetés! 🎉</h1>
    <p>A(z) <strong>${s ? s.plan_name : ''}</strong> előfizetésed aktív${s ? html`, ${fmtDate(s.expires_at)}-ig, utána automatikusan megújul` : ''}.</p>
    <div class="row" style="justify-content:center"><a class="btn primary lg" href="#/">Irány a filmek</a><a class="btn" href="#/account">Fiók</a></div>
  </div></div>`);
}
actions.retryPayment = () => refresh();

// ==========================================================
//  Fiók
// ==========================================================

async function accountPage() {
  const [me, payments] = await Promise.all([refreshMe(), api('/me/payments')]);
  const u = me.user;
  const s = me.subscription;
  const themes = [['dark', 'Sötét'], ['light', 'Világos'], ['auto', 'Automatikus']];
  const accents = [['red', 'Piros'], ['blue', 'Kék'], ['purple', 'Lila'], ['green', 'Zöld'], ['orange', 'Narancs']];

  const demo = me.payments === 'demo';
  const subCard = s ? html`
    <div class="row between">
      <div>
        <div class="row" style="gap:10px"><strong style="font-size:1.3rem">${s.plan_name}</strong> ${stateBadge(s.state)}</div>
        <div class="muted">Legfeljebb ${QUALITY_FULL[s.max_quality] || s.quality} · ${s.screens} egyidejű képernyő · ${fmtMoney(s.price)} / hó</div>
      </div>
    </div>
    <p style="margin:14px 0">${s.state === 'expired'
      ? html`Lejárt: <strong>${fmtDate(s.expires_at)}</strong>`
      : s.state === 'cancelled'
        ? html`Lemondva – a hozzáférésed eddig él: <strong>${fmtDate(s.expires_at)}</strong> (${s.days_left} nap). Utána nem újul meg.`
        : s.renews
          ? html`Automatikusan megújul: <strong>${fmtDate(s.expires_at)}</strong> (${s.days_left} nap múlva), ${fmtMoney(s.price)} a bankkártyádról.`
          : html`Érvényes eddig: <strong>${fmtDate(s.expires_at)}</strong> (${s.days_left} nap). Lejáratkor nem újul meg automatikusan.`}</p>
    <div class="row">
      ${s.state === 'active' && html`<button class="btn danger" data-action="cancelMine">Lemondás</button>`}
      ${s.state === 'cancelled' && html`<a class="btn primary" href="#/checkout/${s.plan_id}">${s.stripe ? 'Lemondás visszavonása' : 'Előfizetés újra'}</a><a class="btn" href="#/plans">Másik csomag választása</a>`}
      ${s.state === 'expired' && html`<a class="btn primary" href="#/plans">Új előfizetés</a>`}
      ${s.stripe && html`<button class="btn" data-action="openPortal">Számlázás kezelése</button>`}
      ${demo && s.state !== 'expired' && html`<button class="btn" data-action="renewMine">Megújítás +30 nap (teszt)</button>`}
    </div>
    ${s.state === 'active' && html`<p class="muted" style="margin:14px 0 0;font-size:.88rem">Másik csomagra váltáshoz előbb mondd le a jelenlegit, utána választhatsz újat.</p>`}`
    : html`<p class="muted">Még nincs előfizetésed.</p><a class="btn primary" href="#/plans">Csomag választása</a>`;

  return page(html`
    <div class="page medium">
      <h1 class="page-title">Fiók</h1>
      <div class="card"><h2>Előfizetés</h2>${subCard}</div>

      <div class="card">
        <h2>Megjelenés</h2>
        <p class="muted">A beállítás a fiókodhoz kötődik, így minden eszközön megmarad.</p>
        <h3 style="font-size:.95rem">Téma</h3>
        <div class="choice-row" style="margin-bottom:18px">
          ${themes.map(([v, l]) => html`<button class="choice ${ImpixTheme.theme === v ? 'selected' : ''}" data-action="setTheme" data-v="${v}">${l}</button>`)}
        </div>
        <h3 style="font-size:.95rem">Kiemelő szín</h3>
        <div class="choice-row">
          ${accents.map(([v, l]) => html`<button class="swatch ${ImpixTheme.accent === v ? 'selected' : ''}" data-c="${v}" data-action="setAccent" data-v="${v}" title="${l}" aria-label="${l}"></button>`)}
        </div>
      </div>

      <div class="card">
        <h2>Profil</h2>
        <form class="form" data-form="profile">
          <div class="grid-2">
            <div class="field"><label for="pname">Név</label><input id="pname" name="name" value="${u.name}" minlength="2" maxlength="60" required></div>
            <div class="field"><label>E-mail cím</label><input value="${u.email}" disabled></div>
          </div>
          <p class="form-error" role="alert"></p>
          <div><button class="btn">Mentés</button></div>
        </form>
      </div>

      <div class="card">
        <h2>Jelszó módosítása</h2>
        <form class="form" data-form="password">
          <div class="grid-2">
            <div class="field"><label for="cp">Jelenlegi jelszó</label><input id="cp" name="currentPassword" type="password" autocomplete="current-password" required></div>
            <div class="field"><label for="np">Új jelszó</label><input id="np" name="newPassword" type="password" autocomplete="new-password" minlength="8" required></div>
          </div>
          <p class="form-error" role="alert"></p>
          <div><button class="btn">Jelszó módosítása</button></div>
        </form>
      </div>

      <div class="card">
        <h2>Fizetési előzmények</h2>
        ${payments.length ? html`
          <div class="table-wrap"><table>
            <thead><tr><th>Dátum</th><th>Csomag</th><th>Típus</th><th>Összeg</th></tr></thead>
            <tbody>${payments.map((p) => html`<tr><td>${fmtDateShort(p.created_at)}</td><td>${p.plan_name}</td><td>${PAY_KIND[p.kind] || p.kind}</td><td>${fmtMoney(p.amount)}</td></tr>`)}</tbody>
          </table></div>` : emptyBox('Még nincs fizetés.')}
      </div>
    </div>`);
}

forms.profile = async (data) => {
  await api('/me', { method: 'PATCH', body: { name: data.name } });
  await refreshMe();
  renderNav();
  toast('Profil mentve.');
};
forms.password = async (data, form) => {
  await api('/me/password', { method: 'POST', body: data });
  form.reset();
  toast('A jelszó megváltozott.');
};
Object.assign(actions, {
  async openPortal() {
    const res = await api('/billing/portal', { method: 'POST' });
    location.href = res.url; // a Stripe számlázási portál (kártya módosítása, számlák)
  },
  async renewMine() {
    const res = await api('/subscription/renew', { method: 'POST' });
    state.sub = res.subscription;
    toast('Az előfizetés megújítva 30 nappal.');
    refresh();
  },
  async cancelMine() {
    if (!(await confirmDialog('Biztosan lemondod? A már kifizetett időszak végéig még nézheted a tartalmakat, utána az előfizetés nem újul meg és nem terheljük a kártyádat.', { okLabel: 'Lemondás', danger: true }))) return;
    const res = await api('/subscription/cancel', { method: 'POST' });
    state.sub = res.subscription;
    toast('Az előfizetés lemondva.');
    refresh();
  },
});

// ==========================================================
//  Admin panel
// ==========================================================

const adminTabs = [['overview', 'Áttekintés'], ['users', 'Felhasználók'], ['subs', 'Előfizetések'], ['plans', 'Csomagok'], ['content', 'Tartalmak'], ['recs', 'Ajánlások']];
const A = { users: [], subs: [], plans: [], titles: [], recs: [], userQ: '', subQ: '', subState: '', recState: '' };
const findBy = (list, id) => list.find((x) => x.id === Number(id));

async function adminPage({ tab }) {
  tab = adminTabs.some(([k]) => k === tab) ? tab : 'overview';
  const stats = await api('/admin/stats');
  state.newRecs = stats.newRecommendations;
  const body = await ({ overview: () => adminOverview(stats), users: adminUsers, subs: adminSubs, plans: adminPlans, content: adminContent, recs: adminRecs })[tab]();
  return page(html`
    <div class="page">
      <h1 class="page-title">Admin panel</h1>
      <nav class="tabs" aria-label="Admin fülek">
        ${adminTabs.map(([k, l]) => html`<a href="#/admin/${k}" class="${k === tab ? 'active' : ''}">${l}${k === 'recs' && stats.newRecommendations > 0 && html` <span class="count-badge">${stats.newRecommendations}</span>`}</a>`)}
      </nav>
      ${body}
    </div>`);
}

const stat = (label, value, sub) => html`<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div>${sub && html`<div class="sub">${sub}</div>`}</div>`;

async function adminOverview(s) {
  const max = Math.max(1, ...s.byPlan.map((p) => p.count));
  const tlsDays = s.tlsExpiresAt ? Math.ceil((s.tlsExpiresAt - Date.now()) / 86_400_000) : null;
  const payBanner = (kind, title, text) => html`<div class="banner" role="${kind === 'bad' ? 'alert' : 'status'}"><div><strong>${title}</strong><div class="muted">${text}</div></div></div>`;
  return html`
    ${s.payments === 'off' && payBanner('bad', 'A bankkártyás fizetés nincs beállítva.', 'A felhasználók most nem tudnak előfizetni. Add meg a STRIPE_SECRET_KEY értékét a szerver .env fájljában (lásd STRIPE.md).')}
    ${s.payments === 'demo' && payBanner('bad', 'FIGYELEM: a DEMO_PAYMENTS be van kapcsolva.', 'Bárki ingyen előfizethet! Ez csak tesztelésre való, éles oldalon kapcsold ki.')}
    ${s.payments === 'stripe' && s.stripeMode === 'test' && payBanner('warn', 'Stripe TESZT mód.', 'A fizetések nem valódiak (teszt kártyák). Éles működéshez sk_live_ kulcs kell.')}
    ${s.payments === 'stripe' && s.stripeMode === 'live' && !s.stripeWebhook && payBanner('warn', 'A Stripe webhook nincs beállítva.', 'Az előfizetések állapota így is frissül (amikor a felhasználó használja az oldalt), de webhookkal azonnali. Lásd STRIPE.md.')}
    ${tlsDays !== null && tlsDays <= 21 && html`<div class="banner" role="alert">
      <div><strong>${tlsDays > 0 ? `A HTTPS tanúsítvány ${tlsDays} nap múlva lejár.` : 'A HTTPS tanúsítvány lejárt!'}</strong>
        <div class="muted">Futtasd újra a <code>tools/get-cert/get-cert.bat</code> fájlt a gépeden, és töltsd fel az új <code>tls</code> mappát a szerverre. Újraindítás nem kell.</div></div>
    </div>`}
    ${s.newRecommendations > 0 && html`<div class="banner"><div><strong>${s.newRecommendations} új ajánlás</strong> vár elbírálásra a felhasználóktól.</div><a class="btn primary" href="#/admin/recs">Megnézem</a></div>`}
    <div class="stats">
      ${stat('Felhasználók', s.users, `+${s.newUsers} az elmúlt 7 napban`)}
      ${stat('Aktív előfizetések', s.activeSubs, `${s.cancelledSubs} lemondva (még érvényes)`)}
      ${stat('Lejárt előfizetések', s.expiredSubs)}
      ${stat('Bevétel (30 nap)', fmtMoney(s.revenue30), `Összesen: ${fmtMoney(s.revenueTotal)}`)}
      ${stat('Tartalmak', s.titles)}
    </div>
    <div class="card">
      <h2>Érvényes előfizetések csomagonként</h2>
      ${s.byPlan.map((p) => html`<div class="bar-row"><span>${p.name}</span><div class="bar"><i style="width:${(p.count / max) * 100}%"></i></div><strong>${p.count}</strong></div>`)}
    </div>`;
}

// ----- Felhasználók -----

async function adminUsers() {
  A.users = await api(`/admin/users?q=${encodeURIComponent(A.userQ)}`);
  return html`
    <form class="toolbar" data-form="adminUserSearch">
      <input class="grow" name="q" value="${A.userQ}" placeholder="Keresés név vagy e-mail alapján…">
      <button class="btn">Keresés</button>
    </form>
    ${A.users.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Felhasználó</th><th>Szerep</th><th>Előfizetés</th><th>Regisztrált</th><th></th></tr></thead>
      <tbody>${A.users.map((u) => {
        const self = u.id === state.user.id;
        return html`<tr>
          <td><strong>${u.name}</strong> ${u.banned ? html`<span class="badge bad">Tiltva</span>` : ''}<br><span class="muted">${u.email}</span></td>
          <td>${u.role === 'admin' ? html`<span class="badge info">Admin</span>` : 'Felhasználó'}</td>
          <td>${u.sub_id ? html`${u.plan_name} ${stateBadge(u.sub_state)}<br><span class="muted">${fmtDateShort(u.expires_at)}-ig</span>` : html`<span class="muted">Nincs</span>`}</td>
          <td>${fmtDateShort(u.created_at)}</td>
          <td class="actions">
            <button class="btn sm primary" data-action="grantSub" data-user="${u.id}">Előfizetés adása</button>
            ${!self && html`
              <button class="btn sm" data-action="userRole" data-id="${u.id}">${u.role === 'admin' ? 'Admin jog elvétele' : 'Adminná tesz'}</button>
              <button class="btn sm" data-action="userBan" data-id="${u.id}">${u.banned ? 'Tiltás feloldása' : 'Tiltás'}</button>
              <button class="btn sm danger" data-action="userDelete" data-id="${u.id}">Törlés</button>`}
          </td></tr>`;
      })}</tbody></table></div>` : emptyBox('Nincs találat.')}`;
}
forms.adminUserSearch = (d) => { A.userQ = (d.q || '').trim(); return refresh(); };

Object.assign(actions, {
  async userRole(el) {
    const u = findBy(A.users, el.dataset.id);
    const makeAdmin = u.role !== 'admin';
    if (!(await confirmDialog(makeAdmin ? `${u.name} admin jogot kap. Biztosan?` : `${u.name} elveszíti az admin jogot. Biztosan?`))) return;
    await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { role: makeAdmin ? 'admin' : 'user' } });
    toast('Szerepkör frissítve.'); refresh();
  },
  async userBan(el) {
    const u = findBy(A.users, el.dataset.id);
    if (!u.banned && !(await confirmDialog(`${u.name} fiókja le lesz tiltva, és azonnal kijelentkeztetjük.`, { okLabel: 'Tiltás', danger: true }))) return;
    await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { banned: !u.banned } });
    toast(u.banned ? 'Tiltás feloldva.' : 'Felhasználó letiltva.'); refresh();
  },
  async userDelete(el) {
    const u = findBy(A.users, el.dataset.id);
    if (!(await confirmDialog(`${u.name} (${u.email}) fiókját és előfizetését véglegesen töröljük. Ez nem vonható vissza.`, { okLabel: 'Végleges törlés', danger: true }))) return;
    await api(`/admin/users/${u.id}`, { method: 'DELETE' });
    toast('Felhasználó törölve.'); refresh();
  },
});

// ----- Előfizetések -----

async function adminSubs() {
  const qs = new URLSearchParams({ q: A.subQ, state: A.subState });
  A.subs = await api(`/admin/subscriptions?${qs}`);
  return html`
    <form class="toolbar" data-form="adminSubSearch">
      <input class="grow" name="q" value="${A.subQ}" placeholder="Keresés név vagy e-mail alapján…">
      <select name="state" data-change="subFilter" aria-label="Állapot szűrő">
        ${[['', 'Minden állapot'], ['active', 'Aktív'], ['cancelled', 'Lemondva'], ['expired', 'Lejárt']].map(([v, l]) => html`<option value="${v}" ${A.subState === v ? raw('selected') : ''}>${l}</option>`)}
      </select>
      <button class="btn">Szűrés</button>
      <button type="button" class="btn primary" data-action="grantSub">+ Előfizetés adása</button>
    </form>
    ${A.subs.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Felhasználó</th><th>Csomag</th><th>Állapot</th><th>Kezdete</th><th>Lejárat</th><th></th></tr></thead>
      <tbody>${A.subs.map((s) => html`<tr>
        <td><strong>${s.user_name}</strong><br><span class="muted">${s.email}</span></td>
        <td>${s.plan_name} ${s.stripe && html`<span class="badge info" title="Bankkártyás előfizetés, a Stripe kezeli">Stripe</span>`}</td>
        <td>${stateBadge(s.state)}</td>
        <td>${fmtDateShort(s.started_at)}</td>
        <td>${fmtDateShort(s.expires_at)}</td>
        <td class="actions">
          ${s.stripe && s.state !== 'expired'
            ? html`<span class="muted" style="font-size:.82rem" title="Időt adni, csomagot cserélni és lejáratot módosítani csak az admin által adott előfizetésnél lehet">A Stripe kezeli</span>`
            : html`<button class="btn sm primary" data-action="subRenew" data-id="${s.id}">Megújítás</button>
          <button class="btn sm" data-action="subEdit" data-id="${s.id}">Szerkesztés</button>`}
          ${s.state !== 'expired' && html`<button class="btn sm danger" data-action="subEnd" data-id="${s.id}">Megszüntetés</button>`}
          <button class="btn sm danger" data-action="subDelete" data-id="${s.id}">Törlés</button>
        </td></tr>`)}</tbody></table></div>` : emptyBox('Nincs a szűrésnek megfelelő előfizetés.')}`;
}
forms.adminSubSearch = (d) => { A.subQ = (d.q || '').trim(); A.subState = d.state || ''; return refresh(); };
changes.subFilter = (el) => { A.subState = el.value; A.subQ = el.form.elements.q.value.trim(); return refresh(); };

Object.assign(actions, {
  async grantSub(el) {
    const [users, plans] = await Promise.all([api('/admin/users'), api('/admin/plans')]);
    const preset = el.dataset.user;
    openForm({
      title: 'Előfizetés adása',
      note: 'Ha a felhasználónak már van előfizetése, a csomag lecserélődik, és a megadott napok hozzáadódnak a lejárathoz.',
      submit: 'Előfizetés adása',
      fields: [
        { name: 'userId', label: 'Felhasználó', type: 'select', value: preset || '', options: users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })) },
        { name: 'planId', label: 'Csomag', type: 'select', options: plans.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} – ${fmtMoney(p.price)}` })) },
        { name: 'days', label: 'Időtartam (nap)', type: 'number', value: 30, min: 1, max: 3650 },
      ],
      async onSubmit(v) {
        await api('/admin/subscriptions', { method: 'POST', body: { userId: Number(v.userId), planId: Number(v.planId), days: v.days } });
        toast('Előfizetés hozzáadva.');
      },
    });
  },
  subRenew(el) {
    const s = findBy(A.subs, el.dataset.id);
    openForm({
      title: 'Előfizetés megújítása',
      note: `${s.user_name} – ${s.plan_name}. Jelenlegi lejárat: ${fmtDate(s.expires_at)}. A napok a lejárathoz (vagy a mai naphoz, ha már lejárt) adódnak hozzá.`,
      submit: 'Megújítás',
      fields: [{ name: 'days', label: 'Hosszabbítás (nap)', type: 'number', value: 30, min: 1, max: 3650 }],
      async onSubmit(v) {
        await api(`/admin/subscriptions/${s.id}/renew`, { method: 'POST', body: { days: v.days } });
        toast('Előfizetés megújítva.');
      },
    });
  },
  async subEdit(el) {
    const s = findBy(A.subs, el.dataset.id);
    const plans = (await api('/admin/plans')).filter((p) => p.active || p.id === s.plan_id);
    const originalDate = toDateInput(s.expires_at);
    openForm({
      title: 'Előfizetés szerkesztése',
      note: `${s.user_name} (${s.email})`,
      fields: [
        { name: 'planId', label: 'Csomag', type: 'select', value: s.plan_id, options: plans.map((p) => ({ value: p.id, label: `${p.name} – ${fmtMoney(p.price)}` })) },
        { name: 'expires', label: 'Lejárat napja', type: 'date', value: originalDate, hint: 'Jövőbeli dátum megadásakor az előfizetés újra aktív lesz.' },
      ],
      async onSubmit(v) {
        if (!v.expires) throw new Error('Add meg a lejárat napját.');
        const body = { planId: Number(v.planId) };
        if (v.expires !== originalDate) body.expiresAt = fromDateInput(v.expires);
        await api(`/admin/subscriptions/${s.id}`, { method: 'PATCH', body });
        toast('Előfizetés módosítva.');
      },
    });
  },
  async subEnd(el) {
    const s = findBy(A.subs, el.dataset.id);
    if (!(await confirmDialog(`${s.user_name} előfizetése azonnal megszűnik, a hozzáférése megszakad.`, { okLabel: 'Megszüntetés', danger: true }))) return;
    await api(`/admin/subscriptions/${s.id}/cancel`, { method: 'POST' });
    toast('Előfizetés megszüntetve.'); refresh();
  },
  async subDelete(el) {
    const s = findBy(A.subs, el.dataset.id);
    if (!(await confirmDialog(`${s.user_name} előfizetés-rekordját töröljük (a fizetési előzmények megmaradnak).`, { okLabel: 'Törlés', danger: true }))) return;
    await api(`/admin/subscriptions/${s.id}`, { method: 'DELETE' });
    toast('Előfizetés törölve.'); refresh();
  },
});

// ----- Csomagok -----

async function adminPlans() {
  A.plans = await api('/admin/plans');
  return html`
    <div class="toolbar"><button class="btn primary" data-action="planNew">+ Új csomag</button></div>
    <div class="plans">${A.plans.map((p) => html`
      <div class="card plan" style="${p.active ? '' : 'opacity:.6'}">
        <div class="row between"><h2 style="margin:0">${p.name}</h2>${p.active ? '' : html`<span class="badge none">Rejtett</span>`}</div>
        <div class="price">${fmtMoney(p.price)}<small> / hó</small></div>
        <p class="muted">${p.description}</p>
        <ul><li>Legfeljebb ${QUALITY_FULL[p.max_quality] || p.quality}</li><li>${p.screens} egyidejű képernyő</li><li>${p.subscribers} előfizető</li></ul>
        <div class="row">
          <button class="btn sm" data-action="planEdit" data-id="${p.id}">Szerkesztés</button>
          <button class="btn sm danger" data-action="planDelete" data-id="${p.id}">Törlés</button>
        </div>
      </div>`)}</div>`;
}

const planFields = (p = {}) => [
  { name: 'name', label: 'Név', value: p.name, max: 40 },
  { name: 'price', label: 'Havi ár (Ft)', type: 'number', value: p.price ?? 1990, min: 175, max: 1000000, hint: 'Legalább 175 Ft (a Stripe minimuma). Áremelésnél a már meglévő előfizetők a régi áron maradnak, az új ár az új vásárlókra vonatkozik.' },
  { name: 'max_quality', label: 'Legjobb videóminőség', type: 'select', value: p.max_quality ?? 1080,
    options: [{ value: 720, label: 'HD (720p)' }, { value: 1080, label: 'Full HD (1080p)' }, { value: 2160, label: 'Ultra HD (4K)' }],
    hint: 'Ennél jobb minőségű változatot a csomag nem kap meg: az ilyen videók linkje ki sem megy a szerverről.' },
  { name: 'screens', label: 'Egyidejű képernyők', type: 'number', value: p.screens ?? 1, min: 1, max: 20, hint: 'Ennyi eszközön nézhet egyszerre az előfizető.' },
  { name: 'description', label: 'Leírás', type: 'textarea', value: p.description, required: false, max: 200 },
  { name: 'active', label: 'Elérhető új előfizetőknek', type: 'checkbox', value: p.active ?? true },
];
Object.assign(actions, {
  planNew() {
    openForm({
      title: 'Új csomag', fields: planFields(), submit: 'Létrehozás',
      async onSubmit(v) { await api('/admin/plans', { method: 'POST', body: v }); toast('Csomag létrehozva.'); },
    });
  },
  planEdit(el) {
    const p = findBy(A.plans, el.dataset.id);
    openForm({
      title: `Csomag szerkesztése: ${p.name}`, fields: planFields({ ...p, active: !!p.active }),
      async onSubmit(v) { await api(`/admin/plans/${p.id}`, { method: 'PATCH', body: v }); toast('Csomag mentve.'); },
    });
  },
  async planDelete(el) {
    const p = findBy(A.plans, el.dataset.id);
    const msg = p.subscribers
      ? `A(z) ${p.name} csomagra ${p.subscribers} előfizetés van, ezért nem törölhető – helyette elrejtjük az új előfizetők elől.`
      : `A(z) ${p.name} csomag véglegesen törlődik.`;
    if (!(await confirmDialog(msg, { okLabel: p.subscribers ? 'Elrejtés' : 'Törlés', danger: true }))) return;
    const r = await api(`/admin/plans/${p.id}`, { method: 'DELETE' });
    toast(r.deactivated ? 'Csomag elrejtve.' : 'Csomag törölve.'); refresh();
  },
});

// ----- Tartalmak -----

async function adminContent() {
  A.titles = await api('/admin/titles');
  return html`
    <div class="toolbar"><button class="btn primary" data-action="titleNew">+ Új tartalom</button></div>
    ${A.titles.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Cím</th><th>Típus</th><th>Műfaj</th><th>Év</th><th>Korhatár</th><th>Értékelés</th><th></th></tr></thead>
      <tbody>${A.titles.map((t) => html`<tr>
        <td><strong>${t.title}</strong> ${t.featured ? html`<span class="badge info">Kiemelt</span>` : ''}</td>
        <td>${t.type === 'movie' ? 'Film' : `Sorozat (${t.episode_count} epizód)`}</td>
        <td>${t.genre}</td><td>${t.year}</td><td>${ageLabel(t.age)}</td><td>★ ${Number(t.rating).toFixed(1)}</td>
        <td class="actions">
          ${t.type === 'series' && html`<button class="btn sm" data-action="episodes" data-id="${t.id}">Epizódok</button>`}
          <button class="btn sm" data-action="titleEdit" data-id="${t.id}">Szerkesztés</button>
          <button class="btn sm danger" data-action="titleDelete" data-id="${t.id}">Törlés</button>
        </td></tr>`)}</tbody></table></div>` : emptyBox('Még nincs tartalom.')}`;
}

const AGE_OPTIONS = [[0, 'Korhatár nélkül'], [6, '6 éves kortól'], [12, '12 éves kortól'], [16, '16 éves kortól'], [18, '18 éves kortól']]
  .map(([value, label]) => ({ value, label }));
const VIDEO_HINT = 'Videa, YouTube vagy Vimeo link, közvetlen .mp4/.webm link – vagy tölts fel videófájlt (mp4, m4v, webm, ogv).';

// Egy videó három minőségi változata. A csomag pontosan azt kapja, ami a szintjéhez tartozik:
// Alap: az alap változat, Standard: Full HD (ha van), Prémium: 4K (ha van).
const videoFields = (v = {}, showIf, extraHint = '') => [
  { name: 'video_url', label: 'Videó – alap változat (720p vagy alacsonyabb)', type: 'video', value: v.video_url, showIf,
    hint: `${VIDEO_HINT} Ezt kapja minden csomag, az Alap is. ${extraHint}` },
  { name: 'video_url_1080', label: 'Videó – Full HD (1080p) változat (nem kötelező)', type: 'video', value: v.video_url_1080, showIf,
    hint: 'Ezt a Standard és a Prémium csomag kapja. Ha üres, ők is az alap változatot látják.' },
  { name: 'video_url_2160', label: 'Videó – 4K változat (nem kötelező)', type: 'video', value: v.video_url_2160, showIf,
    hint: 'Ezt csak a Prémium csomag kapja. Ha üres, a Prémium a Full HD (vagy az alap) változatot látja.' },
];

const titleFields = (t = {}) => [
  { name: 'type', label: 'Típus', type: 'select', value: t.type ?? 'movie', options: [{ value: 'movie', label: 'Film' }, { value: 'series', label: 'Sorozat' }] },
  { name: 'title', label: 'Cím', value: t.title },
  { name: 'description', label: 'Leírás', type: 'textarea', value: t.description, max: 1000, hint: 'Miről szól a film vagy sorozat? (legfeljebb 1000 karakter)' },
  { name: 'year', label: 'Elkészülésének éve', type: 'number', value: t.year ?? new Date().getFullYear(), min: 1888, max: new Date().getFullYear() + 2 },
  { name: 'age', label: 'Ajánlott életkor', type: 'select', value: t.age ?? 12, options: AGE_OPTIONS },
  { name: 'genre', label: 'Műfaj', value: t.genre },
  { name: 'rating', label: 'Értékelés (0–10)', type: 'number', step: '0.1', value: t.rating ?? 7, min: 0, max: 10 },
  { name: 'hue', label: 'Borító színárnyalata (0–359)', type: 'number', value: t.hue ?? Math.floor(Math.random() * 360), min: 0, max: 359 },
  { name: 'duration_min', label: 'Hossz (perc)', type: 'number', value: t.duration_min ?? 90, min: 1, max: 1000, showIf: { name: 'type', value: 'movie' } },
  ...videoFields(t, { name: 'type', value: 'movie' }, 'Sorozatnál az epizódoknál adod meg a videókat.'),
  { name: 'featured', label: 'Kiemelt a főoldalon', type: 'checkbox', value: !!t.featured },
];

// Új tartalom űrlap; ajánlásból indítva előtölti az adatokat, és sikeres mentéskor elfogadottnak jelöli az ajánlást.
function newTitleForm(prefill = {}, recId = null) {
  openForm({
    title: 'Új tartalom', fields: titleFields(prefill), submit: 'Létrehozás', wide: true,
    async onSubmit(v) {
      const { id } = await api('/admin/titles', { method: 'POST', body: v });
      if (recId) await api(`/admin/recommendations/${recId}`, { method: 'PATCH', body: { status: 'added' } });
      toast('Tartalom létrehozva.');
      if (v.type === 'series') {
        A.titles = await api('/admin/titles');
        toast('Most add hozzá a sorozat epizódjait.');
        await openEpisodes(id);
        return 'stay';
      }
    },
  });
}

Object.assign(actions, {
  titleNew: () => newTitleForm(),
  titleEdit(el) {
    const t = findBy(A.titles, el.dataset.id);
    openForm({
      title: `Szerkesztés: ${t.title}`, fields: titleFields(t), wide: true,
      async onSubmit(v) { await api(`/admin/titles/${t.id}`, { method: 'PATCH', body: v }); toast('Tartalom mentve.'); },
    });
  },
  async titleDelete(el) {
    const t = findBy(A.titles, el.dataset.id);
    if (!(await confirmDialog(`„${t.title}” véglegesen törlődik${t.type === 'series' ? ' az összes epizóddal együtt' : ''}.`, { okLabel: 'Törlés', danger: true }))) return;
    await api(`/admin/titles/${t.id}`, { method: 'DELETE' });
    toast('Tartalom törölve.'); refresh();
  },
  episodes: (el) => openEpisodes(Number(el.dataset.id)),
  async episodeDelete(el) {
    await api(`/admin/episodes/${el.dataset.id}`, { method: 'DELETE' });
    toast('Epizód törölve.');
    await openEpisodes(Number(el.dataset.title));
  },
  episodeNew(el) {
    const titleId = Number(el.dataset.title);
    const next = Number(el.dataset.next) || 1;
    openForm({
      title: 'Új epizód', submit: 'Hozzáadás',
      back: () => openEpisodes(titleId),
      fields: [
        { name: 'season', label: 'Évad', type: 'number', value: 1, min: 1, max: 100 },
        { name: 'number', label: 'Epizód sorszáma', type: 'number', value: next, min: 1, max: 1000 },
        { name: 'name', label: 'Cím' },
        ...videoFields(),
      ],
      async onSubmit(v) {
        await api(`/admin/titles/${titleId}/episodes`, { method: 'POST', body: v });
        toast('Epizód hozzáadva.');
        await openEpisodes(titleId);
        return 'stay';
      },
    });
  },
});

async function openEpisodes(titleId) {
  const t = A.titles.find((x) => x.id === titleId);
  const eps = await api(`/admin/titles/${titleId}/episodes`);
  showModal(html`
    <h2>Epizódok: ${t ? t.title : ''}</h2>
    ${eps.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Cím</th><th>Videó</th><th></th></tr></thead>
      <tbody>${eps.map((e) => html`<tr><td>${e.season}×${e.number}</td><td>${e.name}</td><td class="muted">${videoLabel(e.video_url)}<br><small>${['720p', e.video_url_1080 && '1080p', e.video_url_2160 && '4K'].filter(Boolean).join(' · ')}</small></td>
        <td class="actions"><button class="btn sm danger" data-action="episodeDelete" data-id="${e.id}" data-title="${titleId}">Törlés</button></td></tr>`)}</tbody>
    </table></div>` : emptyBox('Még nincs epizód.')}
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn ghost" data-action="closeModal">Bezárás</button>
      <button class="btn primary" data-action="episodeNew" data-title="${titleId}" data-next="${eps.length + 1}">+ Új epizód</button>
    </div>`, true);
  onModalClose = () => refresh(); // bezáráskor frissül az epizódszám a táblázatban
}

function videoLabel(url) {
  if (url.startsWith('/media/')) return 'Feltöltött fájl';
  try {
    const h = new URL(url).hostname;
    if (h === 'videa.hu') return 'Videa';
    if (h.includes('youtube')) return 'YouTube';
    if (h.includes('vimeo')) return 'Vimeo';
    return h;
  } catch { return 'Link'; }
}

// ----- Ajánlások (felhasználóktól) -----

async function adminRecs() {
  A.recs = await api(`/admin/recommendations?status=${A.recState}`);
  return html`
    <div class="toolbar">
      <select data-change="recFilter" aria-label="Állapot szűrő">
        ${[[''  , 'Minden ajánlás'], ['new', 'Új'], ['added', 'Felkerült'], ['rejected', 'Elutasítva']].map(([v, l]) => html`<option value="${v}" ${A.recState === v ? raw('selected') : ''}>${l}</option>`)}
      </select>
    </div>
    ${A.recs.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Dátum</th><th>Ajánlotta</th><th>Cím</th><th>Megjegyzés</th><th>Állapot</th><th></th></tr></thead>
      <tbody>${A.recs.map((r) => html`<tr>
        <td>${fmtDateShort(r.created_at)}</td>
        <td><strong>${r.user_name}</strong><br><span class="muted">${r.email}</span></td>
        <td><strong>${r.title}</strong><br><span class="muted">${r.type === 'movie' ? 'Film' : 'Sorozat'}</span>
          ${r.link && html`<br><a href="${r.link}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">Link megnyitása ↗</a>`}</td>
        <td style="max-width:280px">${r.note || html`<span class="muted">–</span>`}</td>
        <td><span class="badge ${REC_STATUS[r.status][1]}">${REC_STATUS[r.status][0]}</span></td>
        <td class="actions">
          ${r.status !== 'added' && html`<button class="btn sm primary" data-action="recAdd" data-id="${r.id}">Hozzáadás a katalógushoz</button>`}
          ${r.status === 'new' && html`<button class="btn sm" data-action="recSet" data-id="${r.id}" data-status="rejected">Elutasítás</button>`}
          ${r.status !== 'new' && html`<button class="btn sm" data-action="recSet" data-id="${r.id}" data-status="new">Visszaállítás újra</button>`}
          <button class="btn sm danger" data-action="recDelete" data-id="${r.id}">Törlés</button>
        </td></tr>`)}</tbody></table></div>` : emptyBox('Nincs ajánlás.')}`;
}
changes.recFilter = (el) => { A.recState = el.value; return refresh(); };

Object.assign(actions, {
  recAdd(el) {
    const r = findBy(A.recs, el.dataset.id);
    newTitleForm({ title: r.title, type: r.type, description: r.note }, r.id);
  },
  async recSet(el) {
    await api(`/admin/recommendations/${el.dataset.id}`, { method: 'PATCH', body: { status: el.dataset.status } });
    toast('Ajánlás frissítve.'); refresh();
  },
  async recDelete(el) {
    const r = findBy(A.recs, el.dataset.id);
    if (!(await confirmDialog(`Az ajánlás („${r.title}”) törlődik.`, { okLabel: 'Törlés', danger: true }))) return;
    await api(`/admin/recommendations/${r.id}`, { method: 'DELETE' });
    toast('Ajánlás törölve.'); refresh();
  },
});

// Modal űrlap beküldése (az összes admin űrlap közös kezelője)
forms.modal = async (_, form) => {
  const ctx = modalCtx;
  if (ctx.uploading) throw new Error('Várd meg, amíg a videó feltöltése befejeződik.');
  const result = await ctx.onSubmit(readModalValues(form));
  if (result === 'stay') return;
  closeModal();
  refresh();
};

// ==========================================================
//  Indítás
// ==========================================================

// A régi Impix oldal service workerének és gyorsítótárának eltakarítása (az új oldal nem használ ilyet)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister())).catch(() => {});
}
if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});

(async function boot() {
  try { await refreshMe(); applyServerPrefs(state.user); } catch { /* offline: vendégként indul */ }
  await route();
})();
