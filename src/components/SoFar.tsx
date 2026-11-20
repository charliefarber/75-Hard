import { format, parseISO } from 'date-fns';
import type { WeightUnit } from '../data/types';
import { CHALLENGE_LENGTH } from '../lib/challenge';
import { formatChange, formatWeight, kgToLb } from '../lib/body';
import { timeText, type ChallengeStats, type HabitSoFar } from '../lib/report';
import { HABIT_ICON } from './Recap';
import { fmt } from './ui';
import '../styles/report.css';

const short = (n: number) => (n >= 100000 ? `${Math.round(n / 1000)}k` : n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(n));
const pace = (kgPerWeek: number, unit: WeightUnit) => {
  const v = Math.abs(unit === 'kg' ? kgPerWeek : kgToLb(kgPerWeek));
  return `${v.toFixed(1)} ${unit === 'kg' ? 'kg' : 'lb'} a week`;
};

/** The challenge in numbers: everything she's done since day 1, and where her weight is heading. */
export function SoFarCard({ s, unit, currentDay }: { s: ChallengeStats; unit: WeightUnit; currentDay: number }) {
  const w = s.weight;
  const stats: { label: string; value: string; sub: string }[] = [
    { label: 'Tasks done', value: `${Math.round(s.taskShare * 100)}%`, sub: 'of every daily task' },
    { label: 'Full days', value: String(s.fullDays), sub: s.bestStreak > 1 ? `best run ${s.bestStreak} in a row` : 'days with all four tasks done' },
  ];
  if (w)
    stats.push({
      label: 'Weight',
      value: Math.abs(w.change) < 0.05 ? '±0' : formatChange(w.change, unit),
      sub: w.perWeek != null && Math.abs(w.perWeek) >= 0.02 ? `since day 1 · ${w.perWeek < 0 ? 'down' : 'up'} ${pace(w.perWeek, unit)}` : 'since day 1 (7-day average)',
    });
  stats.push({ label: 'Steps', value: short(s.steps.total), sub: `${fmt(s.steps.perDay)} a day` });
  stats.push({
    label: 'Workouts',
    value: timeText(s.workouts.minutes),
    sub: `${s.workouts.sessions} ${s.workouts.sessions === 1 ? 'session' : 'sessions'}${s.workouts.top ? ` · mostly ${s.workouts.top}` : ''}`,
  });
  if (s.food.logged)
    stats.push({
      label: 'Food logged',
      value: `${s.food.logged} ${s.food.logged === 1 ? 'day' : 'days'}`,
      sub: s.food.avgKcal != null ? `${fmt(s.food.avgKcal)} kcal${s.food.avgProtein != null ? `, ${s.food.avgProtein} g protein` : ''} a day when fully logged` : 'none fully logged yet',
    });
  stats.push({ label: 'Reading', value: fmt(s.pages), sub: 'pages' });
  if (s.soberOf) stats.push({ label: 'Alcohol-free', value: String(s.soberDays), sub: `of ${s.soberOf} ${s.soberOf === 1 ? 'day' : 'days'}` });

  return (
    <section className="card" aria-labelledby="sofar-h">
      <div className="card-head" style={{ alignItems: 'baseline' }}>
        <h2 className="card-title" id="sofar-h">
          Your 75 so far
        </h2>
        <span className="card-sub">
          Day {currentDay} of {CHALLENGE_LENGTH}
        </span>
      </div>
      <div className="sofar-grid">
        {stats.map((x) => (
          <div key={x.label} className="sofar-stat">
            <span>{x.label}</span>
            <strong>{x.value}</strong>
            <small>{x.sub}</small>
          </div>
        ))}
      </div>
      {w?.projected != null && (
        <p className="sofar-note">
          At this pace you’d be about <b>{formatWeight(w.projected, unit)}</b> on day 75 ({format(parseISO(w.finish), 'EEE d MMM')}).
        </p>
      )}
    </section>
  );
}

const WHEN = (h: HabitSoFar) => (h.slips === 'weekends' ? ', mostly at weekends' : h.slips ? `, mostly on ${h.slips}s` : '');

/** How often each daily task gets done, best run and current run, and which one slips most. */
export function HabitsSoFarCard({ s }: { s: ChallengeStats }) {
  const judged = s.habits.filter((h) => h.of > 0);
  // Patterns need a few days to show.
  if (!judged.length || Math.max(...judged.map((h) => h.of)) < 3) return null;
  const weak = s.weakest;
  const all = judged.every((h) => h.rate >= 0.8);
  const isWeak = (h: HabitSoFar) => weak.some((w) => w.id === h.id);
  return (
    <section className="card" aria-labelledby="habits-h">
      <div className="card-head" style={{ alignItems: 'baseline' }}>
        <h2 className="card-title" id="habits-h">
          Habits so far
        </h2>
        <span className="card-sub">days hit</span>
      </div>
      <ul className="habit-rows">
        {judged.map((h) => (
          <li key={h.id} className={`habit-row h-${h.id}${isWeak(h) ? ' weak' : ''}`}>
            <span className={`rep-ico t-${h.id === 'workouts' ? 'workouts' : h.id}`} aria-hidden="true">
              {HABIT_ICON[h.id]}
            </span>
            <span className="habit-row-name">{h.label}</span>
            <span className="habit-row-pct" aria-label={`${h.label}: ${h.hit} of ${h.of} days`}>
              {Math.round(h.rate * 100)}%
            </span>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${Math.round(h.rate * 100)}%`, background: 'var(--c)' }} />
            </div>
            <small>
              {h.hit}/{h.of} · best run {h.bestStreak}
            </small>
          </li>
        ))}
      </ul>
      <p className="sofar-note">
        {all ? (
          'All four are landing most days. Keep stacking them.'
        ) : weak.length === 1 ? (
          <>
            <b>{weak[0].label}</b> slips most{WHEN(weak[0])}. Doing it more often is the quickest way to more full days.
          </>
        ) : weak.length === 2 ? (
          <>
            <b>{weak[0].label}</b> and <b>{weak[1].label.toLowerCase()}</b> slip most. Doing either more often is the quickest way to more full days.
          </>
        ) : (
          'They’re all at a similar level: any one of them, done more often, adds full days.'
        )}
      </p>
    </section>
  );
}
