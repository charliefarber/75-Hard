import { describe, expect, it } from 'vitest';
import type { WorkoutEntry } from '../data/types';
import type { BodyStats } from './activities';
import { dayEnergy, defaultActiveGoal, restingDay, stepKcal, workoutSteps } from './energy';

const sierra: BodyStats = { weightKg: 64, heightCm: 168, ageYears: 30, sex: 'female' };
const run = (minutes: number, intensity: WorkoutEntry['intensity'] = 'normal'): WorkoutEntry => ({ id: 'r', activity: 'run', minutes, intensity, kcal: null, source: 'manual' });
const reformer = (minutes: number): WorkoutEntry => ({ id: 'p', activity: 'reformer', minutes, intensity: 'normal', kcal: null, source: 'manual' });

describe('resting burn', () => {
  it('uses Mifflin-St Jeor when she’s filled in her details', () => {
    // 10 × 64 + 6.25 × 168 − 5 × 30 − 161
    expect(restingDay(sierra)).toEqual({ kcal: 1379, approx: false });
  });
  it('falls back to a rough per-kg figure', () => {
    expect(restingDay({ weightKg: 64, heightCm: null, ageYears: null, sex: null })).toEqual({ kcal: 1408, approx: true });
  });
});

describe('steps', () => {
  it('counts the steps already inside walks and runs', () => {
    expect(workoutSteps([run(30), reformer(45)])).toBe(4860);
  });
  it('turns everyday steps into active calories', () => {
    const k = stepKcal(10000, sierra);
    expect(k).toBeGreaterThan(250);
    expect(k).toBeLessThan(400);
    expect(stepKcal(0, sierra)).toBe(0);
    expect(stepKcal(-50, sierra)).toBe(0);
  });
});

describe('a day', () => {
  it('adds resting, workouts and steps without counting the run’s steps twice', () => {
    const e = dayEnergy({ workouts: [run(30)], steps: 8432, calories: 1650 }, sierra, { date: '2026-10-12', today: '2026-10-13' });
    expect(e.partial).toBe(false);
    expect(e.resting).toBe(1379);
    expect(e.workoutSteps).toBe(4860);
    expect(e.stepsCounted).toBe(3572);
    expect(e.steps).toBe(stepKcal(3572, sierra));
    expect(e.active).toBe(e.workouts + e.steps);
    expect(e.total).toBe(e.resting + e.active);
    expect(e.net).toBe(1650 - e.total);
  });

  it('only counts the part of today that has passed', () => {
    const noon = new Date(2026, 9, 13, 12, 0);
    const e = dayEnergy({ workouts: [], steps: null, calories: null }, sierra, { date: '2026-10-13', today: '2026-10-13', now: noon });
    expect(e.partial).toBe(true);
    expect(e.resting).toBe(Math.round(1379 / 2));
    expect(e.restingDay).toBe(1379);
    expect(e.eaten).toBeNull();
    expect(e.net).toBeNull();
  });

  it('nothing burned yet for a future day', () => {
    expect(dayEnergy(undefined, sierra, { date: '2026-10-14', today: '2026-10-13' }).total).toBe(0);
  });

  it('when the workout covers more steps than she took, steps add nothing', () => {
    const e = dayEnergy({ workouts: [run(60)], steps: 5000, calories: 0 }, sierra, { date: '2026-10-12', today: '2026-10-13' });
    expect(e.stepsCounted).toBe(0);
    expect(e.steps).toBe(0);
  });
});

describe('active goal', () => {
  it('comes from her workout and step goals, rounded to 50', () => {
    const g = defaultActiveGoal({ workout_minutes: 45, workout_goal_minutes: 90, step_goal: 10000 }, sierra);
    expect(g % 50).toBe(0);
    expect(g).toBeGreaterThan(400);
    expect(g).toBeLessThan(1000);
  });
});
