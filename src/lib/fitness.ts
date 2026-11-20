import type { DailyLog, Profile, WorkoutEntry } from '../data/types';
import { activityById, intensityIndex } from './activities';
import { bodyStats, entryKcal, entryName } from './body';
import { mondayOf } from './recap';
import { addDays } from './weeks';

/**
 * Fitness and weekly training, from the workouts she logs by hand (no watch, no heart rate).
 *
 * The fitness score is the Sweatpets "condition" model, which is the idea behind Strava's Fitness:
 *   - a day's effort = how hard the activity is (its MET at the effort she picked) × the minutes
 *     that count. The first 45 minutes of an activity in a day count in full, then each minute
 *     counts for less, down to nothing at 90, so one very long session can't stand in for a week.
 *   - training load = a 42-day exponentially weighted average of daily effort: it builds over
 *     about six weeks of steady training and fades slowly on rest days, never all at once.
 *   - the score maps load onto 0–100: 100 × (1 − e^(−load / 144)). About 45 minutes of steady
 *     Pilates every day settles around 60; two solid sessions a day around 85.
 */
export const FITNESS = { days: 42, scale: 144, fullMinutes: 45, capMinutes: 90 } as const;

/** Minutes that count, out of `m` minutes of one activity in a day. */
export function effectiveMinutes(m: number): number {
  const F = FITNESS.fullMinutes;
  const T = FITNESS.capMinutes - F;
  if (m <= 0) return 0;
  if (m <= F) return m;
  const x = Math.min(m, FITNESS.capMinutes) - F;
  return F + x - (x * x) / (2 * T);
}

const activityKey = (w: Pick<WorkoutEntry, 'activity' | 'name'>) => entryName(w).trim().toLowerCase();

/** A day's training effort (MET-minutes that count). Two sessions of the same activity share its taper. */
export function dayEffort(workouts: WorkoutEntry[]): number {
  const before = new Map<string, number>();
  let effort = 0;
  for (const w of workouts) {
    const minutes = Math.max(0, w.minutes || 0);
    if (!minutes) continue;
    const key = activityKey(w);
    const prior = before.get(key) ?? 0;
    before.set(key, prior + minutes);
    effort += activityById(w.activity).met[intensityIndex(w.intensity)] * (effectiveMinutes(prior + minutes) - effectiveMinutes(prior));
  }
  return effort;
}

export const scoreFromLoad = (load: number) => Math.round(100 * (1 - Math.exp(-Math.max(0, load) / FITNESS.scale)));

/** Plain words for the score. Kind on the way back from a break: "Building", never "out of shape". */
export function fitnessWord(score: number): string {
  if (score >= 80) return 'Peak';
  if (score >= 60) return 'Fit';
  if (score >= 40) return 'Steady';
  if (score >= 20) return 'Building';
  return 'Starting out';
}

export interface FitnessDay {
  date: string;
  effort: number;
  load: number;
  score: number;
}

function firstWorkoutDate(logs: Record<string, DailyLog>): string | null {
  let first: string | null = null;
  for (const [date, l] of Object.entries(logs)) if (l.workouts?.length && (!first || date < first)) first = date;
  return first;
}

/** One point a day, from her first logged workout to `to` (today's workouts count as soon as they're logged). */
export function fitnessSeries(logs: Record<string, DailyLog>, to: string): FitnessDay[] {
  const start = firstWorkoutDate(logs);
  if (!start || start > to) return [];
  const out: FitnessDay[] = [];
  let load = 0;
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const effort = dayEffort(logs[d]?.workouts ?? []);
    load += (effort - load) / FITNESS.days;
    out.push({ date: d, effort, load, score: scoreFromLoad(load) });
  }
  return out;
}

/** Points gained (or lost) over the last `days` days, against the start of the series if it's shorter. */
export function fitnessChange(series: FitnessDay[], days: number): { pts: number; from: string } | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const from = series[Math.max(0, series.length - 1 - days)];
  return { pts: last.score - from.score, from: from.date };
}

