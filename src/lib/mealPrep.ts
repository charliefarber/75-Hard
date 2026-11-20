import type { Food, FoodEntry, Meal, MealPrep, Nutrition } from '../data/foodTypes';
import { entryFor, newId, portionFood, totals } from './nutrition';

/**
 * Meal prep: everything that went into a batch, split into equal portions. Each portion she
 * eats is logged as one diary entry ("½ × portion" works too), and the batch counts down.
 * A diary entry points back at its batch through its food key: "prep:<batch id>".
 *
 * If she weighs the whole batch once it's cooked, she can also log it by the gram ("100 g of
 * the lasagne"): the batch's calories and macros are spread over its cooked weight, and the
 * grams she eats count down as the matching share of a portion.
 */

export const PORTION_SIZES = [0.5, 1, 1.5] as const;
export const MAX_PORTIONS = 30;
export const MAX_COOKED_GRAMS = 50000;
/** Close enough to count as there: 1% of a portion (weighing and rounding aren't exact). */
const EPS = 0.01;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const prepKey = (id: string) => `prep:${id}`;

/** The batch an entry came from, if it's a meal-prep portion. */
export function prepIdOf(e: Pick<FoodEntry, 'food_key'>): string | null {
  return e.food_key?.startsWith('prep:') ? e.food_key.slice(5) : null;
}

/** Calories and macros for the whole batch. */
export function batchNutrition(items: MealPrep['items']): Nutrition {
  const t = totals(items);
  return { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat };
}

/** One portion's calories and macros (rounded like the rest of the diary). */
export function portionNutrition(prep: Pick<MealPrep, 'items' | 'portions'>): Nutrition {
  if (!(prep.portions > 0)) throw new Error('A meal prep needs at least one portion');
  const b = batchNutrition(prep.items);
  const r1 = (n: number | null) => (n == null ? null : Math.round((n / prep.portions) * 10) / 10);
  return { kcal: Math.round(b.kcal / prep.portions), protein: r1(b.protein), carbs: r1(b.carbs), fat: r1(b.fat) };
}

/** Grams in one portion, when the batch was weighed. */
export function gramsPerPortion(prep: Pick<MealPrep, 'portions' | 'cooked_grams'>): number | null {
  return prep.cooked_grams && prep.cooked_grams > 0 && prep.portions > 0 ? prep.cooked_grams / prep.portions : null;
}

/** Calories and macros per 100 g of the cooked batch, when it was weighed. */
export function per100Nutrition(prep: Pick<MealPrep, 'items' | 'cooked_grams'>): Nutrition | null {
  if (!prep.cooked_grams || !(prep.cooked_grams > 0)) return null;
  const b = batchNutrition(prep.items);
  const f = 100 / prep.cooked_grams;
  const s = (n: number | null) => (n == null ? null : r1(n * f));
  return { kcal: r1(b.kcal * f), protein: s(b.protein), carbs: s(b.carbs), fat: s(b.fat) };
}

/** Nutrition for `grams` of the cooked batch. */
export function gramsNutrition(prep: Pick<MealPrep, 'items' | 'cooked_grams'>, grams: number): Nutrition | null {
  if (!prep.cooked_grams || !(prep.cooked_grams > 0)) return null;
  const b = batchNutrition(prep.items);
  const f = Math.max(0, grams) / prep.cooked_grams;
  const s = (n: number | null) => (n == null ? null : r1(n * f));
  return { kcal: Math.round(b.kcal * f), protein: s(b.protein), carbs: s(b.carbs), fat: s(b.fat) };
}

/**
 * The batch as a food she can log. Weighed: real per-100 g numbers, with "1 portion" as a serving
 * of its share of the weight, so portions and grams both work (and can be switched when editing).
 * Not weighed: one portion is the only unit.
 */
export function prepFood(prep: MealPrep): Food {
  const per100 = per100Nutrition(prep);
  const gpp = gramsPerPortion(prep);
  if (!per100 || !gpp) return portionFood(prepKey(prep.id), prep.name, portionNutrition(prep));
  return { key: prepKey(prep.id), name: prep.name, source: 'custom', per100, base: 'g', servings: [{ label: '1 portion', grams: r1(gpp) }], defaultServing: 0 };
}

/**
 * How many portions a diary entry took out of its batch: "1½ portions" is 1.5, and grams are
 * converted with the portion weight the entry was logged with.
 */
export function portionsIn(e: Pick<FoodEntry, 'amount' | 'unit' | 'food'>): number {
  if (e.unit !== 'g' && e.unit !== 'ml') return e.amount;
  const per = e.food?.servings?.[0]?.grams;
  return per && per > 0 ? e.amount / per : 0;
}

