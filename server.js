import './env.js'; // .env fájl betöltése (az elsőnek kell lennie: a többi modul a környezeti változókat olvassa)
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { randomBytes, createHmac, timingSafeEqual, X509Certificate } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import db, { tx, seed } from './db.js';
import { hashPassword, verifyPassword, verifyDummy, hashToken, newToken } from './security.js';
import * as billing from './billing.js';
import { issueInvoice, sellerConfigured, sellerConfig } from './invoices.js';
import { renderInvoicePdf } from './invoice-pdf.js';

// Pterodactyl panelen a kiosztott portot a SERVER_PORT változó adja
const PORT = Number(process.env.PORT || process.env.SERVER_PORT) || 3000;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 2048;
const MAX_UPLOAD = MAX_UPLOAD_MB * 1024 * 1024;
const DATA_DIR = process.env.IMPIX_DB ? path.dirname(path.resolve(process.env.IMPIX_DB)) : path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const VIDEO_DIR = path.join(DATA_DIR, 'videos');
const VIDEO_EXT = ['mp4', 'm4v', 'webm', 'ogv'];
const MEDIA_RE = /^[a-f0-9]{32}\.(mp4|m4v|webm|ogv)$/;
const AGES = [0, 6, 12, 16, 18];
fs.mkdirSync(VIDEO_DIR, { recursive: true });

// Melyik weboldalakról (pl. GitHub Pages) hívhatja az API-t: CORS_ORIGINS=https://felhasznalo.github.io,https://www.impix.hu
const CORS_ORIGINS = new Set((process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean));

// Feltöltött videók aláírt, lejáró linkjeihez tartozó titok (env-ből, vagy első indításkor generálva).
const MEDIA_TTL = 6 * 3600_000;
const MEDIA_SECRET = process.env.MEDIA_SECRET || (() => {
  const keyFile = path.join(DATA_DIR, 'media.key');
  try { return fs.readFileSync(keyFile, 'utf8').trim(); } catch { /* még nincs */ }
  const key = randomBytes(32).toString('hex');
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
  return key;
})();
const mediaSig = (file, uid, exp) => createHmac('sha256', MEDIA_SECRET).update(`${file}|${uid}|${exp}`).digest('hex');
function signedMedia(src, uid) {
  if (!src || !src.startsWith('/media/')) return src;
  const exp = Date.now() + MEDIA_TTL;
  return `${src}?u=${uid}&e=${exp}&s=${mediaSig(src.slice(7), uid, exp)}`;
}
const DAY = 86_400_000;
const PERIOD_DAYS = 30;
const SESSION_MS = 30 * DAY;
const COOKIE = 'impix_sid';
const THEMES = ['dark', 'light', 'auto'];
const ACCENTS = ['red', 'blue', 'purple', 'green', 'orange'];

seed();
ensureAdmin();

// ---------- Segédek ----------

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (message, status = 400) => { throw new HttpError(status, message); };

function str(v, name, { min = 1, max = 200 } = {}) {
  if (typeof v !== 'string') fail(`${name} megadása kötelező.`);
  const s = v.trim();
  if (s.length < min || s.length > max) fail(`${name}: ${min}–${max} karakter lehet.`);
  return s;
}
function int(v, name, min, max) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < min || n > max)
    fail(`${name}: ${min} és ${max} közötti egész szám kell.`);
  return n;
}
function num(v, name, min, max) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < min || n > max)
    fail(`${name}: ${min} és ${max} közötti szám kell.`);
  return n;
}
function url(v, name) {
  const s = str(v, name, { max: 500 });
  if (!/^https?:\/\/\S+$/i.test(s)) fail(`${name}: érvényes http(s) cím kell.`);
  return s;
}

// ---------- Videó források ----------
// Elfogadott: feltöltött fájl (/media/...), Videa / YouTube / Vimeo link (beágyazásként),
// vagy közvetlen videófájl-link. A beágyazható linkeket egységes player-címre alakítjuk.

const EMBED_HOSTS = new Set(['videa.hu', 'www.youtube-nocookie.com', 'player.vimeo.com']);
const isVideaHost = (h) => h === 'videa.hu' || h.endsWith('.videa.hu');

function videaId(u) {
  const q = u.searchParams.get('v');
  if (q) return q;
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] === 'player' && parts[1] === 'v') return parts[2];
  const last = parts[parts.length - 1] || '';
  return last.split('-').pop(); // .../videok/kategoria/cim-slug-AZONOSITO
}

function videoSource(v, name = 'Videó') {
  const s = str(v, name, { max: 500 });
  if (s.startsWith('/media/')) {
    const file = s.slice(7);
    if (!MEDIA_RE.test(file) || !fs.existsSync(path.join(VIDEO_DIR, file))) fail(`${name}: a feltöltött fájl nem található.`);
    return s;
  }
  let u;
  try { u = new URL(s); } catch { fail(`${name}: érvényes link vagy feltöltött fájl kell.`); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail(`${name}: csak http(s) link adható meg.`);
  const host = u.hostname.toLowerCase().replace(/^www\./, '');

  if (isVideaHost(host)) {
    const id = videaId(u);
    if (!id || !/^[\w-]{6,40}$/.test(id)) fail(`${name}: nem sikerült a Videa azonosítót kiolvasni. Használd a videó oldalának címét vagy a beágyazó (player) linket.`);
    return `https://videa.hu/player?v=${id}`;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    const parts = u.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts[0]
      : u.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
    if (!id || !/^[\w-]{11}$/.test(id)) fail(`${name}: nem sikerült a YouTube azonosítót kiolvasni.`);
    return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p));
    if (!id) fail(`${name}: nem sikerült a Vimeo azonosítót kiolvasni.`);
    return `https://player.vimeo.com/video/${id}`;
  }
  return u.href;
}

function videoKind(src) {
  if (!src || src.startsWith('/media/')) return 'file';
  try { return EMBED_HOSTS.has(new URL(src).hostname) ? 'embed' : 'file'; } catch { return 'file'; }
}

// Feltöltött fájl törlése, ha már semmi nem hivatkozik rá.
function releaseMedia(src) {
  if (!src || !src.startsWith('/media/')) return;
  const file = src.slice(7);
  if (!MEDIA_RE.test(file)) return;
  const used = db.prepare(`SELECT
    (SELECT COUNT(*) FROM titles WHERE video_url = ? OR video_url_1080 = ? OR video_url_2160 = ?) +
    (SELECT COUNT(*) FROM episodes WHERE video_url = ? OR video_url_1080 = ? OR video_url_2160 = ?) AS c`).get(src, src, src, src, src, src).c;
  if (!used) fs.rm(path.join(VIDEO_DIR, file), { force: true }, () => {});
}

// Egy videóhoz tartozó három minőségi változat (az alap a 720p vagy alacsonyabb; a másik kettő nem kötelező)
const QUALITIES = [720, 1080, 2160];
const QUALITY_LABEL = { 720: 'HD (720p)', 1080: 'Full HD (1080p)', 2160: 'Ultra HD (4K)' };
const SOURCE_COLS = { 720: 'video_url', 1080: 'video_url_1080', 2160: 'video_url_2160' };
const optionalVideo = (v, name) => (typeof v === 'string' && v.trim() ? videoSource(v, name) : null);
const videoSources = (b) => ({
  video_url: videoSource(b.video_url, 'Videó (alap, 720p)'),
  video_url_1080: optionalVideo(b.video_url_1080, 'Videó (Full HD)'),
  video_url_2160: optionalVideo(b.video_url_2160, 'Videó (4K)'),
});

