import { useEffect, useState } from 'react';

/** The current time, refreshed every minute while `live` (so "so far today" numbers keep up). */
export function useMinuteTick(live: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!live) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [live]);
  return now;
}
