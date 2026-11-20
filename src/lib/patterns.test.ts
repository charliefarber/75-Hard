import { describe, expect, it } from 'vitest';
import type { FoodEntry, Meal } from '../data/foodTypes';
import { foodPatterns, mealToLog, wholePercents } from './patterns';

let n = 0;
const e = (date: string, meal: Meal, name: string, kcal: number, protein: number, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: `e${n++}`,
  log_date: date,
  meal,
  name,
  amount: 1,
  unit: 'portion',
  kcal,
  protein_g: protein,
  carbs_g: 10,
  fat_g: 5,
  source: 'describe',
  ...extra,
});

/** Four fully logged days and one half-logged day (oats only). */
function diary(): Record<string, FoodEntry[]> {
  return {
    '2026-11-02': [e('2026-11-02', 'breakfast', 'Flat white', 120, 7), e('2026-11-02', 'breakfast', 'Overnight oats', 330, 14), e('2026-11-02', 'lunch', 'Chicken salad', 380, 35), e('2026-11-02', 'dinner', 'Salmon, rice and greens', 610, 40)],
    '2026-11-03': [e('2026-11-03', 'breakfast', 'flat white ', 120, 7), e('2026-11-03', 'lunch', 'Chicken salad', 380, 35), e('2026-11-03', 'dinner', 'Beef lasagne', 560, 38), e('2026-11-03', 'snacks', 'Flat white', 120, 7)],
    '2026-11-04': [e('2026-11-04', 'breakfast', 'Flat white', 120, 7), e('2026-11-04', 'lunch', 'Steak bowl', 650, 47), e('2026-11-04', 'dinner', 'Chicken stir fry', 520, 38)],
    '2026-11-05': [e('2026-11-05', 'breakfast', 'Overnight oats', 330, 14), e('2026-11-05', 'lunch', 'Tomato soup', 330, 10), e('2026-11-05', 'dinner', 'Pizza', 560, 24), e('2026-11-05', 'snacks', 'Apple', 80, 0)],
    '2026-11-06': [e('2026-11-06', 'breakfast', 'Overnight oats', 330, 14)],
  };
}
const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];

describe('food patterns', () => {
  it('splits the day by meal from fully logged days only', () => {
    const food = diary();
    const p = foodPatterns(dates, (d) => food[d], 1400);
    expect(p).toMatchObject({ days: 6, logged: 5, full: 4 });
    // breakfast (120+330 + 120 + 120 + 330) / 4 = 255; lunch 435; dinner 562.5; snacks (120+80)/4 = 50
    expect(p.meals.map((m) => [m.meal, m.kcal, m.protein, m.days])).toEqual([
      ['breakfast', 255, 12, 4],
      ['lunch', 435, 32, 4],
      ['dinner', 563, 35, 4],
      ['snacks', 50, 2, 2],
    ]);
    expect(p.meals.reduce((a, m) => a + m.pct, 0)).toBe(100);
    expect(p.biggest?.meal).toBe('dinner');
    expect(p.biggest?.pct).toBe(43);
    // breakfast averages 12 g of protein: the leanest main meal, under 15 g
    expect(p.lowProtein?.meal).toBe('breakfast');
  });

  it('needs three fully logged days before splitting the day', () => {
    const food = diary();
    delete food['2026-11-04'];
    delete food['2026-11-05'];
    const p = foodPatterns(dates, (d) => food[d], 1400);
    expect(p.full).toBe(2);
    expect(p.meals).toEqual([]);
    expect(p.biggest).toBeNull();
    expect(p.lowProtein).toBeNull();
  });

  it('most logged: once a day, names matched loosely, with its usual meal and latest amount', () => {
    const food = diary();
    const p = foodPatterns(dates, (d) => food[d], 1400);
    // ties: the one logged most recently first
    expect(p.often.map((f) => [f.name, f.days, f.meal])).toEqual([
      ['Overnight oats', 3, 'breakfast'],
      ['Flat white', 3, 'breakfast'],
      ['Chicken salad', 2, 'lunch'],
    ]);
    expect(p.often[0].entry.log_date).toBe('2026-11-06');
    const fw = p.often[1];
    expect(fw.meals).toEqual(['breakfast', 'snacks']);
    expect(fw.entry.log_date).toBe('2026-11-04');
  });

  it('leaves out meal-prep portions and carried-over totals', () => {
    const food: Record<string, FoodEntry[]> = {};
    for (const d of dates.slice(0, 3))
      food[d] = [e(d, 'dinner', 'Chilli, 1 portion', 500, 30, { food_key: 'prep:abc' }), e(d, 'lunch', 'Logged in Lifesum', 900, 0, { food_key: null })];
    const p = foodPatterns(dates, (d) => food[d], 1400);
    expect(p.often).toEqual([]);
  });

  it('logs a favourite at the meal it is time for, if she has had it then before', () => {
    expect(mealToLog({ meal: 'breakfast', meals: ['breakfast', 'snacks'] }, 'snacks')).toBe('snacks');
    expect(mealToLog({ meal: 'breakfast', meals: ['breakfast', 'snacks'] }, 'dinner')).toBe('breakfast');
  });

  it('whole percentages always add up to 100', () => {
    expect(wholePercents([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33]);
    expect(wholePercents([0.125, 0.375, 0.5])).toEqual([13, 37, 50]);
  });
});