// A felhasználó csomagja által megengedett legjobb változat. A csomag fölötti változat linkje ki sem kerül a szerverről.
function pickSource(row, maxQuality) {
  let chosen = null;
  for (const q of QUALITIES) if (q <= maxQuality && row[SOURCE_COLS[q]]) chosen = q;
  const higher = QUALITIES.find((q) => q > (chosen || 0) && q > maxQuality && row[SOURCE_COLS[q]]) || null;
  return chosen ? { quality: chosen, url: row[SOURCE_COLS[chosen]], higher } : null;
}

// Elárvult (feltöltött, de sehol nem használt) fájlok takarítása
function sweepMedia() {
  const cutoff = Date.now() - 3600_000;
  for (const file of fs.readdirSync(VIDEO_DIR)) {
    const full = path.join(VIDEO_DIR, file);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) releaseMedia(`/media/${file}`);
    } catch { /* közben törlődött */ }
  }
}

async function looksLikeVideo(file, ext) {
  const fh = await fs.promises.open(file, 'r');
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);
    if (bytesRead < 12) return false;
    if (ext === 'webm') return buf.readUInt32BE(0) === 0x1a45dfa3;
    if (ext === 'ogv') return buf.toString('latin1', 0, 4) === 'OggS';
    return buf.toString('latin1', 4, 8) === 'ftyp'; // mp4 / m4v
  } finally { await fh.close(); }
}
function email(v) {
  const s = str(v, 'E-mail cím', { max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail('Érvénytelen e-mail cím.');
  return s;
}
function password(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 200) fail('A jelszó legalább 8 karakter legyen.');
  return v;
}
const like = (q) => `%${String(q).replace(/[\\%_]/g, '\\$&')}%`;

function ensureAdmin() {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return;
  const mail = (process.env.ADMIN_EMAIL || 'admin@impix.hu').toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || newToken().slice(0, 14);
  db.prepare("INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?, 'admin', ?)")
    .run(mail, 'Adminisztrátor', hashPassword(pass), Date.now());
  console.log('\n================ ELSŐ INDÍTÁS ================');
  console.log(' Admin fiók létrehozva');
  console.log(`   E-mail: ${mail}`);
  console.log(`   Jelszó: ${process.env.ADMIN_PASSWORD ? '(a ADMIN_PASSWORD környezeti változóból)' : pass}`);
  console.log(' Ezt a jelszót csak most látod – a belépés után változtasd meg a Fiók oldalon.');
  console.log('===============================================\n');
}

// ---------- Előfizetés logika ----------

const SUB_SELECT = `
  SELECT s.*, p.name AS plan_name, p.price, p.quality, p.max_quality, p.screens
  FROM subscriptions s JOIN plans p ON p.id = s.plan_id`;

function subState(s, t = Date.now()) {
  if (s.expires_at <= t) return 'expired';
  return s.status === 'cancelled' ? 'cancelled' : 'active';
}
function subView(s) {
  if (!s) return null;
  const t = Date.now();
  const state = subState(s, t);
  return {
    id: s.id, user_id: s.user_id, plan_id: s.plan_id, plan_name: s.plan_name, price: s.price,
    quality: s.quality, max_quality: s.max_quality, screens: s.screens, status: s.status, state,
    started_at: s.started_at, expires_at: s.expires_at,
    days_left: Math.max(0, Math.ceil((s.expires_at - t) / DAY)),
    stripe: !!s.stripe_subscription_id,                      // a Stripe kezeli (kártyás előfizetés)
    renews: !!s.stripe_subscription_id && state === 'active', // a lejárat napján automatikusan megújul
  };
}
const getSub = (userId) => db.prepare(`${SUB_SELECT} WHERE s.user_id = ?`).get(userId);
const hasAccess = (user) => user.role === 'admin' || (() => {
  const s = getSub(user.id);
  return !!s && s.expires_at > Date.now();
})();

function recordPayment(userId, planName, amount, kind) {
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return Number(db.prepare('INSERT INTO payments (user_id, user_email, plan_name, amount, kind, created_at) VALUES (?,?,?,?,?,?)')
    .run(userId, u.email, planName, amount, kind, Date.now()).lastInsertRowid);
}

// Számla a (teszt) demó fizetésről. A valódi Stripe fizetések számláját a billing.js állítja ki.
function issueDemoInvoice(user, paymentId, planName, amount, periodStart, periodEnd) {
  return issueInvoice({
    paymentId, userId: user.id, gross: amount, paidAt: Date.now(), planName, periodStart, periodEnd,
    buyer: { name: user.name, email: user.email, address: '' }, paymentMethod: 'Teszt fizetés (demó)',
  });
}

// Amit az előfizetés ténylegesen ad: legnagyobb videóminőség és egyidejű képernyők száma.
// Az admin korlátlanul nézhet (tesztelés, tartalomellenőrzés).
function entitlements(user) {
  if (user.role === 'admin') return { maxQuality: 2160, screens: Infinity, planName: 'Admin' };
  const s = getSub(user.id);
  if (!s || s.expires_at <= Date.now()) return null;
  return { maxQuality: s.max_quality, screens: s.screens, planName: s.plan_name };
}

// Egyidejű lejátszások: a lejátszó oldal percenként jelez; a 2 percig jelzés nélküli lejátszás felszabadul.
const STREAM_TTL = 2 * 60_000;
function claimStream(userId, streamKey, maxScreens) {
  const t = Date.now();
  db.prepare('DELETE FROM streams WHERE last_seen < ?').run(t - STREAM_TTL);
  const known = db.prepare('SELECT 1 FROM streams WHERE id = ? AND user_id = ?').get(streamKey, userId);
  if (!known) {
    const active = db.prepare('SELECT COUNT(*) c FROM streams WHERE user_id = ?').get(userId).c;
    if (active >= maxScreens) {
      fail(`A csomagoddal egyszerre legfeljebb ${maxScreens} képernyőn nézhetsz. Állítsd le a lejátszást egy másik eszközön, vagy válts nagyobb csomagra.`, 429);
    }
  }
  db.prepare(`INSERT INTO streams (id, user_id, started_at, last_seen) VALUES (?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen`).run(streamKey, userId, t, t);
}
const validStreamId = (v) => (typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : fail('Érvénytelen lejátszás-azonosító.'));

const publicUser = (u) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at,
  prefs: safeJson(u.prefs),
});
function safeJson(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }

// ---------- Express ----------

let tlsExpiresAt = null;

const app = express();
app.disable('x-powered-by');
// Reverse proxy (nginx, Apache, hosting panel) mögött: TRUST_PROXY=1, így a HTTPS és a valódi kliens IP felismerhető.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; media-src *; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; " +
      'frame-src https://videa.hu https://*.videa.hu https://www.youtube-nocookie.com https://player.vimeo.com',
  });
  next();
});

// CORS: csak a felsorolt weboldalak (pl. GitHub Pages) hívhatják az API-t. Sütit nem küldünk (credentials nélkül), tokent igen.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && CORS_ORIGINS.has(origin)) {
    res.vary('Origin');
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Impix-Upload, X-Impix-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '600',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// Stripe webhook: az aláírás ellenőrzéséhez a nyers törzs kell, ezért az express.json ELŐTT van regisztrálva.
// A Stripe szerverről hívódik, nincs Origin fejléc; az aláírás (STRIPE_WEBHOOK_SECRET) hitelesíti.
app.post('/api/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  await billing.handleWebhook(req.body, req.get('stripe-signature'));
  res.json({ received: true });
});

app.use(express.json({ limit: '100kb' }));

