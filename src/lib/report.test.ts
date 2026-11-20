import { describe, expect, it } from 'vitest';
import type { FoodEntry, Meal } from '../data/foodTypes';
import { emptyLog, type DailyLog } from '../data/types';
import { summarise } from './challenge';
import { challengeStats, dailySeries, foodDay, foodWeek, reportTeaser, weekReport, weekWeight, type ReportInput, type ReportProfile } from './report';

const START = '2026-10-12'; // a Monday
const P: ReportProfile = {
  step_goal: 10000,
  water_goal_ml: 3000,
  workout_minutes: 45,
  workout_goal_minutes: 90,
  reading_goal_pages: 10,
  calorie_goal: 1500,
  height_cm: 165,
  sex: 'female',
  birthday: '1995-01-01',
};
const d = (from: string, n: number) => new Date(Date.parse(from) + n * 864e5).toISOString().slice(0, 10);
const workout = { id: 'w', activity: 'walk', minutes: 90, intensity: 'normal' as const, kcal: 300 };
const entry = (date: string, meal: Meal, kcal: number, protein: number, name: string): FoodEntry => ({
  id: `${date}-${meal}-${name}`,
  log_date: date,
  meal,
  name,
  amount: 1,
  unit: 'portion',
  kcal,
  protein_g: protein,
  carbs_g: 10,
  fat_g: 5,
  source: 'describe',
});

/**
 * Three weeks from Monday 12 Oct, each Monday–Sunday:
 *   week 1: water Mon–Wed, workouts Mon–Fri, alcohol-free Mon–Fri, 8,000 steps a day → full Mon–Wed
 *   week 2: water Mon–Tue, workouts Mon–Thu, alcohol-free Mon–Fri, 9,000 steps → full Mon–Tue
 *   week 3: water, workouts and alcohol-free Mon–Fri, 11,000 steps → full Mon–Fri
 * Reading every day. Weigh-ins Mon / Wed / Fri, drifting down.
 */
function scenario() {
  const logs: Record<string, DailyLog> = {};
  const plan = [
    { steps: 8000, water: 3, workouts: 5, sober: 5 },
    { steps: 9000, water: 2, workouts: 4, sober: 5 },
    { steps: 11000, water: 5, workouts: 5, sober: 5 },
  ];
  const kg = [70.0, 69.8, 69.8, 69.6, 69.6, 69.4, 69.2, 69.0, 69.0];
  plan.forEach((w, wi) => {
    for (let i = 0; i < 7; i++) {
      const date = d(START, wi * 7 + i);
      const weigh = i === 0 || i === 2 || i === 4 ? kg[wi * 3 + i / 2] : null;
      logs[date] = {
        ...emptyLog(date),
        steps: w.steps,
        water_ml: i < w.water ? 3000 : 1000,
        workouts: i < w.workouts ? [{ ...workout, id: `w${date}` }] : [],
        pages_read: 10,
        no_alcohol: i < w.sober,
        weight_kg: weigh,
      };
    }
  });
  const food: Record<string, FoodEntry[]> = {
    '2026-10-26': [entry('2026-10-26', 'breakfast', 400, 20, 'Overnight oats'), entry('2026-10-26', 'lunch', 500, 35, 'Chicken salad'), entry('2026-10-26', 'dinner', 600, 40, 'Salmon')],
    '2026-10-27': [entry('2026-10-27', 'breakfast', 400, 20, 'Overnight oats'), entry('2026-10-27', 'lunch', 500, 35, 'Chicken salad'), entry('2026-10-27', 'dinner', 700, 30, 'Pasta')],
    '2026-10-28': [entry('2026-10-28', 'breakfast', 400, 20, 'overnight oats '), entry('2026-10-28', 'dinner', 900, 50, 'Curry')],
    '2026-10-29': [entry('2026-10-29', 'lunch', 300, 10, 'Soup')],
  };
  return { logs, food };
}

function input(logs: Record<string, DailyLog>, food: Record<string, FoodEntry[]>, today: string, profile: ReportProfile = P): ReportInput {
  return {
    logs,
    entries: (date) => food[date] ?? [],
    summary: summarise({ start_date: START }, logs, profile, today),
    profile,
    start: START,
    today,
    unit: 'lb',
  };
}

