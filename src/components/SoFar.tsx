import type { ChallengeStats, HabitSoFar } from '../lib/report';
import { HABIT_ICON } from './Recap';
import '../styles/report.css';

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