// CSRF védelem: módosító kérés csak azonos vagy engedélyezett eredetről, JSON tartalommal megengedett.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let ok = CORS_ORIGINS.has(origin);
    try { ok = ok || new URL(origin).host === req.get('host'); } catch { /* érvénytelen origin */ }
    if (!ok) return res.status(403).json({ error: 'Érvénytelen kérés eredet.' });
  }
  // A videófeltöltés nyers fájltörzs; egyéni fejléc kell hozzá (ezt idegen oldal nem küldhet preflight nélkül).
  if (req.path === '/admin/upload') return next();
  if (!req.is('application/json')) return res.status(415).json({ error: 'JSON kérés szükséges.' });
  next();
});

function readCookie(req, name) {
  const header = req.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// A munkamenet-token jöhet Authorization: Bearer fejlécben (külön tárhelyen futó weboldal) vagy sütiben (azonos eredet).
function sessionToken(req) {
  const h = req.get('authorization');
  if (h && /^Bearer\s+[A-Za-z0-9]{20,100}$/.test(h)) return h.slice(7).trim();
  return readCookie(req, COOKIE);
}

app.use('/api', (req, res, next) => {
  req.user = null;
  const token = sessionToken(req);
  if (token) {
    const row = db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.banned = 0`).get(hashToken(token), Date.now());
    if (row) { req.user = row; req.token = token; }
  }
  next();
});

const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Jelentkezz be a folytatáshoz.' }));
const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Jelentkezz be a folytatáshoz.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Ehhez admin jogosultság kell.' });
  next();
};

// Ha a kliens tokent kér (X-Impix-Token: 1), a válaszban kapja meg, és nem állítunk be sütit.
const wantsToken = (req) => req.get('x-impix-token') === '1';

function startSession(req, res, userId) {
  const token = newToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)')
    .run(hashToken(token), userId, Date.now() + SESSION_MS);
  if (wantsToken(req)) return { token };
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: SESSION_MS, path: '/' });
  return {};
}

// ---------- Hitelesítés ----------

const attempts = new Map();
function throttle(key) {
  const t = Date.now();
  const rec = (attempts.get(key) || []).filter((x) => t - x < 15 * 60_000);
  if (rec.length >= 10) fail('Túl sok sikertelen próbálkozás. Próbáld újra 15 perc múlva.', 429);
  rec.push(t);
  attempts.set(key, rec);
}

app.post('/api/register', (req, res) => {
  const name = str(req.body.name, 'Név', { min: 2, max: 60 });
  const mail = email(req.body.email);
  const pass = password(req.body.password);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) fail('Ezzel az e-mail címmel már van fiók.', 409);
  const id = Number(db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?,?,?,?)')
    .run(mail, name, hashPassword(pass), Date.now()).lastInsertRowid);
  const session = startSession(req, res, id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ user: publicUser(user), subscription: null, ...session });
});

app.post('/api/login', (req, res) => {
  const mail = String(req.body.email || '').trim().toLowerCase();
  const pass = String(req.body.password || '');
  throttle(`${req.ip}|${mail}`);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
  const ok = user ? verifyPassword(pass, user.password_hash) : (verifyDummy(pass), false);
  if (!ok) fail('Hibás e-mail cím vagy jelszó.', 401);
  if (user.banned) fail('Ez a fiók le van tiltva.', 403);
  attempts.delete(`${req.ip}|${mail}`);
  const session = startSession(req, res, user.id);
  res.json({ user: publicUser(user), subscription: subView(getSub(user.id)), ...session });
});

app.post('/api/logout', (req, res) => {
  if (req.token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(req.token));
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Hogyan lehet fizetni: 'stripe' (éles), 'demo' (csak teszteléshez, ingyenes), 'off' (nincs beállítva)
const DEMO_PAYMENTS = process.env.DEMO_PAYMENTS === '1';
const paymentsMode = () => (billing.enabled ? 'stripe' : DEMO_PAYMENTS ? 'demo' : 'off');

app.get('/api/me', async (req, res) => {
  if (!req.user) return res.json({ user: null, subscription: null, payments: paymentsMode(), serverTime: Date.now() });
  // megújulás, lemondás a Stripe-ban, sikertelen fizetés; ?sync=1: a lejárat pillanatában azonnali ellenőrzés
  await billing.syncUser(req.user.id, req.query.sync === '1' ? { minAge: 10_000 } : {});
  res.json({
    user: publicUser(req.user),
    subscription: subView(getSub(req.user.id)),
    payments: paymentsMode(),
    serverTime: Date.now(), // a kliens ebből számolja az óra eltérését, hogy pontosan a lejáratkor léptesse ki

    newRecommendations: req.user.role === 'admin' ? newRecommendationCount() : 0,
  });
});

app.patch('/api/me', requireAuth, (req, res) => {
  const name = str(req.body.name, 'Név', { min: 2, max: 60 });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ ok: true });
});

app.post('/api/me/password', requireAuth, (req, res) => {
  if (!verifyPassword(String(req.body.currentPassword || ''), req.user.password_hash)) fail('A jelenlegi jelszó hibás.', 403);
  const pass = password(req.body.newPassword);
  tx(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pass), req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, hashToken(req.token));
  });
  res.json({ ok: true });
});

app.patch('/api/me/prefs', requireAuth, (req, res) => {
  const { theme, accent } = req.body;
  if (!THEMES.includes(theme) || !ACCENTS.includes(accent)) fail('Érvénytelen téma.');
  db.prepare('UPDATE users SET prefs = ? WHERE id = ?').run(JSON.stringify({ theme, accent }), req.user.id);
  res.json({ ok: true });
});

app.get('/api/me/payments', requireAuth, (req, res) => {
  res.json(db.prepare(`
    SELECT p.id, p.plan_name, p.amount, p.kind, p.created_at, i.id AS invoice_id, i.number AS invoice_number
    FROM payments p LEFT JOIN invoices i ON i.payment_id = p.id
    WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC LIMIT 50`).all(req.user.id));
});

// ---------- Számlák ----------

app.get('/api/invoices', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT id, number, issued_at, paid_at, description, period_start, period_end, gross
    FROM invoices WHERE user_id = ? ORDER BY issued_at DESC, id DESC`).all(req.user.id));
});

// A számla PDF-je: csak a tulajdonosa (és az admin) töltheti le. A PDF a kiállításkor mentett adatokból készül, ezért nem változik.
app.get('/api/invoices/:id/pdf', requireAuth, async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(req.params.id));
  if (!inv || (inv.user_id !== req.user.id && req.user.role !== 'admin')) fail('A számla nem található.', 404);
  const pdf = await renderInvoicePdf(inv);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${inv.number}.pdf"`,
    'Cache-Control': 'private, no-store',
  }).send(pdf);
});

// ---------- Csomagok és saját előfizetés ----------

app.get('/api/plans', (req, res) => {
  res.json(db.prepare('SELECT id, name, price, quality, max_quality, screens, description FROM plans WHERE active = 1 ORDER BY sort, price').all());
});

const buyablePlan = (id) => db.prepare('SELECT * FROM plans WHERE id = ? AND active = 1').get(int(id, 'Csomag', 1, 1e9)) || fail('A csomag nem található.', 404);

// Csomagváltás szabálya: aktív (le nem mondott) előfizetés mellett nem lehet másik csomagot venni.
// Előbb le kell mondani. A lemondás után újat vásárolva az új csomag azonnal indul, a régi hátralévő napjai elvesznek.
function assertCanBuy(cur) {
  if (cur && cur.expires_at > Date.now() && cur.status === 'active') {
    fail('Van aktív előfizetésed. Csomagváltáshoz előbb mondd le a jelenlegit.', 409);
  }
}

