// Stripe-alapú fizetés és előfizetés-kezelés.
//
// Működés röviden:
//  - A felhasználó a Stripe Checkout oldalán fizet (kártyaadatot mi soha nem látunk).
//  - A Stripe az igazság forrása: a helyi `subscriptions` sor a Stripe előfizetés másolata (lejárat, lemondás).
//  - Szinkron: (1) a fizetés utáni visszatéréskor, (2) webhookokból, (3) a felhasználó kérésekor időnként újralekérdezve.
//    Így akkor is helyes marad az állapot, ha a webhook nem ér el a szerverhez.
import Stripe from 'stripe';
import db, { tx } from './db.js';

const DAY = 86_400_000;
const KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CURRENCY = 'huf';

export const enabled = KEY !== '';
export const mode = !KEY ? null : /^(sk|rk)_live_/.test(KEY) ? 'live' : 'test';
export const siteUrl = (process.env.SITE_URL || 'https://impix.hu').replace(/\/+$/, '');

export class BillingError extends Error {
  constructor(status, message) { super(message); this.status = status; this.isHttp = true; }
}

let stripe = null;
if (enabled) {
  const options = { maxNetworkRetries: 2, appInfo: { name: 'Impix' } };
  if (process.env.STRIPE_API_BASE) { // csak fejlesztéshez/teszthez: hamis Stripe szerver
    const u = new URL(process.env.STRIPE_API_BASE);
    Object.assign(options, { host: u.hostname, port: u.port, protocol: u.protocol.replace(':', '') });
  }
  stripe = new Stripe(KEY, options);
}

function client() {
  if (!stripe) throw new BillingError(503, 'A bankkártyás fizetés még nincs beállítva.');
  return stripe;
}

const idOf = (x) => (x && typeof x === 'object' ? x.id : x) || null;
const now = () => Date.now();
export const isStripeManaged = (row) => !!(row && row.stripe_subscription_id);

// A Stripe a forintot két tizedessel kezeli: 1490 Ft = 149000
const unitAmount = (forint) => Math.round(forint * 100);

// ---------- Stripe objektumok (ügyfél, ár) ----------

async function ensureCustomer(user, forceNew = false) {
  if (user.stripe_customer_id && !forceNew) return user.stripe_customer_id;
  const customer = await client().customers.create({
    email: user.email, name: user.name, metadata: { user_id: String(user.id) },
  });
  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, user.id);
  return customer.id;
}

// A csomaghoz tartozó Stripe termék és havi ár. Ha az admin megváltoztatta az árat, új Stripe árat hozunk létre
// (a már meglévő előfizetők a régi áron maradnak, ez a Stripe szokásos működése).
async function ensurePrice(plan) {
  if (plan.stripe_price_id && plan.stripe_price_amount === plan.price) return plan.stripe_price_id;
  const s = client();
  let productId = plan.stripe_product_id;
  if (productId) {
    await s.products.update(productId, { name: `Impix ${plan.name}` }).catch(() => { productId = null; });
  }
  if (!productId) {
    productId = (await s.products.create({ name: `Impix ${plan.name}`, metadata: { plan_id: String(plan.id) } })).id;
  }
  const price = await s.prices.create({
    product: productId, currency: CURRENCY, unit_amount: unitAmount(plan.price),
    recurring: { interval: 'month' }, metadata: { plan_id: String(plan.id) },
  });
  db.prepare('UPDATE plans SET stripe_product_id = ?, stripe_price_id = ?, stripe_price_amount = ? WHERE id = ?')
    .run(productId, price.id, plan.price, plan.id);
  return price.id;
}

// ---------- Fizetés indítása ----------

export async function createCheckout(user, plan) {
  const s = client();
  const priceId = await ensurePrice(plan);
  const meta = { user_id: String(user.id), plan_id: String(plan.id) };
  const params = (customer) => ({
    mode: 'subscription',
    customer,
    client_reference_id: String(user.id),
    line_items: [{ price: priceId, quantity: 1 }],
    // A hash előtti query-ben jön vissza a munkamenet azonosítója (a weboldal hash-alapú útvonalkezelést használ)
    success_url: `${siteUrl}/?checkout_session={CHECKOUT_SESSION_ID}#/payment/return`,
    cancel_url: `${siteUrl}/#/plans`,
    locale: 'hu',
    metadata: meta,
    subscription_data: { metadata: meta },
  });
  let customer = await ensureCustomer(user);
  try {
    return (await s.checkout.sessions.create(params(customer))).url;
  } catch (err) {
    // Teszt- és éles kulcs közötti váltáskor a korábbi ügyfélazonosító nem létezik: újat hozunk létre
    if (err.code === 'resource_missing' && /customer/.test(err.param || '')) {
      customer = await ensureCustomer(user, true);
      return (await s.checkout.sessions.create(params(customer))).url;
    }
    throw err;
  }
}

