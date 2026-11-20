import { addDays, format, parseISO } from 'date-fns';
import type { FoodEntry, Meal } from '../data/foodTypes';
import type { DailyLog, Profile, WeightUnit } from '../data/types';
import { workoutGoal } from '../data/types';
import { bodyStats, entryName, kgToLb, weighIns, weightTrend } from './body';
import { taskStatuses, toISODate, type ChallengeSummary, type TaskId, type TimelineDay } from './challenge';
import { dayEnergy } from './energy';
import { macroGoals, mealsWithFood, totals, type MacroGoals } from './nutrition';
import { mondayOf, weekRecap, type WeekRecap } from './recap';

/**
 * The weekly report and the challenge-so-far numbers on the Progress tab, worked out from what she
 * already logs: daily logs (tasks, steps, weigh-ins) and the food diary.
 *
 * Honest numbers, kind words:
 *   - Food averages only use days that look fully logged (two or more meals and at least half her
 *     calorie goal); part-logged days still count as logged, and the report says how many there were.
 *   - Weight is always the 7-day average, never one weigh-in.
 *   - Highlights only say what the numbers back up, and nothing ever praises eating less.
 *   - Today isn't judged until it's over: a task not done yet is "to do", not missed.
 */

export type ReportProfile = Parameters<typeof weekRecap>[3] &
  Pick<Profile, 'calorie_goal'> &
  Partial<Pick<Profile, 'protein_goal_g' | 'carbs_goal_g' | 'fat_goal_g'>>;

/** The diary for a day, or undefined while that day hasn't loaded (the day's calorie total stands in). */
export type EntriesFor = (date: string) => FoodEntry[] | undefined;

export interface ReportInput {
  logs: Record<string, DailyLog>;
  entries: EntriesFor;
  summary: ChallengeSummary;
  profile: ReportProfile;
  start: string;
  today: string;
  unit: WeightUnit;
}

const plusDays = (iso: string, n: number) => toISODate(addDays(parseISO(iso), n));
const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => plusDays(monday, i));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
/** 570 → "9.5 h", 45 → "45 min". */
export const timeText = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.round(min / 6) / 10} h`);
/** "0.6 lb" / "0.3 kg" (stone reads in pounds, like the weight card). */
export function weightAmount(kg: number, unit: WeightUnit): string {
  const v = Math.abs(unit === 'kg' ? kg : kgToLb(kg));
  return `${v.toFixed(1)} ${unit === 'kg' ? 'kg' : 'lb'}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- food

/** A day counts as fully logged with two or more meals and at least half her calorie goal (800 kcal without one). */
export const FULL_DAY = { meals: 2, share: 0.5, fallbackKcal: 800 } as const;

export interface FoodDay {
  date: string;
  kcal: number;
  /** From diary entries; null when the day's total came from elsewhere (typed in, another app). */
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  meals: number;
  full: boolean;
  byMeal: Partial<Record<Meal, number>>;
}

export function fullDayFloor(calorieGoal: number | null | undefined): number {
  return calorieGoal ? Math.round(calorieGoal * FULL_DAY.share) : FULL_DAY.fallbackKcal;
}

export function foodDay(date: string, entries: FoodEntry[] | undefined, log: Pick<DailyLog, 'calories'> | undefined, calorieGoal: number | null): FoodDay | null {
  const floor = fullDayFloor(calorieGoal);
  if (entries && entries.length) {
    const t = totals(entries);
    const byMeal: Partial<Record<Meal, number>> = {};
    for (const e of entries) byMeal[e.meal] = (byMeal[e.meal] ?? 0) + (e.kcal || 0);
    const meals = mealsWithFood(entries);
    return { date, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, meals, full: t.kcal >= floor && meals >= FULL_DAY.meals, byMeal };
  }
  const kcal = typeof log?.calories === 'number' && log.calories > 0 ? log.calories : null;
  if (kcal == null) return null;
  // A total typed in or synced from another app: no meals to go on, so the amount decides.
  return { date, kcal, protein: null, carbs: null, fat: null, meals: 0, full: kcal >= floor, byMeal: {} };
}

export interface FoodWeek {
  /** Finished days in the challenge (today counts once it's over). */
  inPlay: number;
  logged: number;
  full: number;
  /** Logged but not fully. */
  part: number;
  avg: { kcal: number; protein: number | null; carbs: number | null; fat: number | null } | null;
  /** 'full': from fully logged days; 'all': none were, so from every logged day (shown with a warning). */
  basis: 'full' | 'all' | null;
  goal: number | null;
  goals: MacroGoals | null;
  /** Fully logged days with at least 90% of her protein target. */
  proteinDays: number;
  /** Fully logged days within 10% of her calorie goal. */
  onTarget: number;
  /** Average eaten − burned on fully logged days (negative = a deficit). */
  net: number | null;
  /** Average calories by meal, biggest first. */
  meals: { meal: Meal; kcal: number; share: number }[];
  /** What she logged on the most days (2+). */
  top: { name: string; count: number }[];
}

