import { describe, expect, it } from 'vitest';
import { summarise } from './challenge';
import { mondayOf, weekRecap } from './recap';
import { emptyLog, type DailyLog } from '../data/types';

const profile = { water_goal_ml: 3000, workout_minutes: 45, reading_goal_pages: 10, step_goal: 10000, steps_required: false };
const done = (date: string, steps = 10000): DailyLog => ({
  ...emptyLog(date),
  workouts: [
    { done: true, minutes: 50, type: 'Run', outdoor: true },
    { done: true, minutes: 45, type: 'Yoga', outdoor: false },
  ],
  water_ml: 3200,
  pages_read: 10,
  followed_diet: true,
  no_cheat_meal: true,
  no_alcohol: true,
  steps,
});
const d = (start: string, n: number) => new Date(Date.parse(start) + n * 864e5).toISOString().slice(0, 10);

describe('weekly recap', () => {
  it('perfect Monday–Sunday week', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 7; i++) logs[d('2026-09-28', i)] = done(d('2026-09-28', i), 9000 + i * 1000);
    const s = summarise({ start_date: '2026-09-28' }, logs, profile, '2026-10-05');
    const r = weekRecap('2026-09-28', logs, s, profile, '2026-10-05');
    expect(r).toMatchObject({ inPlay: 7, completed: 7, perfect: true, headline: 'Perfect week!' });
    expect(r.steps).toEqual({ total: 84000, goal: 70000, bestDay: '2026-10-04', bestSteps: 15000 });
    expect(r.water).toEqual({ avgMl: 3200, daysHit: 7 });
    expect(r.workouts).toEqual({ logged: 14, possible: 14, minutes: 665 });
    expect(r.readingDays).toBe(7);
  });

  it('only counts days inside the challenge and spots evolution', () => {
    // start Wed 7 Oct with 9 days credited earlier... simulate 8 done before this week then 3 more
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 12; i++) logs[d('2026-09-26', i)] = done(d('2026-09-26', i));
    const s = summarise({ start_date: '2026-09-26' }, logs, profile, '2026-10-12');
    const r = weekRecap('2026-10-05', logs, s, profile, '2026-10-12');
    // 26 Sep–4 Oct = 9 done before; this week: 5,6,7 done, 8–11 missed
    expect(r.inPlay).toBe(7);
    expect(r.completed).toBe(3);
    expect(r.evolvedTo).toBe('Sprout');
    expect(r.totalCompleted).toBe(12);
    expect(r.headline).toBe('Every day counts');
  });

  it('week that started mid-week', () => {
    const logs = { '2026-10-09': done('2026-10-09'), '2026-10-10': done('2026-10-10'), '2026-10-11': done('2026-10-11') };
    const s = summarise({ start_date: '2026-10-09' }, logs, profile, '2026-10-12');
    const r = weekRecap(mondayOf('2026-10-09'), logs, s, profile, '2026-10-12');
    expect(r.days.map((x) => x.state)).toEqual([null, null, null, null, 'complete', 'complete', 'complete']);
    expect(r).toMatchObject({ inPlay: 3, completed: 3, perfect: false, headline: 'Strong week' });
  });
});
