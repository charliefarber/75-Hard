import type { FoodEntry, Meal, MealPrep, MyFood, SavedMeal } from '../data/foodTypes';
import { chipotleOrder, rememberedParts, type ChainOrder } from './chains';
import { gramsEntry, gramsPerPortion, portionEntry } from './mealPrep';
import { defaultAmount, entryFor, newId, withAmount } from './nutrition';
import { amountAfter, amountBefore, CONNECTORS, FILLERS, GRAM_UNITS, leftover, PORTION_WORDS, stem, tokenize, type Amount, type Token } from './words';

/**
 * "What did you eat?" before anything is sent off: her own meal prep, saved meals and foods, and
 * restaurant orders from published menus, are recognised here, exactly and instantly. Whatever's
 * left ("and a diet coke") goes to the estimate.
 *
 *   "150g of the lasagne and a side salad"  → 150 g from her Lasagne batch + estimate "a side salad"
 *   "steak chipotle bowl and a diet coke"   → Chipotle's own numbers + estimate "a diet coke"
 *   "my overnight oats"                      → her saved meal, nothing sent
 */

export type OwnMatch =
  | { kind: 'prep'; prep: MealPrep; grams: number | null; portions: number | null }
  | { kind: 'meal'; meal: SavedMeal; portions: number | null }
  | { kind: 'food'; food: MyFood; grams: number | null; portions: number | null };

export interface Understood {
  own: OwnMatch[];
  orders: ChainOrder[];
  /** What's left for the estimate ('' when everything is accounted for). */
  rest: string;
}

export interface Library {
  preps: MealPrep[];
  meals: SavedMeal[];
  foods: MyFood[];
}

/** Words too general to stand for a whole batch on their own ("chicken" isn't her chicken curry). */
const GENERIC = new Set(
  'chicken beef pork lamb turkey fish salmon tuna prawn tofu egg rice bread toast potato meal prep batch dish food bowl box plate portion leftover dinner lunch breakfast snack mince veg vegetable'
    .split(' ')
    .map(stem),
);

const nameWords = (name: string) => tokenize(name).filter((t) => t.num == null && !FILLERS.has(t.w) && !CONNECTORS.has(t.w)).map((t) => t.w);

/** Words that can sit right next to a name without being part of another food. */
const edgeOk = (t: Token | undefined, taken: boolean) =>
  !t || taken || t.num != null || FILLERS.has(t.w) || CONNECTORS.has(t.w) || t.w in GRAM_UNITS || PORTION_WORDS.has(t.w) || t.w === 'half' || t.w === 'x';

/**
 * Where `words` appear in the text in order, with only joining words between them ("chicken and
 * rice" matches "chicken & rice"), and not glued to another food word ("chicken curry" isn't in
 * "thai green chicken curry pie").
 */
function findWords(tokens: Token[], taken: Set<number>, words: string[]): { from: number; to: number } | null {
  if (!words.length) return null;
  for (let i = 0; i < tokens.length; i++) {
    if (taken.has(i) || tokens[i].w !== words[0]) continue;
    let k = 1;
    let j = i + 1;
    let end = i;
    while (k < words.length && j < tokens.length && !taken.has(j)) {
      if (tokens[j].w === words[k]) {
        end = j;
        k++;
        j++;
      } else if (FILLERS.has(tokens[j].w) || CONNECTORS.has(tokens[j].w)) j++;
      else break;
    }
    if (k < words.length) continue;
    if (!edgeOk(tokens[i - 1], taken.has(i - 1)) || !edgeOk(tokens[end + 1], taken.has(end + 1))) continue;
    return { from: i, to: end };
  }
  return null;
}

interface Candidate {
  match: { from: number; to: number };
  score: number;
  make: (amt: Amount | null) => OwnMatch;
}