// Fizetés indítása (Stripe Checkout). A válaszban kapott címre kell átirányítani a felhasználót.
app.post('/api/checkout', requireAuth, async (req, res) => {
  if (!billing.enabled) fail('A bankkártyás fizetés még nincs beállítva.', 503);
  const plan = buyablePlan(req.body.planId);
  await billing.syncUser(req.user.id, { force: true }); // friss állapot a döntés előtt
  const cur = getSub(req.user.id);
  assertCanBuy(cur);
  // Lemondott, még érvényes, azonos csomag: nem kell újra fizetni, elég visszavonni a lemondást
  if (cur && cur.expires_at > Date.now() && cur.plan_id === plan.id && cur.stripe_subscription_id) {
    await billing.reactivate(req.user.id);
    return res.json({ reactivated: true, subscription: subView(getSub(req.user.id)) });
  }
  res.json({ url: await billing.createCheckout(req.user, plan) });
});

// A Stripe-ról visszatérve ezzel aktiváljuk az előfizetést (a webhook nélkül is működik)
app.post('/api/checkout/confirm', requireAuth, async (req, res) => {
  const result = await billing.confirmCheckout(req.user, req.body.sessionId);
  res.json({ ...result, subscription: subView(getSub(req.user.id)) });
});

// Számlázási portál (kártya módosítása, számlák) a Stripe-on
app.post('/api/billing/portal', requireAuth, async (req, res) => {
  res.json({ url: await billing.portalUrl(req.user) });
});

// Ingyenes bemutató előfizetés – CSAK teszteléshez (DEMO_PAYMENTS=1). Éles környezetben ki van kapcsolva.
app.post('/api/subscription', requireAuth, (req, res) => {
  if (!DEMO_PAYMENTS) fail('A fizetés bankkártyával, a Stripe-on keresztül történik.', 403);
  const plan = buyablePlan(req.body.planId);
  const t = Date.now();
  const uid = req.user.id;
  const cur = getSub(uid);
  assertCanBuy(cur);
  tx(() => {
    if (!cur) {
      db.prepare('INSERT INTO subscriptions (user_id, plan_id, status, started_at, expires_at) VALUES (?,?,?,?,?)')
        .run(uid, plan.id, 'active', t, t + PERIOD_DAYS * DAY);
    } else {
      db.prepare("UPDATE subscriptions SET plan_id = ?, status = 'active', started_at = ?, expires_at = ? WHERE user_id = ?")
        .run(plan.id, t, t + PERIOD_DAYS * DAY, uid);
    }
    const paymentId = recordPayment(uid, plan.name, plan.price, 'subscribe');
    issueDemoInvoice(req.user, paymentId, plan.name, plan.price, t, t + PERIOD_DAYS * DAY);
  });
  res.json({ subscription: subView(getSub(uid)) });
});

app.post('/api/subscription/renew', requireAuth, (req, res) => {
  if (!DEMO_PAYMENTS) fail('A megújítás a Stripe-on keresztül automatikus.', 403);
  const cur = getSub(req.user.id);
  if (!cur) fail('Nincs előfizetésed.', 404);
  const t = Date.now();
  tx(() => {
    const from = Math.max(t, cur.expires_at);
    db.prepare("UPDATE subscriptions SET status = 'active', expires_at = ? WHERE user_id = ?")
      .run(from + PERIOD_DAYS * DAY, req.user.id);
    const paymentId = recordPayment(req.user.id, cur.plan_name, cur.price, 'renew');
    issueDemoInvoice(req.user, paymentId, cur.plan_name, cur.price, from, from + PERIOD_DAYS * DAY);
  });
  res.json({ subscription: subView(getSub(req.user.id)) });
});

// Lemondás: a már kifizetett időszak végéig marad a hozzáférés, utána nem újul meg.
app.post('/api/subscription/cancel', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const cur = getSub(uid);
  if (!cur || cur.expires_at <= Date.now()) fail('Nincs aktív előfizetésed.', 404);
  if (cur.stripe_subscription_id) await billing.cancelAtPeriodEnd(uid);
  else db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ?").run(uid);
  res.json({ subscription: subView(getSub(uid)) });
});

// ---------- Tartalom ----------

const TITLE_PUBLIC = `t.id, t.type, t.title, t.description, t.year, t.genre, t.age, t.rating,
  t.duration_min, t.hue, t.featured,
  (SELECT COUNT(*) FROM episodes e WHERE e.title_id = t.id) AS episode_count,
  (SELECT COUNT(DISTINCT season) FROM episodes e WHERE e.title_id = t.id) AS season_count,
  CASE WHEN t.type = 'movie'
    THEN (CASE WHEN t.video_url_2160 IS NOT NULL THEN 2160 WHEN t.video_url_1080 IS NOT NULL THEN 1080 ELSE 720 END)
    ELSE (SELECT COALESCE(MAX(CASE WHEN e.video_url_2160 IS NOT NULL THEN 2160 WHEN e.video_url_1080 IS NOT NULL THEN 1080 ELSE 720 END), 720)
          FROM episodes e WHERE e.title_id = t.id) END AS best_quality,
  (SELECT COUNT(*) FROM favorites f WHERE f.title_id = t.id AND f.user_id = ?) AS fav`;

// A katalógus (címek, kedvencek) csak érvényes előfizetéssel látható; lejárt előfizetésnél 402, és új csomagot kell venni.
function requireAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!hasAccess(req.user)) return res.status(402).json({ error: 'Az előfizetésed lejárt vagy nincs előfizetésed. Válassz csomagot a folytatáshoz.' });
    next();
  });
}

app.get('/api/titles', requireAccess, (req, res) => {
  const { type, q, genre } = req.query;
  const where = [];
  const args = [req.user.id];
  if (type === 'movie' || type === 'series') { where.push('t.type = ?'); args.push(type); }
  if (typeof genre === 'string' && genre) { where.push('t.genre = ?'); args.push(genre); }
  if (typeof q === 'string' && q.trim()) {
    const term = like(q.trim().slice(0, 100));
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.genre LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' OR CAST(t.year AS TEXT) LIKE ? ESCAPE '\\')");
    args.push(term, term, term, term);
  }
  res.json(db.prepare(`SELECT ${TITLE_PUBLIC} FROM titles t ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.created_at DESC, t.id DESC`).all(...args));
});

app.get('/api/titles/:id', requireAccess, (req, res) => {
  const title = db.prepare(`SELECT ${TITLE_PUBLIC} FROM titles t WHERE t.id = ?`).get(req.user.id, Number(req.params.id));
  if (!title) fail('A tartalom nem található.', 404);
  const episodes = db.prepare('SELECT id, season, number, name FROM episodes WHERE title_id = ? ORDER BY season, number').all(title.id);
  res.json({ ...title, episodes });
});

