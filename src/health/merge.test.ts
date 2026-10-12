import { describe, expect, it } from 'vitest';
import { mergeHealthDay } from './merge';
import { emptyLog } from '../data/types';

const p = { workout_minutes: 45 };

describe('mergeHealthDay', () => {
  it('fills steps, Lifesum calories and water', () => {
    const out = mergeHealthDay(emptyLog('2026-10-11'), { date: '2026-10-11', steps: 8412, calories: 1420, waterMl: 2000, workouts: [] }, p);
    expect(out).toMatchObject({ steps: 8412, steps_source: 'health', calories: 1420, calories_source: 'health', water_ml: 2000 });
  });

  it('keeps a calorie number typed by hand', () => {
    const log = { ...emptyLog('2026-10-11'), calories: 1600, calories_source: 'manual' as const };
    expect(mergeHealthDay(log, { date: '2026-10-11', calories: 1420, workouts: [] }, p).calories).toBe(1600);
  });

  it('never lowers steps or water', () => {
    const log = { ...emptyLog('2026-10-11'), steps: 12000, water_ml: 3000 };
    const out = mergeHealthDay(log, { date: '2026-10-11', steps: 9000, waterMl: 1000, workouts: [] }, p);
    expect(out.steps).toBe(12000);
    expect(out.water_ml).toBe(3000);
  });

  it('adds each Health workout once, any length', () => {
    const h = {
      date: '2026-10-11',
      workouts: [
        { type: 'Running', minutes: 52, outdoor: true, start: '2026-10-11T07:00:00Z' },
        { type: 'Yoga', minutes: 20, outdoor: false, start: '2026-10-11T12:00:00Z' },
      ],
    };
    const once = mergeHealthDay(emptyLog('2026-10-11'), h, p);
    expect(once.workouts).toHaveLength(2);
    expect(once.workouts[0]).toMatchObject({ activity: 'run', minutes: 52, source: 'health', healthId: '2026-10-11T07:00:00Z' });
    expect(once.workouts[1]).toMatchObject({ activity: 'yoga_vinyasa', minutes: 20 });
    const twice = mergeHealthDay(once, h, p);
    expect(twice.workouts).toHaveLength(2);
  });
});