// ---------------------------------------------------------------- weeks of training

export interface WeekTraining {
  monday: string;
  minutes: number;
  sessions: number;
  /** Estimated active calories. */
  kcal: number;
  /** Days with at least one session. */
  days: number;
}

export type WorkoutFilter = (w: WorkoutEntry) => boolean;
export const allWorkouts: WorkoutFilter = () => true;
/** Sessions of one activity, by the name she sees ("Walking", or her own name for a custom one). */
export const byActivity = (key: string): WorkoutFilter => (w) => activityKey(w) === key;

export function weekTraining(
  logs: Record<string, DailyLog>,
  monday: string,
  profile: Pick<Profile, 'height_cm' | 'sex' | 'birthday'>,
  filter: WorkoutFilter = allWorkouts,
): WeekTraining {
  const out: WeekTraining = { monday, minutes: 0, sessions: 0, kcal: 0, days: 0 };
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const list = (logs[date]?.workouts ?? []).filter(filter);
    if (!list.length) continue;
    out.days++;
    const body = bodyStats(profile, logs, date);
    for (const w of list) {
      out.sessions++;
      out.minutes += w.minutes || 0;
      out.kcal += entryKcal(w, body);
    }
  }
  out.kcal = Math.round(out.kcal);
  return out;
}

/** The last `n` Monday–Sunday weeks, oldest first, ending with this week. */
export function pastWeeks(
  logs: Record<string, DailyLog>,
  today: string,
  profile: Pick<Profile, 'height_cm' | 'sex' | 'birthday'>,
  n = 12,
  filter: WorkoutFilter = allWorkouts,
): WeekTraining[] {
  const thisMonday = mondayOf(today);
  return Array.from({ length: n }, (_, i) => weekTraining(logs, addDays(thisMonday, (i - n + 1) * 7), profile, filter));
}

/** Her activities over a span, by total minutes, for the filter chips. */
export function activitiesBetween(logs: Record<string, DailyLog>, from: string, to: string): { key: string; name: string; minutes: number }[] {
  const by = new Map<string, { key: string; name: string; minutes: number }>();
  for (const [date, l] of Object.entries(logs)) {
    if (date < from || date > to) continue;
    for (const w of l.workouts ?? []) {
      const key = activityKey(w);
      const a = by.get(key);
      if (a) a.minutes += w.minutes || 0;
      else by.set(key, { key, name: entryName(w), minutes: w.minutes || 0 });
    }
  }
  return [...by.values()].filter((a) => a.minutes > 0).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- streaks

const trained = (logs: Record<string, DailyLog>, date: string) => (logs[date]?.workouts ?? []).some((w) => (w.minutes || 0) > 0);

/**
 * Weeks in a row with at least one workout. This week keeps the streak alive until it's over:
 * with nothing logged yet, the run is counted up to last week.
 */
export function weekStreak(logs: Record<string, DailyLog>, today: string): { weeks: number; thisWeek: boolean } {
  const weekTrained = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)).some((d) => d <= today && trained(logs, d));
  let monday = mondayOf(today);
  const thisWeek = weekTrained(monday);
  if (!thisWeek) monday = addDays(monday, -7);
  let weeks = 0;
  while (weekTrained(monday) && weeks < 520) {
    weeks++;
    monday = addDays(monday, -7);
  }
  return { weeks, thisWeek };
}

/** Days in a row with a workout, up to today (or yesterday, while today has none yet). */
export function dayStreak(logs: Record<string, DailyLog>, today: string): number {
  let d = trained(logs, today) ? today : addDays(today, -1);
  let days = 0;
  while (trained(logs, d) && days < 3650) {
    days++;
    d = addDays(d, -1);
  }
  return days;
}

/** "4h 41m", "27m", "0m": the way training time reads on a watch. */
export function durationText(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}
