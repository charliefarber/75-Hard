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

export interface TimelineDay {
  date: string;
  state: DayState;
  /** Which of the 75 this calendar day is (or will be). Missed days have none: they don't count. */
  day: number | null;
}

export interface ChallengeSummary {
  /** The day she's working on today: completed days before today + 1 (0 before the start date). */
  currentDay: number;
  /** Completed days so far, including today if it's done. */
  completedDays: number;
  /** Completed days still needed. */
  remaining: number;
  /** Consecutive complete days ending yesterday (or today, if today is already complete). */
  streak: number;
  /** Past days that weren't fully completed. Each one adds a day to the end. */
  missedDays: { date: string }[];
  /** Every calendar day from the start date to the (projected) 75th completed day. */
  timeline: TimelineDay[];
  /** Date of the 75th completed day, actual or projected. */
  finishDate: string;
  todayComplete: boolean;
  finished: boolean;
}

/**
 * The "extend, don't restart" version of 75 Hard: a day only counts when every
 * task is done; a missed day just doesn't count, so the finish line moves back
 * by one. The challenge ends on the 75th completed day.
 */
export function summarise(
  challenge: Pick<Challenge, 'start_date'> & Partial<Pick<Challenge, 'credited_days'>>,
  logs: Record<string, DailyLog>,
  profile: Parameters<typeof taskStatuses>[1],
  today: string = todayISO(),
): ChallengeSummary {
  const credited = challenge.credited_days ?? 0;
  const timeline: TimelineDay[] = [];
  const missedDays: { date: string }[] = [];
  let completed = 0;
  let todayComplete = false;
  let offset = 0;

  // Past and today.
  for (; completed < CHALLENGE_LENGTH; offset++) {
    const date = toISODate(addDays(parseISO(challenge.start_date), offset));
    if (date > today) break;
    const complete = offset < credited || isDayComplete(logs[date], profile);
    if (date === today) {
      todayComplete = complete;
      if (complete) completed++;
      timeline.push({ date, state: complete ? 'complete' : 'today', day: complete ? completed : completed + 1 });
      offset++;
      break;
    }
    if (complete) {
      completed++;
      timeline.push({ date, state: 'complete', day: completed });
    } else {
      missedDays.push({ date });
      timeline.push({ date, state: 'missed', day: null });
    }
  }

  // Projected days ahead, assuming every remaining day is completed.
  let next = timeline.length && timeline[timeline.length - 1].state === 'today' ? completed + 2 : completed + 1;
  for (; next <= CHALLENGE_LENGTH; offset++, next++) {
    const date = toISODate(addDays(parseISO(challenge.start_date), offset));
    timeline.push({ date, state: 'future', day: next });
  }

  // Streak: back from today (if done) or yesterday.
  let streak = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const t = timeline[i];
    if (t.state === 'future' || t.state === 'today') continue;
    if (t.state === 'complete') streak++;
    else break;
  }

  const last75 = timeline.find((t) => t.day === CHALLENGE_LENGTH);
  const started = challenge.start_date <= today;
  return {
    currentDay: started ? Math.min(CHALLENGE_LENGTH, todayComplete ? completed : completed + 1) : 0,
    completedDays: completed,
    remaining: CHALLENGE_LENGTH - completed,
    streak,
    missedDays,
    timeline,
    finishDate: last75?.date ?? today,
    todayComplete,
    finished: completed >= CHALLENGE_LENGTH,
  };
}

/** Litres for display, e.g. 2.75 (or 3.8 for a goal with digits = 1). */
export function litres(ml: number, digits = 2): string {
  return Number((ml / 1000).toFixed(digits)).toString();
}
