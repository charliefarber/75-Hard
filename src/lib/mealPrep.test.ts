import { describe, expect, it } from 'vitest';
import type { MealPrep } from '../data/foodTypes';
import {
  asIngredients,
  batchNutrition,
  canLog,
  formatPortions,
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