const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function inChallenge(input: Pick<ReportInput, 'summary'>): (date: string) => boolean {
  const first = input.summary.timeline[0]?.date ?? '';
  const last = input.summary.timeline[input.summary.timeline.length - 1]?.date ?? '';
  return (d) => d >= first && d <= last;
}

/** A day credited from before she started using the app: counted as full, with nothing logged. */
const credited = (t: TimelineDay | undefined, log: DailyLog | undefined) => !!t && t.state === 'complete' && !log;

export function foodWeek(dates: string[], input: ReportInput): FoodWeek {
  const { logs, entries, profile, today } = input;
  const goal = profile.calorie_goal ?? null;
  const goals = macroGoals(profile);
  const inside = inChallenge(input);
  const play = dates.filter((d) => inside(d) && d < today);
  const days = play.map((d) => foodDay(d, entries(d), logs[d], goal)).filter((x): x is FoodDay => !!x);
  const full = days.filter((x) => x.full);
  const basisDays = full.length ? full : days;
  const withMacros = basisDays.filter((x) => x.protein != null);
  const macro = (k: 'protein' | 'carbs' | 'fat') => (withMacros.length ? r1(mean(withMacros.map((x) => x[k] as number))!) : null);
  const nets = full.map((x) => x.kcal - dayEnergy(logs[x.date], bodyStats(profile, logs, x.date), { date: x.date, today }).total);

  const mealDays = basisDays.filter((x) => Object.keys(x.byMeal).length);
  const perMeal = MEAL_ORDER.map((meal) => ({ meal, kcal: Math.round(mean(mealDays.map((x) => x.byMeal[meal] ?? 0)) ?? 0) })).filter((m) => m.kcal > 0);
  const mealSum = perMeal.reduce((a, m) => a + m.kcal, 0);
  const meals = perMeal.map((m) => ({ ...m, share: mealSum ? m.kcal / mealSum : 0 })).sort((a, b) => b.kcal - a.kcal);

  const counts = new Map<string, { name: string; count: number }>();
  for (const d of play) {
    const seen = new Set<string>();
    for (const e of entries(d) ?? []) {
      const name = e.name.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const c = counts.get(key);
      if (c) c.count++;
      else counts.set(key, { name, count: 1 });
    }
  }
  const top = [...counts.values()].filter((x) => x.count >= 2).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 3);

  return {
    inPlay: play.length,
    logged: days.length,
    full: full.length,
    part: days.length - full.length,
    avg: basisDays.length ? { kcal: Math.round(mean(basisDays.map((x) => x.kcal))!), protein: macro('protein'), carbs: macro('carbs'), fat: macro('fat') } : null,
    basis: full.length ? 'full' : days.length ? 'all' : null,
    goal,
    goals,
    proteinDays: goals?.protein ? full.filter((x) => x.protein != null && x.protein >= goals.protein * 0.9).length : 0,
    onTarget: goal ? full.filter((x) => Math.abs(x.kcal - goal) <= goal * 0.1).length : 0,
    net: nets.length ? Math.round(mean(nets)!) : null,
    meals,
    top,
  };
}

// ---------------------------------------------------------------- habits

export type HabitId = TaskId | 'steps';

export interface HabitRow {
  id: HabitId;
  label: string;
  /** Monday–Sunday: done, missed, or null (outside the challenge, still to come, or today and not done yet). */
  days: (boolean | null)[];
  hit: number;
  of: number;
  /** The same row last week. */
  prev: { hit: number; of: number } | null;
}

export const HABITS: { id: TaskId; label: string }[] = [
  { id: 'workouts', label: 'Workouts' },
  { id: 'water', label: 'Water' },
  { id: 'reading', label: 'Reading' },
  { id: 'alcohol', label: 'No alcohol' },
];

function habitRows(dates: string[], input: ReportInput): HabitRow[] {
  const { logs, profile, today, summary } = input;
  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const rows: HabitRow[] = [...HABITS.map((h) => ({ ...h })), { id: 'steps' as const, label: 'Steps' }].map((h) => ({ ...h, days: [], hit: 0, of: 0, prev: null }));
  for (const d of dates) {
    const t = byDate.get(d);
    if (!t || d > today) {
      rows.forEach((r) => r.days.push(null));
      continue;
    }
    const log = logs[d];
    const statuses = taskStatuses(log, profile);
    const steps = log?.steps ?? null;
    for (const r of rows) {
      // Steps aren't one of the tasks, and a credited day has none logged: not counted either way.
      if (r.id === 'steps' && credited(t, log)) {
        r.days.push(null);
        continue;
      }
      // A full day (including a birthday pass or a day credited from before the app) has every task done.
      const done = r.id === 'steps' ? steps != null && steps >= profile.step_goal : t.state === 'complete' || !!statuses.find((s) => s.id === r.id)?.done;
      if (d === today && !done) {
        r.days.push(null);
        continue;
      }
      r.days.push(done);
      r.of++;
      if (done) r.hit++;
    }
  }
  return rows;
}

