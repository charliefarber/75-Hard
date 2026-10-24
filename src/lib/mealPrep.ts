import type { FoodEntry, Meal, MealPrep, Nutrition } from '../data/foodTypes';
import { entryFor, newId, portionFood, totals } from './nutrition';

/**
 * Meal prep: everything that went into a batch, split into equal portions. Each portion she
 * eats is logged as one diary entry ("½ × portion" works too), and the batch counts down.
 * A diary entry points back at its batch through its food key: "prep:<batch id>".
 */

export const PORTION_SIZES = [0.5, 1, 1.5] as const;
export const MAX_PORTIONS = 30;
const EPS = 1e-9;

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

/** "4 of 6 left", "3½ of 6 left", "All eaten". */
export function leftLabel(prep: Pick<MealPrep, 'portions' | 'portions_left'>): string {
  return prep.portions_left <= EPS ? 'All eaten' : `${formatPortions(prep.portions_left)} of ${prep.portions} left`;
}

export function canLog(prep: Pick<MealPrep, 'portions_left'>, size: number): boolean {
  return size > 0 && prep.portions_left + EPS >= size;
}

/** The batch after `delta` portions are eaten (negative gives them back), kept within 0…portions. */
export function withPortionsLeft<T extends Pick<MealPrep, 'portions' | 'portions_left'>>(prep: T, delta: number): T {
  const left = Math.round((prep.portions_left - delta) * 2) / 2;
  return { ...prep, portions_left: Math.min(prep.portions, Math.max(0, left)) };
}

/** A diary entry for `size` portions of a batch. */
export function portionEntry(prep: MealPrep, size: number, meal: Meal, date: string): FoodEntry {
  const food = portionFood(prepKey(prep.id), prep.name, portionNutrition(prep));
  return { ...entryFor(food, size, food.servings[0].label, meal, date, 'meal'), grams: null };
}

/** A new batch from the ingredients she added. */
export function newMealPrep(input: { name: string; items: MealPrep['items']; portions: number; madeOn: string }): MealPrep {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error('Give the meal prep a name');
  if (!input.items.length) throw new Error('Add at least one ingredient');
  if (!Number.isInteger(input.portions) || input.portions < 1 || input.portions > MAX_PORTIONS) {
    throw new Error(`Split it into 1 to ${MAX_PORTIONS} portions`);
  }
  return { id: newId(), name, items: input.items, portions: input.portions, portions_left: input.portions, made_on: input.madeOn };
}

/** Diary entries become batch ingredients (what's stored is what a saved meal stores). */
export function asIngredients(entries: FoodEntry[]): MealPrep['items'] {
  return entries.map(({ id: _i, log_date: _d, meal: _m, created_at: _c, ...rest }) => rest);
}
