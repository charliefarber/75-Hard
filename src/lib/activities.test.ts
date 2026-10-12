import { describe, expect, it } from 'vitest';
import { ACTIVITIES, activeKcal, activityById, estimateKcal, restingKcalPerDay, searchActivities } from './activities';

const sierra = { weightKg: 62, heightCm: 168, ageYears: 30, sex: 'female' as const };

describe('activity library', () => {
  it('has a big, unique list with sensible light < normal < hard METs', () => {
    expect(ACTIVITIES.length).toBeGreaterThan(90);
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
    for (const a of ACTIVITIES) {
      expect(a.met[0]).toBeLessThanOrEqual(a.met[1]);
      expect(a.met[1]).toBeLessThanOrEqual(a.met[2]);
      expect(a.met[0]).toBeGreaterThanOrEqual(1.5);
      expect(a.met[2]).toBeLessThanOrEqual(14);
    }
  });

  it('finds things by name or keyword', () => {
    expect(searchActivities('reformer').map((a) => a.id)).toContain('pilates_reformer');
    expect(searchActivities('stairmaster').map((a) => a.id)).toContain('stair_stepper');
    expect(searchActivities('peloton').map((a) => a.id)).toContain('spin');
    expect(searchActivities('').length).toBe(ACTIVITIES.length);
  });

  it('unknown ids fall back to a general workout', () => {
    expect(activityById('nope').met).toEqual(activityById('workout').met);
  });
});

describe('calories', () => {
  it('resting rate follows Mifflin-St Jeor', () => {
    // 10×62 + 6.25×168 − 5×30 − 161 = 1359
    expect(restingKcalPerDay(sierra)).toBe(1359);
    expect(restingKcalPerDay({ ...sierra, heightCm: null })).toBeNull();
  });

  it('counts only active calories (on top of resting)', () => {
    // MET 1 is sitting still: next to nothing active.
    expect(activeKcal(1, 60, { weightKg: 62, heightCm: null, ageYears: null, sex: null })).toBe(0);
    // MET 4 for 45 min at 62 kg without full details: (4 − 1) × 3.5 × 62 / 200 × 45 ≈ 146
    expect(activeKcal(4, 45, { weightKg: 62, heightCm: null, ageYears: null, sex: null })).toBe(146);
  });

  it('her example day lands in a realistic range', () => {
    const pilates = estimateKcal('pilates_reformer', 'normal', 45, sierra);
    const weights = estimateKcal('weights', 'normal', 30, sierra);
    const stairs = estimateKcal('stair_stepper', 'normal', 15, sierra);
    expect(pilates).toBeGreaterThan(120);
    expect(pilates).toBeLessThan(200);
    expect(weights).toBeGreaterThan(90);
    expect(weights).toBeLessThan(150);
    expect(stairs).toBeGreaterThan(70);
    expect(stairs).toBeLessThan(120);
  });

  it('light < normal < hard, and longer / heavier burns more', () => {
    const l = estimateKcal('spin', 'light', 45, sierra);
    const n = estimateKcal('spin', 'normal', 45, sierra);
    const h = estimateKcal('spin', 'hard', 45, sierra);
    expect(l).toBeLessThan(n);
    expect(n).toBeLessThan(h);
    expect(estimateKcal('spin', 'normal', 60, sierra)).toBeGreaterThan(n);
    expect(estimateKcal('spin', 'normal', 45, { ...sierra, weightKg: 80 })).toBeGreaterThan(n);
  });
});
