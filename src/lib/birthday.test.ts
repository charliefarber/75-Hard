import { describe, expect, it } from 'vitest';
import { birthdayPass, nextBirthday } from './birthday';

describe('birthday pass', () => {
  it('appears a week before the birthday', () => {
    expect(birthdayPass('1994-10-19', null, '2026-10-11')).toBeNull();
    const p = birthdayPass('1994-10-19', null, '2026-10-12');
    expect(p).toMatchObject({ occurrence: '2026-10-19', year: 2026, daysUntil: 7, available: true, isBirthday: false });
  });
  it('is flagged on the day itself and lasts a month after', () => {
    expect(birthdayPass('1994-10-19', null, '2026-10-19')?.isBirthday).toBe(true);
    expect(birthdayPass('1994-10-19', null, '2026-11-18')?.available).toBe(true);
    expect(birthdayPass('1994-10-19', null, '2026-11-19')).toBeNull();
  });
  it('can only be used once per birthday', () => {
    expect(birthdayPass('1994-10-19', 2026, '2026-10-15')?.available).toBe(false);
    expect(birthdayPass('1994-10-19', 2025, '2026-10-15')?.available).toBe(true);
  });
  it('works across new year', () => {
    expect(birthdayPass('1990-01-03', null, '2026-12-28')).toMatchObject({ occurrence: '2027-01-03', year: 2027, daysUntil: 6 });
    expect(birthdayPass('1990-01-03', null, '2027-01-20')).toMatchObject({ occurrence: '2027-01-03', year: 2027 });
  });
  it('handles 29 February', () => {
    expect(birthdayPass('1996-02-29', null, '2027-02-28')?.isBirthday).toBe(true);
    expect(nextBirthday('1996-02-29', '2027-01-01')).toBe('2027-02-28');
  });
  it('no birthday, no pass', () => {
    expect(birthdayPass(null, null, '2026-10-12')).toBeNull();
  });
});
