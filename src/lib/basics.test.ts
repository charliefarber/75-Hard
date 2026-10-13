import { describe, expect, it } from 'vitest';
import { BASICS, basicByKey, foodEmoji, searchBasics } from './basics';

const ALCOHOL: Record<string, number> = {
  // grams of alcohol per 100 ml (ABV × 0.789)
  'basic:beer': 3.2,
  'basic:red_wine': 10.6,
  'basic:white_wine': 9.9,
  'basic:prosecco': 8.7,
};

describe('everyday foods', () => {
  it('has unique keys and sensible servings', () => {
    const keys = new Set<string>();
    for (const f of BASICS) {
      expect(keys.has(f.key), f.key).toBe(false);
      keys.add(f.key);
      expect(f.per100.kcal, f.key).toBeGreaterThanOrEqual(0);
      expect(f.per100.kcal, f.key).toBeLessThanOrEqual(900);
      for (const s of f.servings) {
        expect(s.grams, `${f.key} ${s.label}`).toBeGreaterThan(0);
        expect(s.label.length, `${f.key} ${s.label}`).toBeLessThanOrEqual(40);
      }
      expect(basicByKey(f.key)).toBe(f);
    }
    expect(BASICS.length).toBeGreaterThan(100);
  });

  it('calories agree with the macros (4 / 4 / 9, 7 for alcohol, 2 for fibre)', () => {
    const off: string[] = [];
    for (const f of BASICS) {
      const { kcal, protein, carbs, fat, fiber } = f.per100;
      const expected = 4 * (protein ?? 0) + 4 * (carbs ?? 0) + 9 * (fat ?? 0) + 7 * (ALCOHOL[f.key] ?? 0);
      // Labels differ on fibre (counted at 2 kcal/g in the UK, inside carbs in the US), so allow for it.
      const slack = Math.max(15, kcal * 0.12) + 2 * (fiber ?? 0);
      if (Math.abs(kcal - expected) > slack) off.push(`${f.key}: ${kcal} vs ${Math.round(expected)}`);
    }
    expect(off).toEqual([]);
  });

  it('finds foods by everyday words', () => {
    expect(searchBasics('banana')[0]?.key).toBe('basic:banana');
    expect(searchBasics('greek yoghurt').map((f) => f.key)).toContain('basic:greek_0');
    expect(searchBasics('porridge').map((f) => f.key)).toContain('basic:oats');
    expect(searchBasics('eggs').map((f) => f.key)).toContain('basic:egg');
    expect(searchBasics('')).toEqual([]);
    expect(searchBasics('zzzz')).toEqual([]);
  });

  it('has a picture for every food', () => {
    for (const f of BASICS) expect(foodEmoji(f.key), f.key).not.toBe('🍽️');
    expect(foodEmoji(null)).toBe('🍽️');
  });
});
