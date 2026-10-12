import type { EntrySource, Food, FoodEntry, Meal, Nutrition, Serving } from '../data/foodTypes';
import { MEALS } from '../data/foodTypes';

export const KJ_PER_KCAL = 4.184;

const r1 = (n: number) => Math.round(n * 10) / 10;
const scaleN = (v: number | null | undefined, f: number) => (typeof v === 'number' && Number.isFinite(v) ? r1(v * f) : null);

/** Nutrition for `grams` of a food given per 100 g. */
export function scale(per100: Nutrition, grams: number): Nutrition {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: scaleN(per100.protein, f),
    carbs: scaleN(per100.carbs, f),
    fat: scaleN(per100.fat, f),
    fiber: scaleN(per100.fiber, f),
    sugar: scaleN(per100.sugar, f),
    satFat: scaleN(per100.satFat, f),
    salt: per100.salt == null ? null : Math.round(per100.salt * f * 100) / 100,
  };
}

/** The units she can pick for a food: its servings, then grams (or ml). */
export function unitsFor(food: Pick<Food, 'servings' | 'base'>): { unit: string; grams: number }[] {
  return [...food.servings.map((s) => ({ unit: s.label, grams: s.grams })), { unit: food.base, grams: 1 }];
}

export function gramsFor(food: Pick<Food, 'servings' | 'base'>, amount: number, unit: string): number {
  if (unit === 'g' || unit === 'ml') return amount;
  const s = food.servings.find((x) => x.label === unit);
  return s ? amount * s.grams : amount;
}

/** What to start with when she picks a food: the last amount she used, else its usual serving. */
export function defaultAmount(food: Food, last?: { amount: number | null; unit: string | null } | null): { amount: number; unit: string } {
  if (last?.amount && last.unit && (last.unit === food.base || food.servings.some((s) => s.label === last.unit)))
    return { amount: last.amount, unit: last.unit };
  const s = food.defaultServing != null ? food.servings[food.defaultServing] : food.servings[0];
  return s ? { amount: 1, unit: s.label } : { amount: 100, unit: food.base };
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}

