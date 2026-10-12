import { addDays, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { toISODate } from './challenge';

/** The pass shows up a week before the birthday and can be used until a month after. */
export const PASS_OPENS_DAYS_BEFORE = 7;
export const PASS_CLOSES_DAYS_AFTER = 30;

export interface BirthdayPass {
  /** The birthday this pass is for (yyyy-MM-dd in the relevant year). */
  occurrence: string;
  year: number;
  /** Days until the birthday (negative once it has passed). */
  daysUntil: number;
  isBirthday: boolean;
  /** Not used yet for this year. */
  available: boolean;
}

function occurrenceIn(birthday: string, year: number): string {
  const [, m, d] = birthday.split('-').map(Number);
  // 29 Feb birthdays fall on 28 Feb in other years
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === 2 && d === 29 && !leap ? 28 : d;
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The birthday pass whose window contains `today`, or null outside the window. */
export function birthdayPass(birthday: string | null | undefined, usedYear: number | null | undefined, today: string): BirthdayPass | null {
  if (!birthday || !isValid(parseISO(birthday))) return null;
  const y = Number(today.slice(0, 4));
  for (const year of [y - 1, y, y + 1]) {
    const occurrence = occurrenceIn(birthday, year);
    const daysUntil = differenceInCalendarDays(parseISO(occurrence), parseISO(today));
    if (daysUntil <= PASS_OPENS_DAYS_BEFORE && daysUntil >= -PASS_CLOSES_DAYS_AFTER) {
      return { occurrence, year, daysUntil, isBirthday: daysUntil === 0, available: usedYear !== year };
    }
  }
  return null;
}

/** Next birthday date from today (for display). */
export function nextBirthday(birthday: string, today: string): string {
  const y = Number(today.slice(0, 4));
  const thisYear = occurrenceIn(birthday, y);
  return thisYear >= today ? thisYear : occurrenceIn(birthday, y + 1);
}

export const isoPlus = (iso: string, n: number) => toISODate(addDays(parseISO(iso), n));