// ---------------------------------------------------------------- weight

export interface WeekWeight {
  /** 7-day average at her latest weigh-in up to the end of the week, kg. */
  end: number;
  endDate: string;
  /** Against the 7-day average a week earlier (or her first weigh-in this week), kg. */
  change: number | null;
  weighIns: number;
  /** Against her first weigh-in of the challenge (from a week before the start), kg. */
  sinceStart: number | null;
}

export function weekWeight(monday: string, input: Pick<ReportInput, 'logs' | 'start' | 'today'>): WeekWeight | null {
  const sunday = plusDays(monday, 6);
  const trend = weightTrend(weighIns(input.logs));
  const lastBy = (until: string) => {
    for (let i = trend.length - 1; i >= 0; i--) if (trend[i].date <= until) return trend[i];
    return null;
  };
  const end = lastBy(sunday < input.today ? sunday : input.today);
  if (!end) return null;
  const inWeek = trend.filter((p) => p.date >= monday && p.date <= sunday && p.date <= input.today);
  const before = lastBy(plusDays(monday, -1));
  let change: number | null = null;
  if (inWeek.length) {
    if (before && before.date >= plusDays(monday, -10)) change = end.avg - before.avg;
    else if (inWeek.length >= 2) change = end.avg - inWeek[0].kg;
  }
  const base = trend.find((p) => p.date >= plusDays(input.start, -7)) ?? null;
  return { end: end.avg, endDate: end.date, change, weighIns: inWeek.length, sinceStart: base && end.date > base.date ? end.avg - base.kg : null };
}

// ---------------------------------------------------------------- activity

export interface WeekActivity {
  steps: number;
  /** The week's step goal: her daily share for each of its challenge days (all 7 except the first and last weeks). */
  goal: number;
  /** Her daily share of the weekly step goal. */
  dayGoal: number;
  prevSteps: number | null;
  minutes: number;
  goalMinutes: number;
  prevMinutes: number | null;
  sessions: number;
  kcal: number;
  /** Her most-done activities this week, by minutes. */
  top: { name: string; minutes: number }[];
}

/** The week's days that count towards its step goal: in the challenge and not credited (nothing logged), all and up to today. */
function stepDays(dates: string[], input: ReportInput): { all: number; soFar: number } {
  const byDate = new Map(input.summary.timeline.map((t) => [t.date, t]));
  let all = 0;
  let soFar = 0;
  for (const d of dates) {
    const t = byDate.get(d);
    if (!t || credited(t, input.logs[d])) continue;
    all++;
    if (d <= input.today) soFar++;
  }
  return { all, soFar };
}

function topActivities(dates: string[], logs: Record<string, DailyLog>): { name: string; minutes: number }[] {
  const by = new Map<string, number>();
  for (const d of dates) for (const w of logs[d]?.workouts ?? []) by.set(entryName(w), (by.get(entryName(w)) ?? 0) + (w.minutes || 0));
  return [...by.entries()].map(([name, minutes]) => ({ name, minutes })).filter((x) => x.minutes > 0).sort((a, b) => b.minutes - a.minutes);
}

// ---------------------------------------------------------------- the week

export interface Highlight {
  /** What it's about, for its icon, and so two highlights never cover the same thing. */
  topic: 'weight' | 'steps' | 'workouts' | 'full' | 'tasks' | 'water' | 'reading' | 'alcohol' | 'food' | 'protein';
  text: string;
  /** A few words for the headline ("down 0.6 lb"). */
  short: string;
  score: number;
}

export interface Focus {
  area: HabitId | 'logging' | 'protein' | 'keep';
  title: string;
  text: string;
}

export interface WeekReport {
  monday: string;
  sunday: string;
  /** This week, still going. */
  current: boolean;
  recap: WeekRecap;
  headline: string;
  habits: HabitRow[];
  weight: WeekWeight | null;
  food: FoodWeek;
  activity: WeekActivity;
  highlights: Highlight[];
  focus: Focus | null;
}

interface WeekCore {
  monday: string;
  recap: WeekRecap;
  habits: HabitRow[];
  food: FoodWeek;
}

