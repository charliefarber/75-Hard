import type { DailyLog, Profile } from '../data/types';
import type { HealthDay } from './health';

// Apple Health workout names (as prettified in health.ts) to our activity library.
const HEALTH_ACTIVITY: Record<string, string> = {
  strength: 'weights', hiit: 'hiit', cardio: 'circuit', core: 'core', 'treadmill run': 'treadmill_run', 'indoor cycle': 'exercise_bike',
  running: 'run', walking: 'walk', hiking: 'hike', cycling: 'cycle_road', swimming: 'swim_laps', yoga: 'yoga_vinyasa', pilates: 'pilates_mat',
  barre: 'barre', 'stair climbing': 'stair_stepper', stairs: 'stairs', elliptical: 'elliptical', rowing: 'row_machine', dance: 'dance',
  'cardio dance': 'zumba', boxing: 'boxing_bag', kickboxing: 'muay_thai', 'martial arts': 'karate', tennis: 'tennis', 'jump rope': 'jump_rope',
  'cross training': 'circuit', 'mind and body': 'stretching', flexibility: 'stretching', cooldown: 'stretching', climbing: 'climbing',
};

/**
 * Fold one day of Apple Health data into a log. Rules:
 *  - steps: take the higher number (steps only go up through the day)
 *  - calories: Apple Health (i.e. Lifesum) wins unless she typed a number by hand
 *  - water: take the higher number (in-app taps vs. water logged in Lifesum)
 *  - workouts: add each Health workout once (any length counts towards the daily minutes)
 */
export function mergeHealthDay(log: DailyLog, h: HealthDay, _profile?: Pick<Profile, 'workout_minutes'>): DailyLog {
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

  for (const hw of [...h.workouts].sort((a, b) => a.start.localeCompare(b.start))) {
    if (!(hw.minutes > 0)) continue;
    const existing = next.workouts.find((w) => w.healthId === hw.start);
    if (existing) {
      existing.minutes = hw.minutes;
      continue;
    }
    next.workouts.push({
      id: `hk-${hw.start}`,
      activity: HEALTH_ACTIVITY[hw.type.toLowerCase()] ?? 'workout',
      name: HEALTH_ACTIVITY[hw.type.toLowerCase()] ? undefined : hw.type,
      minutes: hw.minutes,
      intensity: 'normal',
      kcal: null,
      source: 'health',
      healthId: hw.start,
    });
  }

  return next;
}

export function logsDiffer(a: DailyLog, b: DailyLog): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
