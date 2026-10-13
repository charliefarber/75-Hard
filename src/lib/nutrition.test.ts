import { describe, expect, it } from 'vitest';
import type { Food, FoodEntry } from '../data/foodTypes';
import {
  amountText,
  byMeal,
  defaultAmount,
  entryFor,
  foodFromEstimate,
  gramsFor,
  macroGoals,
  mealForTime,
  niceNumber,
  quickEntry,
  scale,
  servingGrams,
  splitGoals,
  totals,
  unitsFor,
  withAmount,
} from './nutrition';

const banana: Food = {
  key: 'basic:banana',
  name: 'Banana',
  source: 'basic',
  per100: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 },
  base: 'g',
  servings: [
    { label: '1 medium (118 g)', grams: 118 },
    { label: '1 large (136 g)', grams: 136 },
  ],
  defaultServing: 0,
};

describe('amounts and units', () => {
  it('scales per-100 g values to what she ate', () => {
    expect(scale(banana.per100, 118)).toMatchObject({ kcal: 105, protein: 1.3, carbs: 26.9, fat: 0.4 });
    expect(scale(banana.per100, 0).kcal).toBe(0);
    expect(scale(banana.per100, -5).kcal).toBe(0);
  });

  it('offers servings first, then grams', () => {
    expect(unitsFor(banana).map((u) => u.unit)).toEqual(['1 medium (118 g)', '1 large (136 g)', 'g']);
    expect(gramsFor(banana, 2, '1 medium (118 g)')).toBe(236);
    expect(gramsFor(banana, 150, 'g')).toBe(150);
  });

  it('starts from the last amount she used, if it still fits the food', () => {
    expect(defaultAmount(banana)).toEqual({ amount: 1, unit: '1 medium (118 g)' });
    expect(defaultAmount(banana, { last_amount: 2, last_unit: '1 large (136 g)' })).toEqual({ amount: 2, unit: '1 large (136 g)' });
    expect(defaultAmount(banana, { last_amount: 80, last_unit: 'g' })).toEqual({ amount: 80, unit: 'g' });
    // a serving that no longer exists falls back to the usual one
    expect(defaultAmount(banana, { last_amount: 3, last_unit: '1 bunch (500 g)' })).toEqual({ amount: 1, unit: '1 medium (118 g)' });
    expect(defaultAmount({ ...banana, servings: [], defaultServing: undefined })).toEqual({ amount: 100, unit: 'g' });
  });

  it('makes an entry with nutrition for the amount', () => {
    const e = entryFor(banana, 1.5, '1 medium (118 g)', 'breakfast', '2026-10-13');
    expect(e).toMatchObject({ name: 'Banana', meal: 'breakfast', log_date: '2026-10-13', amount: 1.5, grams: 177, kcal: 158, food_key: 'basic:banana', source: 'basic' });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('changing the amount keeps the id and re-works the numbers', () => {
    const e = { ...entryFor(banana, 1, '1 medium (118 g)', 'snacks', '2026-10-13'), created_at: '2026-10-13T08:00:00Z' };
    const next = withAmount(e, 200, 'g');
    expect(next).toMatchObject({ id: e.id, created_at: e.created_at, meal: 'snacks', amount: 200, unit: 'g', grams: 200, kcal: 178 });
  });

  it('scales quick adds and estimates (no food behind them) proportionally', () => {
    const q: FoodEntry = { ...quickEntry({ kcal: 300, protein: 20, carbs: 30, fat: 10 }, 'lunch', '2026-10-13'), amount: 1, grams: 250 };
    expect(withAmount(q, 2, q.unit)).toMatchObject({ kcal: 600, protein_g: 40, carbs_g: 60, fat_g: 20, grams: 500, amount: 2 });
  });
});

describe('totals', () => {
  it('adds up a day and groups it by meal', () => {
    const a = entryFor(banana, 1, '1 medium (118 g)', 'breakfast', '2026-10-13');
    const b = quickEntry({ name: 'Wrap', kcal: 520, protein: 32, carbs: 48, fat: 19 }, 'lunch', '2026-10-13');
    const c = quickEntry({ kcal: 90 }, 'snacks', '2026-10-13');
    expect(totals([a, b, c])).toEqual({ kcal: 715, protein: 33.3, carbs: 74.9, fat: 19.4, fiber: 3.1, sugar: 14.4 });
    const m = byMeal([a, b, c]);
    expect([m.breakfast.length, m.lunch.length, m.dinner.length, m.snacks.length]).toEqual([1, 1, 0, 1]);
  });

  it('guesses the meal from the time of day', () => {
    const at = (h: number, min = 0) => mealForTime(new Date(2026, 9, 13, h, min));
    expect(at(7)).toBe('breakfast');
    expect(at(10, 29)).toBe('breakfast');
    expect(at(10, 30)).toBe('lunch');
    expect(at(15, 30)).toBe('snacks');
    expect(at(19)).toBe('dinner');
    expect(at(23)).toBe('snacks');
    expect(at(2)).toBe('snacks');
  });
});

describe('macro goals', () => {
  it('uses her own grams when set, else a balanced split of the calorie target', () => {
    expect(macroGoals({ calorie_goal: 1800 })).toEqual({ protein: 135, carbs: 180, fat: 60, from: 'split' });
    expect(macroGoals({ calorie_goal: 1800, protein_goal_g: 150, carbs_goal_g: 150, fat_goal_g: 60 })).toEqual({ protein: 150, carbs: 150, fat: 60, from: 'set' });
    expect(macroGoals({ calorie_goal: null })).toBeNull();
  });

  it('splits add back up to the target', () => {
    const g = splitGoals(2000, [0.4, 0.35, 0.25]);
    expect(Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - 2000)).toBeLessThan(10);
  });
});

describe('labels', () => {
  it('describes amounts the way she would say them', () => {
    expect(amountText({ amount: 150, unit: 'g', grams: 150 })).toBe('150 g');
    expect(amountText({ amount: 1, unit: '1 medium (118 g)', grams: 118 })).toBe('1 medium (118 g)');
    expect(amountText({ amount: 2, unit: '1 medium (118 g)', grams: 236 })).toBe('2 × medium (236 g)');
    expect(amountText({ amount: 1.5, unit: '1 serving (170 g)', grams: 255 })).toBe('1½ × serving (255 g)');
    expect(amountText({ amount: 2, unit: '1 portion', grams: null })).toBe('2 × portion');
  });

  it('writes halves and quarters as fractions', () => {
    expect([niceNumber(0.5), niceNumber(1.25), niceNumber(2.75), niceNumber(3), niceNumber(1.3333)]).toEqual(['½', '1¼', '2¾', '3', '1.3']);
  });

  it('reads grams out of serving text', () => {
    expect(servingGrams('30 g')).toBe(30);
    expect(servingGrams('1 bar (45g)')).toBe(45);
    expect(servingGrams('2 biscuits (37,5 g)')).toBe(37.5);
    expect(servingGrams('1 can (33 cl)')).toBe(330);
    expect(servingGrams('1 slice')).toBeNull();
  });
});

describe('estimates and quick adds', () => {
  it('turns an estimated item into a food that logs the same numbers', () => {
    const f = foodFromEstimate({ name: 'Chicken Caesar salad', portion: '1 bowl', grams: 320, kcal: 480, protein: 38, carbs: 14, fat: 30, confidence: 0.7 });
    expect(f.key).toBe('est:chicken-caesar-salad');
    const e = entryFor(f, 1, f.servings[0].label, 'lunch', '2026-10-13', 'photo');
    expect(e.kcal).toBe(480);
    expect(e.protein_g).toBeCloseTo(38, 0);
    expect(e.source).toBe('photo');
    // no weight: one portion is the numbers given
    const p = foodFromEstimate({ name: 'Latte', portion: '1 medium', grams: 0, kcal: 150, protein: 8, carbs: 12, fat: 6, confidence: 0.8 });
    expect(entryFor(p, 1, p.servings[0].label, 'snacks', '2026-10-13').kcal).toBe(150);
  });

  it('only remembers quick adds that have a name', () => {
    expect(quickEntry({ kcal: 250 }, 'snacks', '2026-10-13')).toMatchObject({ name: 'Quick add', food: null, source: 'quick', kcal: 250 });
    const named = quickEntry({ name: ' Office cake ', kcal: 350.4 }, 'snacks', '2026-10-13');
    expect(named.name).toBe('Office cake');
    expect(named.kcal).toBe(350);
    expect(named.food?.key).toBe('quick:office-cake');
    expect(entryFor(named.food!, 1, named.food!.servings[0].label, 'snacks', '2026-10-14').kcal).toBe(350);
  });
});