// A fizetés utáni visszatérés: lekérdezzük a Checkout munkamenetet, és ha kifizették, aktiváljuk az előfizetést.
export async function confirmCheckout(user, sessionId) {
  if (!/^cs_[A-Za-z0-9_]{10,}$/.test(String(sessionId))) throw new BillingError(400, 'Érvénytelen fizetési azonosító.');
  const session = await client().checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== String(user.id)) throw new BillingError(403, 'Ez a fizetés nem a te fiókodhoz tartozik.');
  if (session.mode !== 'subscription') throw new BillingError(400, 'Érvénytelen fizetés típus.');
  if (session.status !== 'complete') return { status: 'open' };
  const subId = idOf(session.subscription);
  if (!subId) return { status: 'pending' };
  await syncSubscription(subId, { userId: user.id, planId: Number(session.metadata && session.metadata.plan_id) });
  return { status: session.payment_status === 'paid' ? 'paid' : 'pending' };
}

// ---------- Szinkron: Stripe → helyi adatbázis ----------

export async function syncSubscription(subscriptionId, hint = {}) {
  const sub = await client().subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
  return applyStripeSubscription(sub, hint);
}

function periodEndOf(sub) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  const seconds = (item && item.current_period_end) || sub.current_period_end;
  return seconds ? seconds * 1000 : null;
}

function planIdFor(sub, hint, local) {
  const wanted = Number(hint.planId || (sub.metadata && sub.metadata.plan_id));
  if (wanted && db.prepare('SELECT 1 FROM plans WHERE id = ?').get(wanted)) return wanted;
  const priceId = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
  const byPrice = priceId && db.prepare('SELECT id FROM plans WHERE stripe_price_id = ?').get(priceId);
  return (byPrice && byPrice.id) || (local && local.plan_id) || null;
}

export function applyStripeSubscription(sub, hint = {}) {
  const customerId = idOf(sub.customer);
  const byStripeId = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(sub.id);

  let userId = (byStripeId && byStripeId.user_id) || hint.userId || Number(sub.metadata && sub.metadata.user_id) || null;
  if (!userId) userId = (db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(customerId) || {}).id || null;
  const user = userId && db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  if (user.stripe_customer_id && customerId && user.stripe_customer_id !== customerId) return null; // nem az övé

  const local = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id);
  const sameSub = !!local && local.stripe_subscription_id === sub.id;
  const t = now();

  // Egy másik (régebbi) Stripe előfizetésről érkező esemény nem írhatja felül az újabbat
  if (local && local.stripe_subscription_id && !sameSub) {
    const newer = !!hint.userId || sub.created * 1000 >= local.started_at - 1000;
    if (!newer) return local;
  }
  // Megszűnt előfizetés csak akkor módosít, ha ehhez a rekordhoz tartozik
  if (sub.status === 'canceled' && !sameSub) return local || null;
  // Még ki nem fizetett (függő) új előfizetés nem ad hozzáférést
  if ((sub.status === 'incomplete' || sub.status === 'incomplete_expired') && !sameSub) return local || null;

  const planId = planIdFor(sub, hint, local);
  if (!planId) return local || null;

  const cancelling = !!(sub.cancel_at_period_end || sub.cancel_at);
  let status = cancelling ? 'cancelled' : 'active';
  let expiresAt;
  if (sub.status === 'active' || sub.status === 'trialing') {
    expiresAt = periodEndOf(sub) || t;
  } else if (sub.status === 'canceled') {
    status = 'cancelled';
    expiresAt = sub.ended_at ? sub.ended_at * 1000 : t;
  } else {
    // past_due, unpaid, paused, incomplete: a hozzáférés nem hosszabbodik, a régi lejárat marad
    expiresAt = sameSub ? local.expires_at : t;
  }

  // Kifizetett számla → fizetési előzmény (számlánként egyszer)
  const invoice = sub.latest_invoice && typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null;
  let lastInvoice = sameSub ? local.stripe_last_invoice : null;
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);

  tx(() => {
    if (invoice && invoice.status === 'paid' && invoice.id !== lastInvoice) {
      const amount = Math.round((invoice.amount_paid || 0) / 100);
      if (amount > 0) {
        db.prepare('INSERT INTO payments (user_id, user_email, plan_name, amount, kind, created_at) VALUES (?,?,?,?,?,?)')
          .run(user.id, user.email, plan.name, amount, sameSub ? 'stripe_renew' : 'stripe_subscribe', t);
      }
      lastInvoice = invoice.id;
    }
    if (local) {
      db.prepare(`UPDATE subscriptions SET plan_id = ?, status = ?, started_at = ?, expires_at = ?,
        stripe_subscription_id = ?, stripe_last_invoice = ?, stripe_synced_at = ? WHERE user_id = ?`)
        .run(planId, status, sameSub ? local.started_at : sub.start_date * 1000, expiresAt, sub.id, lastInvoice, t, user.id);
    } else {
      db.prepare(`INSERT INTO subscriptions (user_id, plan_id, status, started_at, expires_at,
        stripe_subscription_id, stripe_last_invoice, stripe_synced_at) VALUES (?,?,?,?,?,?,?,?)`)
        .run(user.id, planId, status, sub.start_date * 1000, expiresAt, sub.id, lastInvoice, t);
    }
  });

  // Csomagváltásnál a régi Stripe előfizetést azonnal megszüntetjük, hogy ne számlázzon tovább
  if (local && local.stripe_subscription_id && !sameSub && stripe) {
    stripe.subscriptions.cancel(local.stripe_subscription_id).catch((err) => {
      if (err.code !== 'resource_missing') console.error('A régi Stripe előfizetés megszüntetése nem sikerült:', err.message);
    });
  }
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id);
}

