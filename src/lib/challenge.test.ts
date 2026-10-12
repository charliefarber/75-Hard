import { describe, expect, it } from 'vitest';
import { dayNumber, finishDate, isDayComplete, summarise, taskStatuses, weekSteps } from './challenge';
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

  it('workouts can be indoors or outdoors', () => {
    const l = perfect('2026-10-11');
    l.workouts[0].outdoor = false;
    expect(isDayComplete(l, profile)).toBe(true);
  });

  it('needs workouts to be long enough', () => {
    const l = perfect('2026-10-11');
    l.workouts[1].minutes = 30;
    expect(isDayComplete(l, profile)).toBe(false);
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

  it('diet needs both diet and no cheat meal', () => {
    const l = perfect('2026-10-11');
    l.no_cheat_meal = false;
    expect(taskStatuses(l, profile).find((t) => t.id === 'diet')?.done).toBe(false);
  });
});

describe('summary (missed days extend the challenge)', () => {
  it('a missed day does not count and pushes the finish line back a day', () => {
    const logs = {
      '2026-10-01': perfect('2026-10-01'),
      '2026-10-02': perfect('2026-10-02'),
      // 10-03 missed
      '2026-10-04': perfect('2026-10-04'),
    };
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-10-05');
    expect(s.completedDays).toBe(3);
    expect(s.currentDay).toBe(4); // working on day 4 today, not day 5
    expect(s.remaining).toBe(72);
    expect(s.missedDays).toEqual([{ date: '2026-10-03' }]);
    expect(s.streak).toBe(1);
    expect(s.timeline.slice(0, 6).map((t) => [t.state, t.day])).toEqual([
      ['complete', 1], ['complete', 2], ['missed', null], ['complete', 3], ['today', 4], ['future', 5],
    ]);
    // 75 counted days + 1 missed = 76 calendar days from 1 Oct.
    expect(s.finishDate).toBe('2026-12-15');
    expect(s.timeline.length).toBe(76);
  });

  it('with no misses it finishes on calendar day 75', () => {
    const s = summarise({ start_date: '2026-10-11' }, {}, profile, '2026-10-11');
    expect(s.currentDay).toBe(1);
    expect(s.finishDate).toBe('2026-12-24');
  });

  it('includes today once it is done', () => {
    const logs = { '2026-10-01': perfect('2026-10-01'), '2026-10-02': perfect('2026-10-02') };
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-10-02');
    expect(s.streak).toBe(2);
    expect(s.currentDay).toBe(2);
    expect(s.todayComplete).toBe(true);
    expect(s.finishDate).toBe('2026-12-14');
  });

  it('credits days done before using the app', () => {
    const s = summarise({ start_date: '2026-10-01', credited_days: 9 }, {}, profile, '2026-10-10');
    expect(s.missedDays).toEqual([]);
    expect(s.streak).toBe(9);
    expect(s.completedDays).toBe(9);
    expect(s.currentDay).toBe(10);
  });

  it('finishes on the 75th completed day', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 80; i++) {
      const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      if (i !== 10) logs[d] = perfect(d);
    }
    const s = summarise({ start_date: '2026-10-01' }, logs, profile, '2026-12-31');
    expect(s.finished).toBe(true);
    expect(s.completedDays).toBe(75);
    expect(s.finishDate).toBe('2026-12-15');
  });

  it('before the start date nothing has happened yet', () => {
    const s = summarise({ start_date: '2026-10-12' }, {}, profile, '2026-10-11');
    expect(s.currentDay).toBe(0);
    expect(s.timeline[0]).toEqual({ date: '2026-10-12', state: 'future', day: 1 });
  });
});

describe('birthday pass on a day', () => {
  it('makes an otherwise empty day count', () => {
    expect(isDayComplete({ ...emptyLog('2026-10-19'), birthday_pass: true }, profile)).toBe(true);
  });
});