/** Her things whose names appear in the text (longest names first, never two on the same words). */
function findOwn(tokens: Token[], taken: Set<number>, lib: Pick<Library, 'preps' | 'meals'> & { foods?: MyFood[] }): OwnMatch[] {
  const cands: Candidate[] = [];
  const add = (words: string[], weight: number, make: Candidate['make'], partial: 'head' | 'start' | null) => {
    if (!words.length) return;
    const full = findWords(tokens, taken, words);
    if (full) return cands.push({ match: full, score: words.length * 10 + weight, make });
    if (partial === 'head') {
      // "chilli" for her "Turkey chilli" batch (not "chicken" for "Chicken curry")
      for (let n = words.length - 1; n >= 1; n--) {
        const tail = words.slice(words.length - n);
        if (n === 1 && GENERIC.has(tail[0])) break;
        const m = findWords(tokens, taken, tail);
        if (m) return cands.push({ match: m, score: n * 10 + weight - 5, make });
      }
    }
    if (partial === 'start' && words.length >= 3) {
      // "overnight oats" for "Overnight oats with berries and honey"
      for (let n = words.length - 1; n >= Math.max(2, Math.ceil(words.length / 2)); n--) {
        const m = findWords(tokens, taken, words.slice(0, n));
        if (m) return cands.push({ match: m, score: n * 10 + weight - 5, make });
      }
    }
  };
  for (const prep of lib.preps) {
    if (!(prep.portions_left > 0.01)) continue;
    add(nameWords(prep.name), 3, (a) => ({ kind: 'prep', prep, grams: a?.grams ?? null, portions: a?.portions ?? null }), 'head');
  }
  for (const meal of lib.meals) add(nameWords(meal.name), 2, (a) => ({ kind: 'meal', meal, portions: a?.portions ?? null }), 'start');
  for (const food of lib.foods ?? []) {
    if (!food.custom && !food.key.startsWith('custom:')) continue;
    const make: Candidate['make'] = (a) => ({ kind: 'food', food, grams: a?.grams ?? null, portions: a?.portions ?? null });
    const name = nameWords(food.food.name);
    const brand = food.food.brand ? nameWords(food.food.brand) : [];
    // with its brand either side ("arla protein yoghurt"), so the brand isn't left over as a food of its own
    const branded = brand.length && !name.slice(0, brand.length).every((w, i) => w === brand[i]) ? [[...brand, ...name], [...name, ...brand]] : [];
    const before = cands.length;
    for (const words of branded) if (cands.length === before) add(words, 1, make, null);
    if (cands.length === before) add(name, 1, make, 'start');
  }
  cands.sort((a, b) => b.score - a.score);
  const out: OwnMatch[] = [];
  for (const c of cands) {
    const { from, to } = c.match;
    let clash = false;
    for (let i = from; i <= to; i++) if (taken.has(i)) clash = true;
    if (clash) continue;
    for (let i = from; i <= to; i++) taken.add(i);
    const amt = amountBefore(tokens, from, taken) ?? amountAfter(tokens, to, taken);
    if (amt) for (let i = amt.from; i <= amt.to; i++) taken.add(i);
    out.push(c.make(amt));
  }
  return out;
}

export function understand(text: string, lib: Library): Understood {
  const tokens = tokenize(text);
  const taken = new Set<number>();
  // Her own batches and saved meals first (her names win), then restaurant menus, then her foods.
  const own = findOwn(tokens, taken, { preps: lib.preps, meals: lib.meals });
  const orders: ChainOrder[] = [];
  const chain = chipotleOrder(tokens, taken, (key, unit) => rememberedParts(lib.foods.find((f) => f.key === key)?.food, unit));
  if (chain) {
    orders.push(chain.order);
    chain.used.forEach((i) => taken.add(i));
  }
  own.push(...findOwn(tokens, taken, { preps: [], meals: [], foods: lib.foods }));
  return { own, orders, rest: leftover(text, tokens, taken) };
}

/** Diary entries for one of her own things, with a note when it couldn't be logged quite as said. */
export function ownEntries(m: OwnMatch, meal: Meal, date: string): { entries: FoodEntry[]; note?: string } {
  if (m.kind === 'prep') {
    if (m.grams != null && gramsPerPortion(m.prep)) return { entries: [gramsEntry(m.prep, m.grams, meal, date)] };
    const entries = [portionEntry(m.prep, m.portions ?? 1, meal, date)];
    if (m.grams != null) return { entries, note: `Your ${m.prep.name} batch isn’t weighed, so that’s 1 portion. Weigh it on the Food tab to log it by the gram.` };
    return { entries };
  }
  if (m.kind === 'meal') {
    const k = m.portions ?? 1;
    const entries = m.meal.items.map((it) => {
      const e: FoodEntry = { ...it, id: newId(), log_date: date, meal };
      return k === 1 ? e : { ...withAmount(e, e.amount * k, e.unit), id: e.id };
    });
    return { entries };
  }
  const f = m.food.food;
  if (m.grams != null) return { entries: [entryFor(f, m.grams, f.base, meal, date)] };
  const d = defaultAmount(f, m.food);
  return { entries: [entryFor(f, d.amount * (m.portions ?? 1), d.unit, meal, date)] };
}

/** What she typed and what was recognised, in a few words, for the "Log …" button. */
export function describeUnderstood(u: Understood): string | null {
  const bits = [
    ...u.own.map((m) => (m.kind === 'prep' ? `your ${m.prep.name} batch` : m.kind === 'meal' ? `your ${m.meal.name}` : m.food.food.name)),
    ...u.orders.map((o) => `${o.chain}’s ${o.name.toLowerCase()}`),
  ];
  if (!bits.length) return null;
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0];
  return list[0].toUpperCase() + list.slice(1);
}
