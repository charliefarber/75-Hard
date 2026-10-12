import { addDays, parseISO, startOfWeek } from 'date-fns';
import type { DailyLog, Profile } from '../data/types';
import { workoutGoal } from '../data/types';
import { bodyStats, dayBurned } from './body';
import type { ChallengeSummary, DayState } from './challenge';
import { toISODate } from './challenge';
import { stageFor, STAGES } from './pet';

export interface RecapDay {
  date: string;
  /** null = outside the challenge (before the start, or still to come). */
  state: DayState | null;
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
  /** Stage names at the start and end of the week, if the pet evolved. */
  evolvedTo: string | null;
  /** Completed days at the end of the week. */
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
    return { date, state: t && date <= today ? t.state : null };
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
  }

  // Completed days before and after this week → did the pet evolve?
  const before = summary.timeline.filter((t) => t.date < monday && t.state === 'complete').length;
  const after = before + completed;
  const evolvedTo = stageFor(after) > stageFor(before) ? STAGES[stageFor(after)].name : null;

  const perfect = inPlay === 7 && completed === 7;
  const ratio = inPlay ? completed / inPlay : 0;
  const headline = perfect
    ? 'Perfect week!'
    : ratio >= 0.7
      ? 'Strong week'
      : ratio > 0
        ? 'Every day counts'
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
    evolvedTo,
    totalCompleted: after,
    headline,
  };
}
