import type { Food, Nutrition, Serving } from '../data/foodTypes';
import { KJ_PER_KCAL, servingGrams } from './nutrition';

/**
 * Open Food Facts: a free, open database of packaged food (barcodes, nutrition labels).
 * Requests go straight from the phone (their limits are per person), and fall back to our own
 * server function if a request is blocked or rate-limited.
 */

export const OFF_FIELDS =
  'code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,image_front_small_url,image_small_url';

const PRODUCT_URL = (code: string) => `https://world.openfoodfacts.org/api/v2/product/${code}?fields=${OFF_FIELDS}`;
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const LEGACY_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

export type OffProxy = (action: 'product' | 'search', params: Record<string, string>) => Promise<unknown>;

type Json = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** A text field that may come back as a plain string or one per language. */
function text(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return text(v[0]);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return text(o.en ?? o.main ?? Object.values(o).find((x) => typeof x === 'string' && x.trim()));
  }
  return '';
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Valid EAN-8 / UPC-A / EAN-13 / GTIN-14 check digit. */
export function validBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Turn an Open Food Facts product into something she can log. Null if it has no calories. */
export function foodFromOff(p: Json | null | undefined): Food | null {
  if (!p) return null;
  const code = String(p.code ?? '').replace(/\D/g, '');
  const n = (p.nutriments ?? {}) as Json;
  const servingQty = num(p.serving_quantity) ?? servingGrams(text(p.serving_size));
  const per = (k: string): number | null => {
    const v100 = num(n[`${k}_100g`]);
    if (v100 != null) return v100;
    const vs = num(n[`${k}_serving`]);
    return vs != null && servingQty ? (vs * 100) / servingQty : null;
  };
  let kcal = per('energy-kcal');
  if (kcal == null) {
    const kj = per('energy-kj') ?? per('energy');
    if (kj != null) kcal = kj / KJ_PER_KCAL;
  }
  if (kcal == null || kcal < 0 || kcal > 950) return null;

  const name = clip(text(p.product_name_en) || text(p.product_name) || text(p.generic_name), 120);
  if (!name) return null;
  const brand = clip(text(p.brands).split(',')[0]?.trim() ?? '', 80) || undefined;
  const qty = text(p.quantity);
  const base: 'g' | 'ml' = /\d\s*(ml|cl|l)\b/i.test(qty) || /\d\s*ml\b/i.test(text(p.serving_size)) ? 'ml' : 'g';

  const servings: Serving[] = [];
  if (servingQty && servingQty > 0 && servingQty <= 2000) {
    const raw = text(p.serving_size);
    const label = raw && /\d/.test(raw) && raw.length <= 30 ? (/[(]/.test(raw) || /^\d/.test(raw) ? raw : `1 ${raw}`) : `1 serving (${round(servingQty)} ${base})`;
    servings.push({ label: clip(/\d\s*(g|ml)\b/i.test(label) ? label : `${label} (${round(servingQty)} ${base})`, 40), grams: servingQty });
  }
  const packQty = num(p.product_quantity);
  if (packQty && packQty > 0 && packQty <= 3000 && (!servingQty || Math.abs(packQty - servingQty) > 1)) {
    servings.push({ label: `whole pack (${round(packQty)} ${base})`, grams: packQty });
  }

  const per100: Nutrition = {
    kcal: Math.round(kcal),
    protein: round1(per('proteins')),
    carbs: round1(per('carbohydrates')),
    fat: round1(per('fat')),
    fiber: round1(per('fiber')),
    sugar: round1(per('sugars')),
    satFat: round1(per('saturated-fat')),
    salt: per('salt') != null ? Math.round(per('salt')! * 100) / 100 : null,
  };
  const image = text(p.image_front_small_url) || text(p.image_small_url) || undefined;
  return {
    key: code ? `off:${code}` : `off:${name.toLowerCase().slice(0, 60)}`,
    name,
    brand,
    source: 'off',
    per100,
    base,
    servings,
    defaultServing: servings.length && servingQty ? 0 : undefined,
    barcode: code || undefined,
    image: image && /^https:\/\/images\.openfoodfacts\.org\//.test(image) ? image : undefined,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

// ---------------------------------------------------------------- network

const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_MS = 30 * 60_000;

async function getJson(url: string, ms = 8000): Promise<Json> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw Object.assign(new Error(`Open Food Facts said ${res.status}`), { status: res.status });
    return (await res.json()) as Json;
  } finally {
    clearTimeout(t);
  }
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** The country to prefer in search, from the phone's region. */
export function offCountry(locale = typeof navigator !== 'undefined' ? navigator.language : 'en-GB', tz = Intl.DateTimeFormat().resolvedOptions().timeZone): string | null {
  if (tz === 'Europe/London' || /-GB$/i.test(locale)) return 'en:united-kingdom';
  if (/-US$/i.test(locale)) return 'en:united-states';
  if (/-IE$/i.test(locale) || tz === 'Europe/Dublin') return 'en:ireland';
  return null;
}

/** Look a barcode up. Null when Open Food Facts doesn't know it (or it has no nutrition). */
export async function lookupBarcode(code: string, proxy?: OffProxy): Promise<Food | null> {
  const clean = code.replace(/\D/g, '');
  const tries = clean.length === 12 ? [clean, '0' + clean] : [clean];
  return cached(`p:${clean}`, async () => {
    for (const c of tries) {
      let data: Json | null = null;
      try {
        data = await getJson(PRODUCT_URL(c));
      } catch (e) {
        if ((e as { status?: number }).status === 404) continue;
        if (!proxy) throw e;
        data = (await proxy('product', { code: c })) as Json;
      }
      if (data && (data.status === 1 || data.status === 'success') && data.product) {
        const food = foodFromOff({ code: c, ...(data.product as Json) });
        if (food) return food;
      }
    }
    return null;
  });
}

/** Search packaged foods by name. Called after she pauses typing (Open Food Facts asks apps not to search on every keystroke). */
export async function searchProducts(q: string, proxy?: OffProxy): Promise<Food[]> {
  const query = q.trim().replace(/\s+/g, ' ');
  if (query.length < 2) return [];
  const country = offCountry();
  return cached(`s:${country}:${query.toLowerCase()}`, async () => {
    let hits: Json[] = [];
    try {
      const filtered = country ? `${query} countries_tags:"${country}"` : query;
      const data = await getJson(`${SEARCH_URL}?q=${encodeURIComponent(filtered)}&page_size=24&langs=en&fields=${OFF_FIELDS}`);
      hits = (data.hits as Json[]) ?? [];
      if (hits.length < 4 && country) {
        const more = await getJson(`${SEARCH_URL}?q=${encodeURIComponent(query)}&page_size=24&langs=en&fields=${OFF_FIELDS}`);
        hits = [...hits, ...(((more.hits as Json[]) ?? []))];
      }
    } catch {
      try {
        const tag = country ? `&tagtype_0=countries&tag_contains_0=contains&tag_0=${country.replace('en:', '')}` : '';
        const data = await getJson(
          `${LEGACY_SEARCH_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}${tag}`,
        );
        hits = (data.products as Json[]) ?? [];
      } catch (e) {
        if (!proxy) throw e;
        const data = (await proxy('search', { q: query, country: country ?? '' })) as Json;
        hits = ((data?.hits ?? data?.products) as Json[]) ?? [];
      }
    }
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const h of hits) {
      const f = foodFromOff(h);
      if (!f || seen.has(f.key)) continue;
      seen.add(f.key);
      out.push(f);
    }
    return out;
  });
}
