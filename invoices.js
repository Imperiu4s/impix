// Számlák kiállítása. A számla a kifizetett előfizetési díjról készül, sorszámozva, és utólag nem módosul.
//
// A szolgáltató (eladó) adatai. Az admin panel „Cégadatok” fülén adhatók meg (az adatbázisba mentődnek, a `settings` táblába),
// tartalékként a környezeti változók (.env) szolgálnak: SELLER_NAME, SELLER_ADDRESS, SELLER_TAX_ID (adószám), SELLER_EMAIL,
// SELLER_PHONE, SELLER_REG_NUMBER, SELLER_REG_LABEL, HOSTING_NAME, HOSTING_ADDRESS, HOSTING_EMAIL, SELLER_VAT_RATE (%, alap: 27),
// SELLER_VAT_NOTE (pl. alanyi adómentesség szövege). INVOICE_PREFIX (alap: IMPIX) csak .env-ből állítható.
// A számla kiállításkor pillanatképként tárolja az eladó adatait.
import db, { tx } from './db.js';

const env = (k, d = '') => (process.env[k] ?? d).trim();

const ENV_KEYS = {
  name: 'SELLER_NAME', address: 'SELLER_ADDRESS', taxId: 'SELLER_TAX_ID', email: 'SELLER_EMAIL', phone: 'SELLER_PHONE',
  regNumber: 'SELLER_REG_NUMBER', businessType: 'SELLER_BUSINESS_TYPE',
  hostingName: 'HOSTING_NAME', hostingAddress: 'HOSTING_ADDRESS', hostingEmail: 'HOSTING_EMAIL',
  vatRate: 'SELLER_VAT_RATE', vatNote: 'SELLER_VAT_NOTE', invoiceMonths: 'INVOICE_RETENTION_MONTHS',
};
export const DEFAULT_BUSINESS_TYPE = 'egyéni vállalkozó';
export const DEFAULT_INVOICE_MONTHS = 3;
export const SETTING_KEYS = Object.keys(ENV_KEYS);

function storedSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}
// Az admin panelen mentett érték; ha nincs, a .env
const pick = (stored, key) => (stored[key] ?? '').trim() || env(ENV_KEYS[key]);

// Minden szolgáltatói adat szövegként (a jogi oldalak és az admin űrlap használja)
export function legalConfig() {
  const s = storedSettings();
  const c = Object.fromEntries(SETTING_KEYS.map((k) => [k, pick(s, k)]));
  c.businessType = c.businessType || DEFAULT_BUSINESS_TYPE;
  return c;
}

// Hány hónapig marad meg egy számla a rendszerben (0 = nem törlődik). Alapértelmezés: 3 hónap.
export function invoiceRetentionMonths() {
  const raw = pick(storedSettings(), 'invoiceMonths');
  const n = raw === '' ? DEFAULT_INVOICE_MONTHS : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 120) : DEFAULT_INVOICE_MONTHS;
}
const MONTH_MS = 30 * 86_400_000;
// A lejárt (a megőrzési időnél régebbi) számlák törlése. Visszaadja a törölt számlák számát.
export function purgeOldInvoices() {
  const months = invoiceRetentionMonths();
  if (!months) return 0;
  return Number(db.prepare('DELETE FROM invoices WHERE issued_at < ?').run(Date.now() - months * MONTH_MS).changes);
}
export const invoiceExpiresAt = (issuedAt) => { const m = invoiceRetentionMonths(); return m ? issuedAt + m * MONTH_MS : null; };

// Mentés az admin panelről: az üres érték törli a mentett adatot (ilyenkor a .env tartaléka él)
export function saveSettings(values) {
  tx(() => {
    for (const k of SETTING_KEYS) {
      if (!(k in values)) continue;
      const v = String(values[k] ?? '').trim();
      if (v) db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
      else db.prepare('DELETE FROM settings WHERE key = ?').run(k);
    }
  });
}

export function sellerConfig() {
  const s = storedSettings();
  const rate = Number(pick(s, 'vatRate') || '27');
  const vatRate = Number.isFinite(rate) && rate >= 0 && rate <= 27 ? Math.round(rate) : 27;
  return {
    name: pick(s, 'name'),
    address: pick(s, 'address'),
    taxId: pick(s, 'taxId'),
    email: pick(s, 'email'),
    businessType: pick(s, 'businessType') || DEFAULT_BUSINESS_TYPE,
    vatRate,
    vatNote: pick(s, 'vatNote') || (vatRate === 0 ? 'Alanyi adómentes' : ''),
    prefix: env('INVOICE_PREFIX', 'IMPIX').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'IMPIX',
  };
}

// A számlázási adatok megvannak-e (az admin panel figyelmeztet, ha nem)
export const sellerConfigured = () => {
  const s = sellerConfig();
  return !!(s.name && s.address);
};

// A bruttó (a vásárló által fizetett) összegből számolt nettó és ÁFA. Forintban, egész számra kerekítve.
export function vatBreakdown(gross, rate) {
  if (!rate) return { net: gross, vat: 0 };
  const net = Math.round(gross / (1 + rate / 100));
  return { net, vat: gross - net };
}

// Számla kiállítása egy kifizetett tételhez. Ugyanarra a fizetésre csak egyszer készül (ismételt hívás a meglévőt adja).
export function issueInvoice({ paymentId, userId, gross, paidAt, planName, periodStart, periodEnd, buyer, paymentMethod, reference = '' }) {
  if (!(gross > 0)) return null; // ingyenes (admin által adott) tételről nem készül számla
  return tx(() => {
    const existing = db.prepare('SELECT * FROM invoices WHERE payment_id = ?').get(paymentId);
    if (existing) return existing;

    const seller = sellerConfig();
    const issuedAt = Date.now();
    const year = new Date(issuedAt).getFullYear();
    // A sorszámláló külön is tárolódik, mert a régi számlák törlődhetnek, és a sorszám akkor sem ismétlődhet
    const counterKey = `invoiceSeq_${year}`;
    const counter = Number((db.prepare('SELECT value FROM settings WHERE key = ?').get(counterKey) || {}).value) || 0;
    const maxRow = db.prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM invoices WHERE year = ?').get(year).n;
    const seq = Math.max(counter, maxRow) + 1;
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(counterKey, String(seq));
    const number = `${seller.prefix}-${year}-${String(seq).padStart(6, '0')}`;
    const { net, vat } = vatBreakdown(gross, seller.vatRate);

    const id = Number(db.prepare(`INSERT INTO invoices
      (year, seq, number, user_id, payment_id, issued_at, paid_at, buyer_name, buyer_email, buyer_address,
       description, period_start, period_end, net, vat_rate, vat, gross, payment_method, reference, seller)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(year, seq, number, userId, paymentId, issuedAt, paidAt, buyer.name, buyer.email, buyer.address || '',
        `Impix ${planName} előfizetés`, periodStart ?? null, periodEnd ?? null, net, seller.vatRate, vat, gross,
        paymentMethod, reference, JSON.stringify(seller)).lastInsertRowid);
    return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  });
}

// Egy Stripe ügyfél címéből egysoros cím: "1051 Budapest, Fő utca 1., HU"
export function formatAddress(a) {
  if (!a) return '';
  const cityLine = [a.postal_code, a.city].filter(Boolean).join(' ');
  return [cityLine, a.line1, a.line2, a.state, a.country].filter(Boolean).join(', ');
}
