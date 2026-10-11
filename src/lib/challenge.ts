import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Challenge, DailyLog, Profile } from '../data/types';
import { emptyLog } from '../data/types';

export const CHALLENGE_LENGTH = 75;

export type TaskId = 'workout1' | 'workout2' | 'water' | 'reading' | 'diet' | 'alcohol' | 'steps';

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
 * The 75 Hard tasks for one day. The two workouts must each hit the minimum
 * length, and at least one of them has to be outdoors.
 */
export function taskStatuses(log: DailyLog | undefined, profile: Pick<Profile, 'water_goal_ml' | 'workout_minutes' | 'reading_goal_pages' | 'step_goal' | 'steps_required'>): TaskStatus[] {
  const l = log ?? emptyLog('');
  const min = profile.workout_minutes;
  const [w1, w2] = l.workouts;
  const w1ok = !!w1?.done && (w1.minutes || 0) >= min;
  const w2ok = !!w2?.done && (w2.minutes || 0) >= min;
  const anyOutdoor = !!(w1?.done && w1.outdoor) || !!(w2?.done && w2.outdoor);
  const bothDone = w1ok && w2ok;

  const tasks: TaskStatus[] = [
    {
      id: 'workout1',
      label: 'Workout 1',
      done: w1ok,
      hint: w1?.done && !w1ok ? `Needs ${min} min` : undefined,
    },
    {
      id: 'workout2',
      label: 'Workout 2',
      done: w2ok && anyOutdoor,
      hint: bothDone && !anyOutdoor ? 'One workout must be outdoors' : w2?.done && !w2ok ? `Needs ${min} min` : undefined,
    },
    { id: 'water', label: 'Water', done: l.water_ml >= profile.water_goal_ml },
    { id: 'reading', label: 'Reading', done: l.pages_read >= profile.reading_goal_pages },
    { id: 'diet', label: 'Diet', done: l.followed_diet && l.no_cheat_meal },
    { id: 'alcohol', label: 'No alcohol', done: l.no_alcohol },
  ];
  if (profile.steps_required) {
    tasks.push({ id: 'steps', label: 'Steps', done: (l.steps ?? 0) >= profile.step_goal });
  }
  return tasks;
}

export function isDayComplete(log: DailyLog | undefined, profile: Parameters<typeof taskStatuses>[1]): boolean {
  return taskStatuses(log, profile).every((t) => t.done);
}

export type DayState = 'complete' | 'missed' | 'today' | 'future';

export interface ChallengeSummary {
  /** Today's day number, clamped to 1…75 (0 if the attempt starts in the future). */
  currentDay: number;
  /** Days fully completed in this attempt. */
  completedDays: number;
  /** Consecutive complete days ending yesterday (or today, if today is already complete). */
  streak: number;
  /** Past days in this attempt that weren't fully completed — the rules say restart. */
  missedDays: { day: number; date: string }[];
  dayStates: DayState[]; // index 0 = day 1
  finished: boolean;
}

export function summarise(
  challenge: Pick<Challenge, 'start_date'> & Partial<Pick<Challenge, 'credited_days'>>,
  logs: Record<string, DailyLog>,
  profile: Parameters<typeof taskStatuses>[1],
  today: string = todayISO(),
): ChallengeSummary {
  const rawDay = dayNumber(challenge.start_date, today);
  const currentDay = Math.max(0, Math.min(CHALLENGE_LENGTH, rawDay));
  const dayStates: DayState[] = [];
  const missedDays: { day: number; date: string }[] = [];
  let completedDays = 0;

  for (let day = 1; day <= CHALLENGE_LENGTH; day++) {
    const date = dateForDay(challenge.start_date, day);
    const complete = day <= (challenge.credited_days ?? 0) || isDayComplete(logs[date], profile);
    if (complete && day <= rawDay) completedDays++;
    if (day < rawDay) {
      dayStates.push(complete ? 'complete' : 'missed');
      if (!complete) missedDays.push({ day, date });
    } else if (day === rawDay) {
      dayStates.push(complete ? 'complete' : 'today');
    } else {
      dayStates.push('future');
    }
  }

  // Streak: walk back from today (if done) or yesterday.
  let streak = 0;
  const startFrom = Math.min(rawDay, CHALLENGE_LENGTH);
  for (let day = startFrom; day >= 1; day--) {
    const state = dayStates[day - 1];
    if (state === 'complete') streak++;
    else if (day === rawDay && state === 'today') continue;
    else break;
  }

  const finished = rawDay > CHALLENGE_LENGTH && missedDays.length === 0;
  return { currentDay, completedDays, streak, missedDays, dayStates, finished };
}

/** Litres for display, e.g. 2.75 (or 3.8 for a goal with digits = 1). */
export function litres(ml: number, digits = 2): string {
  return Number((ml / 1000).toFixed(digits)).toString();
}