describe('food days', () => {
  it('counts a day as fully logged with two meals and half the calorie goal', () => {
    const e = (meal: Meal, kcal: number) => entry('2026-10-26', meal, kcal, 10, meal);
    expect(foodDay('2026-10-26', [e('breakfast', 400), e('dinner', 400)], undefined, 1500)?.full).toBe(true);
    expect(foodDay('2026-10-26', [e('breakfast', 400), e('dinner', 300)], undefined, 1500)?.full).toBe(false); // 700 < 750
    expect(foodDay('2026-10-26', [e('lunch', 900)], undefined, 1500)?.full).toBe(false); // one meal
    // A total typed in (no diary): the amount decides, and there are no macros
    expect(foodDay('2026-10-26', [], { calories: 1400 }, 1500)).toMatchObject({ kcal: 1400, full: true, protein: null, meals: 0 });
    expect(foodDay('2026-10-26', undefined, { calories: null }, 1500)).toBeNull();
    // No calorie goal: 800 kcal
    expect(foodDay('2026-10-26', [e('breakfast', 400), e('dinner', 400)], undefined, null)?.full).toBe(true);
  });

  it('averages only fully logged days, and says what was left out', () => {
    const { logs, food } = scenario();
    const dates = Array.from({ length: 7 }, (_, i) => d('2026-10-26', i));
    const f = foodWeek(dates, input(logs, food, '2026-11-02'));
    expect(f).toMatchObject({ inPlay: 7, logged: 4, full: 3, part: 1, basis: 'full', goal: 1500, onTarget: 2, proteinDays: 0 });
    expect(f.avg).toEqual({ kcal: 1467, protein: 83.3, carbs: 26.7, fat: 13.3 });
    expect(f.goals?.protein).toBe(113); // 30% of 1,500 kcal
    expect(f.meals.map((m) => `${m.meal} ${m.kcal}`)).toEqual(['dinner 733', 'breakfast 400', 'lunch 333']);
    expect(f.meals[0].share).toBeCloseTo(733 / 1466);
    // counted once per day, names matched loosely
    expect(f.top).toEqual([
      { name: 'Overnight oats', count: 3 },
      { name: 'Chicken salad', count: 2 },
    ]);
    // eaten − burned on the full days: a modest deficit
    expect(f.net).toBeLessThan(0);
    expect(f.net).toBeGreaterThan(-600);
  });

  it('falls back to every logged day when none is full, and never counts today', () => {
    const { logs } = scenario();
    const food = { '2026-11-02': [entry('2026-11-02', 'lunch', 300, 10, 'Soup')], '2026-11-03': [entry('2026-11-03', 'lunch', 500, 20, 'Wrap')] };
    const dates = Array.from({ length: 7 }, (_, i) => d('2026-11-02', i));
    const f = foodWeek(dates, input(logs, food, '2026-11-03'));
    expect(f).toMatchObject({ inPlay: 1, logged: 1, full: 0, part: 1, basis: 'all', net: null });
    expect(f.avg?.kcal).toBe(300);
  });
});

