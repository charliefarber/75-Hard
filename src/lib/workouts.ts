import type { DailyLog, Intensity, WorkoutEntry, WorkoutFavorite } from '../data/types';
import { activityById, CUSTOM_ID } from './activities';

/** Shown first in the picker: what most people log. */
export const POPULAR = [
  'pilates_reformer',
  'weights',
  'stair_stepper',
  'walk',
  'incline_walk',
  'run',
  'spin',
  'hiit',
  'barre',
  'yoga_vinyasa',
  'pilates_mat',
  'elliptical',
  'hike',
  'cycle_road',
  'swim_laps',
  'circuit',
];

export const MAX_FAVORITES = 12;

export const favoriteName = (f: Pick<WorkoutFavorite, 'activity' | 'name'>) =>
  f.name || (f.activity === CUSTOM_ID ? 'Custom workout' : activityById(f.activity).name);

export const sameFavorite = (a: WorkoutFavorite, b: WorkoutFavorite) =>
  a.activity === b.activity && (a.name || '') === (b.name || '') && a.minutes === b.minutes && a.intensity === b.intensity;

/** Add the favourite, or take it away if it's already saved (exact same activity, length and effort). */
export function toggleFavorite(list: WorkoutFavorite[], fav: WorkoutFavorite): WorkoutFavorite[] {
  const clean: WorkoutFavorite = { activity: fav.activity, minutes: fav.minutes, intensity: fav.intensity };
  if (fav.name) clean.name = fav.name;
  if (list.some((f) => sameFavorite(f, clean))) return list.filter((f) => !sameFavorite(f, clean));
  return [...list, clean].slice(-MAX_FAVORITES);
}

export interface RecentWorkout {
  activity: string;
  name?: string;
  minutes: number;
  intensity: Intensity;
}

/** Her most recent distinct workouts (newest first), with the length and effort she used last time. */
export function recentWorkouts(logs: Record<string, DailyLog>, onOrBefore: string, limit = 6): RecentWorkout[] {
  const out: RecentWorkout[] = [];
  const seen = new Set<string>();
  const days = Object.values(logs)
    .filter((l) => l.log_date <= onOrBefore && l.workouts.length)
    .sort((a, b) => b.log_date.localeCompare(a.log_date));
  for (const day of days) {
    for (const w of [...day.workouts].reverse()) {
      // Untouched Apple Health imports and "tick everything off" days aren't real picks.
      if (w.activity === 'workout' && !w.name) continue;
      const key = `${w.activity}|${w.name ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ activity: w.activity, name: w.name, minutes: w.minutes, intensity: w.intensity });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export const newEntryId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

/** 45 → "45 min", 90 → "1 h 30 min", 120 → "2 h". */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/**
 * Widths (in % of the bar) for each logged workout. Until the goal is met the bar is the goal;
 * past it, everything shrinks to fit so the bar is simply full.
 */
export function barSegments(entries: Pick<WorkoutEntry, 'id' | 'minutes'>[], goal: number): { id: string; pct: number }[] {
  const total = entries.reduce((a, w) => a + Math.max(0, w.minutes), 0);
  const scale = Math.max(goal, total) || 1;
  return entries.filter((w) => w.minutes > 0).map((w) => ({ id: w.id, pct: (w.minutes / scale) * 100 }));
}
