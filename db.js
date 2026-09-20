import './env.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('./data/', import.meta.url));
const dbFile = process.env.IMPIX_DB || `${dataDir}impix.db`;
fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true }); // csak arra a mappára van szükség, ahová az adatbázis kerül

const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  banned        INTEGER NOT NULL DEFAULT 0,
  prefs         TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  quality     TEXT NOT NULL,
  screens     INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0
);

-- Felhasználónként egy előfizetés-rekord; a korábbi fizetések a payments táblában maradnak.
CREATE TABLE IF NOT EXISTS subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id    INTEGER NOT NULL REFERENCES plans(id),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  plan_name  TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS titles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL CHECK (type IN ('movie','series')),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  year         INTEGER NOT NULL,
  genre        TEXT NOT NULL,
  age          INTEGER NOT NULL DEFAULT 12,
  rating       REAL NOT NULL DEFAULT 7,
  duration_min INTEGER,
  hue          INTEGER NOT NULL DEFAULT 0,
  video_url    TEXT,
  featured     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS episodes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id  INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season    INTEGER NOT NULL DEFAULT 1,
  number    INTEGER NOT NULL,
  name      TEXT NOT NULL,
  video_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id   INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, title_id)
);

-- Felhasználók ajánlásai az adminnak (mit vegyen fel a katalógusba)
CREATE TABLE IF NOT EXISTS recommendations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('movie','series')),
  link       TEXT,
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','added','rejected')),
  created_at INTEGER NOT NULL
);

-- Kiállított számlák. Kiállítás után a tartalmuk nem változik (az eladó és a vevő adatai pillanatképként tárolódnak),
-- és a felhasználó vagy a fizetés törlésekor is megmaradnak (a számlákat jogszabály szerint meg kell őrizni).
CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  year           INTEGER NOT NULL,
  seq            INTEGER NOT NULL,
  number         TEXT NOT NULL UNIQUE,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_id     INTEGER UNIQUE REFERENCES payments(id) ON DELETE SET NULL,
  issued_at      INTEGER NOT NULL,
  paid_at        INTEGER NOT NULL,
  buyer_name     TEXT NOT NULL,
  buyer_email    TEXT NOT NULL,
  buyer_address  TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL,
  period_start   INTEGER,
  period_end     INTEGER,
  net            INTEGER NOT NULL,
  vat_rate       INTEGER NOT NULL,
  vat            INTEGER NOT NULL,
  gross          INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  reference      TEXT NOT NULL DEFAULT '',
  seller         TEXT NOT NULL,
  UNIQUE (year, seq)
);