function weekCore(monday: string, input: ReportInput): WeekCore {
  const dates = weekDates(monday);
  return {
    monday,
    recap: weekRecap(monday, input.logs, input.summary, input.profile, input.today),
    habits: habitRows(dates, input),
    food: foodWeek(dates, input),
  };
}

const rate = (h: { hit: number; of: number }) => (h.of ? h.hit / h.of : 0);
const longestRun = (days: (boolean | null)[]) => {
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (d === true) best = Math.max(best, ++run);
    else if (d === false) run = 0;
  }
  return best;
};

const HABIT_WORDS: Record<HabitId, { did: string; short: string }> = {
  workouts: { did: 'Workout goal hit', short: 'workouts' },
  water: { did: 'Water goal hit', short: 'water' },
  reading: { did: 'Reading done', short: 'reading' },
  alcohol: { did: 'Alcohol-free', short: 'alcohol-free days' },
  steps: { did: 'Step goal hit', short: 'steps' },
};

function highlightsFor(core: WeekCore, prev: WeekCore | null, earlier: WeekCore[], weight: WeekWeight | null, current: boolean, unit: WeightUnit): Highlight[] {
  const { recap, habits, food } = core;
  const out: Highlight[] = [];
  const add = (h: Highlight) => out.push(h);

  if (recap.perfect) add({ topic: 'full', text: 'Every task, every day: a perfect week.', short: 'a perfect week', score: 100 });
  else if (recap.completed > 0)
    add({ topic: 'full', text: `${recap.completed} full ${plural(recap.completed, 'day')}${current ? ' so far' : ''} this week.`, short: `${recap.completed} full ${plural(recap.completed, 'day')}`, score: 30 + 6 * recap.completed });

  // Weight: the 7-day average, and only good news makes a highlight (a rise is explained in its own card).
  if (weight && weight.change != null && weight.weighIns > 0) {
    if (weight.change <= -0.09)
      add({ topic: 'weight', text: `Down ${weightAmount(weight.change, unit)} this week (7-day average).`, short: `down ${weightAmount(weight.change, unit)}`, score: Math.min(88, 72 + Math.abs(unit === 'kg' ? weight.change * 2.2 : kgToLb(weight.change)) * 5) });
    else if (weight.change < 0.09 && weight.weighIns >= 2) add({ topic: 'weight', text: 'Weight steady this week.', short: 'weight steady', score: 25 });
  }

  // Personal bests: whole weeks only, once there are two earlier weeks to beat.
  const comparable = earlier.filter((w) => w.recap.inPlay > 0);
  if (!current && recap.inPlay >= 5 && comparable.length >= 2) {
    const best = (f: (w: WeekCore) => number) => Math.max(...comparable.map(f));
    if (recap.completed >= 1 && recap.completed > best((w) => w.recap.completed))
      add({ topic: 'full', text: `Your most full days in a week: ${recap.completed}.`, short: 'your most full days yet', score: 78 });
    if (recap.taskShare >= 0.3 && recap.taskShare > best((w) => w.recap.taskShare) + 0.001)
      add({ topic: 'tasks', text: `Your best week for tasks: ${Math.round(recap.taskShare * 100)}% done.`, short: 'your best week for tasks', score: 68 });
    if (recap.steps.total > 0 && recap.steps.total > best((w) => w.recap.steps.total))
      add({ topic: 'steps', text: `Your best step week yet: ${num(recap.steps.total)} steps.`, short: 'your best step week yet', score: 70 });
    if (recap.workouts.minutes >= 60 && recap.workouts.minutes > best((w) => w.recap.workouts.minutes))
      add({ topic: 'workouts', text: `Your most workout time in a week: ${timeText(recap.workouts.minutes)}.`, short: 'your most workout time yet', score: 66 });
    if (recap.water.daysHit >= 2 && recap.water.daysHit > best((w) => w.recap.water.daysHit))
      add({ topic: 'water', text: `Your most water days in a week: ${recap.water.daysHit}.`, short: 'your best water week', score: 62 });
    if (food.logged >= 4 && food.logged > best((w) => w.food.logged))
      add({ topic: 'food', text: `Food logged on ${food.logged} days, your most yet.`, short: 'your best logging week', score: 55 });
  }

  // Better than last week (as a share of days, so a week still going compares fairly).
  if (prev && prev.recap.inPlay > 0) {
    habits.forEach((h, i) => {
      const p = prev.habits[i];
      if (!p || !h.of || !p.of) return;
      const up = current ? rate(h) - rate(p) >= 0.3 && h.hit >= 2 : h.hit - p.hit >= 2;
      if (up)
        add({
          topic: h.id,
          text: `${HABIT_WORDS[h.id].did} ${h.hit} of ${h.of} days, up from ${p.hit} of ${p.of}.`,
          short: `more ${HABIT_WORDS[h.id].short}`,
          score: 46 + 4 * Math.min(5, h.hit - p.hit),
        });
    });
    if (!current && prev.recap.steps.total > 0 && recap.steps.total >= prev.recap.steps.total * 1.1) {
      const pct = Math.round((recap.steps.total / prev.recap.steps.total - 1) * 100);
      add({ topic: 'steps', text: `Steps up ${pct}% on last week.`, short: `steps up ${pct}%`, score: 45 + Math.min(15, pct / 3) });
    }
    if (!current && recap.workouts.minutes - prev.recap.workouts.minutes >= 60 && recap.workouts.minutes >= prev.recap.workouts.minutes * 1.2)
      add({ topic: 'workouts', text: `${timeText(recap.workouts.minutes - prev.recap.workouts.minutes)} more workout time than last week.`, short: 'more workout time', score: 47 });
  }

  // Streaks inside the week.
  for (const h of habits) {
    if (h.id === 'steps') continue;
    const run = longestRun(h.days);
    if (h.of >= 5 && h.hit === h.of)
      add({ topic: h.id, text: `${h.id === 'alcohol' ? 'Alcohol-free' : `${HABIT_WORDS[h.id].did}`} every day${current ? ' so far' : ' this week'}.`, short: `${HABIT_WORDS[h.id].short} every day`, score: 58 + h.of });
    else if (run >= 4) add({ topic: h.id, text: `${HABIT_WORDS[h.id].did} ${run} days in a row.`, short: `${run}-day ${h.id === 'alcohol' ? 'alcohol-free' : HABIT_WORDS[h.id].short} streak`, score: 40 + run });
  }

  // Food: logging and protein (never "ate less").
  if (food.full >= 5) add({ topic: 'food', text: `Food fully logged on ${food.full} of ${food.inPlay} days.`, short: 'food logged all week', score: 42 });
  if (food.proteinDays >= 3 && food.goals) add({ topic: 'protein', text: `Protein goal hit on ${food.proteinDays} days.`, short: 'protein on point', score: 44 });
  if (food.onTarget >= 3 && food.goal) add({ topic: 'food', text: `Within 10% of your ${num(food.goal)} kcal goal on ${food.onTarget} days.`, short: 'calories on target', score: 43 });

  if (!out.length) {
    const done = recap.days.reduce((a, d) => a + d.done, 0);
    if (done > 0) add({ topic: 'tasks', text: `${done} ${plural(done, 'task')} ticked off${current ? ' so far' : ''}. Every one counts.`, short: `${done} tasks done`, score: 10 });
  }

  // Best first, one per topic.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((h) => (seen.has(h.topic) ? false : (seen.add(h.topic), true)))
    .slice(0, 3);
}

