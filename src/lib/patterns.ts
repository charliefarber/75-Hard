import type { FoodEntry, Meal } from '../data/foodTypes';
import { foodDay } from './report';
import { keyOf, suggestable } from './usual';

/**
 * Food patterns for the Food tab, from her last four weeks of diary:
 *  - where the day's calories (and protein) come from, meal by meal, averaged over fully logged
 *    days only (the same rule as the weekly report, so a half-logged day can't skew the split)
 *  - the foods she logs most, counted once per day, ready to log again in one tap
 * Nothing here judges how much she eats: it describes, and the only nudge is about protein.
 */

export const PATTERN_DAYS = 28;
const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
/** Fully logged days needed before the meal split means anything. */
const MIN_FULL_DAYS = 3;
/** A main meal averaging less protein than this (and eaten on most days) gets a gentle pointer. */
const LOW_PROTEIN_G = 15;

export interface MealPart {
  meal: Meal;
  /** Average a day, over fully logged days (0 on days without that meal). */
  kcal: number;
  protein: number;
  share: number;
  /** The share as a whole percentage; the parts add up to exactly 100. */
  pct: number;
  /** Fully logged days that had this meal. */
  days: number;
}

export interface OftenFood {
  key: string;
  name: string;
  /** Days it was logged on (once a day however many times). */
  days: number;
  /** The meal she logs it at most, and every meal she's logged it at. */
  meal: Meal;
  meals: Meal[];
  /** The most recent time she logged it: the amount to log again. */
  entry: FoodEntry;
}

export interface FoodPatterns {
  /** Days looked at, days with any food, days that look fully logged. */
  days: number;
  logged: number;
  full: number;
  /** Breakfast to snacks; empty until there are three fully logged days. */
  meals: MealPart[];
  biggest: MealPart | null;
  /** A main meal that's light on protein, if one clearly is. */
  lowProtein: MealPart | null;
  often: OftenFood[];
}

/** Whole percentages that add up to 100 (largest remainder). */
export function wholePercents(shares: number[]): number[] {
  const raw = shares.map((s) => s * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

/** `dates` are finished days, oldest first; `entriesFor` gives a day's diary (undefined while it loads). */
export function foodPatterns(dates: string[], entriesFor: (date: string) => FoodEntry[] | undefined, calorieGoal: number | null, limit = 5): FoodPatterns {
  let logged = 0;
  const fullDays: FoodEntry[][] = [];
  const often = new Map<string, { days: number; byMeal: Map<Meal, number>; entry: FoodEntry }>();

  for (const date of dates) {
    const list = entriesFor(date);
    if (!list?.length) continue;
    logged++;
    if (foodDay(date, list, undefined, calorieGoal)?.full) fullDays.push(list);
    // Counted once a day, and once a day per meal it was had at.
    const seen = new Set<string>();
    for (const e of list) {
      if (!suggestable(e)) continue;
      const key = keyOf(e);
      let o = often.get(key);
      if (!o) {
        o = { days: 0, byMeal: new Map(), entry: e };
        often.set(key, o);
      }
      if (e.log_date >= o.entry.log_date) o.entry = e; // the latest amount wins
      if (!seen.has(key)) {
        seen.add(key);
        o.days++;
      }
      if (!seen.has(`${key}|${e.meal}`)) {
        seen.add(`${key}|${e.meal}`);
        o.byMeal.set(e.meal, (o.byMeal.get(e.meal) ?? 0) + 1);
      }
    }
  }

  let meals: MealPart[] = [];
  if (fullDays.length >= MIN_FULL_DAYS) {
    const sums = MEAL_ORDER.map((meal) => {
      let kcal = 0;
      let protein = 0;
      let days = 0;
      for (const list of fullDays) {
        const items = list.filter((e) => e.meal === meal);
        if (items.length) days++;
        for (const e of items) {
          kcal += e.kcal || 0;
          protein += e.protein_g ?? 0;
        }
      }
      return { meal, kcal: kcal / fullDays.length, protein: protein / fullDays.length, days };
    }).filter((m) => m.kcal > 0);
    const total = sums.reduce((a, m) => a + m.kcal, 0);
    const pcts = wholePercents(sums.map((m) => m.kcal / total));
    meals = sums.map((m, i) => ({ meal: m.meal, kcal: Math.round(m.kcal), protein: Math.round(m.protein), share: m.kcal / total, pct: pcts[i], days: m.days }));
  }
  const biggest = meals.length >= 2 ? meals.reduce((a, b) => (b.share > a.share ? b : a)) : null;
  const mains = meals.filter((m) => m.meal !== 'snacks' && m.days >= fullDays.length / 2);
  const leanest = mains.length >= 2 ? mains.reduce((a, b) => (b.protein < a.protein ? b : a)) : null;

  const top = [...often.entries()]
    .filter(([, o]) => o.days >= 2)
    .sort(([, a], [, b]) => b.days - a.days || (a.entry.log_date < b.entry.log_date ? 1 : -1))
    .slice(0, limit)
    .map(([key, o]) => {
      const ranked = [...o.byMeal.entries()].sort((a, b) => b[1] - a[1] || (a[0] === o.entry.meal ? -1 : b[0] === o.entry.meal ? 1 : 0));
      return { key, name: o.entry.name.trim(), days: o.days, meal: ranked[0][0], meals: MEAL_ORDER.filter((m) => o.byMeal.has(m)), entry: o.entry };
    });

  return {
    days: dates.length,
    logged,
    full: fullDays.length,
    meals,
    biggest,
    lowProtein: leanest && leanest.protein < LOW_PROTEIN_G ? leanest : null,
    often: top,
  };
}

/** Where a one-tap re-log goes: the meal it's time for, if she's had it then before, else its usual meal. */
export function mealToLog(f: Pick<OftenFood, 'meal' | 'meals'>, now: Meal): Meal {
  return f.meals.includes(now) ? now : f.meal;
}
