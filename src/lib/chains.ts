import type { Food, FoodEntry, Meal, Nutrition } from '../data/foodTypes';
import { entryFor } from './nutrition';
import { CONNECTORS, FILLERS, nearly, numberOf, stem, type Token } from './words';

/**
 * Restaurant orders from the chain's own published nutrition, so "steak chipotle bowl" comes out
 * exact and straight away, with no estimate (and nothing counted against the daily limit). Every
 * part of the order is listed, so she can untick what she didn't have and tick what she added.
 * In the diary the order is one entry ("Steak bowl · Chipotle"), which also lands in her recents
 * and is remembered: next time she types the same order it starts from what she had last time.
 */

/** A menu item, per standard serving, from the chain's published nutrition. */
export interface MenuItem {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  satFat?: number;
  salt?: number;
}

/** A part of an order: a menu item, how much of it (1 standard serving, 2 double, ½ light), and whether she had it. */
export interface OrderPart {
  item: MenuItem;
  qty: number;
  on: boolean;
}

export interface ChainOrder {
  chain: string;
  /** Library key: the same each time she has the same thing ("chain:chipotle:steak-bowl"). */
  key: string;
  /** "Steak bowl" (the chain goes in the brand). */
  name: string;
  /** "1 bowl", "3 tacos". */
  unit: string;
  /** How many she had: half a burrito is 0.5. */
  count: number;
  /** A standard serving of each part, for this order (tacos: a third of a bowl's worth per taco). */
  share: number;
  parts: OrderPart[];
  /** Assumptions worth telling her ("No filling named, so it's chicken."). */
  notes: string[];
  /** Where the numbers come from, shown with the order. */
  source: string;
}

// ---------------------------------------------------------------- Chipotle UK