function headlineFor(recap: WeekRecap, highlights: Highlight[]): string {
  if (recap.perfect) return 'Perfect week!';
  const [a, b] = highlights;
  if (a && a.score >= 60) return cap(b && b.score >= 50 ? `${a.short} and ${b.short}` : a.short);
  return recap.headline;
}

const WEEKEND = (d: string) => {
  const day = parseISO(d).getDay();
  return day === 0 || day === 6;
};

function focusFor(core: WeekCore, input: ReportInput, current: boolean, everLoggedFood: boolean, span: { all: number; soFar: number }): Focus | null {
  const { recap, habits, food } = core;
  const { profile } = input;
  const dates = weekDates(core.monday);
  if (recap.inPlay < 3) return null;
  type C = { area: Focus['area']; rate: number; weight: number };
  const cands: C[] = [];
  for (const h of habits) if (h.of >= 3) cands.push({ area: h.id, rate: rate(h), weight: h.id === 'steps' ? 0 : 1 });
  // Steps are a weekly goal: judged on the total against the days so far (fewer in a week the challenge starts or ends in).
  const stepTarget = profile.step_goal * span.soFar;
  if (stepTarget > 0) cands.push({ area: 'steps', rate: recap.steps.total / stepTarget, weight: 0.6 });
  if (everLoggedFood && food.inPlay >= 3) cands.push({ area: 'logging', rate: food.full / food.inPlay, weight: 0.8 });
  if (food.full >= 3 && food.goals?.protein && food.avg?.protein != null) cands.push({ area: 'protein', rate: food.avg.protein / food.goals.protein, weight: 0.7 });
  const pick = cands.filter((c) => c.weight > 0 && c.rate < 0.8).sort((a, b) => (1 - b.rate) * b.weight - (1 - a.rate) * a.weight)[0];
  if (!pick) {
    return { area: 'keep', title: 'Keep it going', text: 'Everything was at 80% or better this week. Same again next week and the full days stack up.' };
  }
  const row = habits.find((h) => h.id === pick.area);
  const missed = row ? dates.filter((_, i) => row.days[i] === false) : [];
  const weekends = missed.filter(WEEKEND).length;
  const weekendNote = missed.length >= 2 && weekends / missed.length >= 0.6 ? ' Weekends were the hardest.' : '';
  const goalMin = workoutGoal(profile);
  switch (pick.area) {
    case 'water': {
      const goalL = profile.water_goal_ml / 1000;
      const half = Math.round(goalL) / 2;
      return {
        area: 'water',
        title: 'Water',
        text: `Goal hit ${row!.hit} of ${row!.of} days, about ${r1(recap.water.avgMl / 1000)} L a day against ${r1(goalL)} L.${weekendNote} Try ${half} L by lunch and the rest by dinner.`,
      };
    }
    case 'reading':
      return {
        area: 'reading',
        title: 'Reading',
        text: `${profile.reading_goal_pages} pages done on ${row!.hit} of ${row!.of} days.${weekendNote} That's about ${Math.max(5, Math.round((profile.reading_goal_pages * 1.5) / 5) * 5)} minutes: try them in bed before your phone.`,
      };
    case 'workouts':
      return {
        area: 'workouts',
        title: 'Workouts',
        text: `${goalMin} minutes hit on ${row!.hit} of ${row!.of} days.${weekendNote} Splitting helps: a ${Math.round(goalMin / 2)}-minute walk plus a ${Math.round(goalMin / 2)}-minute session counts.`,
      };
    case 'alcohol':
      return {
        area: 'alcohol',
        title: 'No alcohol',
        text: `Alcohol-free ${row!.hit} of ${row!.of} days.${weekendNote} Deciding your alcohol-free drink before plans makes it easier.`,
      };
    case 'steps': {
      const goal = profile.step_goal * span.all;
      const gap = Math.max(0, goal - recap.steps.total);
      if (current) {
        // Today counts: it isn't over.
        const perDay = Math.ceil(gap / Math.max(1, span.all - span.soFar + 1) / 100) * 100;
        return { area: 'steps', title: 'Steps', text: `${num(recap.steps.total)} of ${num(goal)} so far. About ${num(perDay)} a day from here gets there.` };
      }
      // About 100 steps a minute.
      const more = Math.ceil(gap / Math.max(1, span.all) / 100) * 100;
      const minutes = Math.max(5, Math.round(more / 100 / 5) * 5);
      return {
        area: 'steps',
        title: 'Steps',
        text: `${num(recap.steps.total)} of ${num(goal)} steps. About ${num(more)} more a day closes the gap: a ${minutes}-minute walk.`,
      };
    }
    case 'logging':
      return {
        area: 'logging',
        title: 'Food logging',
        text: `Food fully logged on ${food.full} of ${food.inPlay} days${food.part ? ` (${food.part} only partly)` : ''}. Logging straight after each meal keeps it quick: type it or snap a photo.`,
      };
    case 'protein':
      return {
        area: 'protein',
        title: 'Protein',
        text: `About ${Math.round(food.avg!.protein!)} g a day against ${food.goals!.protein} g. Greek yoghurt, eggs or a protein shake at breakfast adds 15 to 25 g.`,
      };
    default:
      return null;
  }
}