describe('weekly report', () => {
  it('a finished week: habits by day, weight, food, highlights and a focus', () => {
    const { logs, food } = scenario();
    const r = weekReport('2026-10-26', input(logs, food, '2026-11-02'));
    expect(r.current).toBe(false);
    const row = (id: string) => r.habits.find((h) => h.id === id)!;
    expect(row('water')).toMatchObject({ hit: 5, of: 7, prev: { hit: 2, of: 7 } });
    expect(row('water').days).toEqual([true, true, true, true, true, false, false]);
    expect(row('reading')).toMatchObject({ hit: 7, of: 7 });
    expect(row('steps')).toMatchObject({ hit: 7, of: 7, prev: { hit: 0, of: 7 } });

    // 7-day average 69.07 kg on Fri 30 Oct against 69.53 kg on Fri 23 Oct
    expect(r.weight?.change).toBeCloseTo(-0.4667, 3);
    expect(r.weight?.weighIns).toBe(3);
    expect(r.weight?.sinceStart).toBeCloseTo(-0.9333, 3);

    expect(r.activity).toMatchObject({ steps: 77000, goal: 70000, prevSteps: 63000, minutes: 450, prevMinutes: 360, sessions: 5 });
    expect(r.activity.top).toEqual([{ name: 'Walking', minutes: 450 }]);

    // Best first, one per topic: most full days beats "5 full days"; best step week beats "steps up 22%"
    expect(r.highlights.map((h) => h.text)).toEqual([
      'Your most full days in a week: 5.',
      'Down 1.0 lb this week (7-day average).',
      'Your best step week yet: 77,000 steps.',
    ]);
    expect(r.headline).toBe('Your most full days yet and down 1.0 lb');

    // Food was fully logged on only 3 of 7 days: the biggest gap
    expect(r.focus?.area).toBe('logging');
    expect(r.focus?.text).toBe('Food fully logged on 3 of 7 days (1 only partly). Logging straight after each meal keeps it quick: type it or snap a photo.');
    expect(reportTeaser(r, 'lb')).toBe('Last week: 79% of tasks, down 1.0 lb');
  });

  it('the week still going: today is "to do", not missed, and totals compare fairly', () => {
    const { logs, food } = scenario();
    logs['2026-11-02'] = { ...emptyLog('2026-11-02'), steps: 12000, water_ml: 3000, workouts: [workout], pages_read: 10, no_alcohol: true };
    logs['2026-11-03'] = { ...emptyLog('2026-11-03'), steps: 6000, water_ml: 1200, workouts: [workout], pages_read: 10, no_alcohol: true };
    logs['2026-11-04'] = { ...emptyLog('2026-11-04'), steps: 2000, pages_read: 12 };
    const r = weekReport('2026-11-02', input(logs, food, '2026-11-04'));
    expect(r.current).toBe(true);
    const row = (id: string) => r.habits.find((h) => h.id === id)!;
    expect(row('workouts').days).toEqual([true, true, null, null, null, null, null]);
    expect(row('water')).toMatchObject({ hit: 1, of: 2 });
    expect(row('reading')).toMatchObject({ hit: 3, of: 3 });
    expect(r.food.inPlay).toBe(2);
    // No "best week" claims while it's going
    expect(r.highlights.some((h) => /best|most/.test(h.text))).toBe(false);
    expect(reportTeaser(r, 'lb')).toMatch(/^This week so far: /);
  });

  it('picks the habit furthest from its goal, with a weekend note when that is where it slips', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 7; i++) {
      const date = d(START, i);
      const weekend = i >= 5;
      logs[date] = { ...emptyLog(date), steps: 10500, water_ml: 3000, workouts: [workout], pages_read: 10, no_alcohol: !weekend };
    }
    logs[d(START, 4)].no_alcohol = false; // Friday too: 3 misses, 2 at the weekend
    const r = weekReport(START, input(logs, {}, '2026-10-19'));
    expect(r.focus).toEqual({
      area: 'alcohol',
      title: 'No alcohol',
      text: 'Alcohol-free 4 of 7 days. Weekends were the hardest. Deciding your alcohol-free drink before plans makes it easier.',
    });
    // A good week everywhere: keep it going
    for (let i = 0; i < 7; i++) logs[d(START, i)].no_alcohol = true;
    expect(weekReport(START, input(logs, {}, '2026-10-19')).focus?.area).toBe('keep');
  });

  it('water focus speaks in litres and steps focus in minutes of walking', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 7; i++) {
      const date = d(START, i);
      logs[date] = { ...emptyLog(date), steps: 9000, water_ml: i < 2 ? 3000 : 1200, workouts: [workout], pages_read: 10, no_alcohol: true };
    }
    const r = weekReport(START, input(logs, {}, '2026-10-19'));
    expect(r.focus?.text).toBe('Goal hit 2 of 7 days, about 1.7 L a day against 3 L. Try 1.5 L by lunch and the rest by dinner.');
    for (let i = 0; i < 7; i++) logs[d(START, i)].water_ml = 3000;
    const s = weekReport(START, input(logs, {}, '2026-10-19'));
    // 63,000 of 70,000 is 90%: nothing under 80%, so keep going
    expect(s.focus?.area).toBe('keep');
    for (let i = 0; i < 7; i++) logs[d(START, i)].steps = 6000;
    expect(weekReport(START, input(logs, {}, '2026-10-19')).focus?.text).toBe('42,000 of 70,000 steps. About 4,000 more a day closes the gap: a 40-minute walk.');
  });

  it('a week the challenge starts in: the step goal only counts its challenge days, and credited days are left out', () => {
    // Started Thursday 15 Oct; Thursday and Friday were credited from before the app, so nothing's logged for them
    const start = '2026-10-15';
    const logs: Record<string, DailyLog> = {};
    for (const date of ['2026-10-17', '2026-10-18']) logs[date] = { ...emptyLog(date), steps: 5000, water_ml: 3000, workouts: [workout], pages_read: 10, no_alcohol: true };
    const summary = summarise({ start_date: start, credited_days: 2 }, logs, P, '2026-10-19');
    const r = weekReport('2026-10-12', { logs, entries: () => [], summary, profile: P, start, today: '2026-10-19', unit: 'lb' });
    expect(r.habits.find((h) => h.id === 'steps')?.days).toEqual([null, null, null, null, null, false, false]);
    expect(r.habits.find((h) => h.id === 'water')).toMatchObject({ hit: 4, of: 4 });
    expect(r.activity).toMatchObject({ steps: 10000, goal: 20000, dayGoal: 10000 });
    expect(r.focus?.text).toBe('10,000 of 20,000 steps. About 5,000 more a day closes the gap: a 50-minute walk.');
  });

  it('says something kind about a slow week, and nothing about weight going up', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 7; i++) {
      const date = d(START, i);
      logs[date] = { ...emptyLog(date), pages_read: i < 2 ? 10 : 0, weight_kg: i === 0 ? 70 : i === 6 ? 70.6 : null };
    }
    const r = weekReport(START, input(logs, {}, '2026-10-19'));
    expect(r.highlights.map((h) => h.text)).toEqual(['2 tasks ticked off. Every one counts.']);
    expect(r.headline).toBe('Every bit counts');
  });
});