/** "½", "1", "1½", "3½" (to the nearest half). */
export function formatPortions(n: number): string {
  const halves = Math.round(n * 2);
  const whole = Math.floor(halves / 2);
  if (halves % 2 === 0) return String(whole);
  return whole === 0 ? '½' : `${whole}½`;
}

/** "½ portion", "1 portion", "1½ portions". */
export function portionLabel(size: number): string {
  return `${formatPortions(size)} ${size <= 1 ? 'portion' : 'portions'}`;
}

/** Grams of the batch not eaten yet, when it was weighed. */
export function gramsLeft(prep: Pick<MealPrep, 'portions' | 'portions_left' | 'cooked_grams'>): number | null {
  const gpp = gramsPerPortion(prep);
  return gpp ? Math.max(0, Math.round(prep.portions_left * gpp)) : null;
}

const g = (n: number) => n.toLocaleString('en-GB');

/** "4 of 6 left", "3½ of 6 left", "820 g of 1,200 g left" ("820 g left" when short), "All eaten". */
export function leftLabel(prep: Pick<MealPrep, 'portions' | 'portions_left' | 'cooked_grams'>, opts: { short?: boolean } = {}): string {
  if (prep.portions_left <= EPS) return 'All eaten';
  const grams = gramsLeft(prep);
  if (grams != null && prep.cooked_grams) return opts.short ? `${g(grams)} g left` : `${g(grams)} g of ${g(Math.round(prep.cooked_grams))} g left`;
  const exact = Math.abs(prep.portions_left * 2 - Math.round(prep.portions_left * 2)) < 0.02;
  return `${exact ? '' : '≈'}${formatPortions(prep.portions_left)} of ${prep.portions} left`;
}

export function canLog(prep: Pick<MealPrep, 'portions_left'>, size: number): boolean {
  return size > 0 && prep.portions_left + EPS >= size;
}

/** The batch after `delta` portions are eaten (negative gives them back), kept within 0…portions. */
export function withPortionsLeft<T extends Pick<MealPrep, 'portions' | 'portions_left'>>(prep: T, delta: number): T {
  let left = Math.round((prep.portions_left - delta) * 1000) / 1000; // 0.001 of a portion: well under a gram
  if (left < EPS) left = 0; // a crumb left after weighing isn't a portion
  return { ...prep, portions_left: Math.min(prep.portions, Math.max(0, left)) };
}

/** A diary entry for `size` portions of a batch. */
export function portionEntry(prep: MealPrep, size: number, meal: Meal, date: string): FoodEntry {
  const food = prepFood(prep);
  const e = entryFor(food, size, food.servings[0].label, meal, date, 'meal');
  return gramsPerPortion(prep) ? e : { ...e, grams: null };
}

/** A diary entry for `grams` of a weighed batch. */
export function gramsEntry(prep: MealPrep, grams: number, meal: Meal, date: string): FoodEntry {
  if (!gramsPerPortion(prep)) throw new Error('Weigh the batch to log it by the gram');
  if (!(grams > 0)) throw new Error('How many grams did you have?');
  return entryFor(prepFood(prep), Math.round(grams), 'g', meal, date, 'meal');
}

/** A cooked weight she typed: whole grams within reason, or null when left empty. */
export function parseCookedGrams(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_COOKED_GRAMS) throw new Error(`Cooked weight should be between 1 and ${g(MAX_COOKED_GRAMS)} g`);
  return Math.round(n);
}

/** A new batch from the ingredients she added. */
export function newMealPrep(input: { name: string; items: MealPrep['items']; portions: number; madeOn: string; cookedGrams?: number | null }): MealPrep {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error('Give the meal prep a name');
  if (!input.items.length) throw new Error('Add at least one ingredient');
  if (!Number.isInteger(input.portions) || input.portions < 1 || input.portions > MAX_PORTIONS) {
    throw new Error(`Split it into 1 to ${MAX_PORTIONS} portions`);
  }
  const cooked = input.cookedGrams ?? null;
  if (cooked != null && !(cooked > 0 && cooked <= MAX_COOKED_GRAMS)) throw new Error(`Cooked weight should be between 1 and ${g(MAX_COOKED_GRAMS)} g`);
  return {
    id: newId(),
    name,
    items: input.items,
    portions: input.portions,
    portions_left: input.portions,
    made_on: input.madeOn,
    ...(cooked != null ? { cooked_grams: cooked } : {}),
  };
}

/** Diary entries become batch ingredients (what's stored is what a saved meal stores). */
export function asIngredients(entries: FoodEntry[]): MealPrep['items'] {
  return entries.map(({ id: _i, log_date: _d, meal: _m, created_at: _c, ...rest }) => rest);
}