/** Everything in the weekly report for the Monday–Sunday week starting `monday`. */
export function weekReport(monday: string, input: ReportInput): WeekReport {
  const sunday = plusDays(monday, 6);
  const current = monday <= input.today && input.today <= sunday;
  const core = weekCore(monday, input);
  const firstMonday = mondayOf(input.start);
  const earlier: WeekCore[] = [];
  for (let m = firstMonday; m < monday; m = plusDays(m, 7)) earlier.push(weekCore(m, input));
  const prev = earlier.length ? earlier[earlier.length - 1] : null;
  if (prev) core.habits.forEach((h, i) => (h.prev = prev.habits[i] ? { hit: prev.habits[i].hit, of: prev.habits[i].of } : null));
  const weight = weekWeight(monday, input);
  const everLoggedFood = earlier.some((w) => w.food.logged > 0) || core.food.logged > 0;
  const highlights = highlightsFor(core, prev, earlier, weight, current, input.unit);
  const dates = weekDates(monday).filter((d) => d <= input.today);
  const span = stepDays(weekDates(monday), input);
  return {
    monday,
    sunday,
    current,
    recap: core.recap,
    headline: headlineFor(core.recap, highlights),
    habits: core.habits,
    weight,
    food: core.food,
    activity: {
      steps: core.recap.steps.total,
      goal: input.profile.step_goal * span.all,
      dayGoal: input.profile.step_goal,
      prevSteps: prev && prev.recap.inPlay ? prev.recap.steps.total : null,
      minutes: core.recap.workouts.minutes,
      goalMinutes: core.recap.workouts.goalMinutes,
      prevMinutes: prev && prev.recap.inPlay ? prev.recap.workouts.minutes : null,
      sessions: core.recap.workouts.sessions,
      kcal: core.recap.workouts.kcal,
      top: topActivities(dates, input.logs).slice(0, 2),
    },
    highlights,
    focus: focusFor(core, input, current, everLoggedFood, span),
  };
}

