import type { ReactNode } from 'react';
import type { DailyLog } from '../data/types';
import type { BodyStats } from '../lib/activities';
import { INTENSITIES, bodyStatsMissing } from '../lib/activities';
import { entryKcal, entryName } from '../lib/body';
import type { Energy } from '../lib/energy';
import { Sheet, fmt } from './ui';
import { IconChevron, IconFlame, IconFork, IconShoe } from './Icons';
import { ActivityIcon } from './ActivityIcon';
import { tap } from '../lib/haptics';

const k = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(Math.round(n)))}`;

/** "2 of 4 meals logged", or where the calories came from when they weren't logged here. */
function loggedText(mealsLogged: number | null, outsideFrom: string | null | undefined) {
  return mealsLogged !== null ? `${mealsLogged} of 4 meals logged` : `from ${outsideFrom ?? 'Lifesum'}`;
}

/**
 * Eaten · Burned · Steps as three rings, with net calories underneath.
 *  - Under Eaten: calories left (target − eaten). Workouts don't add calories back: her target
 *    already holds her deficit.
 *  - Burned is active calories only (workouts + everyday steps), filling up through the day;
 *    resting burn is in the breakdown.
 *  - Net (eaten − everything burned) only shows once she's logged food, with how many meals
 *    that covers, because a day with nothing logged isn't a deficit.
 */
export function EnergyCard({
  energy,
  eaten,
  calorieGoal,
  activeGoal,
  steps,
  stepGoal,
  weekSteps,
  mealsLogged,
  outsideFrom,
  onEaten,
  onBurned,
  onSteps,
}: {
  energy: Energy;
  eaten: number | null;
  calorieGoal: number | null;
  activeGoal: number;
  steps: number | null;
  stepGoal: number;
  weekSteps: number;
  /** Meals with something logged in the diary; null when the calories came from elsewhere. */
  mealsLogged: number | null;
  /** Where the calories came from when they weren't logged in the diary ("Lifesum"). */
  outsideFrom?: string | null;
  onEaten: () => void;
  onBurned: () => void;
  onSteps: () => void;
}) {
  const left = calorieGoal && eaten !== null ? calorieGoal - eaten : null;
  const net = eaten !== null && eaten > 0 ? eaten - energy.total : null;
  return (
    <section className="card energy" aria-label="Calories and steps">
      <div className="energy-rings">
        <RingButton
          kind="eat"
          icon={<IconFork size={14} strokeWidth={2.4} />}
          label="Eaten"
          value={eaten === null ? '0' : fmt(eaten)}
          unit="kcal"
          pct={calorieGoal ? (eaten ?? 0) / calorieGoal : 0}
          sub={left === null ? (calorieGoal ? `of ${fmt(calorieGoal)}` : 'no target set') : left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}
          warn={left !== null && left < 0}
          aria={`Eaten ${fmt(eaten ?? 0)} calories${calorieGoal ? ` of ${fmt(calorieGoal)}` : ''}. Open food diary`}
          onClick={onEaten}
        />
        <RingButton
          kind="burn"
          icon={<IconFlame size={14} strokeWidth={2.4} />}
          label="Burned"
          value={fmt(energy.active)}
          unit="active"
          pct={activeGoal ? energy.active / activeGoal : 0}
          sub={`of ${fmt(activeGoal)} goal`}
          aria={`Burned ${fmt(energy.active)} active calories${energy.partial ? ' so far' : ''}, of a ${fmt(activeGoal)} goal. See the breakdown`}
          onClick={onBurned}
        />
        <RingButton
          kind="steps"
          icon={<IconShoe size={14} strokeWidth={2.4} />}
          label="Steps"
          value={steps === null ? '0' : fmt(steps)}
          unit="steps"
          pct={stepGoal ? (steps ?? 0) / stepGoal : 0}
          sub={`${k(weekSteps)} this week`}
          aria={`${fmt(steps ?? 0)} steps, ${fmt(weekSteps)} this week. Edit`}
          onClick={onSteps}
        />
      </div>
      <button
        type="button"
        className="net-row"
        onClick={() => (tap(), onBurned())}
        aria-label={net === null ? 'Net calories show once you’ve logged food. See the breakdown' : `Net calories ${signed(net)}${energy.partial ? ' so far' : ''}, ${loggedText(mealsLogged, outsideFrom)}. See the breakdown`}
      >
        <span className="net-text">
          <span className="net-label">{net !== null && energy.partial ? 'Net so far' : 'Net calories'}</span>
          <span className="net-sub">{net === null ? 'Shows once you’ve logged food' : loggedText(mealsLogged, outsideFrom)}</span>
        </span>
        {net !== null && (
          <span className="net-value">
            <strong>{signed(net)}</strong>
            <span>{`${net <= 0 ? 'deficit' : 'surplus'}${energy.partial ? ' so far' : ''}`}</span>
          </span>
        )}
        <IconChevron size={18} style={{ color: 'var(--faint)', flex: 'none' }} />
      </button>
    </section>
  );
}

function RingButton({
  kind,
  icon,
  label,
  value,
  unit,
  pct,
  sub,
  warn,
  aria,
  onClick,
}: {
  kind: 'eat' | 'burn' | 'steps';
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  pct: number;
  sub: string;
  warn?: boolean;
  aria: string;
  onClick: () => void;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct || 0));
  return (
    <button type="button" className={`ering ering-${kind}`} onClick={() => (tap(), onClick())} aria-label={aria}>
      <span className="ering-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ering-track" cx="50" cy="50" r={r} />
          <circle
            className="ering-fill ring-progress"
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p)}
            transform="rotate(-90 50 50)"
            style={{ opacity: p === 0 ? 0 : 1 }}
          />
        </svg>
        <span className="ering-center">
          <strong>{value}</strong>
          <span>{unit}</span>
        </span>
      </span>
      <span className="ering-label">
        <span className="ering-icon">{icon}</span>
        {label}
      </span>
      <span className={`ering-sub${warn ? ' warn' : ''}`}>{sub}</span>
    </button>
  );
}

/** Where the day's calories went: resting, each workout, everyday steps, and the net. */
export function EnergySheet({
  open,
  energy,
  log,
  body,
  activeGoal,
  calorieGoal,
  mealsLogged,
  outsideFrom,
  title,
  onClose,
  openProfile,
  logWeight,
}: {
  open: boolean;
  energy: Energy;
  log: DailyLog;
  body: BodyStats;
  activeGoal: number;
  calorieGoal: number | null;
  mealsLogged: number | null;
  outsideFrom?: string | null;
  title: string;
  onClose: () => void;
  openProfile: () => void;
  logWeight: () => void;
}) {
  const workouts = log.workouts.map((w) => ({ w, kcal: entryKcal(w, body) }));
  const missing = bodyStatsMissing(body);
  const net = energy.eaten !== null && energy.eaten > 0 ? energy.eaten - energy.total : null;
  const parts = [
    { key: 'rest', label: 'Resting', value: energy.resting, cls: 'seg-rest' },
    { key: 'work', label: 'Workouts', value: energy.workouts, cls: 'seg-work' },
    { key: 'steps', label: 'Steps', value: energy.steps, cls: 'seg-steps' },
  ];
  const total = Math.max(1, energy.total);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="en-top">
        <div>
          <span>Eaten</span>
          <strong>{net === null ? '–' : fmt(energy.eaten ?? 0)}</strong>
        </div>
        <span className="en-op" aria-hidden="true">
          −
        </span>
        <div>
          <span>Burned</span>
          <strong>{fmt(energy.total)}</strong>
        </div>
        <span className="en-op" aria-hidden="true">
          =
        </span>
        <div>
          <span>Net</span>
          <strong>{net === null ? '–' : signed(net)}</strong>
        </div>
      </div>
      <p className="card-sub" style={{ margin: '-6px 0 0', textAlign: 'center' }}>
        {net === null
          ? 'Net calories show once you’ve logged food.'
          : `${net <= 0 ? `${fmt(-net)} kcal under what you’ve burned` : `${fmt(net)} kcal over what you’ve burned`}${energy.partial ? ' so far today' : ''} · ${loggedText(mealsLogged, outsideFrom)}.`}
      </p>
      {calorieGoal ? (
        <p className="en-note">
          Your {fmt(calorieGoal)} kcal target already includes your deficit, so workouts don’t add calories back to what’s left to eat.
        </p>
      ) : null}

      <div className="en-block">
        <div className="en-bar" aria-hidden="true">
          {parts.map((p) => (p.value > 0 ? <span key={p.key} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
        </div>
        <div className="en-rows">
          <Row
            cls="seg-rest"
            title="Resting"
            sub={energy.partial ? `So far today, out of ${fmt(energy.restingDay)} for the whole day` : 'Your body at rest, all day'}
            value={energy.resting}
          />
          <Row cls="seg-work" title="Workouts" sub={workouts.length ? undefined : 'None logged'} value={energy.workouts} />
          {workouts.map(({ w, kcal }) => (
            <div key={w.id} className="en-sub-row">
              <ActivityIcon activity={w.activity} size={28} />
              <span className="row-text">
                <span className="en-sub-title">{entryName(w)}</span>
                <span className="row-sub">
                  {w.minutes} min · {INTENSITIES.find((i) => i.id === w.intensity)?.label}
                </span>
              </span>
              <span>{fmt(kcal)}</span>
            </div>
          ))}
          <Row
            cls="seg-steps"
            title="Everyday steps"
            sub={
              log.steps
                ? energy.workoutSteps > 0
                  ? `${fmt(energy.stepsCounted)} steps outside your workouts (those are counted there)`
                  : `${fmt(log.steps)} steps`
                : 'No steps yet'
            }
            value={energy.steps}
          />
          <div className="en-total">
            <span>Active</span>
            <span className="card-sub">workouts + steps · goal {fmt(activeGoal)}</span>
            <strong>{fmt(energy.active)}</strong>
          </div>
          <div className="en-total big">
            <span>Total burned</span>
            <span className="card-sub">resting + active</span>
            <strong>{fmt(energy.total)}</strong>
          </div>
        </div>
      </div>

      <details className="burn-how">
        <summary>How it’s worked out</summary>
        <p>
          <strong>Resting</strong> is your basal metabolic rate from the Mifflin-St Jeor equation, using your weight, height, age and sex
          {energy.approx ? ' (until those are filled in, it’s a rough figure from your weight)' : ''}. For today it only counts the hours that have passed, so the
          numbers are true right now.
        </p>
        <p>
          <strong>Workouts</strong> use measured energy costs from the Compendium of Physical Activities, the research table most fitness apps use: light, normal
          or hard picks the level, measured against your own resting rate and multiplied by the minutes, minus what you’d have burned resting anyway.
        </p>
        <p>
          <strong>Steps</strong> count as everyday walking. Steps taken during a logged walk or run are already in that workout, so they’re taken off first.
        </p>
        <p>Nothing is exact without a heart-rate strap (watches estimate too), but this puts you in the right range.</p>
      </details>

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

function Row({ cls, title, sub, value }: { cls: string; title: string; sub?: string; value: number }) {
  return (
    <div className="en-row">
      <span className={`en-dot ${cls}`} aria-hidden="true" />
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <strong>{fmt(value)}</strong>
    </div>
  );
}
