import { describe, expect, it } from 'vitest';
import { dayNumber, finishDate, isDayComplete, summarise, taskStatuses, weekSteps } from './challenge';
import { emptyLog, type DailyLog } from '../data/types';

const profile = { water_goal_ml: 3785, workout_minutes: 45, reading_goal_pages: 10, step_goal: 10000, steps_required: true };

function perfect(date: string): DailyLog {
  return {
    ...emptyLog(date),
    workouts: [
      { id: 'a', activity: 'pilates_reformer', minutes: 45, intensity: 'normal' },
      { id: 'b', activity: 'weights', minutes: 30, intensity: 'hard' },
      { id: 'c', activity: 'stair_stepper', minutes: 15, intensity: 'normal' },
    ],
    water_ml: 3800,
    pages_read: 10,
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

  it('any mix of workouts counts once they add up to 90 minutes', () => {
    const l = perfect('2026-10-11');
    l.workouts = [{ id: 'x', activity: 'run', minutes: 90, intensity: 'light' }];
    expect(isDayComplete(l, profile)).toBe(true);
  });

  it('needs the full 90 minutes, and says how many are left', () => {
    const l = perfect('2026-10-11');
    l.workouts[2].minutes = 10;
    expect(isDayComplete(l, profile)).toBe(false);
    expect(taskStatuses(l, profile)[0]).toMatchObject({ id: 'workouts', done: false, hint: '5 min to go' });
  });

  it('uses her own daily goal when she sets one', () => {
    const l = perfect('2026-10-11');
    l.workouts = [{ id: 'x', activity: 'walk', minutes: 60, intensity: 'normal' }];
    expect(isDayComplete(l, { ...profile, workout_goal_minutes: 60 })).toBe(true);
    expect(isDayComplete(l, { ...profile, workout_goal_minutes: 90 })).toBe(false);
  });

  it('steps never fail a day', () => {
    const l = perfect('2026-10-11');
    l.steps = 4000;
    expect(isDayComplete(l, profile)).toBe(true);
  });

  it('adds up steps Monday to Sunday', () => {
    const logs = { '2026-10-05': { ...perfect('2026-10-05'), steps: 12000 }, '2026-10-11': { ...perfect('2026-10-11'), steps: 8000 }, '2026-10-12': { ...perfect('2026-10-12'), steps: 99999 } };
    const w = weekSteps(logs, '2026-10-09');
    expect(w.start).toBe('2026-10-05');
    expect(w.total).toBe(20000);
  });

  it('the tasks are workouts, water, reading and no alcohol (food is logged, not ticked)', () => {
    expect(taskStatuses(perfect('2026-10-11'), profile).map((t) => t.id)).toEqual(['workouts', 'water', 'reading', 'alcohol']);
    const l = { ...perfect('2026-10-11'), followed_diet: false, no_cheat_meal: false };
    expect(isDayComplete(l, profile)).toBe(true);
    expect(isDayComplete({ ...l, no_alcohol: false }, profile)).toBe(false);
  });
});

describe('summary (always 75 calendar days; nothing restarts or moves)', () => {
  it('a partly done day is logged as it was and the finish line stays put', () => {
    const logs = {
      '2026-10-01': perfect('2026-10-01'),
      '2026-10-02': perfect('2026-10-02'),
      '2026-10-03': { ...perfect('2026-10-03'), no_alcohol: false, pages_read: 0 },
      '2026-10-04': perfect('2026-10-04'),
    };
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-10-05');
    expect(s.completedDays).toBe(3);
    expect(s.currentDay).toBe(5);
    expect(s.remaining).toBe(70);
    expect(s.partialDays).toEqual([{ date: '2026-10-03' }]);
    expect(s.streak).toBe(1);
    expect(s.timeline.slice(0, 6).map((t) => [t.state, t.day, t.done])).toEqual([
      ['complete', 1, 4], ['complete', 2, 4], ['partial', 3, 2], ['complete', 4, 4], ['today', 5, 0], ['future', 6, 0],
    ]);
    expect(s.finishDate).toBe('2026-12-14');
    expect(s.timeline.length).toBe(75);
  });

  it('finishes on calendar day 75', () => {
    const s = summarise({ start_date: '2026-10-11' }, {}, profile, '2026-10-11');
    expect(s.currentDay).toBe(1);
    expect(s.finishDate).toBe('2026-12-24');
  });

  it('includes today once it is done', () => {
    const logs = { '2026-10-01': perfect('2026-10-01'), '2026-10-02': perfect('2026-10-02') };
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-10-02');
    expect(s.streak).toBe(2);
    expect(s.currentDay).toBe(2);
    expect(s.completedDays).toBe(2);
    expect(s.todayComplete).toBe(true);
    expect(s.timeline[1]).toMatchObject({ state: 'complete', done: 4, of: 4 });
  });

  it('credits days done before using the app', () => {
    const s = summarise({ start_date: '2026-10-01', credited_days: 9 }, {}, profile, '2026-10-10');
    expect(s.partialDays).toEqual([]);
    expect(s.streak).toBe(9);
    expect(s.completedDays).toBe(9);
    expect(s.currentDay).toBe(10);
  });

  it('is over after day 75, however many days were full', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 80; i++) {
      const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      if (i !== 10) logs[d] = perfect(d);
    }
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-12-31');
    expect(s.finished).toBe(true);
    expect(s.completedDays).toBe(74);
    expect(s.currentDay).toBe(75);
    expect(s.remaining).toBe(0);
    expect(s.finishDate).toBe('2026-12-14');
  });

  it('is not over on day 75 itself', () => {
    const s = summarise({ start_date: '2026-10-01' }, {}, profile, '2026-12-14');
    expect(s.currentDay).toBe(75);
    expect(s.finished).toBe(false);
    expect(s.remaining).toBe(0);
  });

  it('before the start date nothing has happened yet', () => {
    const s = summarise({ start_date: '2026-10-12' }, {}, profile, '2026-10-11');
    expect(s.currentDay).toBe(0);
    expect(s.timeline[0]).toEqual({ date: '2026-10-12', state: 'future', day: 1, done: 0, of: 0 });
  });
});

describe('birthday pass on a day', () => {
  it('makes an otherwise empty day count', () => {
    expect(isDayComplete({ ...emptyLog('2026-10-19'), birthday_pass: true }, profile)).toBe(true);
  });
});
