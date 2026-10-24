import type { FoodEntry, Meal } from '../data/foodTypes';
import { addDays } from './weeks';
import { newId, totals } from './nutrition';

/**
 * One-tap suggestions worked out from her own diary, so nothing new needs storing:
 *  - yourUsual: the foods she has most often had for this meal on similar days
 *    (weekdays with weekdays, weekends with weekends) over the last two weeks
 *  - sameAsYesterday: yesterday's foods for this meal
 *  - goToFoods: her most frequent single foods for a meal (snack chips)
 * Meal-prep portions and calories carried over from Lifesum are left out: they aren't
 * something she'd log again as they were.
 */

export interface Suggestion {
  /** The entries as she logged them the most recent time. */
  entries: FoodEntry[];
  /** "Chicken salad wrap + Apple", or "Coffee ×2" when a food was logged twice. */
  title: string;
  kcal: number;
  /** The set of foods; equal signatures mean the same meal. */
  signature: string;
  /** "You’ve had this on 4 of the last 5 weekdays." */
  why: string;
}

const CARRIED_OVER = new Set(['Logged in Lifesum', 'Calories typed in earlier']);

/** Entries worth suggesting again. */
function suggestable(e: FoodEntry): boolean {
  if (e.food_key?.startsWith('prep:')) return false;
  if (!e.food_key && CARRIED_OVER.has(e.name)) return false;
  return true;
}

const keyOf = (e: FoodEntry) => e.food_key ?? `name:${e.name.trim().toLowerCase()}`;

export function signatureOf(entries: FoodEntry[]): string {
  return [...new Set(entries.map(keyOf))].sort().join('|');
}

export function titleOf(entries: FoodEntry[]): string {
  const groups = new Map<string, { name: string; n: number }>();
  for (const e of entries) {
    const g = groups.get(keyOf(e));
    if (g) g.n += 1;
    else groups.set(keyOf(e), { name: e.name, n: 1 });
  }
  return [...groups.values()].map((g) => (g.n > 1 ? `${g.name} ×${g.n}` : g.name)).join(' + ');
}

function isWeekend(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

/** A meal's entries grouped by date, newest date first. */
function daysOf(history: FoodEntry[], meal: Meal, from: string, before: string): [string, FoodEntry[]][] {
  const map = new Map<string, FoodEntry[]>();
  for (const e of history) {
    if (e.meal !== meal || e.log_date < from || e.log_date >= before || !suggestable(e)) continue;
    const list = map.get(e.log_date) ?? [];
    list.push(e);
    map.set(e.log_date, list);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function suggestion(entries: FoodEntry[], why: string): Suggestion {
  return { entries, title: titleOf(entries), kcal: Math.round(totals(entries).kcal), signature: signatureOf(entries), why };
}

export function yourUsual(
  history: FoodEntry[],
  opts: { date: string; meal: Meal; lookbackDays?: number; minDays?: number },
): Suggestion | null {
  const weekend = isWeekend(opts.date);
  const days = daysOf(history, opts.meal, addDays(opts.date, -(opts.lookbackDays ?? 14)), opts.date).filter(([d]) => isWeekend(d) === weekend);
  const counts = new Map<string, { n: number; latest: FoodEntry[] }>();
  for (const [, entries] of days) {
    const sig = signatureOf(entries);
    const c = counts.get(sig);
    if (c) c.n += 1;
    else counts.set(sig, { n: 1, latest: entries }); // newest first, so the first one seen is the latest
  }
  let best: { n: number; latest: FoodEntry[] } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c; // ties keep the most recent
  if (!best || best.n < (opts.minDays ?? 3)) return null;
  const kind = weekend ? 'weekend days' : 'weekdays';
  return suggestion(best.latest, `You’ve had this on ${best.n} of the last ${days.length} ${kind}.`);
}

export function sameAsYesterday(history: FoodEntry[], opts: { date: string; meal: Meal }): Suggestion | null {
  const yesterday = addDays(opts.date, -1);
  const entries = history.filter((e) => e.meal === opts.meal && e.log_date === yesterday && suggestable(e));
  return entries.length ? suggestion(entries, 'What you had yesterday.') : null;
}

/** Her most frequent single foods for a meal, by days eaten (ties: most recent first). */
export function goToFoods(history: FoodEntry[], opts: { date: string; meal: Meal; lookbackDays?: number; limit?: number }): FoodEntry[] {
  const from = addDays(opts.date, -(opts.lookbackDays ?? 14));
  const seen = new Map<string, { days: Set<string>; latest: FoodEntry }>();
  for (const e of history) {
    if (e.meal !== opts.meal || e.log_date < from || e.log_date >= opts.date || !suggestable(e)) continue;
    const s = seen.get(keyOf(e));
    if (!s) seen.set(keyOf(e), { days: new Set([e.log_date]), latest: e });
    else {
      s.days.add(e.log_date);
      if (e.log_date >= s.latest.log_date) s.latest = e;
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.days.size - a.days.size || (a.latest.log_date < b.latest.log_date ? 1 : -1))
    .slice(0, opts.limit ?? 3)
    .map((s) => s.latest);
}

/** Fresh diary entries copying `entries` into `meal` on `date` (new ids, same amounts). */
export function copyEntries(entries: FoodEntry[], date: string, meal: Meal): FoodEntry[] {
  return entries.map((e) => ({ ...e, id: newId(), log_date: date, meal, created_at: undefined }));
}
