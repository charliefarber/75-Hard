import { describe, expect, it } from 'vitest';
import { ageOn, bodyStats, dayBurned, formatChange, formatWeight, latestWeight, parseWeight, weighIns, weightParts, weightTrend, weightUnitFor } from './body';
import { emptyLog, normaliseLog, type DailyLog } from '../data/types';

const log = (date: string, kg?: number): DailyLog => ({ ...emptyLog(date), weight_kg: kg ?? null });

describe('weight', () => {
  it('formats in kg, lb and stone', () => {
    expect(formatWeight(62.4)).toBe('62.4 kg');
    expect(formatWeight(62.4, 'lb')).toBe('137.6 lb');
    expect(formatWeight(62.4, 'st')).toBe('9 st 11.6 lb');
    expect(formatChange(-1.24)).toBe('−1.2 kg');
    expect(formatChange(0.5, 'lb')).toBe('+1.1 lb');
    expect(formatChange(0.01)).toBe('±0.0 kg');
  });

  it('finds the latest weigh-in on or before a day', () => {
    const logs = { a: log('2026-10-01', 63), b: log('2026-10-05', 62.5), c: log('2026-10-08'), d: log('2026-10-10', 62) };
    expect(latestWeight(logs, '2026-10-08')).toEqual({ date: '2026-10-05', kg: 62.5 });
    expect(latestWeight(logs, '2026-09-30')).toBeNull();
    expect(weighIns(logs).map((w) => w.kg)).toEqual([63, 62.5, 62]);
  });

  it('7-day average smooths the daily noise', () => {
    const pts = [
      { date: '2026-10-01', kg: 63 },
      { date: '2026-10-02', kg: 62 },
      { date: '2026-10-03', kg: 64 },
      { date: '2026-10-09', kg: 62 },
    ];
    const t = weightTrend(pts);
    expect(t[2].avg).toBeCloseTo(63, 5);
    // 9 Oct window is 3–9 Oct: 64 and 62
    expect(t[3].avg).toBeCloseTo(63, 5);
  });
});

describe('body stats + burned', () => {
  it('works out age from the birthday', () => {
    expect(ageOn('1995-10-19', '2026-10-18')).toBe(30);
    expect(ageOn('1995-10-19', '2026-10-19')).toBe(31);
    expect(ageOn(null, '2026-10-19')).toBeNull();
  });

  it('adds up saved calories and estimates older entries', () => {
    const p = { height_cm: 168, sex: 'female' as const, birthday: '1995-10-19' };
    const logs = { x: log('2026-10-10', 62) };
    const b = bodyStats(p, logs, '2026-10-12');
    expect(b).toEqual({ weightKg: 62, heightCm: 168, ageYears: 30, sex: 'female' });
    const day = normaliseLog({
      log_date: '2026-10-12',
      workouts: [
        { id: '1', activity: 'run', minutes: 30, intensity: 'normal', kcal: 250 },
        // an older two-slot entry: estimated on the fly
        { done: true, minutes: 45, type: 'Pilates', outdoor: false } as never,
        { done: false, minutes: 0, type: '', outdoor: false } as never,
      ],
    });
    expect(day.workouts).toHaveLength(2);
    expect(day.workouts[1]).toMatchObject({ activity: 'pilates_mat', minutes: 45, intensity: 'normal', kcal: null });
    expect(dayBurned(day, b)).toBeGreaterThan(250);
  });
});

describe('weight entry', () => {
  it('reads kg, lb and stone back into kg', () => {
    expect(parseWeight('62.4', 'kg')).toBe(62.4);
    expect(parseWeight('62,4', 'kg')).toBe(62.4);
    expect(parseWeight('137.6', 'lb')).toBeCloseTo(62.41, 2);
    expect(parseWeight('9', 'st', '11.6')).toBeCloseTo(62.41, 2);
    expect(parseWeight('10', 'st', '')).toBeCloseTo(63.5, 1);
  });

  it('rejects things that are not a believable weight', () => {
    expect(parseWeight('', 'kg')).toBeNull();
    expect(parseWeight('6.24', 'kg')).toBeNull();
    expect(parseWeight('9', 'st', '15')).toBeNull();
    expect(parseWeight('abc', 'lb')).toBeNull();
  });

  it('round-trips through what the inputs show', () => {
    for (const unit of ['kg', 'lb', 'st'] as const) {
      const p = weightParts(62.4, unit);
      expect(parseWeight(p.main, unit, p.lb)).toBeCloseTo(62.4, 1);
    }
    expect(weightParts(62.4, 'st')).toEqual({ main: '9', lb: '11.6' });
  });

  it('picks pounds for the US and kilos elsewhere, unless she chose', () => {
    expect(weightUnitFor(null, 'en-US')).toBe('lb');
    expect(weightUnitFor(null, 'en-GB')).toBe('kg');
    expect(weightUnitFor('st', 'en-US')).toBe('st');
  });
});
