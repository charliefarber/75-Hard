// Food helper for the 75 Hard app (Supabase Edge Function, Deno).
//
//   photo     estimate a meal from a photo        } Cloudflare Workers AI (free tier; Cloudflare
//   describe  estimate a meal from a description  }  doesn't train on or keep what's sent)
//   product   Open Food Facts barcode lookup      } fallback for when the phone's own request
//   search    Open Food Facts product search      }  to Open Food Facts is blocked
//   status    whether estimates are switched on (so the app can hide them until they are)
//
// Only signed-in users can call it (verify_jwt + a user check below). Estimates are capped at
// DAILY_LIMIT a day per person. Photos are passed straight through and never stored.
//
// Cloudflare credentials: Edge Function secrets CF_ACCOUNT_ID and CF_API_TOKEN (an API token with
// Workers AI permission), or the same values in Supabase Vault as cf_account_id / cf_api_token.

import { answerText, describePrompt, parseEstimate, photoPrompt, SYSTEM_PROMPT } from './estimate.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CF_BASE = Deno.env.get('CF_API_BASE') ?? 'https://api.cloudflare.com/client/v4';
/** Photos: models that can see. */
const VISION_MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/google/gemma-3-12b-it',
];
/**
 * Descriptions: OpenAI's open 120B model first (it knows far more menus and foods than the small
 * vision models), then the same fallbacks. Still on the free Workers AI allowance.
 */
const TEXT_MODELS = ['@cf/openai/gpt-oss-120b', ...VISION_MODELS];
/** A model slower than this is skipped for the next one (the big text model gets less time: there's a fallback). */
const timeoutFor = (model: string) => (model.includes('gpt-oss') ? 15_000 : 30_000);
const DAILY_LIMIT = 60;
const MAX_IMAGE_CHARS = 2_000_000; // ~1.5 MB JPEG as base64
const OFF_UA = '75Hard/1.0 (https://github.com/charliefarber/75-Hard)';
const OFF_FIELDS =
  'code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,image_front_small_url,image_small_url';

const ORIGINS = ['https://swag-75.pages.dev', 'https://hard-75.pages.dev', 'https://hard-75.netlify.app', 'http://localhost:5173', 'http://localhost:4181', 'capacitor://localhost', 'http://localhost'];
/** The Cloudflare Pages site (swag-75), its preview builds, and the older hard-75 name. */
const PAGES = /^https:\/\/([a-z0-9-]+\.)?(swag|hard)-75(-[a-z0-9]+)?\.pages\.dev$/;

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) || PAGES.test(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

async function currentUser(auth: string): Promise<{ id: string } | null> {
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON_KEY } });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return u?.id ? { id: u.id } : null;
}

/** Count this estimate; false when she's hit today's cap. */
async function withinLimit(userId: string): Promise<boolean> {
  if (!SERVICE_KEY) return true;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_usage_bump`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_user: userId, p_limit: DAILY_LIMIT }),
  });
  if (res.ok) return true;
  const text = await res.text();
  if (/daily limit/i.test(text)) return false;
  console.error('usage counter failed', res.status, text.slice(0, 200));
  return true; // don't block her because the counter broke
}

/** Models that refused a request shape (4xx) in this instance: skipped for a while, so a broken one doesn't slow every estimate. */
const resting = new Map<string, number>();
/** Which request shape each model last accepted. */
const shapeFor = new Map<string, number>();

function bodiesFor(model: string, prompt: string, image?: string): Record<string, unknown>[] {
  const system = { role: 'system', content: SYSTEM_PROMPT };
  if (model.includes('gpt-oss')) {
    // Reasoning model: room to think before answering. Responses API shape first (lets us ask for
    // low effort, so it's quick), then the documented chat shape.
    return [
      { input: [system, { role: 'user', content: prompt }], reasoning: { effort: 'low' }, max_output_tokens: 3000 },
      { messages: [system, { role: 'user', content: prompt }], max_tokens: 3000 },
    ];
  }
  // Vision models on Workers AI take the image either as a content part or as a top-level field.
  return image
    ? [
        { messages: [system, { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }], max_tokens: 1200, temperature: 0.2 },
        { messages: [system, { role: 'user', content: prompt }], image, max_tokens: 1200, temperature: 0.2 },
      ]
    : [{ messages: [system, { role: 'user', content: prompt }], max_tokens: 900, temperature: 0.2 }];
}

/**
 * Ask one model, trying its request shapes in turn (the one that worked last time first), until one
 * gives an answer `usable` accepts. A shape that answers but unusably (cut off, not JSON) counts as
 * not working, so it isn't tried first next time.
 */
async function runModel<T>(model: string, acct: string, token: string, prompt: string, image: string | undefined, usable: (text: string) => T | null): Promise<T> {
  const url = `${CF_BASE}/accounts/${acct}/ai/run/${model}`;
  const bodies = bodiesFor(model, prompt, image);
  const first = shapeFor.get(model) ?? 0;
  const order = [first, ...bodies.map((_, i) => i).filter((i) => i !== first)];
  let last = '';
  let refused = 0;
  for (const i of order) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(bodies[i]),
        signal: AbortSignal.timeout(timeoutFor(model)),
      });
    } catch (e) {
      const slow = e instanceof Error && e.name === 'TimeoutError';
      if (slow) resting.set(model, Date.now() + 10 * 60_000);
      throw new Error(`${model}: ${slow ? 'timed out' : String(e)}`);
    }
    const data = await res.json().catch(() => null);
    const text = res.ok && data?.success !== false ? answerText(data) : null;
    const value = text ? usable(text) : null;
    if (value != null) {
      shapeFor.set(model, i);
      return value;
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 429) refused++;
    last = text ? `unreadable answer (shape ${i}): ${text.slice(0, 200)}` : `${res.status} ${JSON.stringify(data?.errors ?? data ?? '').slice(0, 300)}`;
  }
  if (refused === bodies.length) resting.set(model, Date.now() + 30 * 60_000);
  throw new Error(`${model}: ${last}`);
}

/**
 * Cloudflare credentials: Edge Function secrets if set, otherwise the encrypted copies in Supabase
 * Vault (read through food_ai_credentials(), which only the service role may call).
 */
let creds: { acct: string; token: string } | null | undefined;
async function credentials(): Promise<{ acct: string; token: string } | null> {
  const acct = Deno.env.get('CF_ACCOUNT_ID');
  const token = Deno.env.get('CF_API_TOKEN');
  if (acct && token) return { acct, token };
  if (creds !== undefined) return creds;
  if (!SERVICE_KEY) return (creds = null);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/food_ai_credentials`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
      body: '{}',
    });
    const v = res.ok ? await res.json() : null;
    creds = v?.cf_account_id && v?.cf_api_token ? { acct: v.cf_account_id, token: v.cf_api_token } : null;
  } catch {
    return null; // try again next time
  }
  return creds;
}

