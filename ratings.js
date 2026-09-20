// Automatikus értékelés: a Claude (webes kereséssel) megnézi, hány pontosra értékelik globálisan az adott filmet vagy sorozatot.
// Az API kulcsot az admin panel „Cégadatok” fülén lehet megadni (az adatbázisba mentődik), tartalék: ANTHROPIC_API_KEY (.env).
import Anthropic from '@anthropic-ai/sdk';
import db from './db.js';

const MODEL = 'claude-opus-5';
const KEY_SETTING = 'anthropicKey';

export class RatingError extends Error {}

export function getApiKey() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY_SETTING);
  return (row && row.value.trim()) || (process.env.ANTHROPIC_API_KEY || '').trim();
}
// A kulcsot sosem adjuk vissza teljes egészében, csak az utolsó 4 karakterét
export function aiStatus() {
  const stored = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY_SETTING);
  const key = getApiKey();
  return { configured: !!key, last4: key ? key.slice(-4) : '', source: stored && stored.value.trim() ? 'admin' : key ? 'env' : null };
}
export function saveApiKey(key) {
  const k = String(key || '').trim();
  if (!k) db.prepare('DELETE FROM settings WHERE key = ?').run(KEY_SETTING);
  else db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(KEY_SETTING, k);
}

const WEB_SEARCH = { type: 'web_search_20260209', name: 'web_search', max_uses: 3 };

function promptFor({ title, year, type }) {
  return `Find the current worldwide audience rating of the ${type === 'series' ? 'TV series' : 'movie'} "${title}" (${year}).
Use the IMDb user rating out of 10 when available; otherwise use another large international source (TMDB, Rotten Tomatoes audience score converted to a 10-point scale).
Search the web to get the real, current number. Do not guess from memory.
Reply with ONLY one JSON object and nothing else, in this exact shape:
{"found": true, "rating": 7.8, "source": "IMDb", "matched_title": "the exact title you matched"}
If you cannot find a rating for this exact title and year, reply with {"found": false}.`;
}

function parseResult(content) {
  const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const matches = text.match(/\{[^{}]*\}/g) || [];
  for (const m of matches.reverse()) {
    let o;
    try { o = JSON.parse(m); } catch { continue; }
    if (o.found === false) throw new RatingError('Nem találtam globális értékelést ehhez a címhez és évhez.');
    const r = Number(o.rating);
    if (o.found === true && Number.isFinite(r) && r >= 0 && r <= 10) {
      return { rating: Math.round(r * 10) / 10, source: String(o.source || '').slice(0, 40) || null };
    }
  }
  throw new RatingError('Az AI válaszából nem sikerült értékelést kiolvasni.');
}

// Egy film vagy sorozat globális értékelése (0–10) és a forrása. RatingError-t dob, ha nem sikerült.
export async function fetchGlobalRating({ title, year, type }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new RatingError('Az automatikus értékeléshez add meg az Anthropic API kulcsot a Cégadatok fülön.');
  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });

  const run = async (withFallbacks) => {
    let messages = [{ role: 'user', content: promptFor({ title, year, type }) }];
    for (let turn = 0; turn < 4; turn++) { // a kiszolgálói keresés megszakíthatja a kört (pause_turn): folytatjuk
      const params = { model: MODEL, max_tokens: 4000, output_config: { effort: 'low' }, tools: [WEB_SEARCH], messages };
      const res = withFallbacks
        ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await client.messages.create(params);
      if (res.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: res.content }]; continue; }
      if (res.stop_reason === 'refusal') throw new RatingError('Az AI nem válaszolt erre a kérdésre.');
      return parseResult(res.content);
    }
    throw new RatingError('Az AI keresése túl sokáig tartott.');
  };

  try {
    try {
      return await run(true);
    } catch (err) {
      if (err instanceof Anthropic.BadRequestError) return await run(false); // a tartalék-útvonal beállítást nem fogadta el: anélkül
      throw err;
    }
  } catch (err) {
    if (err instanceof RatingError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new RatingError('Az Anthropic API kulcs érvénytelen vagy nincs jogosultsága.');
    if (err instanceof Anthropic.RateLimitError) throw new RatingError('Az Anthropic API most túlterhelt, próbáld újra egy perc múlva.');
    if (err instanceof Anthropic.APIConnectionError) throw new RatingError('Nem sikerült elérni az Anthropic API-t (hálózati hiba).');
    if (err instanceof Anthropic.APIError) throw new RatingError(`Az Anthropic API hibát jelzett (${err.status}): ${String(err.message).slice(0, 160)}`);
    throw err;
  }
}