/** Chipotle UK's published nutrition per serving (Feb 2025 list; honey chicken from the 2024 list). */
const M = {
  tortilla: { id: 'tortilla', name: 'Flour tortilla', kcal: 297, fat: 8.8, satFat: 0.7, carbs: 49.2, sugar: 1.8, fiber: 4.4, protein: 7.9, salt: 1.5 },
  tacoTortilla: { id: 'taco-tortilla', name: 'Taco tortillas', kcal: 94, fat: 2.8, satFat: 0.2, carbs: 15.5, sugar: 0.6, fiber: 1.4, protein: 2.5, salt: 0.5 },
  romaine: { id: 'romaine', name: 'Romaine lettuce', kcal: 15, fat: 0, carbs: 1.1, sugar: 1.1, protein: 0 },
  whiteRice: { id: 'white-rice', name: 'White rice', kcal: 185, fat: 2.0, satFat: 0.5, carbs: 41.5, sugar: 0.1, fiber: 1.2, protein: 4.1, salt: 1.2 },
  brownRice: { id: 'brown-rice', name: 'Brown rice', kcal: 185, fat: 1.7, satFat: 0.4, carbs: 32.8, sugar: 0.1, fiber: 2.3, protein: 3.8, salt: 1.1 },
  blackBeans: { id: 'black-beans', name: 'Black beans', kcal: 95, fat: 2.4, satFat: 1.0, carbs: 4.9, sugar: 0.9, fiber: 8.6, protein: 7.2, salt: 0.5 },
  pintoBeans: { id: 'pinto-beans', name: 'Pinto beans', kcal: 95, fat: 0.6, satFat: 0.2, carbs: 6.2, sugar: 0.1, fiber: 11.2, protein: 6.7, salt: 0.5 },
  chicken: { id: 'chicken', name: 'Chicken', kcal: 185, fat: 8.4, satFat: 2.4, carbs: 1.0, sugar: 0.1, fiber: 1.0, protein: 27.3, salt: 2.2 },
  steak: { id: 'steak', name: 'Steak', kcal: 165, fat: 5.5, satFat: 1.9, carbs: 1.0, sugar: 0.2, fiber: 1.0, protein: 28.8, salt: 2.1 },
  barbacoa: { id: 'barbacoa', name: 'Barbacoa', kcal: 154, fat: 3.8, satFat: 1.3, carbs: 1.0, sugar: 0.1, fiber: 0.8, protein: 29.7, salt: 0.3 },
  carnitas: { id: 'carnitas', name: 'Carnitas', kcal: 210, fat: 11.9, satFat: 3.9, carbs: 1.0, sugar: 0.1, fiber: 1.0, protein: 25.8, salt: 2.0 },
  sofritas: { id: 'sofritas', name: 'Sofritas', kcal: 84, fat: 4.6, satFat: 0.7, carbs: 3.0, sugar: 2.2, fiber: 1.2, protein: 7.0, salt: 1.0 },
  alPastor: { id: 'al-pastor', name: 'Chicken al pastor', kcal: 207, fat: 9.7, satFat: 2.1, carbs: 7.0, sugar: 5.0, fiber: 0.8, protein: 22.6, salt: 0.6 },
  honeyChicken: { id: 'honey-chicken', name: 'Honey chicken', kcal: 165, fat: 9.3, carbs: 4.2, protein: 15.9 },
  fajitaVeg: { id: 'fajita-veg', name: 'Fajita veg', kcal: 21, fat: 1.1, satFat: 0.1, carbs: 2.1, sugar: 1.4, fiber: 0.6, protein: 0.4, salt: 0.4 },
  freshSalsa: { id: 'fresh-salsa', name: 'Fresh tomato salsa', kcal: 15, fat: 0.5, satFat: 0.1, carbs: 1.1, sugar: 1.5, fiber: 1.2, protein: 0.8, salt: 0.2 },
  cornSalsa: { id: 'corn-salsa', name: 'Chilli-corn salsa', kcal: 38, fat: 0.8, satFat: 0.2, carbs: 5.9, sugar: 0.9, fiber: 1.3, protein: 1.3, salt: 0.4 },
  greenSalsa: { id: 'green-salsa', name: 'Green-chilli salsa', kcal: 6, fat: 0.1, satFat: 0, carbs: 1.0, sugar: 0.9, fiber: 0.4, protein: 0.3, salt: 0.3 },
  redSalsa: { id: 'red-salsa', name: 'Red-chilli salsa', kcal: 9, fat: 0.3, satFat: 0, carbs: 1.4, sugar: 0.7, fiber: 0.2, protein: 0.3, salt: 0.7 },
  cheese: { id: 'cheese', name: 'Cheese', kcal: 94, fat: 7.8, satFat: 4.8, carbs: 0.1, sugar: 0, fiber: 0, protein: 5.8, salt: 0.5 },
  sourCream: { id: 'sour-cream', name: 'Sour cream', kcal: 45, fat: 3.9, satFat: 2.7, carbs: 1.4, sugar: 1.1, fiber: 0, protein: 0.9, salt: 0.1 },
  guac: { id: 'guac', name: 'Guacamole', kcal: 145, fat: 13.5, satFat: 2.8, carbs: 2.8, sugar: 0.8, fiber: 3.3, protein: 1.5, salt: 0.7 },
  lettuce: { id: 'lettuce', name: 'Lettuce', kcal: 4, fat: 0, carbs: 0.3, sugar: 0.3, protein: 0 },
  vinaigrette: { id: 'vinaigrette', name: 'Honey vinaigrette', kcal: 259, fat: 22.9, satFat: 2.4, carbs: 13.1, sugar: 6.2, fiber: 0.5, protein: 0.2, salt: 2.9 },
  chips: { id: 'chips', name: 'Chips', kcal: 417, fat: 21.6, satFat: 1.7, carbs: 54.1, sugar: 1.2, fiber: 0, protein: 4.6, salt: 1.3 },
  chipsLarge: { id: 'chips-large', name: 'Large chips', kcal: 834, fat: 43.2, satFat: 3.4, carbs: 108.2, sugar: 2.4, fiber: 0, protein: 9.2, salt: 2.6 },
  sideGuac: { id: 'side-guac', name: 'Guacamole (side)', kcal: 145, fat: 13.5, satFat: 2.8, carbs: 2.8, sugar: 0.8, fiber: 3.3, protein: 1.5, salt: 0.7 },
  sideGuacLarge: { id: 'side-guac-large', name: 'Large guacamole', kcal: 290, fat: 27, satFat: 5.6, carbs: 5.6, sugar: 1.6, fiber: 6.6, protein: 3, salt: 1.4 },
  sideSalsa: { id: 'side-salsa', name: 'Salsa (side)', kcal: 15, fat: 0.5, satFat: 0.1, carbs: 1.1, sugar: 1.5, fiber: 1.2, protein: 0.8, salt: 0.2 },
} satisfies Record<string, MenuItem>;

type ItemKey = keyof typeof M;
const KEYS = Object.keys(M) as ItemKey[];
const BY_ID = new Map<string, ItemKey>(KEYS.map((k) => [M[k].id, k]));
/** The order parts are listed in (the order Chipotle builds it). */
const RANK = new Map<string, number>(KEYS.map((k, i) => [M[k].id, i]));

type Category = 'protein' | 'rice' | 'beans' | 'salsa' | 'shell' | 'topping';
const CATEGORY: Partial<Record<ItemKey, Category>> = {
  chicken: 'protein',
  steak: 'protein',
  barbacoa: 'protein',
  carnitas: 'protein',
  sofritas: 'protein',
  alPastor: 'protein',
  honeyChicken: 'protein',
  whiteRice: 'rice',
  brownRice: 'rice',
  blackBeans: 'beans',
  pintoBeans: 'beans',
  freshSalsa: 'salsa',
  cornSalsa: 'salsa',
  greenSalsa: 'salsa',
  redSalsa: 'salsa',
  tortilla: 'shell',
  tacoTortilla: 'shell',
};
const categoryOf = (k: ItemKey): Category => CATEGORY[k] ?? 'topping';

