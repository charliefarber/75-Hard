import { describe, expect, it } from 'vitest';
import type { Food, MealPrep, MyFood, SavedMeal } from '../data/foodTypes';
import { describeUnderstood, ownEntries, understand, type Library } from './understand';
import { amountAfter, amountBefore, leftover, nearly, tokenize } from './words';

const item = (name: string, kcal: number, protein = 10) => ({
  name,
  amount: 1,
  unit: '1 portion',
  kcal,
  protein_g: protein,
  carbs_g: 20,
  fat_g: 5,
  source: 'custom' as const,
  food_key: null,
});
const prep = (name: string, extra: Partial<MealPrep> = {}): MealPrep => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  items: [item('Mince', 1600, 120), item('Pasta', 1200, 40)],
  portions: 4,
  portions_left: 4,
  made_on: '2026-11-18',
  ...extra,
});
const meal = (name: string): SavedMeal => ({ id: name, name, items: [item('Oats', 300), item('Berries', 50, 1)], uses: 3, last_used: null });
const food = (name: string, servings: Food['servings'] = [{ label: '1 pot (150 g)', grams: 150 }]): MyFood => ({
  id: name,
  key: `custom:${name}`,
  food: { key: `custom:${name}`, name, source: 'custom', per100: { kcal: 80, protein: 10, carbs: 5, fat: 2 }, base: 'g', servings, defaultServing: 0 },
  favorite: false,
  custom: true,
  uses: 1,
  last_amount: null,
  last_unit: null,
  last_meal: null,
  last_used: null,
});

const lib: Library = {
  preps: [prep('Beef lasagne', { cooked_grams: 2000 }), prep('Turkey chilli'), prep('Chicken curry'), prep('Finished soup', { portions_left: 0 })],
  meals: [meal('Overnight oats with berries'), meal('Usual')],
  foods: [food('Protein yoghurt'), food('Granola', [])],
};
const what = (text: string) => {
  const u = understand(text, lib);
  return {
    own: u.own.map((m) => (m.kind === 'prep' ? `prep:${m.prep.name}:${m.grams ?? '-'}g:${m.portions ?? '-'}` : m.kind === 'meal' ? `meal:${m.meal.name}:${m.portions ?? '-'}` : `food:${m.food.food.name}:${m.grams ?? '-'}g:${m.portions ?? '-'}`)),
    orders: u.orders.map((o) => o.name),
    rest: u.rest,
  };
};

describe('words', () => {
  it('reads amounts before and after a food', () => {
    const t = tokenize('150g of the lasagne');
    expect(amountBefore(t, 4, new Set())).toMatchObject({ grams: 150 });
    expect(amountBefore(tokenize('half a portion of chilli'), 4, new Set())).toMatchObject({ portions: 0.5 });
    expect(amountBefore(tokenize('2 bowls of chilli'), 3, new Set())).toMatchObject({ portions: 2 });
    expect(amountBefore(tokenize('two chilli'), 1, new Set())).toMatchObject({ portions: 2 });
    expect(amountAfter(tokenize('lasagne 180 g'), 0, new Set())).toMatchObject({ grams: 180 });
    expect(amountAfter(tokenize('oats x2'), 0, new Set())).toMatchObject({ portions: 2 });
    expect(amountAfter(tokenize('lasagne, 1½ portions'), 0, new Set())).toMatchObject({ portions: 1.5 });
  });

  it('forgives one typo in longer words', () => {
    expect(nearly('chiken', 'chicken')).toBe(true);
    expect(nearly('guacomole', 'guacamole')).toBe(true);
    expect(nearly('salad', 'salsa')).toBe(false);
    expect(nearly('rice', 'mice')).toBe(false); // too short to guess
  });

  it('keeps what is left, without the joining words', () => {
    const t = tokenize('my lasagne and a side salad');
    expect(leftover('my lasagne and a side salad', t, new Set([0, 1]))).toBe('a side salad');
    expect(leftover('lasagne and', tokenize('lasagne and'), new Set([0]))).toBe('');
  });
});

