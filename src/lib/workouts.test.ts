import { describe, expect, it } from 'vitest';
import { emptyLog, type DailyLog, type WorkoutFavorite } from '../data/types';
import { barSegments, favoriteName, formatMinutes, recentWorkouts, toggleFavorite, MAX_FAVORITES } from './workouts';

const day = (date: string, workouts: DailyLog['workouts']): DailyLog => ({ ...emptyLog(date), workouts });

describe('favourites', () => {
  const reformer: WorkoutFavorite = { activity: 'pilates_reformer', minutes: 45, intensity: 'normal' };

  it('adds, and removes the exact same favourite on a second tap', () => {
    const one = toggleFavorite([], reformer);
    expect(one).toEqual([reformer]);
    expect(toggleFavorite(one, { ...reformer })).toEqual([]);
  });

  it('keeps different lengths or efforts of the same workout as separate favourites', () => {
    const list = toggleFavorite(toggleFavorite([], reformer), { ...reformer, minutes: 30 });
    expect(list).toHaveLength(2);
    expect(toggleFavorite(list, { ...reformer, intensity: 'hard' })).toHaveLength(3);
  });

  it('keeps her own name for custom workouts, and caps the list', () => {
    const custom = toggleFavorite([], { activity: 'custom', name: 'Sculpt', minutes: 50, intensity: 'hard' });
    expect(favoriteName(custom[0])).toBe('Sculpt');
    let many: WorkoutFavorite[] = [];
    for (let m = 1; m <= MAX_FAVORITES + 3; m++) many = toggleFavorite(many, { ...reformer, minutes: m });
    expect(many).toHaveLength(MAX_FAVORITES);
    expect(many[many.length - 1].minutes).toBe(MAX_FAVORITES + 3);
  });

  it('names library workouts from the library', () => {
    expect(favoriteName({ activity: 'stair_stepper' })).toBe('Stair stepper / StairMaster');
  });
});

describe('recentWorkouts', () => {
  it('lists distinct workouts newest first with the settings used last time', () => {
    const logs = {
      '2026-10-10': day('2026-10-10', [
        { id: 'a', activity: 'weights', minutes: 30, intensity: 'hard' },
        { id: 'b', activity: 'pilates_reformer', minutes: 45, intensity: 'normal' },
      ]),
      '2026-10-11': day('2026-10-11', [{ id: 'c', activity: 'weights', minutes: 40, intensity: 'normal' }]),
      '2026-10-12': day('2026-10-12', [{ id: 'd', activity: 'workout', minutes: 90, intensity: 'normal' }]), // "tick everything off"
    };
    const r = recentWorkouts(logs, '2026-10-12');
    expect(r.map((x) => x.activity)).toEqual(['weights', 'pilates_reformer']);
    expect(r[0]).toMatchObject({ minutes: 40, intensity: 'normal' });
    expect(recentWorkouts(logs, '2026-10-10').map((x) => x.activity)).toEqual(['pilates_reformer', 'weights']);
  });
});

describe('progress bar', () => {
  it('splits the bar by workout until the goal, then fits everything in', () => {
    const e = [
      { id: 'a', minutes: 45 },
      { id: 'b', minutes: 30 },
    ];
    expect(barSegments(e, 90).map((s) => Math.round(s.pct))).toEqual([50, 33]);
    expect(barSegments([...e, { id: 'c', minutes: 45 }], 90).reduce((a, s) => a + s.pct, 0)).toBeCloseTo(100);
  });

  it('formats minutes as hours', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(90)).toBe('1 h 30 min');
    expect(formatMinutes(120)).toBe('2 h');
  });
});