// A videó csak érvényes előfizetéssel kérhető le, és pontosan azt kapja, amit a csomagja ad:
//  - a legjobb minőségű változatot, ami a csomag felső határáig elérhető (a magasabb linkek ki sem mennek a szerverről),
//  - és legfeljebb annyi egyidejű képernyőn, amennyit a csomag enged.
app.get('/api/watch/:id', requireAuth, async (req, res) => {
  const title = db.prepare('SELECT * FROM titles WHERE id = ?').get(Number(req.params.id));
  if (!title) fail('A tartalom nem található.', 404);
  await billing.syncUser(req.user.id);
  const ent = entitlements(req.user);
  if (!ent) fail('A megtekintéshez aktív előfizetés szükséges.', 402);

  let row = title;
  let episode = null;
  let episodes = [];
  if (title.type === 'series') {
    const all = db.prepare('SELECT id, season, number, name, video_url, video_url_1080, video_url_2160 FROM episodes WHERE title_id = ? ORDER BY season, number').all(title.id);
    if (!all.length) fail('Ehhez a sorozathoz még nincs epizód.', 404);
    const wanted = Number(req.query.episode);
    row = all.find((e) => e.id === wanted) || all[0];
    episode = { id: row.id, season: row.season, number: row.number, name: row.name };
    episodes = all.map((e) => ({ id: e.id, season: e.season, number: e.number, name: e.name }));
  }

  const source = pickSource(row, ent.maxQuality);
  if (!source) fail('Ehhez a videóhoz nincs a csomagodnak megfelelő minőségű változat.', 403);

  const stream = req.query.stream ? validStreamId(String(req.query.stream)) : randomBytes(12).toString('hex');
  claimStream(req.user.id, stream, ent.screens);

  res.json({
    title: title.title, type: title.type, url: signedMedia(source.url, req.user.id), kind: videoKind(source.url),
    quality: source.quality, qualityLabel: QUALITY_LABEL[source.quality],
    higherQuality: source.higher, higherLabel: source.higher ? QUALITY_LABEL[source.higher] : null,
    plan: ent.planName, screens: Number.isFinite(ent.screens) ? ent.screens : null,
    stream, episode, episodes,
  });
});

// A lejátszó percenként jelez, így a képernyők száma pontos marad. Ha a hely közben elfogyott, 429-et kap.
app.post('/api/watch/ping', requireAuth, (req, res) => {
  const ent = entitlements(req.user);
  if (!ent) fail('Az előfizetésed lejárt.', 402);
  claimStream(req.user.id, validStreamId(req.body.stream), ent.screens);
  res.json({ ok: true });
});

app.post('/api/watch/end', requireAuth, (req, res) => {
  db.prepare('DELETE FROM streams WHERE id = ? AND user_id = ?').run(validStreamId(req.body.stream), req.user.id);
  res.json({ ok: true });
});

// Feltöltött videófájlok. A <video> elem nem tud Authorization fejlécet küldeni, ezért a /api/watch által kiadott,
// aláírt és lejáró linkkel érhetők el. Minden kérésnél újra ellenőrizzük, hogy a felhasználónak még van-e hozzáférése
// (lejárt előfizetés vagy tiltás azonnal megszakítja a lejátszást). Range kéréseket is kezeli.
app.get('/media/:file', (req, res) => {
  const { file } = req.params;
  if (!MEDIA_RE.test(file)) return res.status(404).end();
  const uid = Number(req.query.u);
  const exp = Number(req.query.e);
  const sig = String(req.query.s || '');
  if (!Number.isInteger(uid) || !Number.isFinite(exp) || sig.length !== 64) return res.status(401).end();
  const expected = Buffer.from(mediaSig(file, uid, exp));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(401).end();
  if (exp < Date.now()) return res.status(403).end(); // érvényes aláírás, de lejárt link
  const viewer = db.prepare('SELECT * FROM users WHERE id = ? AND banned = 0').get(uid);
  if (!viewer || !hasAccess(viewer)) return res.status(402).end();
  res.sendFile(path.join(VIDEO_DIR, file), {
    headers: { 'Cache-Control': 'private, max-age=0', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' },
  }, (err) => { if (err && !res.headersSent) res.status(err.statusCode || 404).end(); });
});

// ---------- Kedvencek ----------

app.get('/api/favorites', requireAccess, (req, res) => {
  res.json(db.prepare(`
    SELECT ${TITLE_PUBLIC} FROM favorites fv JOIN titles t ON t.id = fv.title_id
    WHERE fv.user_id = ? ORDER BY fv.created_at DESC`).all(req.user.id, req.user.id));
});

app.put('/api/favorites/:id', requireAccess, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM titles WHERE id = ?').get(id)) fail('A tartalom nem található.', 404);
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, title_id, created_at) VALUES (?,?,?)').run(req.user.id, id, Date.now());
  res.json({ fav: true });
});

app.delete('/api/favorites/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND title_id = ?').run(req.user.id, Number(req.params.id));
  res.json({ fav: false });
});

// ---------- Ajánlások (felhasználó -> admin) ----------

const newRecommendationCount = () => db.prepare("SELECT COUNT(*) c FROM recommendations WHERE status = 'new'").get().c;

app.get('/api/recommendations', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, title, type, link, note, status, created_at FROM recommendations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id));
});