/** What she might say → what it is. Generic words ("rice", "beans", "salsa") keep whatever kind the order already has. */
type Said = { key: ItemKey; generic?: boolean } | { veggie: true } | { chips: 'regular' | 'large'; side?: 'guac' | 'salsa' };
const ALIASES: [string, Said][] = [
  ['chicken al pastor', { key: 'alPastor' }],
  ['al pastor', { key: 'alPastor' }],
  ['pastor', { key: 'alPastor' }],
  ['honey chicken', { key: 'honeyChicken' }],
  ['chicken', { key: 'chicken' }],
  ['steak', { key: 'steak' }],
  ['beef steak', { key: 'steak' }],
  ['beef', { key: 'steak' }],
  ['shredded beef', { key: 'barbacoa' }],
  ['barbacoa beef', { key: 'barbacoa' }],
  ['beef barbacoa', { key: 'barbacoa' }],
  ['barbacoa', { key: 'barbacoa' }],
  ['pulled pork', { key: 'carnitas' }],
  ['carnitas', { key: 'carnitas' }],
  ['pork', { key: 'carnitas' }],
  ['sofritas', { key: 'sofritas' }],
  ['tofu', { key: 'sofritas' }],
  ['veggie', { veggie: true }],
  ['veggies', { veggie: true }],
  ['vegetarian', { veggie: true }],
  ['vegan', { veggie: true }],
  ['coriander lime white rice', { key: 'whiteRice' }],
  ['cilantro lime white rice', { key: 'whiteRice' }],
  ['coriander lime brown rice', { key: 'brownRice' }],
  ['cilantro lime brown rice', { key: 'brownRice' }],
  ['coriander lime rice', { key: 'whiteRice' }],
  ['cilantro lime rice', { key: 'whiteRice' }],
  ['coriander rice', { key: 'whiteRice' }],
  ['cilantro rice', { key: 'whiteRice' }],
  ['lime rice', { key: 'whiteRice' }],
  ['white rice', { key: 'whiteRice' }],
  ['brown rice', { key: 'brownRice' }],
  ['rice', { key: 'whiteRice', generic: true }],
  ['black beans', { key: 'blackBeans' }],
  ['pinto beans', { key: 'pintoBeans' }],
  ['pinto', { key: 'pintoBeans' }],
  ['beans', { key: 'blackBeans', generic: true }],
  ['fajita veggies', { key: 'fajitaVeg' }],
  ['fajita veg', { key: 'fajitaVeg' }],
  ['fajita vegetables', { key: 'fajitaVeg' }],
  ['fajita peppers', { key: 'fajitaVeg' }],
  ['fajitas', { key: 'fajitaVeg' }],
  ['fajita', { key: 'fajitaVeg' }],
  ['peppers and onions', { key: 'fajitaVeg' }],
  ['grilled veg', { key: 'fajitaVeg' }],
  ['veg', { key: 'fajitaVeg' }],
  ['roasted tomato green chilli salsa', { key: 'greenSalsa' }],
  ['roasted tomato red chilli salsa', { key: 'redSalsa' }],
  ['tomatillo green chilli salsa', { key: 'greenSalsa' }],
  ['tomatillo red chilli salsa', { key: 'redSalsa' }],
  ['fresh tomato salsa', { key: 'freshSalsa' }],
  ['tomato salsa', { key: 'freshSalsa' }],
  ['fresh salsa', { key: 'freshSalsa' }],
  ['mild salsa', { key: 'freshSalsa' }],
  ['pico de gallo', { key: 'freshSalsa' }],
  ['pico', { key: 'freshSalsa' }],
  ['mild', { key: 'freshSalsa' }],
  ['roasted chilli corn salsa', { key: 'cornSalsa' }],
  ['roasted chili corn salsa', { key: 'cornSalsa' }],
  ['chilli corn salsa', { key: 'cornSalsa' }],
  ['chili corn salsa', { key: 'cornSalsa' }],
  ['chilli corn', { key: 'cornSalsa' }],
  ['chili corn', { key: 'cornSalsa' }],
  ['corn salsa', { key: 'cornSalsa' }],
  ['corn', { key: 'cornSalsa' }],
  ['medium salsa', { key: 'cornSalsa' }],
  ['green chilli salsa', { key: 'greenSalsa' }],
  ['green chili salsa', { key: 'greenSalsa' }],
  ['green salsa', { key: 'greenSalsa' }],
  ['salsa verde', { key: 'greenSalsa' }],
  ['verde', { key: 'greenSalsa' }],
  ['tomatillo green', { key: 'greenSalsa' }],
  ['red chilli salsa', { key: 'redSalsa' }],
  ['red chili salsa', { key: 'redSalsa' }],
  ['red salsa', { key: 'redSalsa' }],
  ['hot salsa', { key: 'redSalsa' }],
  ['tomatillo red', { key: 'redSalsa' }],
  ['hot', { key: 'redSalsa' }],
  ['salsa', { key: 'freshSalsa', generic: true }],
  ['monterey jack cheese', { key: 'cheese' }],
  ['monterey jack', { key: 'cheese' }],
  ['jack cheese', { key: 'cheese' }],
  ['cheese', { key: 'cheese' }],
  ['sour cream', { key: 'sourCream' }],
  ['soured cream', { key: 'sourCream' }],
  ['crema', { key: 'sourCream' }],
  ['large chips and guacamole', { chips: 'large', side: 'guac' }],
  ['large chips and guac', { chips: 'large', side: 'guac' }],
  ['large chips & guac', { chips: 'large', side: 'guac' }],
  ['large chips and salsa', { chips: 'large', side: 'salsa' }],
  ['chips and guacamole', { chips: 'regular', side: 'guac' }],
  ['chips and guac', { chips: 'regular', side: 'guac' }],
  ['chips & guac', { chips: 'regular', side: 'guac' }],
  ['chips guac', { chips: 'regular', side: 'guac' }],
  ['chips and salsa', { chips: 'regular', side: 'salsa' }],
  ['chips & salsa', { chips: 'regular', side: 'salsa' }],
  ['large chips', { chips: 'large' }],
  ['tortilla chips', { chips: 'regular' }],
  ['chips', { chips: 'regular' }],
  ['nachos', { chips: 'regular' }],
  ['guacamole', { key: 'guac' }],
  ['guac', { key: 'guac' }],
  ['avocado', { key: 'guac' }],
  ['romaine lettuce', { key: 'lettuce' }],
  ['romaine', { key: 'lettuce' }],
  ['lettuce', { key: 'lettuce' }],
  ['chipotle honey vinaigrette', { key: 'vinaigrette' }],
  ['honey vinaigrette', { key: 'vinaigrette' }],
  ['vinaigrette', { key: 'vinaigrette' }],
  ['dressing', { key: 'vinaigrette' }],
  ['tortilla on the side', { key: 'tortilla' }],
  ['tortilla', { key: 'tortilla' }],
];

