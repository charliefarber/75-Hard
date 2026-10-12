import type { ReactNode } from 'react';
import type { DailyLog } from '../data/types';
import type { BodyStats } from '../lib/activities';
import { INTENSITIES, bodyStatsMissing } from '../lib/activities';
import { entryKcal, entryName } from '../lib/body';
import { Sheet, fmt } from './ui';
import { IconFlame, IconFork, IconShoe } from './Icons';
import { ActivityIcon } from './ActivityIcon';
import { tap } from '../lib/haptics';

const k = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

/** Eaten · Burned · Steps, at the top of Today. Each opens its own editor or breakdown. */
export function DaySummary({
  eaten,
  calorieGoal,
  eatenFromHealth,
  burned,
  workoutMinutes,
  workoutGoal,
  steps,
  weekSteps,
  weekGoal,
  onEaten,
  onBurned,
  onSteps,
}: {
  eaten: number | null;
  calorieGoal: number | null;
  eatenFromHealth: boolean;
  burned: number;
  workoutMinutes: number;
  workoutGoal: number;
  steps: number | null;
  weekSteps: number;
  weekGoal: number;
  onEaten: () => void;
  onBurned: () => void;
  onSteps: () => void;
}) {
  const over = calorieGoal && eaten !== null ? eaten - calorieGoal : null;
  return (
    <div className="sum-row" role="group" aria-label="Today in numbers">
      <Tile
        kind="eaten"
        icon={<IconFork size={16} />}
        label="Eaten"
        value={eaten === null ? '–' : fmt(eaten)}
        sub={
          eaten === null
            ? 'Tap to add'
            : over === null
              ? eatenFromHealth
                ? 'kcal · Lifesum'
                : 'kcal'
              : over > 0
                ? `${fmt(over)} over`
                : `${fmt(-over)} left`
        }
        pct={calorieGoal && eaten !== null ? eaten / calorieGoal : null}
        warn={over !== null && over > 0}
        aria={`Calories eaten: ${eaten === null ? 'none logged' : `${fmt(eaten)}`}${calorieGoal ? ` of ${fmt(calorieGoal)}` : ''}. Edit`}
        onClick={onEaten}
      />
      <Tile
        kind="burned"
        icon={<IconFlame size={16} />}
        label="Burned"
        value={fmt(burned)}
        sub={`${workoutMinutes}/${workoutGoal} min`}
        pct={workoutMinutes / workoutGoal}
        aria={`About ${fmt(burned)} calories burned in workouts, ${workoutMinutes} of ${workoutGoal} minutes. See how it’s worked out`}
        onClick={onBurned}
      />
      <Tile
        kind="steps"
        icon={<IconShoe size={16} />}
        label="Steps"
        value={steps === null ? '–' : fmt(steps)}
        sub={`${k(weekSteps)}/${k(weekGoal)} wk`}
        pct={weekSteps / weekGoal}
        aria={`Steps: ${fmt(steps ?? 0)} that day, ${fmt(weekSteps)} of ${fmt(weekGoal)} this week. Edit`}
        onClick={onSteps}
      />
    </div>
  );
}

function Tile({
  kind,
  icon,
  label,
  value,
  sub,
  pct,
  warn,
  aria,
  onClick,
}: {
  kind: 'eaten' | 'burned' | 'steps';
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  pct: number | null;
  warn?: boolean;
  aria: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`sum-tile sum-${kind}`} onClick={() => (tap(), onClick())} aria-label={aria}>
      <span className="sum-label">
        <span className="sum-icon">{icon}</span>
        {label}
      </span>
      <span className="sum-value">{value}</span>
      <span className="sum-sub">{sub}</span>
      <span className="sum-meter" aria-hidden="true">
        {pct !== null && <span style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} className={warn ? 'warn' : undefined} />}
      </span>
    </button>
  );
}

/** How "burned" is worked out, workout by workout. */
export function BurnedSheet({
  open,
  log,
  body,
  onClose,
  openProfile,
  logWeight,
}: {
  open: boolean;
  log: DailyLog;
  body: BodyStats;
  onClose: () => void;
  openProfile: () => void;
  logWeight: () => void;
}) {
  const rows = log.workouts.map((w) => ({ w, kcal: entryKcal(w, body) }));
  const total = rows.reduce((a, r) => a + r.kcal, 0);
  const missing = bodyStatsMissing(body);
  return (
    <Sheet open={open} onClose={onClose} title="Calories burned">
      <div className="burn-total">
        <span className="burn-value">≈ {fmt(total)}</span>
        <span className="card-sub">kcal from {rows.length === 1 ? '1 workout' : `${rows.length} workouts`}</span>
      </div>
      {rows.length > 0 ? (
        <div className="pick-list">
          {rows.map(({ w, kcal }) => (
            <div key={w.id} className="pick-row" style={{ cursor: 'default' }}>
              <ActivityIcon activity={w.activity} size={36} />
              <span className="row-text">
                <span className="row-title">{entryName(w)}</span>
                <span className="row-sub">
                  {w.minutes} min · {INTENSITIES.find((i) => i.id === w.intensity)?.label}
                </span>
              </span>
              <strong style={{ fontSize: 15 }}>{fmt(kcal)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="card-sub" style={{ margin: 0 }}>
          Log a workout and its calories show up here.
        </p>
      )}
      <div className="burn-how">
        <strong>How it’s worked out</strong>
        <p>
          Every workout has a measured energy cost from the Compendium of Physical Activities, the research table most fitness apps use. Light, normal
          or hard picks the matching level for that activity. That’s multiplied by the minutes and your weight, then what your body burns at rest
          anyway is taken off, so this is the extra you burned by working out.
        </p>
        <p>Nothing is exact without a chest strap (watches are estimates too), but this uses the same research and puts you in the right range.</p>
      </div>
      {missing.includes('weight') && (
        <button
          type="button"
          className="btn btn-soft btn-block"
          style={{ background: 'var(--mint-tint)', color: 'var(--green-ink)' }}
          onClick={() => {
            onClose();
            logWeight();
          }}
        >
          Log your weight for a closer estimate
        </button>
      )}
      {missing.some((m) => m !== 'weight') && (
        <button
          type="button"
          className="btn btn-soft btn-block"
          style={{ background: 'var(--mint-tint)', color: 'var(--green-ink)' }}
          onClick={() => {
            onClose();
            openProfile();
          }}
        >
          Add your {missing.filter((m) => m !== 'weight').map((m) => (m === 'age' ? 'birthday' : m)).join(' & ')} in Profile
        </button>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}