app.post('/api/recommendations', requireAuth, (req, res) => {
  const title = str(req.body.title, 'Cím', { max: 120 });
  const type = req.body.type;
  if (type !== 'movie' && type !== 'series') fail('Válaszd ki, hogy film vagy sorozat.');
  const rawLink = typeof req.body.link === 'string' ? req.body.link.trim() : '';
  const link = rawLink ? url(rawLink, 'Link') : null;
  const note = str(req.body.note ?? '', 'Megjegyzés', { min: 0, max: 500 });
  if (db.prepare("SELECT COUNT(*) c FROM recommendations WHERE user_id = ? AND status = 'new'").get(req.user.id).c >= 10)
    fail('Egyszerre legfeljebb 10 még elbírálatlan ajánlásod lehet. Várd meg, amíg az admin átnézi őket.', 429);
  const id = Number(db.prepare('INSERT INTO recommendations (user_id, title, type, link, note, created_at) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, title, type, link, note, Date.now()).lastInsertRowid);
  res.status(201).json({ id });
});


// ---------- Admin ----------

const admin = express.Router();
admin.use(requireAdmin);
app.use('/api/admin', admin);

admin.get('/stats', (req, res) => {
  const t = Date.now();
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  res.json({
    users: one('SELECT COUNT(*) c FROM users').c,
    newUsers: one('SELECT COUNT(*) c FROM users WHERE created_at > ?', t - 7 * DAY).c,
    activeSubs: one("SELECT COUNT(*) c FROM subscriptions WHERE expires_at > ? AND status = 'active'", t).c,
    cancelledSubs: one("SELECT COUNT(*) c FROM subscriptions WHERE expires_at > ? AND status = 'cancelled'", t).c,
    expiredSubs: one('SELECT COUNT(*) c FROM subscriptions WHERE expires_at <= ?', t).c,
    revenue30: one('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE created_at > ?', t - 30 * DAY).s,
    revenueTotal: one('SELECT COALESCE(SUM(amount),0) s FROM payments').s,
    titles: one('SELECT COUNT(*) c FROM titles').c,
    newRecommendations: newRecommendationCount(),
    tlsExpiresAt, // HTTPS tanúsítvány lejárata (null, ha a szerver nem maga szolgál ki HTTPS-t)
    payments: paymentsMode(),
    invoiceConfigured: sellerConfigured(), // az eladó adatai (név, cím, adószám) meg vannak-e adva a számlákhoz
    invoiceVatRate: sellerConfig().vatRate,
    stripeMode: billing.mode, // 'test', 'live' vagy null
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    byPlan: db.prepare(`
      SELECT p.name, COUNT(s.id) AS count FROM plans p
      LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.expires_at > ?
      GROUP BY p.id ORDER BY p.sort, p.price`).all(t),
  });
});

// Felhasználók
admin.get('/users', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.banned, u.created_at,
           s.id AS sub_id, s.status AS sub_status, s.expires_at, p.name AS plan_name
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    LEFT JOIN plans p ON p.id = s.plan_id
    ${q ? "WHERE u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'" : ''}
    ORDER BY u.created_at DESC LIMIT 500`).all(...(q ? [like(q), like(q)] : []));
  const t = Date.now();
  res.json(rows.map((r) => ({
    ...r,
    sub_state: r.sub_id ? subState({ status: r.sub_status, expires_at: r.expires_at }, t) : null,
  })));
});

admin.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) fail('A felhasználó nem található.', 404);
  const role = req.body.role ?? user.role;
  const banned = req.body.banned === undefined ? user.banned : req.body.banned ? 1 : 0;
  if (!['user', 'admin'].includes(role)) fail('Érvénytelen szerepkör.');
  if (id === req.user.id && (role !== 'admin' || banned)) fail('Saját magadat nem fokozhatod le és nem tilthatod le.');
  tx(() => {
    db.prepare('UPDATE users SET role = ?, banned = ? WHERE id = ?').run(role, banned, id);
    if (banned) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  });
  res.json({ ok: true });
});

// Stripe előfizetés megszüntetése (ha van és a Stripe be van állítva), hogy a számlázás ne folytatódjon tovább
async function stripeStop(row) {
  if (row && row.stripe_subscription_id && billing.enabled) await billing.cancelNow(row.stripe_subscription_id);
}

admin.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) fail('Saját fiókodat nem törölheted.');
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) fail('A felhasználó nem található.', 404);
  // Ha a Stripe előfizetés megszüntetése nem sikerül, a fiók nem törlődik (különben a számlázás folytatódna)
  await stripeStop(db.prepare('SELECT stripe_subscription_id FROM subscriptions WHERE user_id = ?').get(id));
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Előfizetések
admin.get('/subscriptions', (req, res) => {
  const t = Date.now();
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = db.prepare(`
    SELECT s.id, s.user_id, s.plan_id, s.status, s.started_at, s.expires_at,
           (s.stripe_subscription_id IS NOT NULL) AS stripe,
           u.email, u.name AS user_name, p.name AS plan_name, p.price
    FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id
    ${q ? "WHERE u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'" : ''}
    ORDER BY s.expires_at DESC LIMIT 500`).all(...(q ? [like(q), like(q)] : []));
  const withState = rows.map((r) => ({ ...r, stripe: !!r.stripe, state: subState(r, t) }));
  const f = req.query.state;
  res.json(['active', 'cancelled', 'expired'].includes(f) ? withState.filter((r) => r.state === f) : withState);
});

const daysArg = (v) => int(v, 'Napok száma', 1, 3650);
const activePlan = (id) => db.prepare('SELECT * FROM plans WHERE id = ?').get(int(id, 'Csomag', 1, 1e9)) || fail('A csomag nem található.', 404);

// A kártyás (Stripe) előfizetéseket a Stripe kezeli: az admin csak megszüntetheti vagy törölheti őket.
// Idő adása, csomagcsere és lejárat-szerkesztés csak az admin által adott (nem Stripe) előfizetésen lehetséges.
function assertNotStripeManaged(row) {
  if (row && row.stripe_subscription_id && row.expires_at > Date.now()) {
    fail('Ezt az előfizetést a Stripe kezeli (kártyás előfizetés). Itt csak megszüntetni vagy törölni lehet; időt adni, csomagot cserélni vagy lejáratot módosítani nem.', 409);
  }
}
// Lejárt Stripe-előfizetésnél a kapcsolatot megszüntetjük (a Stripe oldalon is leállítjuk), és admin által kezelt lesz
async function detachStripe(row) {
  if (!row || !row.stripe_subscription_id) return;
  await stripeStop(row);
  db.prepare('UPDATE subscriptions SET stripe_subscription_id = NULL, stripe_last_invoice = NULL, stripe_synced_at = NULL WHERE id = ?').run(row.id);
}
const rawSub = (id) => db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);

// Előfizetés adása egy felhasználónak (meglévőnél: csomagcsere + időtartam hozzáadása)
admin.post('/subscriptions', async (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(int(req.body.userId, 'Felhasználó', 1, 1e9));
  if (!user) fail('A felhasználó nem található.', 404);
  const plan = activePlan(req.body.planId);
  const days = daysArg(req.body.days);
  const existing = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id);
  assertNotStripeManaged(existing);
  await detachStripe(existing);
  const t = Date.now();
  tx(() => {
    const cur = getSub(user.id);
    if (!cur) {
      db.prepare('INSERT INTO subscriptions (user_id, plan_id, status, started_at, expires_at) VALUES (?,?,?,?,?)')
        .run(user.id, plan.id, 'active', t, t + days * DAY);
    } else {
      const start = cur.expires_at > t ? cur.started_at : t;
      const base = Math.max(t, cur.expires_at);
      db.prepare("UPDATE subscriptions SET plan_id = ?, status = 'active', started_at = ?, expires_at = ? WHERE user_id = ?")
        .run(plan.id, start, base + days * DAY, user.id);
    }
    recordPayment(user.id, plan.name, 0, 'admin_grant');
  });
  res.status(201).json({ subscription: subView(getSub(user.id)) });
});

admin.post('/subscriptions/:id/renew', async (req, res) => {
  const sub = db.prepare(`${SUB_SELECT} WHERE s.id = ?`).get(Number(req.params.id));
  if (!sub) fail('Az előfizetés nem található.', 404);
  const days = daysArg(req.body.days);
  assertNotStripeManaged(sub);
  await detachStripe(sub);
  tx(() => {
    db.prepare("UPDATE subscriptions SET status = 'active', expires_at = ? WHERE id = ?")
      .run(Math.max(Date.now(), sub.expires_at) + days * DAY, sub.id);
    recordPayment(sub.user_id, sub.plan_name, 0, 'admin_renew');
  });
  res.json({ ok: true });
});

// Azonnali megszüntetés (Stripe előfizetésnél a Stripe-ban is leáll a számlázás; a kifizetett időszakot nem téríti vissza)
admin.post('/subscriptions/:id/cancel', async (req, res) => {
  const sub = rawSub(Number(req.params.id));
  if (!sub) fail('Az előfizetés nem található.', 404);
  await stripeStop(sub);
  db.prepare("UPDATE subscriptions SET status = 'cancelled', expires_at = ? WHERE id = ?").run(Date.now(), sub.id);
  res.json({ ok: true });
});

admin.patch('/subscriptions/:id', async (req, res) => {
  const sub = rawSub(Number(req.params.id));
  if (!sub) fail('Az előfizetés nem található.', 404);
  const plan = activePlan(req.body.planId ?? sub.plan_id);
  const expires = req.body.expiresAt === undefined ? sub.expires_at : int(req.body.expiresAt, 'Lejárat', 0, 4102444800000);
  assertNotStripeManaged(sub);
  await detachStripe(sub);
  const status = expires > Date.now() && expires !== sub.expires_at ? 'active' : sub.status;
  db.prepare('UPDATE subscriptions SET plan_id = ?, expires_at = ?, status = ? WHERE id = ?').run(plan.id, expires, status, sub.id);
  res.json({ ok: true });
});

admin.delete('/subscriptions/:id', async (req, res) => {
  const sub = rawSub(Number(req.params.id));
  if (!sub) fail('Az előfizetés nem található.', 404);
  await stripeStop(sub); // különben a Stripe tovább számláznák
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(sub.id);
  res.json({ ok: true });
});

// Csomagok
admin.get('/plans', (req, res) => {
  res.json(db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id) AS subscribers
    FROM plans p ORDER BY p.sort, p.price`).all());
});

