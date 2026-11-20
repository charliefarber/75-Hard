import { describe, expect, it } from 'vitest';
import { emptyLog, type DailyLog, type WorkoutEntry } from '../data/types';
import {
  activitiesBetween,
  byActivity,
  dayEffort,
  dayStreak,
  durationText,
  effectiveMinutes,
  fitnessChange,
  fitnessSeries,
  fitnessWord,
  pastWeeks,
  scoreFromLoad,
  weekStreak,
} from './fitness';
import { addDays } from './weeks';

const P = { height_cm: 165, sex: 'female' as const, birthday: '1995-01-01' };
let n = 0;
const w = (activity: string, minutes: number, intensity: WorkoutEntry['intensity'] = 'normal', name?: string): WorkoutEntry => ({ id: `w${n++}`, activity, minutes, intensity, name, kcal: null });
const day = (date: string, workouts: WorkoutEntry[]): DailyLog => ({ ...emptyLog(date), workouts });

describe('effort', () => {
  it('counts the first 45 minutes in full and tapers to nothing at 90', () => {
    expect(effectiveMinutes(30)).toBe(30);
    expect(effectiveMinutes(45)).toBe(45);
    expect(effectiveMinutes(90)).toBe(67.5);
    expect(effectiveMinutes(200)).toBe(67.5);
  });

  it('weighs minutes by how hard the activity is, and two sessions of one activity share the taper', () => {
    // Mat Pilates, normal: 3.0 METs × 45
    expect(dayEffort([w('pilates_mat', 45)])).toBeCloseTo(135);
    // Running, hard: 11.8 × 30
    expect(dayEffort([w('run', 30, 'hard')])).toBeCloseTo(354);
    // Two 45-minute walks: 90 minutes of walking counts as 67.5
    expect(dayEffort([w('walk', 45), w('walk', 45)])).toBeCloseTo(3.5 * 67.5);
    // A walk and a Pilates class each get their own 45 minutes
    expect(dayEffort([w('walk', 45), w('pilates_mat', 45)])).toBeCloseTo(3.5 * 45 + 3.0 * 45);
  });
});

describe('fitness score', () => {
  it('builds with training, fades slowly with rest, never all at once', () => {
    const logs: Record<string, DailyLog> = {};
    for (let i = 0; i < 42; i++) {
      const d = addDays('2026-10-01', i);
      logs[d] = day(d, [w('pilates_mat', 45), w('walk', 45)]);
    }
    const s = fitnessSeries(logs, '2026-12-11'); // six weeks of training, then four of rest
    expect(s[0].date).toBe('2026-10-01');
    const peak = s.find((x) => x.date === '2026-11-11')!;
    const later = s[s.length - 1];
    expect(peak.score).toBeGreaterThan(s[13].score);
    expect(peak.score).toBe(scoreFromLoad(peak.load));
    expect(later.score).toBeLessThan(peak.score);
    expect(later.score).toBeGreaterThan(peak.score / 2);
    expect(fitnessChange(s, 30)?.pts).toBeLessThan(0);
  });

  it('settles around 60 with 45 minutes of Pilates a day, and maps load to 0–100', () => {
    expect(scoreFromLoad(0)).toBe(0);
    expect(scoreFromLoad(135)).toBe(61);
    expect(scoreFromLoad(1e6)).toBe(100);
    expect([85, 65, 45, 25, 5].map(fitnessWord)).toEqual(['Peak', 'Fit', 'Steady', 'Building', 'Starting out']);
  });

  it('starts at her first workout and is empty before then', () => {
    expect(fitnessSeries({}, '2026-11-20')).toEqual([]);
    const logs = { '2026-11-18': day('2026-11-18', [w('run', 30)]) };
    expect(fitnessSeries(logs, '2026-11-20').map((x) => x.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
  });
});

describe('weeks of training', () => {
  const logs: Record<string, DailyLog> = {
    '2026-11-09': day('2026-11-09', [w('walk', 45), w('pilates_mat', 45)]),
    '2026-11-11': day('2026-11-11', [w('walk', 30)]),
    '2026-11-16': day('2026-11-16', [w('custom', 40, 'normal', 'Reformer at the studio')]),
    '2026-11-20': day('2026-11-20', [w('walk', 20)]),
  };

  it('adds up the last 12 Monday–Sunday weeks, and filters by activity', () => {
    const weeks = pastWeeks(logs, '2026-11-20', P);
    expect(weeks).toHaveLength(12);
    expect(weeks[11]).toMatchObject({ monday: '2026-11-16', minutes: 60, sessions: 2, days: 2 });
    expect(weeks[10]).toMatchObject({ monday: '2026-11-09', minutes: 120, sessions: 3, days: 2 });
    expect(weeks[10].kcal).toBeGreaterThan(0);
    expect(weeks[0].monday).toBe('2026-08-31');
    const walks = pastWeeks(logs, '2026-11-20', P, 12, byActivity('walking'));
    expect(walks.slice(-2).map((x) => x.minutes)).toEqual([75, 20]);
  });

  it('lists her activities by time, with her own names for custom ones', () => {
    expect(activitiesBetween(logs, '2026-08-31', '2026-11-20')).toEqual([
      { key: 'walking', name: 'Walking', minutes: 95 },
      { key: 'mat pilates', name: 'Mat Pilates', minutes: 45 },
      { key: 'reformer at the studio', name: 'Reformer at the studio', minutes: 40 },
    ]);
  });
});

describe('streaks', () => {
  it('counts weeks in a row with a workout; this week keeps it alive until it ends', () => {
    const logs: Record<string, DailyLog> = {};
    for (const d of ['2026-10-28', '2026-11-03', '2026-11-12']) logs[d] = day(d, [w('walk', 30)]);
    // weeks of 26 Oct, 2 Nov and 9 Nov trained; this week (16 Nov) not yet
    expect(weekStreak(logs, '2026-11-18')).toEqual({ weeks: 3, thisWeek: false });
    logs['2026-11-17'] = day('2026-11-17', [w('run', 20)]);
    expect(weekStreak(logs, '2026-11-18')).toEqual({ weeks: 4, thisWeek: true });
  });

  it('counts days in a row up to today, or yesterday while today is still empty', () => {
    const logs: Record<string, DailyLog> = {};
    for (const d of ['2026-11-17', '2026-11-18', '2026-11-19']) logs[d] = day(d, [w('walk', 30)]);
    expect(dayStreak(logs, '2026-11-20')).toBe(3);
    logs['2026-11-20'] = day('2026-11-20', [w('walk', 30)]);
    expect(dayStreak(logs, '2026-11-20')).toBe(4);
    expect(dayStreak(logs, '2026-11-22')).toBe(0);
  });

  it('reads time the way a watch does', () => {
    expect([0, 27, 60, 281, 600].map(durationText)).toEqual(['0m', '27m', '1h', '4h 41m', '10h']);
  });
});
