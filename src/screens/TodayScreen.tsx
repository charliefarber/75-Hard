import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isAfter, parseISO, startOfWeek } from 'date-fns';
import { useApp } from '../data/AppData';
import type { DailyLog, Workout } from '../data/types';
import { dayNumber, litres, summarise, taskStatuses, toISODate, weekSteps } from '../lib/challenge';
import { GLASS_ML, Glass } from '../components/Glass';
import { Ring, Sheet, Toggle, fmt } from '../components/ui';
import { IconCheck, IconFlame, IconGrid, IconNote, IconRefresh, IconUndo } from '../components/Icons';
import { success, tap } from '../lib/haptics';

const WORKOUT_TYPES = ['Run', 'Walk', 'Strength', 'HIIT', 'Cycle', 'Yoga', 'Pilates', 'Swim', 'Class', 'Other'];

export function TodayScreen({ date, setDate, openProgress }: { date: string; setDate: (d: string) => void; openProgress: () => void }) {
  const { profile, challenge, logs, logFor, updateLog, today, health, syncHealth } = useApp();
  const [sheet, setSheet] = useState<null | { kind: 'workout'; index: number } | { kind: 'steps' } | { kind: 'calories' }>(null);

  const log = logFor(date);
  const tasks = useMemo(() => (profile ? taskStatuses(log, profile) : []), [log, profile]);
  const summary = useMemo(
    () => (challenge && profile ? summarise(challenge, logs, profile, today) : null),
    [challenge, logs, profile, today],
  );

  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  // Buzz once when the day flips to complete.
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) success();
    wasDone.current = allDone;
  }, [allDone]);

  if (!profile || !challenge || !summary) return null;

  const isToday = date === today;
  const calendarIndex = dayNumber(challenge.start_date, date); // 1 = start date
  const credited = calendarIndex >= 1 && calendarIndex <= challenge.credited_days;
  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const viewing = byDate.get(date);
  const headline =
    calendarIndex < 1 ? 'Starts soon' : viewing?.state === 'missed' ? 'Didn’t count' : `Day ${viewing?.day ?? summary.currentDay}`;
  const set = (patch: Partial<DailyLog>) => updateLog(date, (l) => ({ ...l, ...patch }));
  const setWorkout = (i: number, w: Workout) =>
    updateLog(date, (l) => ({ ...l, workouts: l.workouts.map((x, j) => (j === i ? w : x)) }));

  // Week strip: the Mon–Sun week containing the selected day.
  const weekStart = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = toISODate(addDays(weekStart, i));
    const n = dayNumber(challenge.start_date, d);
    const state = byDate.get(d)?.state ?? null;
    return {
      d,
      n,
      label: format(parseISO(d), 'EEEEE'),
      num: format(parseISO(d), 'd'),
      selectable: n >= 1 && !isAfter(parseISO(d), parseISO(today)),
      state,
    };
  });

  // Only nudge about recent misses; older ones are visible on Progress.
  const weekAgo = toISODate(addDays(parseISO(today), -7));
  const missed = isToday ? summary.missedDays.filter((m) => m.date >= weekAgo) : [];
  const lastMissed = missed[missed.length - 1];
  const steps = log.steps ?? 0;
  const calGoal = profile.calorie_goal;
  const calories = log.calories ?? 0;
  const healthSourced = (s: string | null) => s === 'health' || s === 'shortcut';

  const glassCount = Math.min(32, Math.max(Math.ceil(profile.water_goal_ml / GLASS_ML), Math.ceil(log.water_ml / GLASS_ML)));
  const stepWeek = weekSteps(logs, date);
  const weekGoal = profile.step_goal * 7;
  const k = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

  return (
    <div className="screen">
      <header
        style={{
          background: 'var(--forest)',
          color: '#fff',
          padding: 'calc(var(--safe-top) + 18px) 20px 22px',
          borderRadius: '0 0 32px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mint-soft)' }}>
              {isToday ? 'Today · ' : ''}
              {format(parseISO(date), 'EEEE d MMMM')}
            </span>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {headline}{' '}
              <span style={{ fontWeight: 500, color: 'var(--mint-soft)', fontSize: 20 }}>of 75</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {health.connected && health.available && (
              <button
                className="icon-btn"
                aria-label="Sync Apple Health"
                onClick={() => syncHealth()}
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                <span style={{ display: 'flex', animation: health.syncing ? 'spin 1s linear infinite' : undefined }}>
                  <IconRefresh size={20} />
                </span>
              </button>
            )}
            <button className="icon-btn" aria-label="See all 75 days" onClick={openProgress} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
              <IconGrid size={20} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Ring
            size={132}
            stroke={12}
            value={credited ? 1 : doneCount}
            max={credited ? 1 : tasks.length}
            color="var(--mint)"
            track="rgba(255,255,255,0.14)"
            label={`${doneCount} of ${tasks.length} tasks done`}
          >
            {allDone || credited ? (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, animation: 'pop 0.5s var(--ease)' }}>
                <IconCheck size={40} strokeWidth={3} style={{ color: 'var(--mint)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mint-soft)' }}>day done</span>
              </span>
            ) : (
              <>
                <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {doneCount}/{tasks.length}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mint-soft)' }}>tasks done</span>
              </>
            )}
          </Ring>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <Stat label="Current streak" value={`${summary.streak} ${summary.streak === 1 ? 'day' : 'days'}`} icon />
            <Stat label="Finish line" value={format(parseISO(summary.finishDate), 'EEE d MMM')} />
          </div>
        </div>

        <nav aria-label="This week" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {week.map((w) => {
            const selected = w.d === date;
            const dot =
              w.state === 'complete' ? 'var(--mint)' : w.state === 'missed' ? 'var(--gold)' : 'transparent';
            return (
              <button
                key={w.d}
                disabled={!w.selectable}
                aria-pressed={selected}
                aria-label={format(parseISO(w.d), 'EEEE d MMMM')}
                onClick={() => (tap(), setDate(w.d))}
                style={{
                  border: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 0',
                  borderRadius: 14,
                  background: selected ? '#fff' : 'rgba(255,255,255,0.08)',
                  color: selected ? 'var(--forest)' : '#fff',
                  opacity: w.selectable ? 1 : 0.45,
                  transition: 'background 0.25s, color 0.25s',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: selected ? 'var(--green-ink)' : 'var(--mint-soft)' }}>{w.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{w.num}</span>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: selected && !w.state ? 'transparent' : dot }} />
              </button>
            );
          })}
        </nav>
      </header>

      <main style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lastMissed && (
          <section className="card" style={{ background: '#fff8e8', border: '1.5px solid #f5dfa8' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 className="card-title">
                {format(parseISO(lastMissed.date), 'EEEE')} didn’t count, so you’ve got an extra day
              </h2>
              <p className="card-sub" style={{ margin: 0, lineHeight: 1.5, color: '#6b4e12' }}>
                Finish line is now {format(parseISO(summary.finishDate), 'EEEE d MMMM')}. If you did everything and just didn’t log it, fill the day in.
              </p>
            </div>
            <button className="btn btn-sm btn-dark" style={{ height: 44 }} onClick={() => setDate(lastMissed.date)}>
              Fill in {format(parseISO(lastMissed.date), 'EEE d MMM')}
            </button>
          </section>
        )}

        {viewing?.state === 'missed' && (
          <section className="card" style={{ background: '#fff8e8', border: '1.5px solid #f5dfa8' }}>
            <p className="card-sub" style={{ margin: 0, lineHeight: 1.5, color: '#6b4e12' }}>
              This day didn’t count, so it added a day to the end. Tick off everything you did and it’ll count again.
            </p>
          </section>
        )}

        {!isToday && (
          <button className="btn btn-soft btn-sm" style={{ alignSelf: 'center', height: 40 }} onClick={() => setDate(today)}>
            Back to today
          </button>
        )}

        {credited && (
          <section className="card">
            <p className="card-sub" style={{ margin: 0 }}>
              You counted this day as done when you set up. Anything you log here is extra.
            </p>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <button
            className="card"
            style={{ border: 0, textAlign: 'left', gap: 12 }}
            onClick={() => setSheet({ kind: 'steps' })}
            aria-label={`Steps: ${fmt(stepWeek.total)} of ${fmt(weekGoal)} this week, ${fmt(steps)} today. Edit today`}
          >
            <div className="card-head">
              <span style={{ fontSize: 14, fontWeight: 700 }}>Steps</span>
              <span className="chip">{healthSourced(log.steps_source) ? 'Health' : 'Week'}</span>
            </div>
            <div style={{ alignSelf: 'center' }}>
              <Ring size={100} stroke={10} value={stepWeek.total} max={weekGoal} color="var(--steps)" track="var(--steps-tint)" label={`${fmt(stepWeek.total)} of ${fmt(weekGoal)} steps this week`}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{k(stepWeek.total)}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>of {k(weekGoal)} wk</span>
              </Ring>
            </div>
            <span className="card-sub" style={{ textAlign: 'center' }}>
              <strong style={{ color: 'var(--ink)' }}>{fmt(steps)}</strong> {isToday ? 'today' : 'that day'}
            </span>
          </button>

          <button className="card" style={{ border: 0, textAlign: 'left', gap: 12 }} onClick={() => setSheet({ kind: 'calories' })} aria-label={`Calories: ${fmt(calories)} eaten. Edit`}>
            <div className="card-head">
              <span style={{ fontSize: 14, fontWeight: 700 }}>Calories</span>
              {healthSourced(log.calories_source) ? <span className="chip">Lifesum</span> : null}
            </div>
            <div style={{ alignSelf: 'center' }}>
              <Ring
                size={100}
                stroke={10}
                value={calories}
                max={calGoal ?? Math.max(calories, 1)}
                color={calGoal && calories > calGoal ? 'var(--steps)' : 'var(--green)'}
                track="var(--mint-tint)"
                label={`${fmt(calories)} kcal eaten`}
              >
                {calGoal ? (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{fmt(Math.abs(calGoal - calories))}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{calories > calGoal ? 'kcal over' : 'kcal left'}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{fmt(calories)}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>kcal</span>
                  </>
                )}
              </Ring>
            </div>
            <span className="card-sub" style={{ textAlign: 'center' }}>
              {calGoal ? `${fmt(calories)} of ${fmt(calGoal)} eaten` : 'eaten today'}
            </span>
          </button>
        </div>

        <section className="card" aria-labelledby="water-h">
          <div className="card-head" style={{ alignItems: 'baseline' }}>
            <h2 className="card-title" id="water-h">
              Water
            </h2>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--water)' }}>{litres(log.water_ml)}</span> / {litres(profile.water_goal_ml, 1)} L
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', rowGap: 8, justifyItems: 'center' }}>
            {Array.from({ length: glassCount }, (_, i) => {
              const fill = (log.water_ml - i * GLASS_ML) / GLASS_ML;
              const full = fill >= 1;
              const isLastFull = full && log.water_ml < (i + 2) * GLASS_ML;
              return (
                <button
                  key={i}
                  aria-label={full ? `Glass ${i + 1}, full. Tap to ${isLastFull ? 'empty' : 'set water to here'}` : `Glass ${i + 1}. Tap to fill`}
                  onClick={() => (tap(), set({ water_ml: isLastFull ? i * GLASS_ML : (i + 1) * GLASS_ML }))}
                  style={{ border: 0, background: 'none', padding: 4, borderRadius: 10, display: 'flex' }}
                >
                  <Glass fill={fill} />
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              style={{ flex: 1, height: 48, borderRadius: 14, background: 'var(--water-tint)', color: 'var(--water)', fontSize: 15 }}
              onClick={() => (tap(), set({ water_ml: log.water_ml + GLASS_ML }))}
            >
              <Glass fill={1} size={24} />
              Add a glass
              <span style={{ fontWeight: 600, opacity: 0.75 }}>· {GLASS_ML} ml</span>
            </button>
            <button
              className="icon-btn"
              aria-label="Take away a glass"
              style={{ background: 'var(--surface-2)', color: 'var(--muted)', height: 48, width: 48 }}
              disabled={log.water_ml === 0}
              onClick={() => (tap(), set({ water_ml: Math.max(0, log.water_ml - GLASS_ML) }))}
            >
              <IconUndo size={20} />
            </button>
          </div>
        </section>

        <section className="card list" aria-label="Workouts">
          {log.workouts.map((w, i) => {
            const t = tasks.find((x) => x.id === (i === 0 ? 'workout1' : 'workout2'));
            const done = w.done;
            return (
              <button
                key={i}
                className="row"
                style={{ border: 0, borderBottom: i === 0 ? '1px solid var(--line)' : 0, background: 'none', textAlign: 'left', width: '100%' }}
                onClick={() => setSheet({ kind: 'workout', index: i })}
              >
                <span
                  className="icon-badge"
                  style={
                    done
                      ? { background: 'var(--green)', color: '#fff', animation: 'pop 0.4s var(--ease)' }
                      : { border: '2px dashed #b7c2b9' }
                  }
                >
                  {done && <IconCheck size={20} strokeWidth={2.6} />}
                </span>
                <span className="row-text">
                  <span className="row-title">Workout {i + 1}</span>
                  <span className="row-sub" style={t?.hint ? { color: '#8a4b00', fontWeight: 600 } : undefined}>
                    {t?.hint ??
                      (done
                        ? [w.type || 'Workout', `${w.minutes} min`, w.source === 'health' ? 'from Apple Health' : null].filter(Boolean).join(' · ')
                        : `${profile.workout_minutes} min · indoors or out`)}
                  </span>
                </span>
                {!done && (
                  <span className="btn btn-sm btn-dark" aria-hidden="true">
                    Log
                  </span>
                )}
              </button>
            );
          })}
        </section>

        <section className="card list" aria-label="Daily habits">
          <DietRow
            title={`Read ${profile.reading_goal_pages} pages`}
            sub="Non-fiction"
            checked={log.pages_read >= profile.reading_goal_pages}
            onChange={(v) => set({ pages_read: v ? profile.reading_goal_pages : 0 })}
          />
          <DietRow title="Followed my diet" sub="Whatever plan you picked" checked={log.followed_diet} onChange={(v) => set({ followed_diet: v })} />
          <DietRow title="No cheat meals" sub="Stuck to it all day" checked={log.no_cheat_meal} onChange={(v) => set({ no_cheat_meal: v })} />
          <DietRow title="No alcohol" sub="Zero drinks" checked={log.no_alcohol} onChange={(v) => set({ no_alcohol: v })} />
        </section>

        <section className="card">
          <label className="field" style={{ gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', fontSize: 16, fontWeight: 700 }}>
              <IconNote size={20} style={{ color: 'var(--muted)' }} /> Notes
            </span>
            <textarea
              className="input"
              placeholder="How did today feel?"
              value={log.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
        </section>
      </main>

      <WorkoutSheet
        open={sheet?.kind === 'workout'}
        workout={sheet?.kind === 'workout' ? log.workouts[sheet.index] : undefined}
        index={sheet?.kind === 'workout' ? sheet.index : 0}
        minMinutes={profile.workout_minutes}
        onClose={() => setSheet(null)}
        onSave={(w) => {
          if (sheet?.kind === 'workout') setWorkout(sheet.index, w);
          setSheet(null);
        }}
      />

      <NumberSheet
        open={sheet?.kind === 'steps'}
        title="Steps"
        unit="steps"
        initial={log.steps}
        presets={[profile.step_goal]}
        note={
          health.available
            ? 'Apple Health updates this automatically. A number you type is kept unless Health has a higher one.'
            : 'Type today’s steps from the Health app, or set up the Apple Health shortcut in Profile to fill this in for you.'
        }
        onClose={() => setSheet(null)}
        onSave={(v) => {
          set({ steps: v, steps_source: v === null ? null : 'manual' });
          setSheet(null);
        }}
      />

      <NumberSheet
        open={sheet?.kind === 'calories'}
        title="Calories eaten"
        unit="kcal"
        initial={log.calories}
        note={
          health.available
            ? 'Lifesum sends what you log to Apple Health, and it lands here. A number you type here overrides it for the day. Clear it to go back to Lifesum.'
            : 'Copy the “eaten” number from Lifesum, or set up the Apple Health shortcut in Profile to pull it in automatically.'
        }
        onClose={() => setSheet(null)}
        onSave={(v) => {
          set({ calories: v, calories_source: v === null ? null : 'manual' });
          setSheet(null);
        }}
      />

    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mint-soft)' }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <IconFlame size={18} style={{ color: 'var(--gold)' }} />}
        {value}
      </span>
    </div>
  );
}

function DietRow({ title, sub, checked, onChange }: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-title">{title}</span>
        <span className="row-sub">{sub}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function WorkoutSheet({
  open,
  workout,
  index,
  minMinutes,
  onClose,
  onSave,
}: {
  open: boolean;
  workout?: Workout;
  index: number;
  minMinutes: number;
  onClose: () => void;
  onSave: (w: Workout) => void;
}) {
  const [type, setType] = useState('');
  const [minutes, setMinutes] = useState(minMinutes);

  useEffect(() => {
    if (!open) return;
    setType(workout?.type ?? '');
    setMinutes(workout?.done && workout.minutes ? workout.minutes : minMinutes);
  }, [open, workout, minMinutes]);

  const presets = [minMinutes, 60, 75, 90].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Sheet open={open} onClose={onClose} title={`Workout ${index + 1}`}>
      <div className="chips" role="group" aria-label="Workout type">
        {WORKOUT_TYPES.map((t) => (
          <button key={t} className="chip-btn" aria-pressed={type === t} onClick={() => (tap(), setType(type === t ? '' : t))}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="card-head">
          <span className="row-title">Length</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>
            {minutes} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>min</span>
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={150}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          aria-label="Workout length in minutes"
          style={{ width: '100%', accentColor: 'var(--green)' }}
        />
        <div className="chips">
          {presets.map((p) => (
            <button key={p} className="chip-btn" aria-pressed={minutes === p} onClick={() => setMinutes(p)}>
              {p} min
            </button>
          ))}
        </div>
        {minutes < minMinutes && (
          <span className="card-sub" style={{ color: '#8a4b00', fontWeight: 600 }}>
            75 Hard workouts are at least {minMinutes} minutes.
          </span>
        )}
      </div>


      <button className="btn btn-primary btn-block" onClick={() => onSave({ done: true, minutes, type, outdoor: workout?.outdoor ?? false, source: 'manual' })}>
        {workout?.done ? 'Save' : 'Mark done'}
      </button>
      {workout?.done && (
        <button className="btn btn-ghost btn-block" onClick={() => onSave({ done: false, minutes: 0, type: '', outdoor: false })}>
          Clear this workout
        </button>
      )}
    </Sheet>
  );
}

function NumberSheet({
  open,
  title,
  unit,
  initial,
  note,
  presets = [],
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  unit: string;
  initial: number | null;
  note: string;
  presets?: number[];
  onClose: () => void;
  onSave: (v: number | null) => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue(initial?.toString() ?? '');
  }, [open, initial]);
  const parsed = value === '' ? null : parseInt(value, 10);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(parsed);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label className="field">
          <span className="sr-only">{title}</span>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              style={{ height: 64, fontSize: 28, fontWeight: 800, paddingRight: 72 }}
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="0"
            />
            <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>{unit}</span>
          </div>
        </label>
        {presets.length > 0 && (
          <div className="chips">
            {presets.map((p) => (
              <button type="button" key={p} className="chip-btn" onClick={() => setValue(String(p))}>
                {fmt(p)}
              </button>
            ))}
          </div>
        )}
        <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
          {note}
        </p>
        <button className="btn btn-primary btn-block" type="submit">
          Save
        </button>
        {initial !== null && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => onSave(null)}>
            Clear
          </button>
        )}
      </form>
    </Sheet>
  );
}