function planInput(b) {
  const maxQuality = Number(b.max_quality);
  if (!QUALITIES.includes(maxQuality)) fail('Minőség: válassz a listából (HD 720p, Full HD 1080p vagy 4K).');
  const price = int(b.price, 'Ár', 175, 1_000_000); // a Stripe minimuma 175 Ft
  return {
    name: str(b.name, 'Név', { max: 40 }),
    price,
    max_quality: maxQuality,
    quality: QUALITY_LABEL[maxQuality], // a felirat a minőségi szintből következik, így sosem tér el attól, amit a csomag ténylegesen ad
    screens: int(b.screens, 'Képernyők', 1, 20),
    description: str(b.description ?? '', 'Leírás', { min: 0, max: 200 }),
    active: b.active === false ? 0 : 1,
  };
}
admin.post('/plans', (req, res) => {
  const p = planInput(req.body);
  const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM plans').get().n;
  const id = Number(db.prepare('INSERT INTO plans (name, price, quality, max_quality, screens, description, active, sort) VALUES (?,?,?,?,?,?,?,?)')
    .run(p.name, p.price, p.quality, p.max_quality, p.screens, p.description, p.active, sort).lastInsertRowid);
  res.status(201).json({ id });
});
admin.patch('/plans/:id', (req, res) => {
  const p = planInput(req.body);
  const r = db.prepare('UPDATE plans SET name=?, price=?, quality=?, max_quality=?, screens=?, description=?, active=? WHERE id=?')
    .run(p.name, p.price, p.quality, p.max_quality, p.screens, p.description, p.active, Number(req.params.id));
  if (!r.changes) fail('A csomag nem található.', 404);
  res.json({ ok: true });
});
// Ha van rá előfizetés, csak elrejtjük az új előfizetők elől, különben törlődik.
admin.delete('/plans/:id', (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare('SELECT COUNT(*) c FROM subscriptions WHERE plan_id = ?').get(id).c;
  if (used) {
    db.prepare('UPDATE plans SET active = 0 WHERE id = ?').run(id);
    return res.json({ deactivated: true });
  }
  const r = db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  if (!r.changes) fail('A csomag nem található.', 404);
  res.json({ deleted: true });
});


// Videófeltöltés: nyers fájltörzs (PUT), streamelve a lemezre. Nincs memóriában pufferelés.
admin.put('/upload', async (req, res) => {
  if (req.get('x-impix-upload') !== '1') fail('Hibás feltöltési kérés.');
  const ext = path.extname(String(req.query.name || '')).slice(1).toLowerCase();
  if (!VIDEO_EXT.includes(ext)) fail('Csak .mp4, .m4v, .webm vagy .ogv videófájl tölthető fel.', 415);
  const declared = Number(req.get('content-length'));
  if (declared > MAX_UPLOAD) fail(`A fájl túl nagy (legfeljebb ${MAX_UPLOAD_MB} MB).`, 413);

  const file = `${randomBytes(16).toString('hex')}.${ext}`;
  const full = path.join(VIDEO_DIR, file);
  let size = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      if (size > MAX_UPLOAD) return cb(new HttpError(413, `A fájl túl nagy (legfeljebb ${MAX_UPLOAD_MB} MB).`));
      cb(null, chunk);
    },
  });
  try {
    await pipeline(req, limiter, fs.createWriteStream(full));
  } catch (err) {
    await fs.promises.rm(full, { force: true });
    if (req.destroyed) return; // a kliens megszakította a feltöltést
    throw err;
  }
  if (!size || !(await looksLikeVideo(full, ext))) {
    await fs.promises.rm(full, { force: true });
    fail('A fájl nem érvényes videó (a tartalma nem egyezik a kiterjesztéssel).', 415);
  }
  res.status(201).json({ url: `/media/${file}`, size });
});

// Kiállított számlák (könyveléshez): a PDF a /api/invoices/:id/pdf címen tölthető le
admin.get('/invoices', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const term = like(q);
  res.json(db.prepare(`
    SELECT id, number, issued_at, paid_at, buyer_name, buyer_email, description, period_start, period_end, net, vat_rate, vat, gross, payment_method
    FROM invoices
    ${q ? "WHERE number LIKE ? ESCAPE '\\' OR buyer_name LIKE ? ESCAPE '\\' OR buyer_email LIKE ? ESCAPE '\\'" : ''}
    ORDER BY year DESC, seq DESC LIMIT 500`).all(...(q ? [term, term, term] : [])));
});

