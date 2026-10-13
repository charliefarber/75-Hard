import { describe, expect, it } from 'vitest';
import { summarise } from './challenge';
import { mondayOf, weekRecap } from './recap';
import { emptyLog, type DailyLog } from '../data/types';

const profile = { water_goal_ml: 3000, workout_minutes: 45, reading_goal_pages: 10, step_goal: 10000, steps_required: false };
const done = (date: string, steps = 10000): DailyLog => ({
  ...emptyLog(date),
  workouts: [
    { id: 'a', activity: 'run', minutes: 50, intensity: 'normal', kcal: 400 },
    { id: 'b', activity: 'yoga_vinyasa', minutes: 45, intensity: 'normal', kcal: 120 },
  ],
  water_ml: 3200,
  pages_read: 10,
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
    expect(r.workouts).toEqual({ minutes: 665, goalMinutes: 630, kcal: 3640, sessions: 14 });
    expect(r.readingDays).toBe(7);
  });

  it('says how the week went, partly done days included', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 12; i++) logs[d('2026-09-26', i)] = done(d('2026-09-26', i));
    // 8–11 Oct: water and no alcohol only (2 of 4 tasks), with food logged
    for (let i = 12; i < 16; i++) logs[d('2026-09-26', i)] = { ...emptyLog(d('2026-09-26', i)), water_ml: 3000, no_alcohol: true, calories: 1800 };
    const s = summarise({ start_date: '2026-09-26' }, logs, profile, '2026-10-12');
    const r = weekRecap('2026-10-05', logs, s, profile, '2026-10-12');
    // 26 Sep–4 Oct = 9 full days before; this week: 5,6,7 full, 8–11 half done
    expect(r.inPlay).toBe(7);
    expect(r.completed).toBe(3);
    expect(r.days.map((x) => `${x.state}:${x.done}/${x.of}`)).toEqual([
      'complete:4/4', 'complete:4/4', 'complete:4/4', 'partial:2/4', 'partial:2/4', 'partial:2/4', 'partial:2/4',
    ]);
    expect(r.taskShare).toBeCloseTo(20 / 28);
    expect(r.soberDays).toBe(7);
    expect(r.eaten).toEqual({ avg: 1800, days: 4 });
    expect(r.totalCompleted).toBe(12);
    expect(r.headline).toBe('Solid week');
  });

  it('week that started mid-week', () => {
    const logs = { '2026-10-09': done('2026-10-09'), '2026-10-10': done('2026-10-10'), '2026-10-11': done('2026-10-11') };
    const s = summarise({ start_date: '2026-10-09' }, logs, profile, '2026-10-12');
    const r = weekRecap(mondayOf('2026-10-09'), logs, s, profile, '2026-10-12');
    expect(r.days.map((x) => x.state)).toEqual([null, null, null, null, 'complete', 'complete', 'complete']);
    expect(r).toMatchObject({ inPlay: 3, completed: 3, perfect: false, headline: 'Strong week' });
  });
});
