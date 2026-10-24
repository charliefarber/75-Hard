import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildWeeks,
  changeSinceFirst,
  dayNumber,
  onePerDay,
  weekCount,
  weekOfDay,
} from './weeks';

const START = '2026-10-01';
const day = (n: number) => addDays(START, n - 1); // challenge day n → date

describe('day and week numbers', () => {
  it('counts the start date as day 1', () => {
    expect(dayNumber(START, START)).toBe(1);
    expect(dayNumber(START, '2026-10-08')).toBe(8);
    expect(dayNumber(START, '2026-09-30')).toBe(0);
  });

  it('crosses the October clock change without drifting', () => {
    // UK clocks go back on 25 Oct 2026; calendar-day maths must not care.
    expect(dayNumber(START, '2026-10-26')).toBe(26);
    expect(dayNumber(START, '2026-12-14')).toBe(75);
  });

  it('puts days 1–7 in week 1 and days 71–75 in week 11', () => {
    expect(weekOfDay(1)).toBe(1);
    expect(weekOfDay(7)).toBe(1);
    expect(weekOfDay(8)).toBe(2);
    expect(weekOfDay(71)).toBe(11);
    expect(weekOfDay(75)).toBe(11);
    expect(weekCount()).toBe(11);
  });

  it('rejects malformed dates', () => {
    expect(() => dayNumber(START, '1/10/2026')).toThrow();
  });
});

describe('onePerDay', () => {
  it('keeps the last entry for a day and drops empty ones', () => {
    const m = onePerDay([
      { date: day(1), value: 72.4 },
      { date: day(1), value: 72.2 },
      { date: day(2), value: null },
      { date: day(3), value: Number.NaN },
    ]);
    expect(m.get(day(1))).toBe(72.2);
    expect(m.has(day(2))).toBe(false);
    expect(m.has(day(3))).toBe(false);
  });
});

describe('buildWeeks with averages (weight)', () => {
  const weighIns = [
    // week 1: avg 72.0
    { date: day(1), value: 72.4 },
    { date: day(3), value: 72.0 },
    { date: day(6), value: 71.6 },
    // week 2: avg 71.5
    { date: day(9), value: 71.6 },
    { date: day(13), value: 71.4 },
    // week 4 (current, day 25 today): avg 70.8 so far
    { date: day(22), value: 70.9 },
    { date: day(24), value: 70.7 },
    // future entry and pre-start entry are ignored
    { date: day(30), value: 60 },
    { date: day(0), value: 90 },
  ];
  const weeks = buildWeeks({ start: START, today: day(25), values: weighIns, aggregate: 'average' });

  it('returns all 11 weeks with the right shape', () => {
    expect(weeks.length).toBe(11);
    expect(weeks[10].firstDay).toBe(71);
    expect(weeks[10].lastDay).toBe(75);
    expect(weeks[10].length).toBe(5);
    expect(weeks[1].firstDate).toBe('2026-10-08');
    expect(weeks[1].lastDate).toBe('2026-10-14');
  });

  it('marks done, current and upcoming weeks', () => {
    expect(weeks.slice(0, 5).map((w) => w.status)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
    ]);
    expect(weeks[3].daysElapsed).toBe(4);
    expect(weeks[4].daysElapsed).toBe(0);
  });

  it('averages each week', () => {
    expect(weeks[0].value).toBeCloseTo(72.0, 6);
    expect(weeks[1].value).toBeCloseTo(71.5, 6);
    expect(weeks[2].value).toBeNull(); // no weigh-ins in week 3
    expect(weeks[3].value).toBeCloseTo(70.8, 6);
    expect(weeks[4].value).toBeNull(); // the day-30 entry is in the future
  });

  it('compares with the previous week only when both have values', () => {
    expect(weeks[0].change).toBeNull();
    expect(weeks[1].change).toBeCloseTo(-0.5, 6);
    expect(weeks[2].change).toBeNull();
    expect(weeks[3].change).toBeNull(); // week 3 has no value
  });

  it('gives the change from the first to the latest week with a value', () => {
    expect(changeSinceFirst(weeks, 'average')).toBeCloseTo(-1.2, 6);
  });
});

describe('buildWeeks with totals (steps)', () => {
  const steps = [];
  for (let d = 1; d <= 25; d++) steps.push({ date: day(d), value: d <= 7 ? 9000 : 10000 });
  const weeks = buildWeeks({ start: START, today: day(25), values: steps, aggregate: 'total' });

  it('sums each week', () => {
    expect(weeks[0].value).toBe(63000);
    expect(weeks[1].value).toBe(70000);
    expect(weeks[3].value).toBe(40000); // 4 days so far
  });

  it('does not compare a part-week total', () => {
    expect(weeks[1].change).toBe(7000);
    expect(weeks[3].change).toBeNull();
    expect(changeSinceFirst(weeks, 'total')).toBeNull();
  });

  it('does not compare the 5-day last week with a 7-day week', () => {
    const all = [];
    for (let d = 1; d <= 75; d++) all.push({ date: day(d), value: 1 });
    const done = buildWeeks({ start: START, today: day(80), values: all, aggregate: 'total' });
    expect(done.every((w) => w.status === 'done')).toBe(true);
    expect(done[9].change).toBe(0);
    expect(done[10].value).toBe(5);
    expect(done[10].change).toBeNull();
  });
});

describe('before the challenge starts', () => {
  it('marks every week upcoming', () => {
    const weeks = buildWeeks({ start: START, today: day(0), values: [], aggregate: 'average' });
    expect(weeks.every((w) => w.status === 'upcoming' && w.daysElapsed === 0)).toBe(true);
  });
});
