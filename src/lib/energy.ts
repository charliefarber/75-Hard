import type { DailyLog, Intensity } from '../data/types';
import { workoutGoal } from '../data/types';
import { activeKcal, estimateKcal, FALLBACK_WEIGHT_KG, intensityIndex, restingKcalPerDay, type BodyStats } from './activities';
import { entryKcal } from './body';

/**
 * Calories burned in a day, without a watch:
 *   resting   what her body burns anyway (Mifflin-St Jeor from weight, height, age, sex;
 *             about 22 kcal per kg if those aren't filled in). For today, only the part of the
 *             day that has passed, so the numbers are true right now.
 *   workouts  the active calories of each logged workout
 *   steps     everyday walking from her step count, minus the steps her walks and runs
 *             already account for, so nothing is counted twice
 *   total     resting + workouts + steps; net = eaten − total
 */

/** Steps a phone counts per minute during these workouts (light, normal, hard). */
const STEPS_PER_MIN: Record<string, [number, number, number]> = {
  walk: [95, 110, 125],
  dog_walk: [85, 95, 105],
  walk_hill: [95, 105, 115],
  hike: [90, 100, 110],
  treadmill_walk: [95, 110, 125],
  incline_walk: [100, 110, 120],
  run: [155, 162, 170],
  treadmill_run: [155, 162, 170],
  trail_run: [150, 158, 165],
  sprints: [140, 150, 160],
  stairs: [80, 90, 100],
  stair_stepper: [70, 80, 90],
  treadmill_class: [130, 145, 160],
  golf: [45, 50, 55],
};

/** Everyday walking: about 3 mph, 110 steps a minute, 3.5 METs. */
const WALK_CADENCE = 110;
const WALK_MET = 3.5;
/** Resting burn per kg per day when height, age or sex is missing. */
const REST_PER_KG = 22;

export interface Energy {
  /** Resting calories so far today (or the whole day for past days). */
  resting: number;
  restingDay: number;
  workouts: number;
  /** Active calories from steps outside workouts. */
  steps: number;
  /** Steps that counted towards `steps` (total minus workout steps). */
  stepsCounted: number;
  workoutSteps: number;
  active: number;
  total: number;
  eaten: number | null;
  /** eaten − total (negative = deficit). */
  net: number | null;
  /** It's today: resting is only the time that has passed. */
  partial: boolean;
  /** Resting burn is a rough figure (her height, age or sex are missing). */
  approx: boolean;
}

const minutesIntoDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function workoutSteps(workouts: DailyLog['workouts']): number {
  return Math.round(
    workouts.reduce((a, w) => {
      const r = STEPS_PER_MIN[w.activity];
      return a + (r ? r[intensityIndex(w.intensity as Intensity)] * (w.minutes || 0) : 0);
    }, 0),
  );
}

/** Active calories from everyday steps. */
export function stepKcal(steps: number, body: BodyStats): number {
  return activeKcal(WALK_MET, Math.max(0, steps) / WALK_CADENCE, body);
}

export function restingDay(body: BodyStats): { kcal: number; approx: boolean } {
  const kg = body.weightKg || FALLBACK_WEIGHT_KG;
  const rmr = restingKcalPerDay({ ...body, weightKg: kg });
  return rmr ? { kcal: Math.round(rmr), approx: false } : { kcal: Math.round(REST_PER_KG * kg), approx: true };
}

export function dayEnergy(
  log: Pick<DailyLog, 'workouts' | 'steps' | 'calories'> | undefined,
  body: BodyStats,
  when: { date: string; today: string; now?: Date },
): Energy {
  const rest = restingDay(body);
  const partial = when.date === when.today;
  const share = when.date > when.today ? 0 : partial ? minutesIntoDay(when.now ?? new Date()) / 1440 : 1;
  const resting = Math.round(rest.kcal * share);
  const list = log?.workouts ?? [];
  const workouts = Math.round(list.reduce((a, w) => a + entryKcal(w, body), 0));
  const wSteps = workoutSteps(list);
  const stepsCounted = Math.max(0, (log?.steps ?? 0) - wSteps);
  const steps = stepKcal(stepsCounted, body);
  const active = workouts + steps;
  const total = resting + active;
  const eaten = typeof log?.calories === 'number' ? log.calories : null;
  return {
    resting,
    restingDay: rest.kcal,
    workouts,
    steps,
    stepsCounted,
    workoutSteps: wSteps,
    active,
    total,
    eaten,
    net: eaten == null ? null : eaten - total,
    partial,
    approx: rest.approx,
  };
}

/** A sensible daily active-calorie target: her workout goal at normal effort plus her daily steps. */
export function defaultActiveGoal(
  profile: { workout_goal_minutes?: number; workout_minutes: number; step_goal: number },
  body: BodyStats,
): number {
  const kcal = estimateKcal('workout', 'normal', workoutGoal(profile), body) + stepKcal(profile.step_goal, body);
  return Math.max(100, Math.round(kcal / 50) * 50);
}