type OrderType = 'bowl' | 'burrito' | 'salad' | 'taco';
const TYPES: [string, OrderType][] = [
  ['burrito bowl', 'bowl'],
  ['bowl', 'bowl'],
  ['burrito', 'burrito'],
  ['salad', 'salad'],
  ['tacos', 'taco'],
];

const MODIFIERS: Record<string, number> = { double: 2, triple: 3, extra: 1.5, more: 1.5, light: 0.5, lite: 0.5, little: 0.5, bit: 0.5, half: 0.5, side: 1 };
const NEGATIONS = new Set(['no', 'without', 'hold', 'minus', 'skip', 'not', 'nothing', 'sans', 'zero', 'wo']);
/** Words that can sit inside an order without changing it. */
const INSIDE = new Set([...FILLERS, ...CONNECTORS, 'add', 'added', 'top', 'topped', 'order', 'meal', 'roasted', 'kind', 'type', 'both', 'please', 'on', 'side', 'usual']);
/** "chipotle" followed by one of these is the flavour, not the restaurant. */
const FLAVOUR = new Set(
  'mayo mayonnaise sauce paste chilli chili chillies pepper peppers dressing seasoning marinade marinated ketchup hummus houmous flavour flavor flavoured crisps wrap sandwich sub pasta soup burger aioli rub powder oil ranch glaze bbq dip relish salt spice spiced smoked infused butter jam chutney pesto chicken-wrap'
    .split(' ')
    .map(stem),
);
/** Other places (or her own cooking): then it isn't a Chipotle order, and the estimate handles it. */
const OTHER_PLACES = new Set(
  'tesco sainsbury asda aldi lidl waitrose morrisons coop iceland ocado pret greggs nando subway leon itsu wasabi costa starbucks mcdonald kfc wagamama barburrito chilango wahaca boots spar homemade made cooked recipe'
    .split(' ')
    .map(stem),
);
const OTHER_PHRASES = /\b(m & s|m and s|ms|marks and spencer|marks & spencer|co op|taco bell|home made|at home)\b/;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const phrase = (p: string) => p.split(' ').map(stem);
const SAID = ALIASES.map(([p, said]) => ({ w: phrase(p), said })).sort((a, b) => b.w.length - a.w.length);
const TYPE_WORDS = TYPES.map(([p, type]) => ({ w: phrase(p), type })).sort((a, b) => b.w.length - a.w.length);
/** Single long words, for forgiving a typo ("chiken", "burito"). */
const TYPO_WORDS = SAID.filter((s) => s.w.length === 1 && s.w[0].length >= 5);
const TYPO_TYPES = TYPE_WORDS.filter((t) => t.w.length === 1 && t.w[0].length >= 5);