-- Egyidejű lejátszások nyilvántartása (a csomag képernyőszámának betartatásához)
CREATE TABLE IF NOT EXISTS streams (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_episodes_title ON episodes(title_id, season, number);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_user ON streams(user_id);
`);

// ---- Séma-frissítések meglévő adatbázisokhoz (többször is lefuthatnak) ----

function addColumn(table, column, ddl) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  return !exists;
}

// A csomag által adott legnagyobb videóminőség (magasság pixelben): 720, 1080 vagy 2160 (4K)
if (addColumn('plans', 'max_quality', 'INTEGER NOT NULL DEFAULT 720')) {
  db.exec(`UPDATE plans SET max_quality = CASE
    WHEN quality LIKE '%4K%' OR quality LIKE '%2160%' THEN 2160
    WHEN quality LIKE '%1080%' THEN 1080 ELSE 720 END`);
}
// Stripe kapcsolatok
addColumn('plans', 'stripe_product_id', 'TEXT');
addColumn('plans', 'stripe_price_id', 'TEXT');
addColumn('plans', 'stripe_price_amount', 'INTEGER');
addColumn('users', 'stripe_customer_id', 'TEXT');
addColumn('subscriptions', 'stripe_subscription_id', 'TEXT');
addColumn('subscriptions', 'stripe_last_invoice', 'TEXT');
addColumn('subscriptions', 'stripe_synced_at', 'INTEGER');
// Melyik Stripe számlához tartozik a fizetés (így egy számla csak egyszer kerül rögzítésre)
addColumn('payments', 'stripe_invoice_id', 'TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_invoice ON payments(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL');
// Magasabb minőségű változatok (a videó alap, azaz `video_url` a 720p vagy alacsonyabb változat)
for (const table of ['titles', 'episodes']) {
  addColumn(table, 'video_url_1080', 'TEXT');
  addColumn(table, 'video_url_2160', 'TEXT');
}

// Borítókép (feltöltött fájl neve a covers/ mappában; ha nincs, a `hue` színárnyalatból készül háttér)
addColumn('titles', 'poster', 'TEXT');
// Elfogadott feltételek naplója (ÁSZF és adatkezelési tájékoztató elfogadása regisztrációkor, a digitális szolgáltatás
// azonnali megkezdésére adott hozzájárulás vásárláskor). Bizonyíthatóság: ki, mit, mikor, a szöveg melyik változatára.
db.exec(`CREATE TABLE IF NOT EXISTS consents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  version    TEXT NOT NULL,
  plan_id    INTEGER,
  created_at INTEGER NOT NULL
)`);

// Tranzakció. Egymásba ágyazható: a belső hívás a külső tranzakció része lesz, hiba esetén az egész visszagörgetődik.
let txDepth = 0;
export function tx(fn) {
  if (txDepth > 0) return fn();
  db.exec('BEGIN');
  txDepth++;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    txDepth--;
  }
}

// ---- Kezdő adatok (csak üres adatbázisnál) ----

// Bemutató videók: szabad licencű (Blender Foundation, CC0) anyagok külső tárhelyről.
// Az admin panelen bármelyik tartalom videója kicserélhető a saját címedre.
const V = {
  bunny: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  elephants: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4',
  sintel: 'https://archive.org/download/Sintel/sintel-2048-stereo.mp4',
  sintelShort: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4',
  trailer: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
};

export function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM plans').get().c === 0) {
    const ins = db.prepare('INSERT INTO plans (name, price, quality, max_quality, screens, description, sort) VALUES (?,?,?,?,?,?,?)');
    ins.run('Alap', 1490, 'HD (720p)', 720, 1, 'Egy képernyő, korlátlan filmek és sorozatok HD minőségben.', 1);
    ins.run('Standard', 2490, 'Full HD (1080p)', 1080, 2, 'Két képernyő egyszerre, Full HD minőségben.', 2);
    ins.run('Prémium', 3490, 'Ultra HD (4K)', 2160, 4, 'Négy képernyő egyszerre, 4K minőségben.', 3);
  }

  if (db.prepare('SELECT COUNT(*) c FROM titles').get().c === 0) {
    const t = db.prepare(`INSERT INTO titles
      (type, title, description, year, genre, age, rating, duration_min, hue, video_url, featured, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const e = db.prepare('INSERT INTO episodes (title_id, season, number, name, video_url) VALUES (?,?,?,?,?)');
    const now = Date.now();
    const movie = (title, description, year, genre, age, rating, min, hue, url, featured = 0) =>
      t.run('movie', title, description, year, genre, age, rating, min, hue, url, featured, now);
    const series = (title, description, year, genre, age, rating, hue, eps, featured = 0) => {
      const id = Number(t.run('series', title, description, year, genre, age, rating, null, hue, null, featured, now).lastInsertRowid);
      eps.forEach(([name, url], i) => e.run(id, 1, i + 1, name, url));
    };

    movie('Éjféli Expressz', 'Egy különös vonat minden éjjel ugyanabban a percben indul – és egyetlen utasa sem száll le ugyanott, ahol felszállt.', 2024, 'Thriller', 16, 8.2, 112, 265, V.bunny, 1);
    movie('Neon Város', 'A jövő metropolisában egy futár olyan csomagot kap, amely felboríthatja a hatalmi egyensúlyt.', 2023, 'Sci-fi', 12, 7.9, 104, 300, V.sintel, 1);
    movie('Az Utolsó Hajnal', 'Egy világítótoronyőr és egy váratlan vendég története a világ végén.', 2022, 'Dráma', 12, 8.5, 96, 25, V.elephants);
    movie('Acélszív', 'Egy visszavonult mérnök építi meg élete legnagyobb gépét – és a gép választ akar.', 2024, 'Sci-fi', 12, 7.4, 118, 200, V.trailer);
    movie('Vad Hajsza', 'Autós üldözés a hegyek között, ahol minden kanyar életet menthet vagy vehet el.', 2021, 'Akció', 16, 7.1, 101, 8, V.bunny);
    movie('Nevetve Nyaralás', 'Három család, egy szálloda és egy elrontott foglalás: a káosz garantált.', 2023, 'Vígjáték', 6, 6.8, 93, 45, V.bunny);
    movie('Lángoló Égbolt', 'Egy tűzoltópilóta mindent kockára tesz, hogy megmentsen egy elzárt falut.', 2022, 'Akció', 12, 7.6, 108, 15, V.flower);
    movie('Menekülés a Sivatagba', 'Egy térképész eltéved a homoktengerben, ahol a fatamorgana valósággá válik.', 2020, 'Kaland', 12, 7.2, 99, 35, V.sintelShort);
    movie('Olvadás', 'Egy sarki kutatóállomás lakói rájönnek, hogy a jég alatt valami ébredezik.', 2024, 'Thriller', 16, 7.8, 107, 190, V.flower);

    series('Árnyak a Városban', 'Egy nyomozó minden epizódban egy újabb réteget fed fel a város rejtett hatalmi hálójából.', 2024, 'Krimi', 16, 8.7, 250,
      [['Az első nyom', V.bunny], ['Hamis alibi', V.elephants], ['A tanú', V.sintel], ['Leszámolás', V.trailer]], 1);
    series('Csillagkapu Akadémia', 'Fiatal kadétok tanulják a csillagközi navigációt – és a felelősséget.', 2023, 'Sci-fi', 12, 8.0, 285,
      [['Felvételi', V.sintel], ['Első repülés', V.trailer], ['Vészhelyzet', V.trailer]]);
    series('Konyhafőnök', 'Egy családi étterem küzd a túlélésért – humorral, szenvedéllyel és rengeteg vajjal.', 2022, 'Vígjáték', 6, 7.3, 40,
      [['Nyitás', V.bunny], ['Kritikus vendég', V.flower], ['Tűz van!', V.flower]]);
    series('Hullámtörők', 'Egy tengerparti kisváros lakói és a tenger, amely sosem adja vissza, amit elvett.', 2024, 'Dráma', 12, 8.3, 195,
      [['Apály', V.elephants], ['Dagály', V.sintelShort]]);
    series('Roncsderby', 'Amatőr versenyzők, rozsdás autók, óriási tét. Minden futam más szabályok szerint.', 2021, 'Akció', 12, 7.0, 5,
      [['Rajtvonal', V.bunny], ['Sárfürdő', V.sintelShort], ['Döntő', V.elephants]]);
  }
}

export default db;
