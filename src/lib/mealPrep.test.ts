import { describe, expect, it } from 'vitest';
import type { MealPrep } from '../data/foodTypes';
import {
  asIngredients,
  batchNutrition,
  canLog,
  formatPortions,
  gramsEntry,
  gramsLeft,
  gramsNutrition,
  gramsPerPortion,
  parseCookedGrams,
  per100Nutrition,
  portionsIn,
  leftLabel,
  newMealPrep,
  portionEntry,
  portionLabel,
  portionNutrition,
  prepIdOf,
  withPortionsLeft,
} from './mealPrep';
import { amountText, withAmount } from './nutrition';

const item = (name: string, kcal: number, p: number, c: number, f: number): MealPrep['items'][number] => ({
  name, food_key: null, amount: 1, unit: '1 portion', grams: null, kcal, protein_g: p, carbs_g: c, fat_g: f, source: 'quick',
});
const teriyaki = [
  item('Chicken breast, raw', 1284, 276, 0, 18),
  item('Basmati rice, dry', 1575, 36, 351, 2),
  item('Broccoli', 204, 17, 17, 2),
  item('Olive oil', 371, 0, 0, 42),
  item('Teriyaki sauce', 135, 9, 27, 0),
];
const prep: MealPrep = { id: 'p1', name: 'Chicken teriyaki rice', items: teriyaki, portions: 6, portions_left: 6, made_on: '2026-10-18' };

describe('batch maths', () => {
  it('adds up everything that went in', () => {
    expect(batchNutrition(teriyaki)).toEqual({ kcal: 3569, protein: 338, carbs: 395, fat: 64 });
  });

  it('splits it into equal portions', () => {
    expect(portionNutrition(prep)).toEqual({ kcal: 595, protein: 56.3, carbs: 65.8, fat: 10.7 });
    expect(() => portionNutrition({ ...prep, portions: 0 })).toThrow();
  });
});

describe('labels', () => {
  it('writes halves', () => {
    expect(formatPortions(0.5)).toBe('½');
    expect(formatPortions(3.5)).toBe('3½');
    expect(formatPortions(4)).toBe('4');
    expect(portionLabel(0.5)).toBe('½ portion');
    expect(portionLabel(1)).toBe('1 portion');
    expect(portionLabel(1.5)).toBe('1½ portions');
  });

  it('says how many are left', () => {
    expect(leftLabel(prep)).toBe('6 of 6 left');
    expect(leftLabel({ ...prep, portions_left: 3.5 })).toBe('3½ of 6 left');
    expect(leftLabel({ ...prep, portions_left: 0 })).toBe('All eaten');
  });
});

describe('logging portions', () => {
  it('makes a diary entry that points back at the batch', () => {
    const half = portionEntry(prep, 0.5, 'dinner', '2026-10-23');
    expect(half.kcal).toBe(298); // the diary rounds calories to whole numbers
    expect(half.protein_g).toBe(28.2);
    expect(half.source).toBe('meal');
    expect(half.grams).toBeNull();
    expect(prepIdOf(half)).toBe('p1');
    expect(amountText(half)).toBe('½ × portion');
    expect(amountText(portionEntry(prep, 1, 'dinner', '2026-10-23'))).toBe('1 portion');
  });

  it('can be changed afterwards like any other food', () => {
    const one = portionEntry(prep, 1, 'dinner', '2026-10-23');
    const more = withAmount(one, 1.5, one.unit);
    expect(more.kcal).toBe(893);
    expect(more.id).toBe(one.id);
  });

  it('counts down in halves and never below zero or above the batch', () => {
    expect(withPortionsLeft(prep, 1).portions_left).toBe(5);
    expect(withPortionsLeft(prep, 0.5).portions_left).toBe(5.5);
    expect(withPortionsLeft({ ...prep, portions_left: 0.5 }, 1).portions_left).toBe(0);
    expect(withPortionsLeft(prep, -2).portions_left).toBe(6);
    expect(canLog({ portions_left: 0.5 }, 1)).toBe(false);
    expect(canLog({ portions_left: 0.5 }, 0.5)).toBe(true);
  });

  it('ignores ordinary foods', () => {
    expect(prepIdOf({ food_key: 'basic:banana' })).toBeNull();
    expect(prepIdOf({ food_key: null })).toBeNull();
  });
});

