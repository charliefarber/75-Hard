import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { useFood } from '../data/FoodData';
import type { FoodEntry, Meal } from '../data/foodTypes';
import { MEALS } from '../data/foodTypes';
import { toISODate } from '../lib/challenge';
import { bodyStats } from '../lib/body';
import { dayEnergy } from '../lib/energy';
import { amountText, byMeal, macroGoals, mealForTime, newId, totals } from '../lib/nutrition';
import { Ring, Sheet, Toast, fmt } from '../components/ui';
import { IconCamera, IconChevron, IconChevronLeft, IconPlus, IconSearch } from '../components/Icons';
import { FoodLogger, type LoggerMode } from '../components/food/FoodLogger';
import { FoodThumb, MacroBars } from '../components/food/bits';
import { tap } from '../lib/haptics';
import '../styles/food.css';

/** The food diary for the selected day: totals and macros up top, then each meal. */
export function FoodScreen({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { profile, logs, today } = useApp();
  const food = useFood();
  const [logger, setLogger] = useState<null | { meal: Meal; mode: LoggerMode; edit?: FoodEntry }>(null);
  const [saving, setSaving] = useState<null | { meal: Meal; name: string }>(null);
  const [toast, setToast] = useState<null | { message: string; undo?: () => void }>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const yesterday = toISODate(addDays(parseISO(date), -1));

  useEffect(() => {
    food.ensure(yesterday, date);
  }, [food, yesterday, date]);

  const entries = food.entriesFor(date);
  const meals = useMemo(() => byMeal(entries), [entries]);
  const before = useMemo(() => byMeal(food.entriesFor(yesterday)), [food, yesterday]);
  if (!profile) return null;

  const t = totals(entries);
  const log = logs[date];
  const eaten = entries.length ? t.kcal : log?.calories ?? 0;
  const goals = macroGoals(profile);
  const energy = dayEnergy(log, bodyStats(profile, logs, date), { date, today });
  const goal = profile.calorie_goal;
  const left = goal ? goal - eaten : null;
  const isToday = date === today;

  return (
    <div className="screen page-pad food-screen">
      <div className="food-head">
        <h1 className="page-title">Food</h1>
        <div className="date-switch">
          <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => (tap(), setDate(yesterday))}>
            <IconChevronLeft size={20} />
          </button>
          <button type="button" className="date-label" onClick={() => setDate(today)} aria-label="Go to today">
            {isToday ? 'Today' : date === toISODate(addDays(parseISO(today), -1)) ? 'Yesterday' : format(parseISO(date), 'EEE d MMM')}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next day"
            disabled={date >= today}
            onClick={() => (tap(), setDate(toISODate(addDays(parseISO(date), 1))))}
          >
            <IconChevron size={20} />
          </button>
        </div>
      </div>

      <section className="card food-summary" aria-label="Calories and macros">
        <div className="food-summary-top">
          <Ring
            size={124}
            stroke={11}
            value={eaten}
            max={goal ?? Math.max(energy.total, eaten, 1)}
            color={left !== null && left < 0 ? 'var(--steps)' : 'var(--green)'}
            track="var(--mint-tint)"
            label={goal ? `${fmt(eaten)} of ${fmt(goal)} kcal eaten` : `${fmt(eaten)} kcal eaten`}
          >
            <span className="ring-big">{fmt(Math.abs(left ?? eaten))}</span>
            <span className="ring-small">{left === null ? 'kcal eaten' : left < 0 ? 'kcal over' : 'kcal left'}</span>
          </Ring>
          <div className="food-stats">
            <Stat label="Eaten" value={fmt(eaten)} sub={goal ? `of ${fmt(goal)}` : undefined} />
            <Stat label="Burned" value={fmt(energy.total)} sub={energy.partial ? 'so far' : undefined} />
            <Stat
              label="Net"
              value={`${eaten - energy.total > 0 ? '+' : eaten - energy.total < 0 ? '−' : ''}${fmt(Math.abs(eaten - energy.total))}`}
              sub={eaten - energy.total <= 0 ? 'deficit' : 'surplus'}
            />
          </div>
        </div>
        <MacroBars t={entries.length ? t : { ...t, kcal: eaten }} goals={goals} />
        {!entries.length && log?.calories ? (
          <p className="card-sub" style={{ margin: 0 }}>
            {fmt(log.calories)} kcal came in from {log.calories_source === 'manual' ? 'a number typed in' : 'Lifesum'}. Log here and it’s kept as one item.
          </p>
        ) : null}
      </section>

      <div className="log-bar">
        <button type="button" className="log-bar-search" onClick={() => (tap(), setLogger({ meal: mealForTime(), mode: 'search' }))}>
          <IconSearch size={20} />
          <span>Search or add food</span>
        </button>
        <button type="button" className="log-bar-btn" aria-label="Scan a barcode" onClick={() => (tap(), setLogger({ meal: mealForTime(), mode: 'scan' }))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M10 8v8M13 8v8M16 8v8" />
          </svg>
        </button>
        <button type="button" className="log-bar-btn" aria-label="Snap a photo of a meal" onClick={() => (tap(), setLogger({ meal: mealForTime(), mode: 'photo' }))}>
          <IconCamera size={22} />
        </button>
      </div>

      {MEALS.map((m) => {
        const list = meals[m.id];
        const mt = totals(list);
        const prev = before[m.id];
        return (
          <section key={m.id} className="card meal-card" aria-labelledby={`meal-${m.id}`}>
            <div className="meal-head">
              <h2 className="card-title" id={`meal-${m.id}`}>
                {m.label}
              </h2>
              <span className="meal-kcal">{list.length ? `${fmt(mt.kcal)} kcal` : ''}</span>
              <button type="button" className="add-btn" aria-label={`Add to ${m.label.toLowerCase()}`} onClick={() => (tap(), setLogger({ meal: m.id, mode: 'search' }))}>
                <IconPlus size={20} strokeWidth={2.6} />
              </button>
            </div>
            {list.length > 0 && (
              <div className="entry-list">
                {list.map((e) => (
                  <button key={e.id} type="button" className="entry-row" onClick={() => (tap(), setLogger({ meal: e.meal, mode: 'search', edit: e }))}>
                    <FoodThumb entry={e} size={36} />
                    <span className="row-text">
                      <span className="row-title">{e.name}</span>
                      <span className="row-sub">{[amountText(e), e.brand].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="entry-kcal">{fmt(Math.round(e.kcal))}</span>
                  </button>
                ))}
              </div>
            )}
            {!list.length && prev.length > 0 && (
              <button
                type="button"
                className="copy-btn"
                onClick={async () => {
                  tap();
                  const copies = prev.map((e) => ({ ...e, id: newId(), log_date: date, created_at: undefined }));
                  await food.add(copies).catch(() => {});
                  setToast({ message: `Copied ${m.label.toLowerCase()} · ${fmt(totals(copies).kcal)} kcal`, undo: () => food.remove(copies.map((c) => c.id)) });
                }}
              >
                Copy yesterday’s {m.label.toLowerCase()} · {fmt(totals(prev).kcal)} kcal
              </button>
            )}
            {list.length >= 2 && (
              <button type="button" className="link-btn save-meal" onClick={() => setSaving({ meal: m.id, name: `My ${m.label.toLowerCase()}` })}>
                Save as a meal
              </button>
            )}
          </section>
        );
      })}

      <FoodLogger
        open={!!logger}
        date={date}
        meal={logger?.meal ?? 'snacks'}
        mode={logger?.mode}
        edit={logger?.edit}
        onClose={() => setLogger(null)}
        onDeleted={(removed) => setToast({ message: `Deleted ${removed[0]?.name ?? 'item'}`, undo: () => food.restore(removed) })}
      />

      <Sheet open={!!saving} onClose={() => setSaving(null)} title="Save as a meal">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!saving?.name.trim()) return;
            await food.saveMeal(saving.name, meals[saving.meal]);
            setSaving(null);
            setToast({ message: 'Saved. It’s under Saved meals when you add food.' });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <label className="field">
            Name
            <input className="input" autoFocus maxLength={60} value={saving?.name ?? ''} onChange={(e) => setSaving((s) => (s ? { ...s, name: e.target.value } : s))} />
          </label>
          <p className="card-sub" style={{ margin: 0 }}>
            {saving ? `${meals[saving.meal].length} items · ${fmt(totals(meals[saving.meal]).kcal)} kcal. Log them all again in one tap.` : ''}
          </p>
          <button type="submit" className="btn btn-primary btn-block">
            Save meal
          </button>
        </form>
      </Sheet>

      {toast && <Toast tone="info" message={toast.message} onClose={closeToast} action={toast.undo ? { label: 'Undo', onClick: toast.undo } : undefined} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="food-stat">
      <span className="food-stat-label">{label}</span>
      <span className="food-stat-value">{value}</span>
      {sub && <span className="food-stat-sub">{sub}</span>}
    </div>
  );
}