/** A diary entry for `amount` × `unit` of a food. */
export function entryFor(food: Food, amount: number, unit: string, meal: Meal, date: string, source: EntrySource = food.source): FoodEntry {
  const grams = gramsFor(food, amount, unit);
  const n = scale(food.per100, grams);
  return {
    id: newId(),
    log_date: date,
    meal,
    name: food.name,
    brand: food.brand ?? null,
    food_key: food.key,
    amount: r2(amount),
    unit,
    grams: r1(grams),
    kcal: n.kcal,
    protein_g: n.protein,
    carbs_g: n.carbs,
    fat_g: n.fat,
    fiber_g: n.fiber ?? null,
    sugar_g: n.sugar ?? null,
    sat_fat_g: n.satFat ?? null,
    salt_g: n.salt ?? null,
    source,
    food,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Change how much of a logged food she had (keeps the meal, date and id). */
export function withAmount(entry: FoodEntry, amount: number, unit: string): FoodEntry {
  if (!entry.food) {
    // Quick adds and estimates scale from what was logged.
    const f = entry.amount > 0 ? amount / entry.amount : 1;
    return {
      ...entry,
      amount: r2(amount),
      grams: entry.grams != null ? r1(entry.grams * f) : null,
      kcal: Math.round(entry.kcal * f),
      protein_g: scaleN(entry.protein_g, f),
      carbs_g: scaleN(entry.carbs_g, f),
      fat_g: scaleN(entry.fat_g, f),
      fiber_g: scaleN(entry.fiber_g, f),
      sugar_g: scaleN(entry.sugar_g, f),
      sat_fat_g: scaleN(entry.sat_fat_g, f),
      salt_g: entry.salt_g == null ? null : Math.round(entry.salt_g * f * 100) / 100,
    };
  }
  const fresh = entryFor(entry.food, amount, unit, entry.meal, entry.log_date, entry.source);
  return { ...fresh, id: entry.id, created_at: entry.created_at };
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

export function totals(entries: Pick<FoodEntry, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g'>[]): Totals {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
  for (const e of entries) {
    t.kcal += e.kcal || 0;
    t.protein += e.protein_g || 0;
    t.carbs += e.carbs_g || 0;
    t.fat += e.fat_g || 0;
    t.fiber += e.fiber_g || 0;
    t.sugar += e.sugar_g || 0;
  }
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), fiber: r1(t.fiber), sugar: r1(t.sugar) };
}

export function byMeal(entries: FoodEntry[]): Record<Meal, FoodEntry[]> {
  const out = { breakfast: [], lunch: [], dinner: [], snacks: [] } as Record<Meal, FoodEntry[]>;
  for (const e of entries) out[e.meal]?.push(e);
  return out;
}

/** The meal she's most likely logging right now. */
export function mealForTime(d = new Date()): Meal {
  const m = d.getHours() * 60 + d.getMinutes();
  if (m >= 4 * 60 && m < 10 * 60 + 30) return 'breakfast';
  if (m >= 10 * 60 + 30 && m < 15 * 60) return 'lunch';
  if (m >= 15 * 60 && m < 17 * 60) return 'snacks';
  if (m >= 17 * 60 && m < 22 * 60) return 'dinner';
  return 'snacks';
}

export const mealLabel = (m: Meal) => MEALS.find((x) => x.id === m)!.label;

export interface MacroGoals {
  protein: number;
  carbs: number;
  fat: number;
  /** Where the numbers came from: her own, or a balanced split of her calorie target. */
  from: 'set' | 'split' | 'none';
}

/** Her macro targets: what she set, else 30 / 40 / 30 of her calorie target (protein / carbs / fat). */
export function macroGoals(p: { calorie_goal: number | null; protein_goal_g?: number | null; carbs_goal_g?: number | null; fat_goal_g?: number | null }): MacroGoals | null {
  if (p.protein_goal_g || p.carbs_goal_g || p.fat_goal_g)
    return { protein: p.protein_goal_g ?? 0, carbs: p.carbs_goal_g ?? 0, fat: p.fat_goal_g ?? 0, from: 'set' };
  if (!p.calorie_goal) return null;
  return splitGoals(p.calorie_goal, MACRO_SPLITS[0].split);
}

export const MACRO_SPLITS: { id: string; label: string; note: string; split: [number, number, number] }[] = [
  { id: 'balanced', label: 'Balanced', note: '30% protein · 40% carbs · 30% fat', split: [0.3, 0.4, 0.3] },
  { id: 'protein', label: 'High protein', note: '40% protein · 35% carbs · 25% fat', split: [0.4, 0.35, 0.25] },
  { id: 'lowcarb', label: 'Lower carb', note: '35% protein · 25% carbs · 40% fat', split: [0.35, 0.25, 0.4] },
];

export function splitGoals(kcal: number, [p, c, f]: [number, number, number]): MacroGoals {
  return { protein: Math.round((kcal * p) / 4), carbs: Math.round((kcal * c) / 4), fat: Math.round((kcal * f) / 9), from: 'split' };
}

/** "1 medium (118 g)", "150 g", "1½ servings". */
export function amountText(e: Pick<FoodEntry, 'amount' | 'unit' | 'grams'>): string {
  const a = niceNumber(e.amount);
  if (e.unit === 'g' || e.unit === 'ml') return `${a} ${e.unit}`;
  if (e.unit === 'portion') return e.grams ? `${Math.round(e.grams)} g` : 'portion';
  if (e.amount === 1) return e.unit;
  // "1 medium (118 g)" × 2 → "2 medium (236 g)"; "handful (80 g)" × 2 → "2 × handful (160 g)"
  const bare = e.unit.replace(/\s*\([^)]*\)\s*$/, '');
  const unit = /\(\s*[\d.]+\s*ml\s*\)/i.test(e.unit) ? 'ml' : 'g';
  const total = e.grams ? ` (${Math.round(e.grams)} ${unit})` : '';
  return /^1\s+/.test(bare) ? `${a} ${bare.replace(/^1\s+/, '')}${total}` : `${a} × ${bare}${total}`;
}

export function niceNumber(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  const fr = Math.abs(frac - 0.5) < 0.01 ? '½' : Math.abs(frac - 0.25) < 0.01 ? '¼' : Math.abs(frac - 0.75) < 0.01 ? '¾' : null;
  if (fr) return whole ? `${whole}${fr}` : fr;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Serving like "30 g" or "1 bar (45 g)" → grams, if it says. */
export function servingGrams(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(g|gr|grams?|ml|millilitres?|milliliters?|cl|l)\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === 'cl') return v * 10;
  if (u === 'l') return v * 1000;
  return v;
}

export const servingLabel = (label: string, grams: number, base: 'g' | 'ml') =>
  /\d\s*(g|ml)\b/i.test(label) ? label : `${label} (${Math.round(grams)} ${base})`;

/** Calories from macros (4 / 4 / 9), for sanity checks. */
export const kcalFromMacros = (p: number, c: number, f: number) => 4 * p + 4 * c + 9 * f;

export function serving(label: string, grams: number): Serving {
  return { label, grams };
}
