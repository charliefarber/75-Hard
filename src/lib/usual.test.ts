import { describe, expect, it } from 'vitest';
import type { FoodEntry, Meal } from '../data/foodTypes';
import { addDays } from './weeks';
import { copyEntries, goToFoods, sameAsYesterday, signatureOf, titleOf, yourUsual } from './usual';

const FRIDAY = '2026-10-23';
const d = (n: number) => addDays(FRIDAY, -n);
let n = 0;
const e = (date: string, meal: Meal, key: string | null, name: string, kcal: number, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: `e${++n}`, log_date: date, meal, name, food_key: key, amount: 1, unit: '1 portion', grams: null, kcal,
  protein_g: null, carbs_g: null, fat_g: null, source: 'custom', ...extra,
});
const wrap = (date: string) => e(date, 'lunch', 'custom:wrap', 'Chicken salad wrap', 435);
const apple = (date: string) => e(date, 'lunch', 'basic:apple', 'Apple', 95);

// Mon–Wed this week: wrap + apple (Tuesday logged in the other order); Thursday (yesterday): chilli.
// Last week: wrap + apple on Tuesday; Saturday: pizza twice (must not count on a weekday).
const history: FoodEntry[] = [
  wrap(d(4)), apple(d(4)),
  apple(d(3)), wrap(d(3)),
  wrap(d(2)), apple(d(2)),
  e(d(1), 'lunch', 'custom:chilli', 'Turkey chilli', 430),
  wrap(d(10)), apple(d(10)),
  e(d(6), 'lunch', 'off:pizza', 'Pizza', 800), e(d(6), 'lunch', 'off:pizza', 'Pizza', 800),
  e(d(1), 'snacks', 'basic:greek_0', 'Greek yoghurt 0%', 86),
  e(d(2), 'snacks', 'basic:greek_0', 'Greek yoghurt 0%', 86),
  e(d(2), 'snacks', 'basic:banana', 'Banana', 105),
  e(d(3), 'snacks', 'custom:bar', 'Protein bar', 198),
  e(d(5), 'snacks', 'basic:banana', 'Banana', 105),
  e(d(30), 'snacks', 'custom:crisps', 'Crisps', 130), // too long ago
  e(FRIDAY, 'snacks', 'custom:cake', 'Cake', 300), // today doesn't count
  // never suggested: a meal-prep portion and calories carried over from Lifesum
  e(d(1), 'dinner', 'prep:abc', 'Chicken teriyaki rice', 595, { source: 'meal' }),
  e(d(2), 'dinner', 'prep:abc', 'Chicken teriyaki rice', 595, { source: 'meal' }),
  e(d(3), 'dinner', 'prep:abc', 'Chicken teriyaki rice', 595, { source: 'meal' }),
  e(d(2), 'breakfast', null, 'Logged in Lifesum', 400, { source: 'quick' }),
  e(d(3), 'breakfast', null, 'Logged in Lifesum', 400, { source: 'quick' }),
  e(d(4), 'breakfast', null, 'Logged in Lifesum', 400, { source: 'quick' }),
];

describe('yourUsual', () => {
  it('finds the foods she most often has for this meal on similar days', () => {
    const u = yourUsual(history, { date: FRIDAY, meal: 'lunch' });
    expect(u?.title).toBe('Chicken salad wrap + Apple');
    expect(u?.kcal).toBe(530);
    expect(u?.why).toBe('You’ve had this on 4 of the last 5 weekdays.');
    expect(u?.entries).toHaveLength(2);
  });

  it('needs a few days before calling something usual', () => {
    expect(yourUsual(history, { date: FRIDAY, meal: 'lunch', minDays: 5 })).toBeNull();
    expect(yourUsual([], { date: FRIDAY, meal: 'lunch' })).toBeNull();
  });

  it('only compares weekends with weekends', () => {
    const u = yourUsual(history, { date: addDays(FRIDAY, 1), meal: 'lunch', minDays: 1 });
    expect(u?.title).toBe('Pizza ×2');
    expect(u?.entries).toHaveLength(2);
    expect(u?.kcal).toBe(1600);
  });

  it('never suggests meal-prep portions or carried-over Lifesum calories', () => {
    expect(yourUsual(history, { date: FRIDAY, meal: 'dinner', minDays: 1 })).toBeNull();
    expect(yourUsual(history, { date: FRIDAY, meal: 'breakfast', minDays: 1 })).toBeNull();
  });
});

describe('sameAsYesterday', () => {
  it('returns yesterday’s foods for the meal', () => {
    const y = sameAsYesterday(history, { date: FRIDAY, meal: 'lunch' });
    expect(y?.title).toBe('Turkey chilli');
    expect(y?.kcal).toBe(430);
    expect(sameAsYesterday(history, { date: FRIDAY, meal: 'breakfast' })).toBeNull();
  });
});

describe('goToFoods', () => {
  it('ranks single foods by days eaten, most recent first on ties', () => {
    expect(goToFoods(history, { date: FRIDAY, meal: 'snacks' }).map((x) => x.name)).toEqual(['Greek yoghurt 0%', 'Banana', 'Protein bar']);
  });
});

describe('helpers', () => {
  it('matches meals whatever order they were logged in', () => {
    expect(signatureOf([wrap(FRIDAY), apple(FRIDAY)])).toBe(signatureOf([apple(FRIDAY), wrap(FRIDAY)]));
    expect(titleOf([wrap(FRIDAY), wrap(FRIDAY), apple(FRIDAY)])).toBe('Chicken salad wrap ×2 + Apple');
  });

  it('copies entries into today with new ids and the same amounts', () => {
    const src = [wrap(d(2)), apple(d(2))];
    const copies = copyEntries(src, FRIDAY, 'dinner');
    expect(copies.map((c) => c.log_date)).toEqual([FRIDAY, FRIDAY]);
    expect(copies.map((c) => c.meal)).toEqual(['dinner', 'dinner']);
    expect(copies[0].id).not.toBe(src[0].id);
    expect(copies[0].kcal).toBe(435);
  });
});