type Kind =
  | { k: 'item'; said: Said; len: number }
  | { k: 'type'; type: OrderType; len: number }
  | { k: 'cue' }
  | { k: 'mod'; v: number }
  | { k: 'neg' }
  | { k: 'just' }
  | { k: 'num'; v: number }
  | { k: 'inside' }
  | { k: 'unknown' };

interface Mention {
  key: ItemKey;
  generic: boolean;
  qty: number | null;
  neg: boolean;
  both: boolean;
}

/** The parts she had last time she ordered this (by library key), if she has. */
export type Remembered = (key: string, unit: string) => { id: string; qty: number }[] | null | undefined;

const isProtein = (k: Kind | undefined) => k?.k === 'item' && 'key' in k.said && categoryOf(k.said.key) === 'protein';

/**
 * A Chipotle order in what she typed, and the tokens it used (so the rest can go to the estimate).
 * Null when there isn't one: no "chipotle", "chipotle mayo" (the flavour), or somewhere else named.
 */
export function chipotleOrder(tokens: Token[], taken: Set<number>, remembered?: Remembered): { order: ChainOrder; used: Set<number> } | null {
  const free = (i: number) => i >= 0 && i < tokens.length && !taken.has(i);
  const cue = tokens.findIndex((t, i) => free(i) && t.w === 'chipotle' && !FLAVOUR.has(tokens[i + 1]?.w ?? ''));
  if (cue < 0) return null;
  if (tokens.some((t) => OTHER_PLACES.has(t.w)) || OTHER_PHRASES.test(tokens.map((t) => t.w).join(' '))) return null;

  // What each word is.
  const kinds: Kind[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!free(i)) {
      kinds[i] = { k: 'unknown' };
      continue;
    }
    const t = tokens[i];
    const at = (w: string[]) => w.every((x, j) => free(i + j) && tokens[i + j].w === x);
    const type = TYPE_WORDS.find((x) => at(x.w));
    const said = SAID.find((x) => at(x.w));
    let kind: Kind;
    if (t.w === 'chipotle' && !(said && said.w.length > 1)) kind = { k: 'cue' };
    else if (type && (!said || type.w.length >= said.w.length)) kind = { k: 'type', type: type.type, len: type.w.length };
    else if (said) kind = { k: 'item', said: said.said, len: said.w.length };
    else if (t.w in MODIFIERS && !(t.w === 'half' && typeAhead(i))) kind = { k: 'mod', v: MODIFIERS[t.w] };
    else if (NEGATIONS.has(t.w)) kind = { k: 'neg' };
    else if (t.w === 'just' || t.w === 'only') kind = { k: 'just' };
    else if (numberOf(t) != null && t.w !== 'a' && t.w !== 'an') kind = { k: 'num', v: numberOf(t)! };
    else if (INSIDE.has(t.w)) kind = { k: 'inside' };
    else {
      const typoType = t.w.length >= 5 ? TYPO_TYPES.find((x) => nearly(t.w, x.w[0])) : undefined;
      const typo = t.w.length >= 5 && !typoType ? TYPO_WORDS.find((x) => nearly(t.w, x.w[0])) : undefined;
      kind = typoType ? { k: 'type', type: typoType.type, len: 1 } : typo ? { k: 'item', said: typo.said, len: 1 } : { k: 'unknown' };
    }
    kinds[i] = kind;
    // the other words of a several-word match
    const len = 'len' in kind ? kind.len : 1;
    for (let j = 1; j < len; j++) kinds[i + j] = { k: 'inside' };
    i += len - 1;
  }
  function typeAhead(i: number): boolean {
    for (let j = i + 1; j < Math.min(tokens.length, i + 5); j++) {
      const w = tokens[j].w;
      if (TYPE_WORDS.some((x) => x.w[0] === w)) return true;
      if (!['a', 'an', 'the', 'my', 'of', 'chipotle'].includes(w) && !SAID.some((s) => s.w.length === 1 && s.w[0] === w && 'key' in s.said && categoryOf(s.said.key) === 'protein'))
        return false;
    }
    return false;
  }

  // Is it the restaurant? An order word ("bowl", "chips and guac"), "from/at chipotle", "chipotle order",
  // "chipotle chips", or "chipotle" on its own ("had chipotle for lunch").
  const before = tokens[cue - 1]?.w;
  const after = kinds[cue + 1];
  const alone = tokens.every((t, i) => i === cue || FILLERS.has(t.w) || !free(i));
  const ordered =
    kinds.some((k) => k.k === 'type') ||
    kinds.some((k) => k.k === 'item' && 'chips' in k.said && !!k.said.side) ||
    (after?.k === 'item' && 'chips' in after.said);
  if (!ordered && before !== 'from' && before !== 'at' && tokens[cue + 1]?.w !== 'order' && !alone) return null;

  // "Burrito with salad": a second "salad" is lettuce.
  let firstType: OrderType | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const k = kinds[i];
    if (k.k !== 'type') continue;
    if (!firstType) firstType = k.type;
    else if (k.type === 'salad') kinds[i] = { k: 'item', said: { key: 'lettuce' }, len: 1 };
  }

  // The stretch of words that make up the order: out from "chipotle" until a word that isn't part of it.
  const inOrder = (i: number) => free(i) && kinds[i].k !== 'unknown';
  let lo = cue;
  let hi = cue;
  while (inOrder(lo - 1)) lo--;
  while (inOrder(hi + 1)) hi++;
  // "cheese sandwich", "grilled chicken": a menu word stuck to another food belongs with that food.
  if (free(lo - 1) && kinds[lo - 1].k === 'unknown' && kinds[lo].k === 'item') {
    lo++;
    while (lo < cue && kinds[lo].k === 'inside') lo++;
  }
  if (free(hi + 1) && kinds[hi + 1].k === 'unknown' && kinds[hi].k === 'item') {
    hi--;
    while (hi > cue && kinds[hi].k === 'inside') hi--;
  }
  // Joining words and amounts at the edges belong to whatever is next to the order ("… and 2 cokes").
  while (hi > cue && ['inside', 'num', 'mod', 'neg', 'just'].includes(kinds[hi].k)) hi--;
  while (lo < cue && kinds[lo].k === 'inside') lo++;
  // A second main dish ends this order ("… and a steak burrito" goes to the estimate).
  let type: OrderType | null = null;
  for (let i = lo; i <= hi; i++) {
    const k = kinds[i];
    if (k.k !== 'type') continue;
    if (!type) {
      type = k.type;
      continue;
    }
    let end = i - 1;
    while (end > cue && (kinds[end].k === 'item' || kinds[end].k === 'num' || kinds[end].k === 'mod')) end--;
    while (end > cue && kinds[end].k === 'inside') end--;
    hi = Math.max(cue, end);
    break;
  }

  // Read it.
  let count = 1;
  let tacos = 3;
  let neg = false;
  let mult: number | null = null;
  let both = false;
  let just = false;
  let veggie = false;
  const proteins: { key: ItemKey; qty: number | null }[] = [];
  const mentions: Mention[] = [];
  let chips: { size: 'regular' | 'large'; side?: 'guac' | 'salsa' } | null = null;
  const used = new Set<number>();
  for (let i = lo; i <= hi; i++) {
    used.add(i);
    const k = kinds[i];
    const w = tokens[i].w;
    if (k.k === 'neg') {
      neg = true;
      mult = null;
    } else if (k.k === 'just') just = true;
    else if (k.k === 'mod') {
      mult = k.v;
      neg = false; // "no salsa, light guac"
    }
    else if (k.k === 'num') {
      // "2 steak tacos", "half a burrito": how many of them; "2 guac": double
      let j = i + 1;
      while (j <= hi && (kinds[j].k === 'inside' || kinds[j].k === 'cue' || isProtein(kinds[j]))) j++;
      const nk = kinds[j];
      if (j <= hi && nk.k === 'type') {
        if (nk.type === 'taco') tacos = Math.max(1, Math.min(6, Math.round(k.v)));
        else count = Math.max(0.25, Math.min(4, k.v));
      } else if (kinds[i + 1]?.k === 'item') mult = k.v;
    } else if (k.k === 'inside') {
      if (w === 'both') both = true;
      else if (w === 'with' || w === 'add' || w === 'added' || w === 'plus' || w === '+') neg = false;
    } else if (k.k === 'item') {
      const s = k.said;
      if ('veggie' in s) {
        if (!neg) veggie = true;
      } else if ('chips' in s) {
        if (!neg) chips = { size: s.chips, side: s.side };
      } else if (categoryOf(s.key) === 'protein') {
        if (!neg) proteins.push({ key: s.key, qty: mult });
      } else mentions.push({ key: s.key, generic: !!s.generic, qty: neg ? null : mult, neg, both });
      mult = null;
      both = false;
    }
  }

  if (!type && chips && !proteins.length && !veggie && !mentions.some((m) => !m.neg)) return { order: chipsOrder(chips, count), used };
  const notes: string[] = [];
  if (!type) {
    type = 'bowl';
    if (!alone) notes.push('Taken as a bowl.');
  }
  const share = type === 'taco' ? tacos / 3 : 1;
  const unit = type === 'bowl' ? '1 bowl' : type === 'burrito' ? '1 burrito' : type === 'salad' ? '1 salad' : tacos === 1 ? '1 taco' : `${tacos} tacos`;

  // Fillings: what she named. Two without amounts are half and half; "extra chicken" is a double scoop.
  let fill = proteins.map((p) => ({ key: p.key, qty: p.qty == null ? 1 / proteins.length : p.qty === 1.5 ? 2 : p.qty }));
  if (proteins.length > 1 && proteins.every((p) => p.qty == null)) notes.push(`${proteins.map((p) => M[p.key].name).join(' and ')}, half of each.`);
  if (!fill.length && !veggie && !just) {
    fill = [{ key: 'chicken', qty: 1 }];
    notes.push(alone ? 'No order given, so it’s a chicken bowl with the usual.' : 'No filling named, so it’s chicken.');
  }
  if (proteins.some((p) => p.key === 'steak') && tokens.some((t, i) => used.has(i) && t.w === 'beef')) notes.push('Beef taken as steak.');

  const typeName = type === 'taco' ? (tacos === 1 ? 'taco' : 'tacos') : type;
  const fillName = fill.length ? fill.map((p) => M[p.key].name.toLowerCase()).join(' & ') : veggie ? 'veggie' : '';
  let name = fillName ? `${fillName} ${typeName}` : typeName;
  if (chips) name += chips.side === 'guac' ? ' + chips & guac' : chips.side === 'salsa' ? ' + chips & salsa' : ' + chips';
  name = name[0].toUpperCase() + name.slice(1);
  const key = `chain:chipotle:${slug(name)}`;

  // Start from what she had last time, or the usual build.
  const last = just ? null : remembered?.(key, unit);
  let parts: OrderPart[] = [];
  const keyOf = (p: OrderPart) => BY_ID.get(p.item.id)!;
  const has = (k: ItemKey) => parts.some((p) => keyOf(p) === k);
  const drop = (pred: (k: ItemKey) => boolean) => (parts = parts.filter((p) => !pred(keyOf(p))));
  const put = (k: ItemKey, qty: number) => {
    const i = parts.findIndex((p) => keyOf(p) === k);
    if (i >= 0) parts[i] = { ...parts[i], qty, on: true };
    else parts.push({ item: M[k], qty, on: true });
  };
  if (last?.length) {
    for (const p of last) {
      const k = BY_ID.get(p.id);
      if (k && p.qty > 0) put(k, p.qty);
    }
    notes.push(`Same as your last ${name.toLowerCase()}.`);
    for (const p of proteins) if (p.qty != null) put(p.key, (p.qty === 1.5 ? 2 : p.qty) * share);
  } else {
    if (type === 'burrito') put('tortilla', 1);
    if (type === 'taco') put('tacoTortilla', tacos);
    if (!just) {
      if (type === 'salad') put('romaine', 1);
      else if (type !== 'taco') put('whiteRice', 1);
      if (type !== 'taco') put('blackBeans', 1);
    }
    for (const p of fill) put(p.key, p.qty * share);
    if (veggie && !proteins.length) {
      put('fajitaVeg', share);
      put('guac', share);
    }
    if (!just) {
      put('freshSalsa', share);
      put('cheese', share);
    }
  }

  // What she said about each part.
  const negated = new Set<ItemKey>();
  const salsas = mentions.filter((m) => categoryOf(m.key) === 'salsa' && !m.neg);
  if (salsas.some((m) => !m.generic)) {
    drop((k) => categoryOf(k) === 'salsa');
    for (const m of salsas) if (!m.generic) put(m.key, (m.qty ?? 1) * share);
  } else if (salsas.length && !parts.some((p) => categoryOf(keyOf(p)) === 'salsa')) put('freshSalsa', (salsas[0].qty ?? 1) * share);
  for (const cat of ['rice', 'beans'] as const) {
    const said = mentions.filter((m) => categoryOf(m.key) === cat && !m.neg);
    const kinds = [...new Set(said.filter((m) => !m.generic).map((m) => m.key))];
    const other = (k: ItemKey): ItemKey => (cat === 'rice' ? (k === 'whiteRice' ? 'brownRice' : 'whiteRice') : k === 'blackBeans' ? 'pintoBeans' : 'blackBeans');
    if (said.some((m) => m.both) || kinds.length > 1) {
      // both kinds: half a scoop of each, unless she said otherwise
      const k0 = (kinds[0] ?? said[0].key) as ItemKey;
      drop((k) => categoryOf(k) === cat);
      for (const k of [k0, other(k0)]) put(k, (said.find((m) => m.key === k && m.qty != null)?.qty ?? 0.5) * share);
    } else if (kinds.length === 1) {
      const m = said.find((x) => !x.generic)!;
      const cur = parts.find((p) => categoryOf(keyOf(p)) === cat);
      drop((k) => categoryOf(k) === cat);
      put(m.key, m.qty != null ? m.qty * share : cur && keyOf(cur) !== m.key ? cur.qty : (cur?.qty ?? share));
    } else if (said.length) {
      const m = said[0];
      const cur = parts.find((p) => categoryOf(keyOf(p)) === cat);
      if (cur) put(keyOf(cur), m.qty != null ? m.qty * share : cur.qty);
      else put(m.key, (m.qty ?? 1) * share);
    }
  }
  for (const m of mentions) {
    const cat = categoryOf(m.key);
    if (m.neg) {
      const gone = m.generic ? KEYS.filter((k) => categoryOf(k) === cat) : [m.key];
      drop((k) => gone.includes(k));
      gone.forEach((k) => negated.add(k));
    } else if (cat === 'topping' || cat === 'shell') put(m.key, (m.qty ?? 1) * (cat === 'shell' ? 1 : share));
  }

  if (chips) {
    put(chips.size === 'large' ? 'chipsLarge' : 'chips', 1);
    if (chips.side === 'guac') put(chips.size === 'large' ? 'sideGuacLarge' : 'sideGuac', 1);
    if (chips.side === 'salsa') put('sideSalsa', 1);
  }
  parts.sort((a, b) => RANK.get(a.item.id)! - RANK.get(b.item.id)!);

  // Things people often add, ready to tick.
  if (!just) {
    const extras: ItemKey[] = ['cheese', 'sourCream', 'guac', 'fajitaVeg', 'cornSalsa'];
    if (type === 'salad') extras.push('vinaigrette');
    for (const k of extras) if (!has(k) && !negated.has(k)) parts.push({ item: M[k], qty: share, on: false });
  }

  return { order: { chain: 'Chipotle', key, name, unit, count, share, parts, notes, source: 'Chipotle UK nutrition' }, used };
}

