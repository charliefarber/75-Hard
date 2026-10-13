import { addDays, parseISO, startOfWeek } from 'date-fns';
import type { ChallengeSummary } from './challenge';
import { toISODate } from './challenge';

/**
 * The challenge pet. Everything here is derived from the challenge summary,
 * so the pet can never disagree with the tracker:
 *  - it grows (evolves) with completed days,
 *  - it gets hungry when days are missed in a row,
 *  - each perfect Monday–Sunday week earns a treat she can spend to feed it
 *    on a missed day (treats keep the pet fed; they don't change the 75).
 */

export interface Stage {
  min: number;
  name: string;
  blurb: string;
}

export const STAGES: Stage[] = [
  // Thresholds are completed days, matching the art: Baby days 1–9, Sprout 10–14,
  // Mover 15–24, Athlete 25–34, Champion 35–49, Legend 50–75.
  { min: 0, name: 'Baby', blurb: 'Just starting out. Small steps, big dreams.' },
  { min: 10, name: 'Sprout', blurb: 'Building habits. Finding your rhythm.' },
  { min: 15, name: 'Mover', blurb: 'Momentum grows. You’re doing it!' },
  { min: 25, name: 'Athlete', blurb: 'Stronger, fitter, more focused.' },
  { min: 35, name: 'Champion', blurb: 'Discipline becomes a superpower.' },
  { min: 50, name: 'Legend', blurb: 'Unstoppable. 75 days and still going strong.' },
];

export type Mood = 'ecstatic' | 'happy' | 'hungry' | 'veryHungry' | 'starving';

export const MOODS: Record<Mood, { label: string; line: (name: string) => string }> = {
  ecstatic: { label: 'Full & happy', line: (n) => `${n} is stuffed and doing a happy wiggle.` },
  happy: { label: 'Content', line: (n) => `${n} is waiting for today’s leaves. Finish the day to feed them.` },
  hungry: { label: 'Hungry', line: (n) => `${n}’s tummy is rumbling. One missed day, so finish today to fix it.` },
  veryHungry: { label: 'Very hungry', line: (n) => `${n} is getting weak. Two missed days in a row.` },
  starving: { label: 'Starving', line: (n) => `${n} is starving and barely hanging on. Please feed them!` },
};

export interface PetState {
  stageIndex: number;
  stage: Stage;
  next: Stage | null;
  daysToNext: number;
  /** 0…1 progress through the current stage. */
  stageProgress: number;
  mood: Mood;
  /** Missed days in a row, ending yesterday, not covered by a treat. */
  missedRun: number;
  /** 0…100 */
  fullness: number;
  perfectWeeks: string[]; // Monday dates
  treatsEarned: number;
  treatsUsed: number;
  treatsAvailable: number;
  /** The most recent missed day a treat could cover (null if none). */
  treatTarget: string | null;
}

export function stageFor(completed: number): number {
  let idx = 0;
  STAGES.forEach((s, i) => {
    if (completed >= s.min) idx = i;
  });
  return idx;
}

export function petState(summary: ChallengeSummary, treatDates: string[], today: string): PetState {
  const completed = summary.completedDays;
  const stageIndex = stageFor(completed);
  const stage = STAGES[stageIndex];
  const next = STAGES[stageIndex + 1] ?? null;
  const daysToNext = next ? next.min - completed : 0;
  const stageProgress = next ? (completed - stage.min) / (next.min - stage.min) : 1;

  const treated = new Set(treatDates);
  const past = summary.timeline.filter((t) => t.date < today);

  // Hunger: consecutive missed days ending yesterday that no treat covered.
  let missedRun = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    const t = past[i];
    if (t.state === 'partial' && !treated.has(t.date)) missedRun++;
    else break;
  }

  let mood: Mood;
  if (summary.todayComplete) mood = 'ecstatic';
  else if (missedRun === 0) mood = 'happy';
  else if (missedRun === 1) mood = 'hungry';
  else if (missedRun === 2) mood = 'veryHungry';
  else mood = 'starving';

  const fullness = summary.todayComplete ? 100 : Math.max(8, 80 - missedRun * 25);

  // Perfect weeks: every day Monday–Sunday inside the attempt, all complete, all past (or today, done).
  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const mondays = new Set(summary.timeline.filter((t) => t.date <= today).map((t) => toISODate(startOfWeek(parseISO(t.date), { weekStartsOn: 1 }))));
  const perfectWeeks = [...mondays].filter((monday) =>
    Array.from({ length: 7 }, (_, i) => toISODate(addDays(parseISO(monday), i))).every((d) => {
      const t = byDate.get(d);
      return !!t && d <= today && t.state === 'complete';
    }),
  );

  const usedTreats = treatDates.filter((d) => byDate.get(d)?.state === 'partial').length;
  const treatsAvailable = Math.max(0, perfectWeeks.length - usedTreats);
  const lastMissed = [...past].reverse().find((t) => t.state === 'partial' && !treated.has(t.date));

  return {
    stageIndex,
    stage,
    next,
    daysToNext,
    stageProgress,
    mood,
    missedRun,
    fullness,
    perfectWeeks: perfectWeeks.sort(),
    treatsEarned: perfectWeeks.length,
    treatsUsed: usedTreats,
    treatsAvailable,
    treatTarget: lastMissed?.date ?? null,
  };
}