async function estimate(prompt: string, image?: string) {
  const { acct, token } = (await credentials())!;
  const problems: string[] = [];
  let empty: { items: unknown[]; note: string } | null = null;
  const now = Date.now();
  const models = (image ? VISION_MODELS : TEXT_MODELS).filter((m) => (resting.get(m) ?? 0) < now);
  for (const model of models.length ? models : VISION_MODELS) {
    const started = Date.now();
    try {
      const parsed = await runModel(model, acct, token, prompt, image, parseEstimate);
      if (parsed.items.length) {
        console.log('estimate', model, `${Date.now() - started} ms`, problems.length ? `after ${problems.join(' | ')}` : '');
        return { status: 200, body: { ...parsed, model } };
      }
      empty = parsed; // it answered but saw no food; a second opinion is cheap
      problems.push(`${model}: no items`);
    } catch (e) {
      problems.push(String(e instanceof Error ? e.message : e));
    }
  }
  if (empty) return { status: 200, body: { items: [], note: empty.note } };
  console.error('estimate failed', problems.join(' | '));
  return { status: 502, body: { error: 'estimate_failed' } };
}

async function off(url: string) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': OFF_UA, accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return { status: res.status === 404 ? 404 : 502, body: { error: 'off_failed', status: res.status } };
    return { status: 200, body: await res.json() };
  } catch {
    return { status: 504, body: { error: 'off_unreachable' } };
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  const user = await currentUser(req.headers.get('authorization') ?? '');
  if (!user) return reply(401, { error: 'sign_in' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_request' });
  }
  const meal = typeof body.meal === 'string' ? body.meal : 'meal';

  switch (body.action) {
    case 'status':
      return reply(200, { ai: !!(await credentials()) });
    case 'photo': {
      const image = typeof body.image === 'string' ? body.image : '';
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE_CHARS)
        return reply(400, { error: 'bad_image' });
      if (!(await credentials())) return reply(503, { error: 'not_configured' });
      if (!(await withinLimit(user.id))) return reply(429, { error: 'daily_limit' });
      const r = await estimate(photoPrompt(meal, typeof body.hint === 'string' ? body.hint : ''), image);
      return reply(r.status, r.body);
    }
    case 'describe': {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (text.length < 2 || text.length > 500) return reply(400, { error: 'bad_text' });
      if (!(await credentials())) return reply(503, { error: 'not_configured' });
      if (!(await withinLimit(user.id))) return reply(429, { error: 'daily_limit' });
      const r = await estimate(describePrompt(meal, text));
      return reply(r.status, r.body);
    }
    case 'product': {
      const code = String(body.code ?? '');
      if (!/^\d{8,14}$/.test(code)) return reply(400, { error: 'bad_code' });
      const r = await off(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${OFF_FIELDS}`);
      return reply(r.status, r.body);
    }
    case 'search': {
      const q = String(body.q ?? '').trim().slice(0, 100);
      if (q.length < 2) return reply(400, { error: 'bad_query' });
      const country = String(body.country ?? '');
      const filter = /^en:[a-z-]+$/.test(country) ? ` countries_tags:"${country}"` : '';
      let r = await off(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q + filter)}&page_size=24&langs=en&fields=${OFF_FIELDS}`);
      if (r.status !== 200)
        r = await off(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}`,
        );
      return reply(r.status, r.body);
    }
    default:
      return reply(400, { error: 'unknown_action' });
  }
});
