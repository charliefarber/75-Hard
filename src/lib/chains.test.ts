import { describe, expect, it } from 'vitest';
import { chipotleOrder, orderEntry, orderFood, orderNutrition, partLabel, rememberedParts, type ChainOrder } from './chains';
import { leftover, tokenize } from './words';

function read(text: string, remembered?: Parameters<typeof chipotleOrder>[2]) {
  const tokens = tokenize(text);
  const r = chipotleOrder(tokens, new Set(), remembered);
  return r ? { ...r.order, rest: leftover(text, tokens, r.used) } : null;
}
const on = (o: ChainOrder) => o.parts.filter((p) => p.on).map((p) => `${p.item.id}${p.qty !== o.share && p.item.id !== 'taco-tortilla' ? `×${p.qty}` : ''}`);
const extras = (o: ChainOrder) => o.parts.filter((p) => !p.on).map((p) => p.item.id);
const kcal = (o: ChainOrder) => orderNutrition(o.parts).kcal;

describe('Chipotle orders', () => {
  it('a steak bowl is the usual build with steak, from the published numbers', () => {
    const o = read('steak chipotle bowl')!;
    expect(o.name).toBe('Steak bowl');
    expect(o.unit).toBe('1 bowl');
    expect(o.key).toBe('chain:chipotle:steak-bowl');
    expect(on(o)).toEqual(['white-rice', 'black-beans', 'steak', 'fresh-salsa', 'cheese']);
    expect(extras(o)).toEqual(['sour-cream', 'guac', 'fajita-veg', 'corn-salsa']);
    expect(kcal(o)).toBe(185 + 95 + 165 + 15 + 94);
    expect(o.rest).toBe('');
    expect(o.notes).toEqual([]);
  });

  it('follows what she says: kinds, extras, no, double, light', () => {
    const o = read('Chipotle burrito, double chicken, brown rice, pinto beans, corn salsa, extra cheese, sour cream, no fresh salsa, light guac')!;
    expect(o.name).toBe('Chicken burrito');
    expect(on(o)).toEqual(['tortilla', 'brown-rice', 'pinto-beans', 'chicken×2', 'corn-salsa', 'cheese×1.5', 'sour-cream', 'guac×0.5']);
    expect(extras(o)).toEqual(['fajita-veg']);
    expect(o.rest).toBe('');
  });

  it('no / without carry over a list, and "with" ends it', () => {
    const o = read('chipotle chicken bowl no rice or cheese with guac')!;
    expect(on(o)).toEqual(['black-beans', 'chicken', 'fresh-salsa', 'guac']);
    expect(extras(o)).toEqual(['sour-cream', 'fajita-veg', 'corn-salsa']);
  });

  it('leaves the rest for the estimate', () => {
    expect(read('steak chipotle bowl and a diet coke')!.rest).toBe('a diet coke');
    expect(read('a flat white and a chipotle chicken burrito')!.rest).toBe('a flat white');
    // a menu word stuck to another food goes with it
    const o = read('chipotle bowl with steak and a cheese toastie')!;
    expect(on(o)).toContain('cheese'); // the usual build still has cheese
    expect(o.rest).toBe('a cheese toastie');
    expect(read('grilled chicken and a chipotle bowl')!.rest).toBe('grilled chicken');
  });

  it('two fillings are half and half; no filling is chicken', () => {
    const o = read('chipotle chicken and steak burrito bowl')!;
    expect(o.name).toBe('Chicken & steak bowl');
    expect(on(o)).toEqual(['white-rice', 'black-beans', 'chicken×0.5', 'steak×0.5', 'fresh-salsa', 'cheese']);
    expect(o.notes[0]).toMatch(/half of each/);
    const c = read('chipotle burrito')!;
    expect(c.name).toBe('Chicken burrito');
    expect(c.notes[0]).toMatch(/chicken/);
  });

  it('tacos come in threes unless she says', () => {
    const o = read('3 carnitas tacos from chipotle')!;
    expect(o.name).toBe('Carnitas tacos');
    expect(o.unit).toBe('3 tacos');
    expect(on(o)).toEqual(['taco-tortilla', 'carnitas', 'fresh-salsa', 'cheese']);
    expect(kcal(o)).toBe(3 * 94 + 210 + 15 + 94);
    const two = read('two chipotle steak tacos')!;
    expect(two.unit).toBe('2 tacos');
    expect(kcal(two)).toBe(Math.round(2 * 94 + (2 / 3) * (165 + 15 + 94)));
  });

  it('half a burrito, two bowls', () => {
    expect(read('half a chipotle steak burrito')!.count).toBe(0.5);
    expect(read('2 chipotle chicken bowls')!.count).toBe(2);
  });

  it('veggie, salad, chips', () => {
    const v = read('veggie bowl from chipotle')!;
    expect(v.name).toBe('Veggie bowl');
    expect(on(v)).toEqual(['white-rice', 'black-beans', 'fajita-veg', 'fresh-salsa', 'cheese', 'guac']);
    const s = read('chipotle barbacoa salad')!;
    expect(on(s)).toEqual(['romaine', 'black-beans', 'barbacoa', 'fresh-salsa', 'cheese']);
    expect(extras(s)).toContain('vinaigrette');
    const c = read('chipotle chips and guac')!;
    expect(c.name).toBe('Chips & guac');
    expect(on(c)).toEqual(['chips', 'side-guac']);
    expect(kcal(c)).toBe(417 + 145);
    const b = read('chipotle steak burrito with chips and guac')!;
    expect(b.name).toBe('Steak burrito + chips & guac');
    expect(on(b)).toEqual(['tortilla', 'white-rice', 'black-beans', 'steak', 'fresh-salsa', 'cheese', 'chips', 'side-guac']);
  });

  it('"just" means only what she listed', () => {
    const o = read('chipotle bowl just chicken rice and beans')!;
    expect(on(o)).toEqual(['white-rice', 'black-beans', 'chicken']);
    expect(extras(o)).toEqual([]);
  });

  it('forgives a typo and plurals', () => {
    expect(on(read('chipotle burito with chiken and guacomole')!)).toContain('guac');
    expect(read('chipotle burito with chiken')!.name).toBe('Chicken burrito');
  });

  it('chipotle the flavour, or somewhere else, is not the restaurant', () => {
    expect(read('chicken wrap with chipotle mayo')).toBeNull();
    expect(read('tesco chipotle chicken bowl')).toBeNull();
    expect(read('M&S chipotle chicken salad')).toBeNull();
    expect(read('chipotle chicken and rice')).toBeNull();
    expect(read('chicken with chipotle and chips')).toBeNull();
    expect(read('homemade chipotle chicken burrito')).toBeNull();
    expect(read('pasta')).toBeNull();
  });

  it('just "chipotle" is a chicken bowl', () => {
    const o = read('had chipotle for lunch')!;
    expect(o.name).toBe('Chicken bowl');
    expect(o.notes[0]).toMatch(/No order given/);
  });

  it('starts from last time when she had the same thing', () => {
    const last = { parts: [{ id: 'brown-rice', qty: 1 }, { id: 'steak', qty: 2 }, { id: 'guac', qty: 1 }], servings: [{ label: '1 bowl', grams: 100 }] };
    const o = read('chipotle steak bowl', (key, unit) => (key === 'chain:chipotle:steak-bowl' ? rememberedParts(last, unit) : null))!;
    expect(on(o)).toEqual(['brown-rice', 'steak×2', 'guac']);
    expect(extras(o)).toEqual(['cheese', 'sour-cream', 'fajita-veg', 'corn-salsa']);
    expect(o.notes).toContain('Same as your last steak bowl.');
    // a different size doesn't count
    expect(rememberedParts(last, '1 burrito')).toBeNull();
  });

  it('becomes one diary entry that remembers its parts', () => {
    const o = read('chipotle steak bowl with guac')!;
    const f = orderFood(o);
    expect(f).toMatchObject({ key: 'chain:chipotle:steak-bowl', name: 'Steak bowl', brand: 'Chipotle', servings: [{ label: '1 bowl', grams: 100 }] });
    expect(f.parts!.map((p) => p.id)).toEqual(['white-rice', 'black-beans', 'steak', 'fresh-salsa', 'cheese', 'guac']);
    const e = orderEntry(o, 'lunch', '2026-11-20');
    expect(e).toMatchObject({ name: 'Steak bowl', brand: 'Chipotle', amount: 1, unit: '1 bowl', grams: null, source: 'describe' });
    expect(e.kcal).toBe(185 + 95 + 165 + 15 + 94 + 145);
    expect(e.protein_g).toBeCloseTo(4.1 + 7.2 + 28.8 + 0.8 + 5.8 + 1.5, 1);
    const half = orderEntry({ ...o, count: 0.5 }, 'lunch', '2026-11-20');
    expect(half.kcal).toBe(Math.round(e.kcal / 2));
  });

  it('labels parts that are not a standard serving', () => {
    const o = read('chipotle burrito double steak light rice')!;
    const label = (id: string) => partLabel(o.parts.find((p) => p.item.id === id)!, o);
    expect(label('steak')).toBe('double');
    expect(label('white-rice')).toBe('half');
    expect(label('black-beans')).toBe('');
  });
});
