import { describe, expect, it } from 'vitest';
import { emptyLog } from '../data/types';
import { fitWithin, photoDays, thumbPath } from './photos';

describe('photos', () => {
  it('shrinks to fit without ever enlarging', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(4032, 3024, 400)).toEqual({ w: 400, h: 300 });
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });

  it('keeps the small version next to the full one', () => {
    expect(thumbPath('abc/2026-10-12-x1.jpg')).toBe('abc/2026-10-12-x1.t.jpg');
  });

  it('lists photo days oldest first with their challenge day', () => {
    const logs = {
      '2026-10-12': { ...emptyLog('2026-10-12'), photo_path: 'u/2026-10-12-b.jpg' },
      '2026-10-01': { ...emptyLog('2026-10-01'), photo_path: 'u/2026-10-01-a.jpg' },
      '2026-10-05': emptyLog('2026-10-05'),
    };
    const days = photoDays(logs, (d) => (d === '2026-10-01' ? 1 : 12));
    expect(days).toEqual([
      { date: '2026-10-01', path: 'u/2026-10-01-a.jpg', day: 1 },
      { date: '2026-10-12', path: 'u/2026-10-12-b.jpg', day: 12 },
    ]);
  });
});
