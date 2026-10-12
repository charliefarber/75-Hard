// Food helper for the 75 Hard app (Supabase Edge Function, Deno).
//
//   photo     estimate a meal from a photo        } Cloudflare Workers AI (free tier; Cloudflare
//   describe  estimate a meal from a description  }  doesn't train on or keep what's sent)
//   product   Open Food Facts barcode lookup      } fallback for when the phone's own request
//   search    Open Food Facts product search      }  to Open Food Facts is blocked
//
// Only signed-in users can call it (verify_jwt + a user check below). Estimates are capped at
// DAILY_LIMIT a day per person. Photos are passed straight through and never stored.
//
// Secrets: CF_ACCOUNT_ID, CF_API_TOKEN (a Cloudflare API token with Workers AI permission).

import { answerText, describePrompt, parseEstimate, photoPrompt, SYSTEM_PROMPT } from './estimate.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CF_BASE = Deno.env.get('CF_API_BASE') ?? 'https://api.cloudflare.com/client/v4';
const MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/google/gemma-3-12b-it',
];
const DAILY_LIMIT = 60;
const MAX_IMAGE_CHARS = 2_000_000; // ~1.5 MB JPEG as base64
const OFF_UA = '75Hard/1.0 (https://hard-75.netlify.app)';
const OFF_FIELDS =
  'code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,image_front_small_url,image_small_url';

const ORIGINS = ['https://hard-75.netlify.app', 'http://localhost:5173', 'http://localhost:4181', 'capacitor://localhost', 'http://localhost'];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
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

async function runModel(model: string, acct: string, token: string, prompt: string, image?: string): Promise<string> {
  const url = `${CF_BASE}/accounts/${acct}/ai/run/${model}`;
  const system = { role: 'system', content: SYSTEM_PROMPT };
  // Vision models on Workers AI take the image either as a content part or as a top-level field.
  const bodies = image
    ? [
        { messages: [system, { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }], max_tokens: 1200, temperature: 0.2 },
        { messages: [system, { role: 'user', content: prompt }], image, max_tokens: 1200, temperature: 0.2 },
      ]
    : [{ messages: [system, { role: 'user', content: prompt }], max_tokens: 900, temperature: 0.2 }];
  let last = '';
  for (const body of bodies) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    const text = res.ok && data?.success !== false ? answerText(data) : null;
    if (text) return text;
    last = `${res.status} ${JSON.stringify(data?.errors ?? data ?? '').slice(0, 300)}`;
  }
  throw new Error(`${model}: ${last}`);
}

const configured = () => !!(Deno.env.get('CF_ACCOUNT_ID') && Deno.env.get('CF_API_TOKEN'));

async function estimate(prompt: string, image?: string) {
  const acct = Deno.env.get('CF_ACCOUNT_ID')!;
  const token = Deno.env.get('CF_API_TOKEN')!;
  const problems: string[] = [];
  for (const model of MODELS) {
    try {
      const parsed = parseEstimate(await runModel(model, acct, token, prompt, image));
      if (parsed) return { status: 200, body: { ...parsed, model } };
      problems.push(`${model}: unreadable answer`);
    } catch (e) {
      problems.push(String(e instanceof Error ? e.message : e));
    }
  }
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
    case 'photo': {
      const image = typeof body.image === 'string' ? body.image : '';
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE_CHARS)
        return reply(400, { error: 'bad_image' });
      if (!configured()) return reply(503, { error: 'not_configured' });
      if (!(await withinLimit(user.id))) return reply(429, { error: 'daily_limit' });
      const r = await estimate(photoPrompt(meal, typeof body.hint === 'string' ? body.hint : ''), image);
      return reply(r.status, r.body);
    }
    case 'describe': {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (text.length < 2 || text.length > 500) return reply(400, { error: 'bad_text' });
      if (!configured()) return reply(503, { error: 'not_configured' });
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
