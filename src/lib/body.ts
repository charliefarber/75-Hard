import { addDays, differenceInYears, parseISO } from 'date-fns';
import type { DailyLog, Profile, WeightUnit, WorkoutEntry } from '../data/types';
import { activityById, estimateKcal, type BodyStats } from './activities';
import { toISODate } from './challenge';

// ---------------------------------------------------------------- weight

const KG_PER_LB = 0.45359237;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

/** e.g. "62.4 kg", "137.6 lb", "9 st 11.6 lb". */
export function formatWeight(kg: number, unit: WeightUnit = 'kg', digits = 1): string {
  if (unit === 'kg') return `${kg.toFixed(digits)} kg`;
  const lb = kgToLb(kg);
  if (unit === 'lb') return `${lb.toFixed(digits)} lb`;
  const st = Math.floor(lb / 14);
  const rest = lb - st * 14;
  return `${st} st ${rest.toFixed(digits)} lb`;
}

/** A change in weight, signed, e.g. "−1.2 kg" / "+0.4 lb" (stone shows in pounds). */
export function formatChange(kg: number, unit: WeightUnit = 'kg'): string {
  const v = unit === 'kg' ? kg : kgToLb(kg);
  const u = unit === 'kg' ? 'kg' : 'lb';
  const n = Math.abs(v) < 0.05 ? '0.0' : Math.abs(v).toFixed(1);
  return `${v <= -0.05 ? '−' : v >= 0.05 ? '+' : '±'}${n} ${u}`;
}

export interface WeighIn {
  date: string;
  kg: number;
}

/** Every weigh-in, oldest first. */
export function weighIns(logs: Record<string, DailyLog>): WeighIn[] {
  return Object.values(logs)
    .filter((l) => typeof l.weight_kg === 'number' && l.weight_kg > 0)
    .map((l) => ({ date: l.log_date, kg: l.weight_kg as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The most recent weigh-in on or before `date`. */
export function latestWeight(logs: Record<string, DailyLog>, date: string): WeighIn | null {
  let best: WeighIn | null = null;
  for (const l of Object.values(logs)) {
    if (typeof l.weight_kg !== 'number' || !(l.weight_kg > 0) || l.log_date > date) continue;
    if (!best || l.log_date > best.date) best = { date: l.log_date, kg: l.weight_kg };
  }
  return best;
}

/**
 * The 7-day average on each day she weighed in: the mean of her weigh-ins in the 7 days
 * ending that day. Daily weight jumps around with water and food; the average shows the trend.
 */
export function weightTrend(points: WeighIn[]): (WeighIn & { avg: number })[] {
  return points.map((p) => {
    const from = toISODate(addDays(parseISO(p.date), -6));
    const window = points.filter((q) => q.date >= from && q.date <= p.date);
    const avg = window.reduce((a, q) => a + q.kg, 0) / window.length;
    return { ...p, avg };
  });
}

// ---------------------------------------------------------------- body stats for calories

export function ageOn(birthday: string | null | undefined, date: string): number | null {
  if (!birthday) return null;
  const a = differenceInYears(parseISO(date), parseISO(birthday));
  return a > 0 && a < 120 ? a : null;
}

export function bodyStats(
  profile: Pick<Profile, 'height_cm' | 'sex' | 'birthday'>,
  logs: Record<string, DailyLog>,
  date: string,
): BodyStats {
  return {
    weightKg: latestWeight(logs, date)?.kg ?? null,
    heightCm: profile.height_cm ?? null,
    ageYears: ageOn(profile.birthday, date),
    sex: profile.sex ?? null,
  };
}

// ---------------------------------------------------------------- workouts

export function entryName(w: Pick<WorkoutEntry, 'activity' | 'name'>): string {
  return w.name || activityById(w.activity).name;
}

/** Calories for a logged workout: the number saved when it was logged, or a fresh estimate. */
export function entryKcal(w: WorkoutEntry, body: BodyStats): number {
  return typeof w.kcal === 'number' ? w.kcal : estimateKcal(w.activity, w.intensity, w.minutes, body);
}

export function dayBurned(log: Pick<DailyLog, 'workouts'> | undefined, body: BodyStats): number {
  return (log?.workouts ?? []).reduce((a, w) => a + entryKcal(w, body), 0);
}

// ---------------------------------------------------------------- weight units

/** Her unit if she's picked one; otherwise pounds in the US and kilos elsewhere. */
export function weightUnitFor(saved: WeightUnit | null | undefined, locale = typeof navigator !== 'undefined' ? navigator.language : 'en-GB'): WeightUnit {
  if (saved === 'kg' || saved === 'lb' || saved === 'st') return saved;
  return /^en-US$|^en-LR$|^my/i.test(locale) ? 'lb' : 'kg';
}

/** Split a weight into what the inputs show: kg or lb as one number, stone as stones + pounds. */
export function weightParts(kg: number, unit: WeightUnit): { main: string; lb?: string } {
  if (unit === 'kg') return { main: (Math.round(kg * 10) / 10).toFixed(1) };
  const lb = Math.round(kgToLb(kg) * 10) / 10;
  if (unit === 'lb') return { main: lb.toFixed(1) };
  const st = Math.floor(lb / 14);
  return { main: String(st), lb: (Math.round((lb - st * 14) * 10) / 10).toFixed(1) };
}

/** Read what she typed back into kg, or null if it isn't a believable weight (20–400 kg). */
export function parseWeight(main: string, unit: WeightUnit, lbPart = ''): number | null {
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));
  let kg: number;
  if (unit === 'kg') kg = num(main);
  else if (unit === 'lb') kg = lbToKg(num(main));
  else {
    const st = num(main);
    const lb = lbPart.trim() === '' ? 0 : num(lbPart);
    if (!Number.isFinite(st) || !Number.isFinite(lb) || lb < 0 || lb >= 14) return null;
    kg = lbToKg(st * 14 + lb);
  }
  if (!Number.isFinite(kg) || kg < 20 || kg > 400) return null;
  return Math.round(kg * 100) / 100;
}

/** The step the − / + buttons move by, in kg: 0.1 of whatever unit she uses. */
export const weightStepKg = (unit: WeightUnit) => (unit === 'kg' ? 0.1 : lbToKg(0.1));