// Időnként újralekérdezi a felhasználó Stripe előfizetését (megújulás, külső lemondás, sikertelen fizetés).
export async function syncUser(userId, { force = false } = {}) {
  if (!stripe) return;
  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (!isStripeManaged(row)) return;
  const t = now();
  if (!force) {
    if (row.expires_at < t - 14 * DAY) return; // régen lejárt, nincs mit frissíteni
    const ttl = row.expires_at - t > 3 * DAY ? 15 * 60_000 : 2 * 60_000; // lejárat közelében gyakrabban
    if (t - (row.stripe_synced_at || 0) < ttl) return;
  }
  db.prepare('UPDATE subscriptions SET stripe_synced_at = ? WHERE user_id = ?').run(t, userId); // hiba esetén se hívjuk folyton
  try {
    await syncSubscription(row.stripe_subscription_id);
  } catch (err) {
    console.error(`Stripe szinkron hiba (felhasználó ${userId}):`, err.message);
  }
}

// ---------- Kezelés ----------

export async function cancelAtPeriodEnd(userId) {
  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (!isStripeManaged(row)) throw new BillingError(400, 'Ez az előfizetés nem a Stripe-on keresztül fut.');
  const sub = await client().subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
  return applyStripeSubscription(sub);
}

// A lemondott (de még érvényes) előfizetés visszavonása: újra megújul a periódus végén
export async function reactivate(userId) {
  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (!isStripeManaged(row) || row.expires_at <= now()) throw new BillingError(409, 'Ez az előfizetés már lejárt, vásárolj újat.');
  const sub = await client().subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });
  return applyStripeSubscription(sub);
}

// Azonnali megszüntetés (admin, fiók törlése). A már kifizetett időszakot nem téríti vissza.
export async function cancelNow(stripeSubscriptionId) {
  try {
    const sub = await client().subscriptions.cancel(stripeSubscriptionId);
    return applyStripeSubscription(sub);
  } catch (err) {
    if (err.code === 'resource_missing') return null; // már nincs a Stripe-ban
    throw err;
  }
}

export async function portalUrl(user) {
  if (!user.stripe_customer_id) throw new BillingError(400, 'Még nincs számlázási adatod.');
  const session = await client().billingPortal.sessions.create({
    customer: user.stripe_customer_id, return_url: `${siteUrl}/#/account`,
  });
  return session.url;
}

// ---------- Webhook ----------

export async function handleWebhook(rawBody, signature) {
  if (!WEBHOOK_SECRET) throw new BillingError(503, 'A webhook titkos kulcsa nincs beállítva.');
  let event;
  try {
    event = client().webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch {
    throw new BillingError(400, 'Érvénytelen webhook aláírás.');
  }
  const o = event.data.object;
  let subId = null;
  switch (event.type) {
    case 'checkout.session.completed': subId = idOf(o.subscription); break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': subId = o.id; break;
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      subId = idOf(o.subscription) || idOf(o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription);
      break;
    default: break;
  }
  if (subId) await syncSubscription(subId); // hibánál a Stripe újrapróbálja
  return event.type;
}