// Ajánlások kezelése
admin.get('/recommendations', (req, res) => {
  const f = req.query.status;
  const rows = db.prepare(`
    SELECT r.*, u.name AS user_name, u.email
    FROM recommendations r JOIN users u ON u.id = r.user_id
    ${['new', 'added', 'rejected'].includes(f) ? 'WHERE r.status = ?' : ''}
    ORDER BY (r.status = 'new') DESC, r.created_at DESC LIMIT 500`).all(...(['new', 'added', 'rejected'].includes(f) ? [f] : []));
  res.json(rows);
});
admin.patch('/recommendations/:id', (req, res) => {
  if (!['new', 'added', 'rejected'].includes(req.body.status)) fail('Érvénytelen állapot.');
  const r = db.prepare('UPDATE recommendations SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id));
  if (!r.changes) fail('Az ajánlás nem található.', 404);
  res.json({ ok: true });
});
admin.delete('/recommendations/:id', (req, res) => {
  const r = db.prepare('DELETE FROM recommendations WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) fail('Az ajánlás nem található.', 404);
  res.json({ ok: true });
});

// Tartalmak
admin.get('/titles', (req, res) => {
  res.json(db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM episodes e WHERE e.title_id = t.id) AS episode_count FROM titles t ORDER BY t.created_at DESC, t.id DESC`).all());
});

function titleInput(b) {
  const type = b.type;
  if (type !== 'movie' && type !== 'series') fail('Érvénytelen típus.');
  const age = Number(b.age);
  if (!AGES.includes(age)) fail('Korhatár: válassz a listából (0, 6, 12, 16 vagy 18 év).');
  return {
    type,
    title: str(b.title, 'Cím', { max: 120 }),
    description: str(b.description, 'Leírás', { max: 1000 }),
    year: int(b.year, 'Elkészülés éve', 1888, new Date().getFullYear() + 2),
    genre: str(b.genre, 'Műfaj', { max: 40 }),
    age,
    rating: num(b.rating, 'Értékelés', 0, 10),
    duration_min: type === 'movie' ? int(b.duration_min, 'Hossz (perc)', 1, 1000) : null,
    hue: int(b.hue, 'Színárnyalat', 0, 359),
    // A videó három minőségi változata (alap 720p; a Full HD és a 4K nem kötelező). Sorozatnál az epizódoknál adják meg.
    ...(type === 'movie' ? videoSources(b) : { video_url: null, video_url_1080: null, video_url_2160: null }),
    featured: b.featured ? 1 : 0,
  };
}
const sourceList = (row) => (row ? [row.video_url, row.video_url_1080, row.video_url_2160] : []);

admin.post('/titles', (req, res) => {
  const t = titleInput(req.body);
  const id = Number(db.prepare(`INSERT INTO titles (type,title,description,year,genre,age,rating,duration_min,hue,video_url,video_url_1080,video_url_2160,featured,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t.type, t.title, t.description, t.year, t.genre, t.age, t.rating, t.duration_min, t.hue, t.video_url, t.video_url_1080, t.video_url_2160, t.featured, Date.now()).lastInsertRowid);
  res.status(201).json({ id });
});
admin.patch('/titles/:id', (req, res) => {
  const t = titleInput(req.body);
  const id = Number(req.params.id);
  const old = db.prepare('SELECT video_url, video_url_1080, video_url_2160 FROM titles WHERE id = ?').get(id);
  if (!old) fail('A tartalom nem található.', 404);
  db.prepare(`UPDATE titles SET type=?,title=?,description=?,year=?,genre=?,age=?,rating=?,duration_min=?,hue=?,video_url=?,video_url_1080=?,video_url_2160=?,featured=? WHERE id=?`)
    .run(t.type, t.title, t.description, t.year, t.genre, t.age, t.rating, t.duration_min, t.hue, t.video_url, t.video_url_1080, t.video_url_2160, t.featured, id);
  sourceList(old).forEach(releaseMedia); // amire már semmi nem hivatkozik, az törlődik
  res.json({ ok: true });
});
admin.delete('/titles/:id', (req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare('SELECT video_url, video_url_1080, video_url_2160 FROM titles WHERE id = ?').get(id);
  if (!t) fail('A tartalom nem található.', 404);
  const sources = [...sourceList(t), ...db.prepare('SELECT video_url, video_url_1080, video_url_2160 FROM episodes WHERE title_id = ?').all(id).flatMap(sourceList)];
  db.prepare('DELETE FROM titles WHERE id = ?').run(id);
  sources.forEach(releaseMedia);
  res.json({ ok: true });
});

admin.get('/titles/:id/episodes', (req, res) => {
  res.json(db.prepare('SELECT * FROM episodes WHERE title_id = ? ORDER BY season, number').all(Number(req.params.id)));
});
admin.post('/titles/:id/episodes', (req, res) => {
  const title = db.prepare("SELECT id FROM titles WHERE id = ? AND type = 'series'").get(Number(req.params.id));
  if (!title) fail('Sorozat nem található.', 404);
  const v = videoSources(req.body);
  const id = Number(db.prepare('INSERT INTO episodes (title_id, season, number, name, video_url, video_url_1080, video_url_2160) VALUES (?,?,?,?,?,?,?)')
    .run(title.id, int(req.body.season, 'Évad', 1, 100), int(req.body.number, 'Epizód száma', 1, 1000),
      str(req.body.name, 'Epizód címe', { max: 120 }), v.video_url, v.video_url_1080, v.video_url_2160).lastInsertRowid);
  res.status(201).json({ id });
});
admin.delete('/episodes/:id', (req, res) => {
  const id = Number(req.params.id);
  const ep = db.prepare('SELECT video_url, video_url_1080, video_url_2160 FROM episodes WHERE id = ?').get(id);
  if (!ep) fail('Az epizód nem található.', 404);
  db.prepare('DELETE FROM episodes WHERE id = ?').run(id);
  sourceList(ep).forEach(releaseMedia);
  res.json({ ok: true });
});

// ---------- Statikus fájlok és hibakezelés ----------

app.use('/api', (req, res) => res.status(404).json({ error: 'Nem létező végpont.' }));

// Jobb klikk / fejlesztői eszköz gyorsbillentyűk tiltása (elrettentés – nem valódi védelem).
// IMPIX_ALLOW_DEVTOOLS=1 esetén a szkript üres, így fejlesztés közben kikapcsolható.
const PROTECT_JS = fs.readFileSync(fileURLToPath(new URL('./public/protect.js', import.meta.url)), 'utf8');
app.get('/protect.js', (req, res) => {
  res.type('js').set('Cache-Control', 'no-cache').send(process.env.IMPIX_ALLOW_DEVTOOLS === '1' ? '' : PROTECT_JS);
});

app.use(express.static(fileURLToPath(new URL('./public/', import.meta.url))));

// Az alkalmazás belső címei (/plans, /watch/3, …) ugyanazt az oldalt adják, az útvonalat a böngészőben kezeli az app.js.
// (GitHub Pages-en ugyanezt a 404.html + spa-restore.js oldja meg.)
const INDEX_HTML = fileURLToPath(new URL('./public/index.html', import.meta.url));
app.use((req, res, next) => {
  if (req.method !== 'GET' || path.extname(req.path) || req.path.startsWith('/api/') || req.path.startsWith('/media/')) return next();
  res.sendFile(INDEX_HTML);
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError || err.isHttp) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Hibás JSON.' });
  if (typeof err.type === 'string' && err.type.startsWith('Stripe')) {
    // A Stripe hibáit a naplóba írjuk (kulcs nélkül), a felhasználónak általános üzenetet adunk
    console.error(`Stripe hiba: ${err.type} ${err.code || ''} ${err.message}`);
    return res.status(502).json({ error: 'A fizetési szolgáltatóval most nem sikerült kapcsolatot teremteni. Próbáld újra később.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Váratlan szerverhiba.' });
});

setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600_000).unref();
sweepMedia();
setInterval(sweepMedia, 3600_000).unref();

// ---------- HTTP / HTTPS indítás ----------
// Ha van tanúsítvány (tls/fullchain.pem + tls/privkey.pem, vagy TLS_CERT / TLS_KEY), a szerver maga szolgál ki HTTPS-t.
// Ez olyan tárhelyen kell, ahol nincs előtte nginx (pl. Pterodactyl). Tanúsítványcserénél nem kell újraindítani.

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const TLS_CERT = process.env.TLS_CERT || path.join(APP_DIR, 'tls', 'fullchain.pem');
const TLS_KEY = process.env.TLS_KEY || path.join(APP_DIR, 'tls', 'privkey.pem');
const USE_TLS = fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY);

// Beolvassa és ellenőrzi a tanúsítvány–kulcs párt. A lejáratot csak érvényes pár esetén jegyezzük meg.
function loadTls() {
  const cert = fs.readFileSync(TLS_CERT);
  const key = fs.readFileSync(TLS_KEY);
  const validTo = new Date(new X509Certificate(cert).validTo).getTime();
  tls.createSecureContext({ cert, key }); // hibát dob, ha a kulcs nem ehhez a tanúsítványhoz tartozik
  tlsExpiresAt = validTo;
  return { cert, key };
}
const tlsStamp = () => [TLS_CERT, TLS_KEY].map((f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } }).join('-');

let server;
if (USE_TLS) {
  let creds;
  try { creds = loadTls(); } catch (err) {
    console.error(`HIBA: a HTTPS tanúsítvány nem tölthető be (${err.message}).`);
    console.error(`Ellenőrizd a fájlokat: ${TLS_CERT} és ${TLS_KEY}`);
    process.exit(1);
  }
  server = https.createServer(creds, app);

  // Percenként megnézzük, cserélődtek-e a fájlok, és ha igen, újraindítás nélkül átvesszük az újat.
  let applied = tlsStamp();
  let failedFor = null;
  setInterval(() => {
    const stamp = tlsStamp();
    if (stamp === applied) return;
    try {
      server.setSecureContext(loadTls()); // loadTls() előbb ellenőrzi a párt: hibás pár mellett a futó szerverhez nem nyúlunk
      applied = stamp;
      failedFor = null;
      console.log(`HTTPS tanúsítvány frissítve, lejár: ${new Date(tlsExpiresAt).toLocaleDateString('hu-HU')}`);
    } catch (err) {
      // Pl. a tanúsítvány már felkerült, de a kulcs még nem: a következő percben újra próbáljuk.
      if (failedFor !== stamp) { console.error(`HTTPS tanúsítvány frissítése sikertelen (${err.message}). Újrapróbálom.`); failedFor = stamp; }
    }
  }, 60_000).unref();
} else {
  server = http.createServer(app);
}

server.listen(PORT, () => {
  console.log(`Impix fut: ${USE_TLS ? 'https' : 'http'}://localhost:${PORT}`);
  if (USE_TLS) {
    const days = Math.floor((tlsExpiresAt - Date.now()) / 86_400_000);
    console.log(`HTTPS aktív. A tanúsítvány lejár: ${new Date(tlsExpiresAt).toLocaleDateString('hu-HU')} (${days} nap múlva).`);
    if (days < 21) console.warn('FIGYELEM: a tanúsítvány hamarosan lejár, újítsd meg!');
  } else {
    console.warn('FIGYELEM: nincs HTTPS tanúsítvány, a szerver titkosítatlan HTTP-n fut (csak tesztre jó).');
  }
});
server.requestTimeout = 60 * 60_000; // nagy videófeltöltésekhez
