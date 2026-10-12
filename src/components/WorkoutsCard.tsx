import type { WorkoutEntry, WorkoutFavorite } from '../data/types';
import type { BodyStats } from '../lib/activities';
import { INTENSITIES } from '../lib/activities';
import { entryKcal, entryName } from '../lib/body';
import { barSegments, favoriteName, formatMinutes, type RecentWorkout } from '../lib/workouts';
import { ActivityIcon } from './ActivityIcon';
import { fmt } from './ui';
import { IconCheck, IconPlus, IconStar } from './Icons';
import { tap } from '../lib/haptics';

/**
 * Today's workouts: any mix of sessions that adds up to the daily total (90 minutes by default).
 * The bar fills one chunk per workout; quick-log chips log a saved favourite in one tap.
 */
export function WorkoutsCard({
  entries,
  goal,
  body,
  quick,
  quickIsRecent,
  onAdd,
  onEdit,
  onQuickLog,
}: {
  entries: WorkoutEntry[];
  goal: number;
  body: BodyStats;
  /** Favourites, or her recent workouts when she hasn't saved any yet. */
  quick: (WorkoutFavorite | RecentWorkout)[];
  quickIsRecent: boolean;
  onAdd: () => void;
  onEdit: (entry: WorkoutEntry) => void;
  onQuickLog: (f: WorkoutFavorite | RecentWorkout) => void;
}) {
  const minutes = entries.reduce((a, w) => a + (w.minutes || 0), 0);
  const done = minutes >= goal;
  const left = goal - minutes;
  const segments = barSegments(entries, goal);

  return (
    <section className="card wk-card" aria-labelledby="wk-title">
      <div className="card-head" style={{ alignItems: 'center' }}>
        <h2 className="card-title" id="wk-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {done && (
            <span className="wk-done-badge" aria-hidden="true">
              <IconCheck size={14} strokeWidth={3.2} />
            </span>
          )}
          Workouts
        </h2>
        <span className="wk-total">
          <strong>{minutes}</strong> / {goal} min
        </span>
      </div>

      <div
        className={`wk-bar${done ? ' done' : ''}`}
        role="progressbar"
        aria-label="Workout minutes today"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(minutes, goal)}
        aria-valuetext={`${minutes} of ${goal} minutes`}
      >
        {segments.map((s) => (
          <span key={s.id} style={{ width: `${s.pct}%` }} />
        ))}
      </div>

      <p className="wk-hint">
        {done ? (
          <>
            <strong>Done!</strong> {formatMinutes(minutes)} today{minutes > goal ? `, ${formatMinutes(minutes - goal)} extra` : ''}.
          </>
        ) : minutes > 0 ? (
          <>
            <strong>{formatMinutes(left)} to go.</strong> Any workout counts.
          </>
        ) : (
          <>
            <strong>{formatMinutes(goal)} today,</strong> any mix. Say 45 min reformer, 30 min weights and 15 min stairs.
          </>
        )}
      </p>

      {entries.length > 0 && (
        <ul className="wk-list">
          {entries.map((w) => {
            const kcal = entryKcal(w, body);
            return (
              <li key={w.id}>
                <button type="button" className="wk-row" onClick={() => (tap(), onEdit(w))} aria-label={`${entryName(w)}, ${w.minutes} minutes, ${w.intensity}, about ${kcal} calories. Edit`}>
                  <ActivityIcon activity={w.activity} size={40} />
                  <span className="row-text">
                    <span className="row-title">{entryName(w)}</span>
                    <span className="row-sub">
                      {INTENSITIES.find((i) => i.id === w.intensity)?.label} · ≈{fmt(kcal)} kcal
                      {w.source === 'health' ? ' · Apple Health' : ''}
                    </span>
                  </span>
                  <span className="wk-mins">
                    {w.minutes}
                    <small> min</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {quick.length > 0 && (
        <div className="wk-quick">
          <span className="pick-label">{quickIsRecent ? 'Log again' : 'Quick log'}</span>
          <div className="hscroll wk-chips">
            {quick.map((f, i) => (
              <button
                key={i}
                type="button"
                className="quick-chip"
                onClick={() => onQuickLog(f)}
                aria-label={`Log ${favoriteName(f)}, ${f.minutes} minutes, ${f.intensity}`}
              >
                {!quickIsRecent && <IconStar size={14} filled style={{ color: 'var(--gold)' }} />}
                <span>{favoriteName(f)}</span>
                <span className="quick-chip-min">{f.minutes}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className={`btn btn-block ${done ? 'btn-ghost' : 'btn-dark'}`} style={{ height: 48 }} onClick={() => (tap(), onAdd())}>
        <IconPlus size={20} strokeWidth={2.4} /> {done ? 'Add another workout' : 'Add a workout'}
      </button>
    </section>
  );
}