describe('a new batch', () => {
  it('checks its inputs', () => {
    const p = newMealPrep({ name: '  Chicken teriyaki rice ', items: teriyaki, portions: 6, madeOn: '2026-10-18' });
    expect(p.name).toBe('Chicken teriyaki rice');
    expect(p.portions_left).toBe(6);
    expect(() => newMealPrep({ name: ' ', items: teriyaki, portions: 6, madeOn: '2026-10-18' })).toThrow('name');
    expect(() => newMealPrep({ name: 'A', items: [], portions: 6, madeOn: '2026-10-18' })).toThrow('ingredient');
    expect(() => newMealPrep({ name: 'A', items: teriyaki, portions: 2.5, madeOn: '2026-10-18' })).toThrow('portions');
    expect(() => newMealPrep({ name: 'A', items: teriyaki, portions: 31, madeOn: '2026-10-18' })).toThrow('portions');
  });

  it('turns logged foods into ingredients', () => {
    const entry = { ...teriyaki[0], id: 'x', log_date: '2026-10-18', meal: 'dinner' as const, created_at: 'now' };
    const [ing] = asIngredients([entry]);
    expect(ing).toEqual(teriyaki[0]);
  });
});

describe('logging by weight', () => {
  // The teriyaki batch weighed 2,400 g cooked: 400 g a portion, 3569 kcal over 2400 g.
  const weighed: MealPrep = { ...prep, cooked_grams: 2400 };

  it('works out grams per portion and per 100 g', () => {
    expect(gramsPerPortion(weighed)).toBe(400);
    expect(gramsPerPortion(prep)).toBeNull();
    expect(per100Nutrition(weighed)).toEqual({ kcal: 148.7, protein: 14.1, carbs: 16.5, fat: 2.7 });
  });

  it('logs 100 g of the whole dish with its share of everything', () => {
    const e = gramsEntry(weighed, 100, 'lunch', '2026-11-20');
    expect(e.unit).toBe('g');
    expect(e.grams).toBe(100);
    expect(e.kcal).toBe(149);
    expect(e.protein_g).toBe(14.1);
    expect(prepIdOf(e)).toBe('p1');
    expect(amountText(e)).toBe('100 g');
    expect(portionsIn(e)).toBeCloseTo(0.25);
    expect(gramsNutrition(weighed, 100)?.kcal).toBe(149);
    expect(() => gramsEntry(prep, 100, 'lunch', '2026-11-20')).toThrow('Weigh');
  });

  it('logs a portion of a weighed batch with its grams, and can switch to grams later', () => {
    const one = portionEntry(weighed, 1, 'dinner', '2026-11-20');
    expect(one.grams).toBe(400);
    expect(one.kcal).toBe(595);
    expect(portionsIn(one)).toBe(1);
    const asGrams = withAmount(one, 200, 'g');
    expect(asGrams.kcal).toBe(297);
    expect(portionsIn(asGrams)).toBeCloseTo(0.5);
  });

  it('counts grams down as a share of a portion, and says what is left in grams', () => {
    const after = withPortionsLeft(weighed, 0.25);
    expect(after.portions_left).toBe(5.75);
    expect(gramsLeft(after)).toBe(2300);
    expect(leftLabel(after)).toBe('2,300 g of 2,400 g left');
    expect(leftLabel({ ...prep, portions_left: 5.67 })).toBe('≈5½ of 6 left');
    expect(withPortionsLeft({ ...weighed, portions_left: 0.004 }, 0).portions_left).toBe(0);
    // 100 g out of a 1,200 g batch in 4 leaves 1,100 g, not 1,101 g
    const bake: MealPrep = { ...prep, portions: 4, portions_left: 4, cooked_grams: 1200 };
    const ate = gramsEntry(bake, 100, 'lunch', '2026-11-20');
    const left = withPortionsLeft(bake, portionsIn(ate));
    expect(gramsLeft(left)).toBe(1100);
    expect(leftLabel(left, { short: true })).toBe('1,100 g left');
  });

  it('checks the cooked weight', () => {
    expect(parseCookedGrams('')).toBeNull();
    expect(parseCookedGrams(' 1200,4 ')).toBe(1200);
    expect(() => parseCookedGrams('0')).toThrow('weight');
    expect(() => parseCookedGrams('abc')).toThrow('weight');
    const p = newMealPrep({ name: 'A', items: teriyaki, portions: 4, madeOn: '2026-11-20', cookedGrams: 1200 });
    expect(p.cooked_grams).toBe(1200);
    expect(newMealPrep({ name: 'A', items: teriyaki, portions: 4, madeOn: '2026-11-20' })).not.toHaveProperty('cooked_grams');
  });
});