describe('weight by week', () => {
  it('no weigh-ins this week: shows the latest, with no change', () => {
    const { logs } = scenario();
    const w = weekWeight('2026-11-02', { logs, start: START, today: '2026-11-04' });
    expect(w).toMatchObject({ endDate: '2026-10-30', weighIns: 0, change: null });
  });
});

describe('challenge so far', () => {
  it('adds up tasks, streaks, habits, steps and food', () => {
    const { logs, food } = scenario();
    const s = challengeStats(input(logs, food, '2026-11-02'));
    expect(s.days).toBe(22);
    expect(s.taskShare).toBeCloseTo(60 / 84); // today isn't judged yet
    expect(s).toMatchObject({ fullDays: 10, streak: 0, bestStreak: 5, pages: 210, soberDays: 15, soberOf: 21 });
    const h = (id: string) => s.habits.find((x) => x.id === id)!;
    expect(h('water')).toMatchObject({ hit: 10, of: 21, bestStreak: 5, current: 0, slips: 'weekends' });
    expect(h('reading')).toMatchObject({ hit: 21, of: 21, slips: null });
    expect(s.weakest.map((x) => x.id)).toEqual(['water']);
    expect(s.steps).toEqual({ total: 196000, perDay: 9333 });
    expect(s.workouts).toEqual({ minutes: 1260, sessions: 14, top: 'Walking' });
    expect(s.food).toEqual({ logged: 4, full: 3, avgKcal: 1467, avgProtein: 83 });
    // Under three weeks of weigh-ins: a change, but no pace or projection yet
    expect(s.weight?.change).toBeCloseTo(-0.9333, 3);
    expect(s.weight?.perWeek).toBeNull();
    expect(s.weight?.projected).toBeNull();
  });

  it('projects day 75 from the weekly pace once there are three weeks of weigh-ins', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i <= 10; i++) {
      const date = d(START, i * 3);
      logs[date] = { ...emptyLog(date), weight_kg: Math.round((70 - 0.1 * i) * 10) / 10 };
    }
    const s = challengeStats(input(logs, {}, '2026-11-11'));
    expect(s.weight?.now).toBeCloseTo(69.1);
    expect(s.weight?.perWeek).toBeCloseTo(-0.21);
    expect(s.weight?.finish).toBe('2026-12-25');
    expect(s.weight?.projected).toBeCloseTo(69.1 - (0.21 * 44) / 7);
  });

  it('daily series for the week-by-week charts', () => {
    const { logs, food } = scenario();
    const s = dailySeries(input(logs, food, '2026-11-02'));
    expect(s.kcal.map((x) => x.value)).toEqual([1500, 1600, 1300]); // fully logged days only
    expect(s.protein.map((x) => x.value)).toEqual([95, 85, 70]);
    expect(s.tasks).toHaveLength(21); // today isn't over
    expect(s.tasks[0]).toEqual({ date: START, value: 100 });
    expect(s.water[0]).toEqual({ date: START, value: 3 });
  });
});