/** One line for the "Weekly report" button: last week's headline and the number that matters most. */
export function reportTeaser(r: WeekReport, unit: WeightUnit): string {
  const bits = [`${Math.round(r.recap.taskShare * 100)}% of tasks`];
  if (r.weight?.change != null && Math.abs(r.weight.change) >= 0.09) bits.push(`${r.weight.change < 0 ? 'down' : 'up'} ${weightAmount(r.weight.change, unit)}`);
  else if (r.recap.completed) bits.push(`${r.recap.completed} full ${plural(r.recap.completed, 'day')}`);
  return `${r.current ? 'This week so far' : 'Last week'}: ${bits.join(', ')}`;
}

// ---------------------------------------------------------------- the challenge so far

export interface HabitSoFar {
  id: TaskId;
  label: string;
  hit: number;
  of: number;
  rate: number;
  bestStreak: number;
  current: number;
  /** When it slips most, if clearly: a weekday ("Saturday") or "weekends". */
  slips: string | null;
}

export interface ChallengeStats {
  /** Days so far, today included. */
  days: number;
  taskShare: number;
  fullDays: number;
  streak: number;
  bestStreak: number;
  habits: HabitSoFar[];
  /** The habit that slips most when one clearly does, or the two that do (10+ points under the rest). */
  weakest: HabitSoFar[];
  /** kg; perWeek and projected need three weeks of weigh-ins. */
  weight: { start: number; now: number; change: number; perWeek: number | null; projected: number | null; finish: string } | null;
  steps: { total: number; perDay: number };
  workouts: { minutes: number; sessions: number; top: string | null };
  food: { logged: number; full: number; avgKcal: number | null; avgProtein: number | null };
  pages: number;
  /** Alcohol-free days, out of the days judged so far (the same count as the habit row). */
  soberDays: number;
  soberOf: number;
  /** Average a day over finished days. */
  water: { avgMl: number };
}

const runs = (xs: (boolean | null)[]) => {
  let best = 0;
  let run = 0;
  for (const x of xs) {
    if (x === true) best = Math.max(best, ++run);
    else if (x === false) run = 0;
  }
  return { best, current: run };
};