describe('understanding what she typed', () => {
  it('finds her meal prep, with grams or portions', () => {
    expect(what('150g of the beef lasagne')).toEqual({ own: ['prep:Beef lasagne:150g:-'], orders: [], rest: '' });
    expect(what('lasagne 200g')).toEqual({ own: ['prep:Beef lasagne:200g:-'], orders: [], rest: '' });
    expect(what('half a portion of turkey chilli and a jacket potato')).toEqual({ own: ['prep:Turkey chilli:-g:0.5'], orders: [], rest: 'a jacket potato' });
    expect(what('chilli')).toEqual({ own: ['prep:Turkey chilli:-g:-'], orders: [], rest: '' });
  });

  it('does not grab a batch from a general word, or a different dish', () => {
    expect(what('grilled chicken salad').own).toEqual([]); // not her "Chicken curry"
    expect(what('200g chicken').own).toEqual([]);
    expect(what('thai green curry from the takeaway').own).toEqual([]);
    expect(what('finished soup').own).toEqual([]); // nothing left in that batch
  });

  it('finds saved meals and her own foods', () => {
    expect(what('my overnight oats with berries')).toEqual({ own: ['meal:Overnight oats with berries:-'], orders: [], rest: '' });
    expect(what('my usual and a coffee')).toEqual({ own: ['meal:Usual:-'], orders: [], rest: 'a coffee' });
    expect(what('2 protein yoghurts')).toEqual({ own: ['food:Protein yoghurt:-g:2'], orders: [], rest: '' });
    expect(what('40g granola with milk')).toEqual({ own: ['food:Granola:40g:-'], orders: [], rest: 'milk' });
    // her food's brand either side is part of it
    const branded: Library = { ...lib, foods: [{ ...food('Protein yoghurt'), food: { ...food('Protein yoghurt').food, brand: 'Arla' } }] };
    expect(understand('arla protein yoghurt', branded).rest).toBe('');
    expect(understand('protein yoghurt (arla) and a banana', branded).rest).toBe('a banana');
  });

  it('mixes her food, a restaurant order and the rest', () => {
    expect(what('steak chipotle bowl, a protein yoghurt and a diet coke')).toEqual({
      own: ['food:Protein yoghurt:-g:1'],
      orders: ['Steak bowl'],
      rest: 'a diet coke',
    });
  });

  it('remembers her last order', () => {
    const withLast: Library = {
      ...lib,
      foods: [
        ...lib.foods,
        {
          ...food('x'),
          key: 'chain:chipotle:chicken-burrito',
          custom: false,
          food: { ...food('x').food, key: 'chain:chipotle:chicken-burrito', name: 'Chicken burrito', servings: [{ label: '1 burrito', grams: 100 }], parts: [{ id: 'tortilla', qty: 1 }, { id: 'chicken', qty: 1 }, { id: 'pinto-beans', qty: 1 }] },
        },
      ],
    };
    const o = understand('chipotle chicken burrito', withLast).orders[0];
    expect(o.parts.filter((p) => p.on).map((p) => p.item.id)).toEqual(['tortilla', 'pinto-beans', 'chicken']);
  });

  it('says what it recognised', () => {
    expect(describeUnderstood(understand('150g lasagne and a chipotle steak bowl', lib))).toBe('Your Beef lasagne batch and Chipotle’s steak bowl');
    expect(describeUnderstood(understand('beans on toast', lib))).toBeNull();
  });
});

describe('her own things as diary entries', () => {
  it('logs grams of a weighed batch, portions otherwise (and says why)', () => {
    const u = understand('150g lasagne', lib);
    const { entries } = ownEntries(u.own[0], 'dinner', '2026-11-20');
    expect(entries[0]).toMatchObject({ amount: 150, unit: 'g', food_key: 'prep:beef-lasagne', meal: 'dinner', log_date: '2026-11-20' });
    expect(entries[0].kcal).toBe(Math.round(2800 * (150 / 2000)));
    const c = ownEntries(understand('200g turkey chilli', lib).own[0], 'dinner', '2026-11-20');
    expect(c.entries[0]).toMatchObject({ amount: 1, unit: '1 portion', kcal: 700 });
    expect(c.note).toMatch(/isn’t weighed/);
  });

  it('copies a saved meal, scaled', () => {
    const { entries } = ownEntries({ kind: 'meal', meal: meal('Oats'), portions: 2 }, 'breakfast', '2026-11-20');
    expect(entries.map((e) => [e.name, e.kcal, e.meal])).toEqual([
      ['Oats', 600, 'breakfast'],
      ['Berries', 100, 'breakfast'],
    ]);
    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
  });

  it('uses her food’s serving, or grams', () => {
    const y = ownEntries({ kind: 'food', food: food('Protein yoghurt'), grams: null, portions: 2 }, 'snacks', '2026-11-20').entries[0];
    expect(y).toMatchObject({ amount: 2, unit: '1 pot (150 g)', kcal: 240 });
    const g = ownEntries({ kind: 'food', food: food('Granola', []), grams: 40, portions: null }, 'snacks', '2026-11-20').entries[0];
    expect(g).toMatchObject({ amount: 40, unit: 'g', kcal: 32 });
  });
});
