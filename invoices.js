// Számlák kiállítása. A számla a kifizetett előfizetési díjról készül, sorszámozva, és utólag nem módosul.
//
// Az eladó adatai a környezeti változókból (.env) jönnek, és kiállításkor pillanatképként a számlához mentődnek:
//   SELLER_NAME, SELLER_ADDRESS, SELLER_TAX_ID (adószám), SELLER_EMAIL, SELLER_VAT_RATE (%, alap: 27),
//   SELLER_VAT_NOTE (pl. alanyi adómentesség szövege), INVOICE_PREFIX (alap: IMPIX)
import db, { tx } from './db.js';

const env = (k, d = '') => (process.env[k] ?? d).trim();

export function sellerConfig() {
  const rate = Number(env('SELLER_VAT_RATE', '27'));
  const vatRate = Number.isFinite(rate) && rate >= 0 && rate <= 27 ? Math.round(rate) : 27;
  return {
    name: env('SELLER_NAME'),
    address: env('SELLER_ADDRESS'),
    taxId: env('SELLER_TAX_ID'),
    email: env('SELLER_EMAIL'),
    vatRate,
    vatNote: env('SELLER_VAT_NOTE') || (vatRate === 0 ? 'Alanyi adómentes' : ''),
    prefix: env('INVOICE_PREFIX', 'IMPIX').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'IMPIX',
  };
}

// A számlázási adatok megvannak-e (az admin panel figyelmeztet, ha nem)
export const sellerConfigured = () => {
  const s = sellerConfig();
  return !!(s.name && s.address && s.taxId);
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
    const seq = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM invoices WHERE year = ?').get(year).n;
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