export function challengeStats(input: ReportInput): ChallengeStats {
  const { logs, entries, summary, profile, today, start } = input;
  const played = summary.timeline.filter((t) => t.date <= today);
  const dates = played.map((t) => t.date);
  const rows = habitRows(dates, input);
  // Today only counts once it's a full day: its tasks aren't missed yet.
  const judged = played.filter((t) => t.state !== 'today');
  const tasksDone = judged.reduce((a, t) => a + t.done, 0);
  const tasksAll = judged.reduce((a, t) => a + t.of, 0);
  const full = runs(played.map((t) => (t.state === 'complete' ? true : t.state === 'today' ? null : false)));

  const habits: HabitSoFar[] = rows
    .filter((r): r is HabitRow & { id: TaskId } => r.id !== 'steps')
    .map((r) => {
      const streak = runs(r.days);
      // Weekday it slips most: at least two of that weekday seen and 25 points under its overall rate.
      const byDay = new Map<number, { hit: number; of: number }>();
      r.days.forEach((v, i) => {
        if (v === null) return;
        const wd = parseISO(dates[i]).getDay();
        const s = byDay.get(wd) ?? { hit: 0, of: 0 };
        s.of++;
        if (v) s.hit++;
        byDay.set(wd, s);
      });
      const overall = rate(r);
      const seen = [...byDay.entries()].filter(([, s]) => s.of >= 2).map(([wd, s]) => ({ wd, r: s.hit / s.of }));
      const worst = Math.min(...seen.map((x) => x.r));
      const low = seen.filter((x) => x.r <= worst + 0.05).map((x) => x.wd);
      const slips =
        !seen.length || overall - worst < 0.25
          ? null
          : low.length === 2 && low.includes(0) && low.includes(6)
            ? 'weekends'
            : low.length === 1
              ? format(addDays(parseISO('2026-11-01'), low[0]), 'EEEE') // 1 Nov 2026 is a Sunday
              : null;
      return { id: r.id, label: r.label, hit: r.hit, of: r.of, rate: overall, bestStreak: streak.best, current: streak.current, slips };
    });
  const ranked = habits.filter((h) => h.of >= 3).sort((a, b) => a.rate - b.rate);
  const gap = (i: number) => (ranked[i + 1] ? ranked[i + 1].rate - ranked[i].rate : 0);
  const weakest = ranked.length >= 2 && gap(0) >= 0.1 ? ranked.slice(0, 1) : ranked.length >= 3 && gap(1) >= 0.1 ? ranked.slice(0, 2) : [];

  // Weight: first weigh-in from a week before the start → the latest 7-day average.
  const trend = weightTrend(weighIns(logs)).filter((p) => p.date >= plusDays(start, -7) && p.date <= today);
  let weight: ChallengeStats['weight'] = null;
  const finish = summary.finishDate;
  if (trend.length >= 2) {
    const first = trend[0];
    const last = trend[trend.length - 1];
    const days = (parseISO(last.date).getTime() - parseISO(first.date).getTime()) / 864e5;
    const perWeek = days >= 21 && trend.length >= 6 ? ((last.avg - first.kg) / days) * 7 : null;
    const toGo = (parseISO(finish).getTime() - parseISO(last.date).getTime()) / 864e5;
    weight = {
      start: first.kg,
      now: last.avg,
      change: last.avg - first.kg,
      perWeek,
      projected: perWeek != null && toGo > 0 ? last.avg + (perWeek * toGo) / 7 : null,
      finish,
    };
  }

  // Totals include today; per-day averages only use finished days (today's aren't in yet).
  let steps = 0;
  let pastSteps = 0;
  let pastStepDays = 0;
  let minutes = 0;
  let sessions = 0;
  let pages = 0;
  let water = 0;
  const finished = dates.filter((d) => d < today).length;
  for (const d of dates) {
    const l = logs[d];
    if (!l) continue;
    if (typeof l.steps === 'number') {
      steps += l.steps;
      if (d < today) {
        pastSteps += l.steps;
        pastStepDays++;
      }
    }
    for (const w of l.workouts) {
      sessions++;
      minutes += w.minutes || 0;
    }
    pages += l.pages_read || 0;
    if (d < today) water += l.water_ml || 0;
  }
  const perDay = pastStepDays ? Math.round(pastSteps / pastStepDays) : steps;
  const alcohol = rows.find((r) => r.id === 'alcohol');
  const top = topActivities(dates, logs)[0]?.name ?? null;

  const goal = profile.calorie_goal ?? null;
  const foodDays = dates.filter((d) => d < today).map((d) => foodDay(d, entries(d), logs[d], goal)).filter((x): x is FoodDay => !!x);
  const fullFood = foodDays.filter((x) => x.full);
  const protein = fullFood.filter((x) => x.protein != null).map((x) => x.protein as number);

  return {
    days: dates.length,
    taskShare: tasksAll ? tasksDone / tasksAll : 0,
    fullDays: summary.completedDays,
    streak: summary.streak,
    bestStreak: Math.max(full.best, summary.streak),
    habits,
    weakest,
    weight,
    steps: { total: steps, perDay },
    workouts: { minutes, sessions, top },
    food: {
      logged: foodDays.length,
      full: fullFood.length,
      avgKcal: fullFood.length ? Math.round(mean(fullFood.map((x) => x.kcal))!) : null,
      avgProtein: protein.length ? Math.round(mean(protein)!) : null,
    },
    pages,
    soberDays: alcohol?.hit ?? 0,
    soberOf: alcohol?.of ?? 0,
    water: { avgMl: finished ? Math.round(water / finished) : 0 },
  };
}

/** Per-day values for the week-by-week charts that need the food diary or task counts. */
export function dailySeries(input: ReportInput): { kcal: { date: string; value: number }[]; protein: { date: string; value: number }[]; water: { date: string; value: number }[]; tasks: { date: string; value: number }[] } {
  const { logs, entries, summary, profile, today } = input;
  const played = summary.timeline.filter((t) => t.date <= today);
  const kcal: { date: string; value: number }[] = [];
  const protein: { date: string; value: number }[] = [];
  const water: { date: string; value: number }[] = [];
  const tasks: { date: string; value: number }[] = [];
  for (const t of played) {
    const l = logs[t.date];
    // Today's water and tasks aren't over yet: today joins once it's done (tasks) or over (water).
    if (l && t.date < today) water.push({ date: t.date, value: (l.water_ml || 0) / 1000 });
    if (t.state !== 'today' && t.of) tasks.push({ date: t.date, value: Math.round((t.done / t.of) * 100) });
    if (t.date >= today) continue;
    const f = foodDay(t.date, entries(t.date), l, profile.calorie_goal ?? null);
    if (!f?.full) continue;
    kcal.push({ date: t.date, value: f.kcal });
    if (f.protein != null) protein.push({ date: t.date, value: f.protein });
  }
  return { kcal, protein, water, tasks };
}
