import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import type { DailyLog, Profile } from '../data/types';
import { toISODate } from '../lib/challenge';
import { bodyStats } from '../lib/body';
import { dayEnergy } from '../lib/energy';
import { fmt } from './ui';

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(Math.round(n)))}`;

/** Net calories (eaten − burned) for each day this week, as bars above or below zero. */
export function CaloriesWeekCard({ logs, profile, today }: { logs: Record<string, DailyLog>; profile: Profile; today: string }) {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = toISODate(addDays(monday, i));
    const log = logs[d];
    const eaten = typeof log?.calories === 'number' ? log.calories : null;
    const energy = d <= today && log ? dayEnergy(log, bodyStats(profile, logs, d), { date: d, today }) : null;
    return { d, letter: format(parseISO(d), 'EEEEE'), name: format(parseISO(d), 'EEEE'), net: eaten !== null && energy ? eaten - energy.total : null, today: d === today };
  });
  const done = days.filter((x) => x.net !== null && !x.today);
  const avg = done.length ? done.reduce((a, x) => a + (x.net ?? 0), 0) / done.length : null;
  const scale = Math.max(400, ...days.map((x) => Math.abs(x.net ?? 0)));
  const logged = days.some((x) => x.net !== null);

  return (
    <section className="card cal-week" aria-labelledby="cal-week-h">
      <div className="card-head" style={{ alignItems: 'baseline' }}>
        <h2 className="card-title" id="cal-week-h">
          Net calories this week
        </h2>
        {avg !== null && (
          <span className="card-sub">
            avg <strong className="cal-week-avg">{signed(avg)}</strong> a day
          </span>
        )}
      </div>
      {logged ? (
        <>
          <div
            className="cal-week-chart"
            role="img"
            aria-label={`Net calories by day: ${days
              .map((x) => `${x.name} ${x.net === null ? 'nothing logged' : `${signed(x.net)}${x.today ? ' so far' : ''}`}`)
              .join(', ')}`}
          >
            <span className="cal-week-zero" aria-hidden="true" />
            {days.map((x) => {
              const h = x.net === null ? 0 : Math.max(2, (Math.abs(x.net) / scale) * 50);
              return (
                <span key={x.d} className="cal-week-col" aria-hidden="true">
                  {x.net !== null && (
                    <span
                      className={`cal-week-bar ${x.net > 0 ? 'over' : 'under'}${x.today ? ' partial' : ''}`}
                      style={x.net > 0 ? { bottom: '50%', height: `${h}%` } : { top: '50%', height: `${h}%` }}
                    />
                  )}
                </span>
              );
            })}
          </div>
          <div className="cal-week-labels" aria-hidden="true">
            {days.map((x) => (
              <span key={x.d} className={x.today ? 'on' : undefined}>
                <b>{x.letter}</b>
                {x.net === null ? '–' : signed(x.net)}
              </span>
            ))}
          </div>
          <p className="card-sub" style={{ margin: 0 }}>
            Eaten minus burned. Below the line is a deficit.{days.some((x) => x.today && x.net !== null) ? ' Today’s bar is so far.' : ''}
          </p>
        </>
      ) : (
        <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
          Log food and each day’s eaten minus burned shows up here.
        </p>
      )}
    </section>
  );
}