function chipsOrder(chips: { size: 'regular' | 'large'; side?: 'guac' | 'salsa' }, count: number): ChainOrder {
  const large = chips.size === 'large';
  const parts: OrderPart[] = [{ item: large ? M.chipsLarge : M.chips, qty: 1, on: true }];
  if (chips.side === 'guac') parts.push({ item: large ? M.sideGuacLarge : M.sideGuac, qty: 1, on: true });
  else if (chips.side === 'salsa') parts.push({ item: M.sideSalsa, qty: 1, on: true });
  else parts.push({ item: large ? M.sideGuacLarge : M.sideGuac, qty: 1, on: false }, { item: M.sideSalsa, qty: 1, on: false });
  const name = `${large ? 'Large chips' : 'Chips'}${chips.side === 'guac' ? ' & guac' : chips.side === 'salsa' ? ' & salsa' : ''}`;
  return { chain: 'Chipotle', key: `chain:chipotle:${slug(name)}`, name, unit: '1 bag', count, share: 1, parts, notes: [], source: 'Chipotle UK nutrition' };
}

// ---------------------------------------------------------------- an order in the diary

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Calories and macros of the parts she had. */
export function orderNutrition(parts: OrderPart[]): Nutrition {
  const on = parts.filter((p) => p.on);
  const sum = (f: (m: MenuItem) => number | undefined) => r1(on.reduce((s, p) => s + (f(p.item) ?? 0) * p.qty, 0));
  return {
    kcal: Math.round(on.reduce((s, p) => s + p.item.kcal * p.qty, 0)),
    protein: sum((m) => m.protein),
    carbs: sum((m) => m.carbs),
    fat: sum((m) => m.fat),
    fiber: sum((m) => m.fiber),
    sugar: sum((m) => m.sugar),
    satFat: sum((m) => m.satFat),
    salt: Math.round(on.reduce((s, p) => s + (p.item.salt ?? 0) * p.qty, 0) * 100) / 100,
  };
}

