import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import type { Challenge, DailyLog, Profile } from '../data/types';
import { emptyLog, workoutGoal, workoutMinutes } from '../data/types';

export const CHALLENGE_LENGTH = 75;

export type TaskId = 'workouts' | 'water' | 'reading' | 'alcohol';

export interface TaskStatus {
  id: TaskId;
  label: string;
  done: boolean;
  /** Short reason it isn't done yet, when that isn't obvious. */
  hint?: string;
}

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');
export const todayISO = () => toISODate(new Date());

/** Day number within an attempt: start date is day 1. */
export function dayNumber(startDate: string, date: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(startDate)) + 1;
}

export function dateForDay(startDate: string, day: number): string {
  return toISODate(addDays(parseISO(startDate), day - 1));
}

export function finishDate(startDate: string): string {
  return dateForDay(startDate, CHALLENGE_LENGTH);
}

/**
 * The daily tasks: workout minutes adding up to her daily goal (90 by default, any mix of
 * activities), water, reading and no alcohol. Food is logged in the diary rather than ticked off,
 * and steps are a weekly goal (see weekSteps); neither is a task.
 */
export function taskStatuses(
  log: DailyLog | undefined,
  profile: Pick<Profile, 'water_goal_ml' | 'workout_minutes' | 'reading_goal_pages'> & Partial<Pick<Profile, 'workout_goal_minutes'>>,
): TaskStatus[] {
  const l = log ?? emptyLog('');
  const goal = workoutGoal(profile);
  const mins = workoutMinutes(l);
  return [
    { id: 'workouts', label: 'Workouts', done: mins >= goal, hint: mins > 0 && mins < goal ? `${goal - mins} min to go` : undefined },
    { id: 'water', label: 'Water', done: l.water_ml >= profile.water_goal_ml },
    { id: 'reading', label: 'Reading', done: l.pages_read >= profile.reading_goal_pages },
    { id: 'alcohol', label: 'No alcohol', done: l.no_alcohol },
  ];
}

/** Monday–Sunday step total for the week containing `date`. */
export function weekSteps(logs: Record<string, DailyLog>, date: string): { total: number; days: { date: string; steps: number }[]; start: string } {
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = toISODate(addDays(start, i));
    return { date: d, steps: logs[d]?.steps ?? 0 };
  });
  return { total: days.reduce((a, b) => a + b.steps, 0), days, start: toISODate(start) };
}

export function isDayComplete(log: DailyLog | undefined, profile: Parameters<typeof taskStatuses>[1]): boolean {
  if (log?.birthday_pass) return true;
  return taskStatuses(log, profile).every((t) => t.done);
}

/** complete = every task done; partial = a past day with some (or none) done. */
export type DayState = 'complete' | 'partial' | 'today' | 'future';

export interface TimelineDay {
  date: string;
  state: DayState;
  /** Which of the 75 this calendar day is. */
  day: number;
  /** Tasks done that day, out of `of` (both 0 for days still to come). */
  done: number;
  of: number;
}

export interface ChallengeSummary {
  /** Today's day number, 1–75 (0 before the start date, 75 once it's over). */
  currentDay: number;
  /** Days with every task done so far, including today if it's done. */
  completedDays: number;
  /** Days still to come after today. */
  remaining: number;
  /** Consecutive full days ending yesterday (or today, if today is already done). */
  streak: number;
  /** Past days that weren't fully done. They don't move anything; they're just logged as they were. */
  partialDays: { date: string }[];
  /** The 75 calendar days from the start date. */
  timeline: TimelineDay[];
  /** Day 75. */
  finishDate: string;
  todayComplete: boolean;
  /** Day 75 has passed. */
  finished: boolean;
}

/**
 * A relaxed 75 Hard: it's always 75 calendar days from the start date. Each day is logged as it
 * went (all done, or partly done) and nothing restarts or moves the finish line.
 */
export function summarise(
  challenge: Pick<Challenge, 'start_date'> & Partial<Pick<Challenge, 'credited_days'>>,
  logs: Record<string, DailyLog>,
  profile: Parameters<typeof taskStatuses>[1],
  today: string = todayISO(),
): ChallengeSummary {
  const credited = challenge.credited_days ?? 0;
  const timeline: TimelineDay[] = [];
  const partialDays: { date: string }[] = [];
  let completed = 0;
  let todayComplete = false;

  for (let i = 0; i < CHALLENGE_LENGTH; i++) {
    const date = toISODate(addDays(parseISO(challenge.start_date), i));
    const day = i + 1;
    if (date > today) {
      timeline.push({ date, state: 'future', day, done: 0, of: 0 });
      continue;
    }
    const tasks = taskStatuses(logs[date], profile);
    const complete = i < credited || isDayComplete(logs[date], profile);
    const done = complete ? tasks.length : tasks.filter((t) => t.done).length;
    if (complete) completed++;
    if (date === today) {
      todayComplete = complete;
      timeline.push({ date, state: complete ? 'complete' : 'today', day, done, of: tasks.length });
    } else {
      if (!complete) partialDays.push({ date });
      timeline.push({ date, state: complete ? 'complete' : 'partial', day, done, of: tasks.length });
    }
  }

  // Streak: back from today (if done) or yesterday.
  let streak = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const t = timeline[i];
    if (t.state === 'future' || t.state === 'today') continue;
    if (t.state === 'complete') streak++;
    else break;
  }

  const end = finishDate(challenge.start_date);
  const started = challenge.start_date <= today;
  const currentDay = started ? Math.min(CHALLENGE_LENGTH, dayNumber(challenge.start_date, today)) : 0;
  return {
    currentDay,
    completedDays: completed,
    remaining: today > end ? 0 : CHALLENGE_LENGTH - currentDay,
    streak,
    partialDays,
    timeline,
    finishDate: end,
    todayComplete,
    finished: today > end,
  };
}

/** Litres for display, e.g. 2.75 (or 3.8 for a goal with digits = 1). */
export function litres(ml: number, digits = 2): string {
  return Number((ml / 1000).toFixed(digits)).toString();
}
