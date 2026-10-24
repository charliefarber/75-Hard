/**
 * Challenge weeks: Week 1 = days 1–7 from the start date, Week 2 = days 8–14 …
 * A 75-day challenge has 11 weeks; Week 11 is days 71–75 (5 days).
 *
 * Dates are plain "yyyy-mm-dd" strings, compared as calendar days (no time zones).
 */

export const CHALLENGE_DAYS = 75;
export const WEEK_LENGTH = 7;

export type WeekStatus = 'done' | 'current' | 'upcoming';

/** 'average' for weight, water, workout minutes, calories; 'total' for steps, full days. */
export type Aggregate = 'average' | 'total';

export interface DatedValue {
  date: string; // yyyy-mm-dd
  value: number | null | undefined;
}

export interface WeekSummary {
  week: number; // 1-based
  firstDay: number; // challenge day number of the first day
  lastDay: number;
  firstDate: string; // yyyy-mm-dd
  lastDate: string;
  length: number; // days in this week: 7, or fewer for the last week
  daysElapsed: number; // days of this week up to and including today
  status: WeekStatus;
  value: number | null; // average or total of the days with a value; null if none
  daysLogged: number; // days in the week that have a value
  /** Change against the previous week; null when there is nothing fair to compare. */
  change: number | null;
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(date: string): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Expected a yyyy-mm-dd date, got "${date}"`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Challenge day number of `date` (start date = day 1). Can be < 1 or > the challenge length. */
export function dayNumber(start: string, date: string): number {
  return Math.round((toUtc(date) - toUtc(start)) / DAY_MS) + 1;
}

/** Which challenge week a day number falls in (day 1–7 → 1, day 8 → 2, …). */
export function weekOfDay(day: number): number {
  return Math.floor((day - 1) / WEEK_LENGTH) + 1;
}

export function weekCount(totalDays: number = CHALLENGE_DAYS): number {
  return Math.ceil(totalDays / WEEK_LENGTH);
}

/**
 * One value per calendar day. When a day has several entries (two weigh-ins, say),
 * the last one in the array wins, so pass entries in the order they were logged.
 * Nulls, undefined and non-finite numbers are dropped.
 */
export function onePerDay(values: DatedValue[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const v of values) {
    if (v.value === null || v.value === undefined || !Number.isFinite(v.value)) continue;
    byDate.set(v.date, v.value);
  }
  return byDate;
}

export interface BuildWeeksOptions {
  start: string; // challenge start date, yyyy-mm-dd
  today: string; // yyyy-mm-dd
  values: DatedValue[];
  aggregate: Aggregate;
  totalDays?: number;
}

export function buildWeeks(opts: BuildWeeksOptions): WeekSummary[] {
  const totalDays = opts.totalDays ?? CHALLENGE_DAYS;
  const todayDay = dayNumber(opts.start, opts.today);
  const perDay = onePerDay(opts.values);

  // Bucket each day's value into its week, ignoring days outside the challenge or in the future.
  const buckets: number[][] = Array.from({ length: weekCount(totalDays) }, () => []);
  for (const [date, value] of perDay) {
    const day = dayNumber(opts.start, date);
    if (day < 1 || day > totalDays || day > todayDay) continue;
    buckets[weekOfDay(day) - 1].push(value);
  }

  const weeks: WeekSummary[] = [];
  for (let i = 0; i < buckets.length; i++) {
    const week = i + 1;
    const firstDay = i * WEEK_LENGTH + 1;
    const lastDay = Math.min(week * WEEK_LENGTH, totalDays);
    const length = lastDay - firstDay + 1;
    const status: WeekStatus =
      todayDay > lastDay ? 'done' : todayDay >= firstDay ? 'current' : 'upcoming';
    const daysElapsed = Math.max(0, Math.min(length, todayDay - firstDay + 1));
    const logged = buckets[i];
    const sum = logged.reduce((a, b) => a + b, 0);
    const value =
      logged.length === 0 ? null : opts.aggregate === 'average' ? sum / logged.length : sum;

    let change: number | null = null;
    const prev = weeks[i - 1];
    if (prev && value !== null && prev.value !== null) {
      // A total for a part-week (this week so far, or the shorter last week) isn't comparable.
      const fair =
        opts.aggregate === 'average' || (status === 'done' && length === prev.length);
      if (fair) change = value - prev.value;
    }

    weeks.push({
      week,
      firstDay,
      lastDay,
      firstDate: addDays(opts.start, firstDay - 1),
      lastDate: addDays(opts.start, lastDay - 1),
      length,
      daysElapsed,
      status,
      value,
      daysLogged: logged.length,
      change,
    });
  }
  return weeks;
}

/** First week with a value → latest week with a value. Null for totals or if fewer than two weeks have values. */
export function changeSinceFirst(weeks: WeekSummary[], aggregate: Aggregate): number | null {
  if (aggregate !== 'average') return null;
  const withValue = weeks.filter((w) => w.value !== null);
  if (withValue.length < 2) return null;
  return (withValue[withValue.length - 1].value as number) - (withValue[0].value as number);
}
