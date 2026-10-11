import type { DailyLog, Profile } from '../data/types';
import type { HealthDay } from './health';

/**
 * Fold one day of Apple Health data into a log. Rules:
 *  - steps: take the higher number (steps only go up through the day)
 *  - calories: Apple Health (i.e. Lifesum) wins unless she typed a number by hand
 *  - water: take the higher number (in-app taps vs. water logged in Lifesum)
 *  - workouts: fill empty slots with Health workouts that meet the minimum length
 */
export function mergeHealthDay(log: DailyLog, h: HealthDay, profile: Pick<Profile, 'workout_minutes'>): DailyLog {
  const next: DailyLog = { ...log, workouts: log.workouts.map((w) => ({ ...w })) };

  if (h.steps !== undefined && h.steps > (log.steps ?? -1)) {
    next.steps = h.steps;
    next.steps_source = 'health';
  }

  if (h.calories !== undefined && log.calories_source !== 'manual' && h.calories !== log.calories) {
    next.calories = h.calories;
    next.calories_source = 'health';
  }

  if (h.waterMl !== undefined && h.waterMl > log.water_ml) {
    next.water_ml = h.waterMl;
  }

  const eligible = h.workouts
    .filter((w) => w.minutes >= profile.workout_minutes)
    .sort((a, b) => a.start.localeCompare(b.start));

  for (const hw of eligible) {
    const existing = next.workouts.find((w) => w.healthId === hw.start);
    if (existing) {
      existing.minutes = hw.minutes;
      continue;
    }
    const slot = next.workouts.find((w) => !w.done);
    if (!slot) break;
    Object.assign(slot, { done: true, minutes: hw.minutes, type: hw.type, outdoor: hw.outdoor, source: 'health', healthId: hw.start });
  }

  return next;
}

export function logsDiffer(a: DailyLog, b: DailyLog): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
