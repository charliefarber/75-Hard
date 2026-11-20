/**
 * Small helpers for reading what she typed in "What did you eat?": words with their positions,
 * plural-insensitive forms, numbers in words, and amounts like "150g", "2 portions" or "half".
 */

export interface Token {
  /** As typed. */
  raw: string;
  /** Lower case, singular ("Tacos" → "taco"), for matching. */
  w: string;
  start: number;
  end: number;
  /** Its value if it's a number: "2", "1.5", "½", "two", "half". */
  num?: number;
}

const TOKEN = /\d+(?:[.,]\d+)?|[½¼¾⅓]|[a-zà-ÿ]+(?:['’][a-z]+)?|&|\+|,|\//gi;
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3 };
const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  couple: 2,
  half: 0.5,
  quarter: 0.25,
};

/** Singular, lower-case form: "tacos" → "taco", "berries" → "berry", "tomatoes" → "tomato". */
export function stem(word: string): string {
  const w = word.toLowerCase().replace(/['’]s$/, '').replace(/['’]/g, '');
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(ch|sh|x|ss|zz|o)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const raw = m[0];
    const start = m.index ?? 0;
    const t: Token = { raw, w: /^\d/.test(raw) ? raw.replace(',', '.') : stem(raw), start, end: start + raw.length };
    if (/^\d/.test(raw)) t.num = parseFloat(raw.replace(',', '.'));
    else if (raw in FRACTIONS) t.num = FRACTIONS[raw];
    out.push(t);
  }
  // "1½" and "1/2" are one number
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i];
    const b = out[i + 1];
    if (a.num != null && /^\d+$/.test(a.raw) && b.raw in FRACTIONS && b.start === a.end) {
      out.splice(i, 2, { raw: a.raw + b.raw, w: String(a.num + FRACTIONS[b.raw]), start: a.start, end: b.end, num: a.num + FRACTIONS[b.raw] });
    } else if (a.num != null && b.raw === '/' && out[i + 2]?.num && /^\d+$/.test(a.raw) && /^\d+$/.test(out[i + 2].raw)) {
      const c = out[i + 2];
      const v = a.num / c.num!;
      out.splice(i, 3, { raw: text.slice(a.start, c.end), w: String(v), start: a.start, end: c.end, num: v });
    }
  }
  return out;
}

/** The value of a number word ("two", "half", "a") or digit token. */
export function numberOf(t: Token | undefined): number | null {
  if (!t) return null;
  if (t.num != null) return t.num;
  return NUMBER_WORDS[t.w] ?? null;
}

/** Words that join or pad a description without being food. */
export const FILLERS = new Set(
  (
    'a an the some of and with plus also then i ive im had have having ate eaten eat eating got get grabbed for my me our ' +
    'today tonight yesterday this that morning afternoon evening lunch dinner breakfast brunch supper snack ' +
    'on in at from to it was were is just like about around approx roughly maybe please ok okay , & + / ' +
    'bit little lot lots thanks thank thx ty cheers lol yum yummy delicious nice lovely great ish earlier later again ' +
    'quick quickly too as well so but very really pretty'
  ).split(/\s+/),
);

/** Joining words that can sit between the parts of a description. */
export const CONNECTORS = new Set(['and', ',', '&', '+', 'plus', 'with', 'or', 'nor', 'also', 'then']);

export const GRAM_UNITS: Record<string, number> = { g: 1, gr: 1, gram: 1, gramme: 1, grm: 1, kg: 1000, kilo: 1000, ml: 1, millilitre: 1, milliliter: 1 };

/** Words for "one helping of it". */
export const PORTION_WORDS = new Set([
  'portion',
  'serving',
  'bowl',
  'bowlful',
  'plate',
  'plateful',
  'helping',
  'box',
  'tub',
  'pot',
  'container',
  'tupperware',
  'piece',
  'slice',
  'scoop',
  'lot',
  'x',
]);

export interface Amount {
  grams?: number;
  portions?: number;
  /** Token indexes it covers. */
  from: number;
  to: number;
}

/**
 * An amount written just before token `i` ("150g of the", "2 portions of my", "half the", "a").
 * Words like "of", "the", "my" between the amount and the food are included.
 */