/** The order as one food: one serving is the whole order as she had it (and it remembers its parts). */
export function orderFood(order: ChainOrder): Food {
  return {
    key: order.key,
    name: order.name,
    brand: order.chain,
    source: 'custom',
    per100: orderNutrition(order.parts),
    base: 'g',
    servings: [{ label: order.unit, grams: 100 }],
    defaultServing: 0,
    parts: order.parts.filter((p) => p.on).map((p) => ({ id: p.item.id, qty: Math.round(p.qty * 1000) / 1000 })),
  };
}

/** The diary entry for an order (`amount` of them). */
export function orderEntry(order: ChainOrder, meal: Meal, date: string, amount = order.count): FoodEntry {
  return { ...entryFor(orderFood(order), amount, order.unit, meal, date, 'describe'), grams: null };
}

/** "double", "light", "×3" next to a part that isn't one standard serving. */
export function partLabel(part: OrderPart, order: Pick<ChainOrder, 'share'>): string {
  if (part.item.id === 'taco-tortilla') return `×${Math.round(part.qty)}`;
  const q = part.qty / (order.share || 1);
  if (Math.abs(q - 1) < 0.01) return '';
  if (Math.abs(q - 0.5) < 0.01) return 'half';
  if (Math.abs(q - 1.5) < 0.01) return 'extra';
  if (Math.abs(q - 2) < 0.01) return 'double';
  return `×${Math.round(q * 100) / 100}`;
}

/** The parts she had last time, from the food saved in her library. */
export function rememberedParts(food: Pick<Food, 'parts' | 'servings'> | null | undefined, unit: string): { id: string; qty: number }[] | null {
  if (!food?.parts?.length || food.servings?.[0]?.label !== unit) return null;
  return food.parts.filter((p) => BY_ID.has(p.id));
}
