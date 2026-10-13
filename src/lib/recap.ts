import { addDays, parseISO, startOfWeek } from 'date-fns';
import type { DailyLog, Profile } from '../data/types';
import { workoutGoal } from '../data/types';
import { bodyStats, dayBurned } from './body';
import type { ChallengeSummary, DayState } from './challenge';
import { toISODate } from './challenge';

export interface RecapDay {
  date: string;
  /** null = outside the challenge (before the start, or still to come). */
  state: DayState | null;
  /** Tasks done that day, out of `of`. */
  done: number;
  of: number;
}

export interface WeekRecap {
  monday: string;
  sunday: string;
  days: RecapDay[];
  /** Days of this week that were part of the challenge and have happened. */
  inPlay: number;
  completed: number;
  perfect: boolean;
  steps: { total: number; goal: number; bestDay: string | null; bestSteps: number };
  water: { avgMl: number; daysHit: number };
  /** Workout minutes this week vs. what the daily goal adds up to, and active calories burned. */
  workouts: { minutes: number; goalMinutes: number; kcal: number; sessions: number };
  readingDays: number;
  /** Days with no alcohol. */
  soberDays: number;
  /** Average calories eaten on days with food logged, and how many days had any. */
  eaten: { avg: number; days: number };
  /** Share of all the week's tasks that got done, 0–1. */
  taskShare: number;
  /** Full days in the challenge by the end of this week. */
  totalCompleted: number;
  headline: string;
}

export const mondayOf = (iso: string) => toISODate(startOfWeek(parseISO(iso), { weekStartsOn: 1 }));

export function weekRecap(
  monday: string,
  logs: Record<string, DailyLog>,
  summary: ChallengeSummary,
  profile: Pick<Profile, 'step_goal' | 'water_goal_ml' | 'workout_minutes' | 'reading_goal_pages'> &
    Partial<Pick<Profile, 'workout_goal_minutes' | 'height_cm' | 'sex' | 'birthday'>>,
  today: string,
): WeekRecap {
  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const dates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(parseISO(monday), i)));
  const days: RecapDay[] = dates.map((date) => {
    const t = byDate.get(date);
    return t && date <= today ? { date, state: t.state, done: t.done, of: t.of } : { date, state: null, done: 0, of: 0 };
  });
  const played = dates.filter((_, i) => days[i].state !== null);
  const inPlay = played.length;
  const completed = days.filter((d) => d.state === 'complete').length;

  let total = 0;
  let bestDay: string | null = null;
  let bestSteps = 0;
  let waterSum = 0;
  let waterHit = 0;
  let sessions = 0;
  let minutes = 0;
  let kcal = 0;
  let readingDays = 0;
  let soberDays = 0;
  let eatenSum = 0;
  let eatenDays = 0;
  for (const d of played) {
    const l = logs[d];
    if (!l) continue;
    const s = l.steps ?? 0;
    total += s;
    if (s > bestSteps) {
      bestSteps = s;
      bestDay = d;
    }
    waterSum += l.water_ml;
    if (l.water_ml >= profile.water_goal_ml) waterHit++;
    for (const w of l.workouts) {
      sessions++;
      minutes += w.minutes || 0;
    }
    kcal += dayBurned(l, bodyStats(profile, logs, d));
    if (l.pages_read >= profile.reading_goal_pages) readingDays++;
    if (l.no_alcohol) soberDays++;
    if (l.calories && l.calories > 0) {
      eatenSum += l.calories;
      eatenDays++;
    }
  }

  const totalCompleted = summary.timeline.filter((t) => t.date <= dates[6] && t.date <= today && t.state === 'complete').length;

  const perfect = inPlay === 7 && completed === 7;
  const tasksDone = days.reduce((a, x) => a + x.done, 0);
  const tasksAll = days.reduce((a, x) => a + x.of, 0);
  const taskShare = tasksAll ? tasksDone / tasksAll : 0;
  const headline = perfect
    ? 'Perfect week!'
    : taskShare >= 0.8
      ? 'Strong week'
      : taskShare >= 0.5
        ? 'Solid week'
        : taskShare > 0
          ? 'Every bit counts'
          : 'Fresh week ahead';

  return {
    monday,
    sunday: dates[6],
    days,
    inPlay,
    completed,
    perfect,
    steps: { total, goal: profile.step_goal * 7, bestDay, bestSteps },
    water: { avgMl: inPlay ? Math.round(waterSum / inPlay) : 0, daysHit: waterHit },
    workouts: { minutes, goalMinutes: inPlay * workoutGoal(profile), kcal, sessions },
    readingDays,
    soberDays,
    eaten: { avg: eatenDays ? Math.round(eatenSum / eatenDays) : 0, days: eatenDays },
    taskShare,
    totalCompleted,
    headline,
  };
}