export function amountBefore(tokens: Token[], i: number, taken: Set<number>): Amount | null {
  let j = i - 1;
  while (j >= 0 && !taken.has(j) && ['of', 'the', 'my', 'our', 'that', 'this', 'some'].includes(tokens[j].w)) j--;
  if (j < 0 || taken.has(j)) return null;
  const t = tokens[j];
  // 150 g · 0.2 kg
  if (t.w in GRAM_UNITS) {
    const n = numberOf(tokens[j - 1]);
    if (n != null && n > 0 && !taken.has(j - 1) && tokens[j - 1].num != null) return { grams: n * GRAM_UNITS[t.w], from: j - 1, to: i - 1 };
    return null;
  }
  // 2 portions · half a portion · a bowl
  if (PORTION_WORDS.has(t.w) && t.w !== 'x') {
    let k = j - 1;
    if (k >= 0 && !taken.has(k) && (tokens[k].w === 'a' || tokens[k].w === 'an') && tokens[k - 1]?.w === 'half') k--; // half a portion
    const n = numberOf(tokens[k]);
    if (n != null && n > 0 && !taken.has(k)) return { portions: n, from: k, to: i - 1 };
    return { portions: 1, from: j, to: i - 1 };
  }
  // 2x · x2 (the "x" before)
  if (t.w === 'x' && tokens[j - 1]?.num != null && !taken.has(j - 1)) return { portions: tokens[j - 1].num!, from: j - 1, to: i - 1 };
  // half · half a · 2 · two
  if ((t.w === 'a' || t.w === 'an') && tokens[j - 1]?.w === 'half' && !taken.has(j - 1)) return { portions: 0.5, from: j - 1, to: i - 1 };
  const n = numberOf(t);
  if (n != null && n > 0 && n <= 20) return { portions: n, from: j, to: i - 1 };
  return null;
}

/** An amount written just after token `i` ("lasagne 150g", "oats x2", "chilli, 2 portions"). */
export function amountAfter(tokens: Token[], i: number, taken: Set<number>): Amount | null {
  let j = i + 1;
  if (tokens[j]?.raw === ',' && !taken.has(j)) j++;
  const t = tokens[j];
  if (!t || taken.has(j)) return null;
  if (t.w === 'x' && tokens[j + 1]?.num != null && !taken.has(j + 1)) return { portions: tokens[j + 1].num!, from: i + 1, to: j + 1 };
  const n = t.num ?? (t.w === 'half' ? 0.5 : null);
  if (n == null || n <= 0) return null;
  const u = tokens[j + 1];
  if (u && !taken.has(j + 1)) {
    if (u.w in GRAM_UNITS && t.num != null) return { grams: n * GRAM_UNITS[u.w], from: i + 1, to: j + 1 };
    if (PORTION_WORDS.has(u.w)) return { portions: n, from: i + 1, to: j + 1 };
    if ((u.w === 'a' || u.w === 'an') && PORTION_WORDS.has(tokens[j + 2]?.w ?? '') && t.w === 'half') return { portions: 0.5, from: i + 1, to: j + 2 };
  }
  return null;
}

/** Whether two words are the same allowing one typo (for longer words only): "chiken" ≈ "chicken". */
export function nearly(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  // one insertion, deletion, substitution or swap of neighbours
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * What's left of the text once some tokens are accounted for: each untouched stretch, trimmed of
 * joining words, e.g. "steak chipotle bowl and a diet coke" minus the order → "a diet coke".
 * Empty when nothing but filler is left.
 */
export function leftover(text: string, tokens: Token[], taken: Set<number>): string {
  const runs: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (taken.has(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < tokens.length && !taken.has(j + 1)) j++;
    // trim joining words at both ends, but keep "a"/"an" in front of food ("a diet coke")
    let a = i;
    let b = j;
    while (a <= b && (CONNECTORS.has(tokens[a].w) || (FILLERS.has(tokens[a].w) && !['a', 'an', 'some'].includes(tokens[a].w)))) a++;
    while (b >= a && FILLERS.has(tokens[b].w)) b--;
    const content = tokens.slice(a, b + 1).some((t) => !FILLERS.has(t.w) || t.num != null);
    if (a <= b && content) runs.push(text.slice(tokens[a].start, tokens[b].end));
    i = j + 1;
  }
  return runs.join(', ');
}
