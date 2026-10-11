import { describe, expect, it } from 'vitest';
import { dayNumber, finishDate, isDayComplete, summarise, taskStatuses } from './challenge';
import { emptyLog, type DailyLog } from '../data/types';

const profile = { water_goal_ml: 3785, workout_minutes: 45, reading_goal_pages: 10, step_goal: 10000, steps_required: true };

function perfect(date: string): DailyLog {
  return {
    ...emptyLog(date),
    workouts: [
      { done: true, minutes: 45, type: 'Run', outdoor: true },
      { done: true, minutes: 50, type: 'Strength', outdoor: false },
    ],
    water_ml: 3800,
    pages_read: 10,
    followed_diet: true,
    no_cheat_meal: true,
    no_alcohol: true,
    steps: 10000,
  };
}

describe('day maths', () => {
  it('counts the start date as day 1', () => {
    expect(dayNumber('2026-10-01', '2026-10-01')).toBe(1);
    expect(dayNumber('2026-10-01', '2026-10-11')).toBe(11);
  });
  it('works across the October clock change', () => {
    expect(dayNumber('2026-10-20', '2026-10-27')).toBe(8);
  });
  it('finishes on day 75', () => {
    expect(finishDate('2026-10-11')).toBe('2026-12-24');
  });
});

describe('tasks', () => {
  it('a fully logged day is complete', () => {
    expect(isDayComplete(perfect('2026-10-11'), profile)).toBe(true);
  });

  it('needs one outdoor workout', () => {
    const l = perfect('2026-10-11');
    l.workouts[0].outdoor = false;
    const t = taskStatuses(l, profile);
    expect(t.find((x) => x.id === 'workout2')?.done).toBe(false);
    expect(t.find((x) => x.id === 'workout2')?.hint).toMatch(/outdoors/);
  });

  it('needs workouts to be long enough', () => {
    const l = perfect('2026-10-11');
    l.workouts[1].minutes = 30;
    expect(isDayComplete(l, profile)).toBe(false);
  });

  it('steps only count when required', () => {
    const l = perfect('2026-10-11');
    l.steps = 4000;
    expect(isDayComplete(l, profile)).toBe(false);
    expect(isDayComplete(l, { ...profile, steps_required: false })).toBe(true);
  });

  it('diet needs both diet and no cheat meal', () => {
    const l = perfect('2026-10-11');
    l.no_cheat_meal = false;
    expect(taskStatuses(l, profile).find((t) => t.id === 'diet')?.done).toBe(false);
  });
});

describe('summary', () => {
  it('flags missed days and counts the streak', () => {
    const logs = {
      '2026-10-01': perfect('2026-10-01'),
      '2026-10-02': perfect('2026-10-02'),
      // 10-03 missing
      '2026-10-04': perfect('2026-10-04'),
    };
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-10-05');
    expect(s.currentDay).toBe(5);
    expect(s.completedDays).toBe(3);
    expect(s.missedDays).toEqual([{ day: 3, date: '2026-10-03' }]);
    expect(s.streak).toBe(1);
    expect(s.dayStates.slice(0, 6)).toEqual(['complete', 'complete', 'missed', 'complete', 'today', 'future']);
  });

  it('includes today in the streak once it is done', () => {
    const logs = { '2026-10-01': perfect('2026-10-01'), '2026-10-02': perfect('2026-10-02') };
    expect(summarise({ start_date: '2026-10-01' }, logs, profile, '2026-10-02').streak).toBe(2);
  });

  it('credits days done before using the app', () => {
    const s = summarise({ start_date: '2026-10-01', credited_days: 9 }, {}, profile, '2026-10-10');
    expect(s.missedDays).toEqual([]);
    expect(s.streak).toBe(9);
    expect(s.completedDays).toBe(9);
  });
});
