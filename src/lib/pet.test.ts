import { describe, expect, it } from 'vitest';
import { summarise } from './challenge';
import { petState, stageFor } from './pet';
import { emptyLog, type DailyLog } from '../data/types';

const profile = { water_goal_ml: 3000, workout_minutes: 45, reading_goal_pages: 10, step_goal: 10000, steps_required: false };
const done = (date: string): DailyLog => ({
  ...emptyLog(date),
  workouts: [
    { id: 'a', activity: 'run', minutes: 50, intensity: 'normal', kcal: 400 },
    { id: 'b', activity: 'yoga_vinyasa', minutes: 45, intensity: 'normal', kcal: 120 },
  ],
  water_ml: 3000,
  pages_read: 10,
  followed_diet: true,
  no_cheat_meal: true,
  no_alcohol: true,
});
const day = (start: string, n: number) => new Date(Date.parse(start) + n * 864e5).toISOString().slice(0, 10);
function logsFor(start: string, n: number, skip: number[] = []) {
  const logs: Record<string, DailyLog> = {};
  for (let i = 0; i < n; i++) if (!skip.includes(i)) logs[day(start, i)] = done(day(start, i));
  return logs;
}

describe('pet', () => {
  it('evolves with completed days', () => {
    expect([0, 9, 10, 14, 15, 24, 25, 34, 35, 49, 50, 75].map(stageFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('is happy when nothing is missed, ecstatic once today is done', () => {
    const start = '2026-10-05'; // Monday
    const s = summarise({ start_date: start }, logsFor(start, 3), profile, day(start, 3));
    expect(petState(s, [], day(start, 3)).mood).toBe('happy');
    const s2 = summarise({ start_date: start }, logsFor(start, 4), profile, day(start, 3));
    expect(petState(s2, [], day(start, 3)).mood).toBe('ecstatic');
  });

  it('gets hungrier with each missed day in a row, down to starving', () => {
    const start = '2026-10-05';
    const moods = [1, 2, 3, 5].map((miss) => {
      const today = day(start, 3 + miss);
      const s = summarise({ start_date: start }, logsFor(start, 3), profile, today);
      return petState(s, [], today);
    });
    expect(moods.map((m) => m.mood)).toEqual(['hungry', 'veryHungry', 'starving', 'starving']);
    expect(moods.map((m) => m.missedRun)).toEqual([1, 2, 3, 5]);
    expect(moods[3].fullness).toBe(8);
  });

  it('a perfect Monday–Sunday week earns a treat that feeds a missed day', () => {
    const start = '2026-10-05'; // Monday
    const logs = logsFor(start, 7); // perfect week, then miss Monday 12th
    const today = '2026-10-13';
    const s = summarise({ start_date: start }, logs, profile, today);
    const before = petState(s, [], today);
    expect(before.perfectWeeks).toEqual(['2026-10-05']);
    expect(before.treatsAvailable).toBe(1);
    expect(before.mood).toBe('hungry');
    expect(before.treatTarget).toBe('2026-10-12');
    const after = petState(s, ['2026-10-12'], today);
    expect(after.mood).toBe('happy');
    expect(after.treatsAvailable).toBe(0);
  });

  it('a week that started mid-challenge is not perfect', () => {
    const start = '2026-10-07'; // Wednesday
    const s = summarise({ start_date: start }, logsFor(start, 7), profile, '2026-10-14');
    expect(petState(s, [], '2026-10-14').perfectWeeks).toEqual([]);
  });
});
