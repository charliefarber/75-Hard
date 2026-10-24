import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { useFood } from '../data/FoodData';
import type { FoodEntry, Meal, MealPrep, SavedMeal } from '../data/foodTypes';
import { MEALS } from '../data/foodTypes';
import { toISODate } from '../lib/challenge';
import { bodyStats } from '../lib/body';
import { dayEnergy, defaultActiveGoal, restingDay } from '../lib/energy';
import { useMinuteTick } from '../lib/useMinuteTick';
import { FoodGoalsSheet } from '../components/food/GoalsSheet';
import { amountText, byMeal, macroGoals, mealForTime, mealsWithFood, totals } from '../lib/nutrition';
import { copyEntries, goToFoods, sameAsYesterday, signatureOf, yourUsual, type Suggestion } from '../lib/usual';
import { leftLabel, portionNutrition } from '../lib/mealPrep';
import { addDays as addIsoDays } from '../lib/weeks';
import { Ring, Sheet, Toast, fmt } from '../components/ui';
import { IconCamera, IconCheck, IconChevron, IconChevronLeft, IconPlus, IconSearch } from '../components/Icons';
import { FoodLogger, type LoggerMode } from '../components/food/FoodLogger';
import { FoodThumb, MacroBars } from '../components/food/bits';
import { MealIcon, PrepIcon } from '../components/food/MealIcon';
import { MealSuggestions, type QuickOption } from '../components/food/QuickLog';
import { MealPrepSheet } from '../components/food/MealPrepSheet';
import { success, tap } from '../lib/haptics';
import '../styles/food.css';

/**
 * The food diary for the selected day: totals and macros up top, then each meal, then meal prep.
 * An empty meal offers one-tap logging: her usual, the same as yesterday, a meal-prep portion,
 * saved meals she's chosen for that meal, and (for snacks) her go-to snacks.
 */
export function FoodScreen({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { profile, logs, today, updateProfile } = useApp();
  const [goalsOpen, setGoalsOpen] = useState(false);
  const now = useMinuteTick(date === today);
  const food = useFood();
  const [logger, setLogger] = useState<null | { meal: Meal; mode: LoggerMode; edit?: FoodEntry; photo?: File; focus?: boolean }>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<null | { meal: Meal; name: string; off: string[]; slots: Meal[] }>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [toast, setToast] = useState<null | { message: string; undo?: () => void }>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const yesterday = toISODate(addDays(parseISO(date), -1));

  const { ensure } = food;
  const twoWeeksBack = addIsoDays(date, -14);
  useEffect(() => {
    ensure(twoWeeksBack, date); // two weeks of history for "your usual"
  }, [ensure, twoWeeksBack, date]);

  const entries = food.entriesFor(date);
  const meals = useMemo(() => byMeal(entries), [entries]);
  const history = useMemo(() => {
    const out: FoodEntry[] = [];
    for (let i = 1; i <= 14; i++) out.push(...food.entriesFor(addIsoDays(date, -i)));
    return out;
  }, [food, date]);
  if (!profile) return null;

  const t = totals(entries);
  const log = logs[date];
  const eaten = entries.length ? t.kcal : log?.calories ?? 0;
  const goals = macroGoals(profile);
  const body = bodyStats(profile, logs, date);
  const energy = dayEnergy({ workouts: log?.workouts ?? [], steps: log?.steps ?? null, calories: eaten }, body, { date, today, now });
  const activeDefault = defaultActiveGoal(profile, body);
  const goal = profile.calorie_goal;
  const left = goal ? goal - eaten : null;
  const isToday = date === today;
  // Net only once something's been eaten (a day with nothing logged isn't a deficit), with how much of the day it covers.
  const net = eaten > 0 ? eaten - energy.total : null;
  const netSub = entries.length ? `${mealsWithFood(entries)} of 4 meals` : 'from Lifesum';

  // ---- one-tap logging (each shows a toast with Undo) ----
  const done = (label: string, logged: FoodEntry[]) => {
    success();
    setToast({ message: `${label} · ${fmt(Math.round(totals(logged).kcal))} kcal`, undo: () => food.remove(logged.map((e) => e.id)) });
  };
  const logCopies = async (src: FoodEntry[], meal: Meal, label: string) => {
    const copies = copyEntries(src, date, meal);
    try {
      await food.add(copies);
      done(label, copies);
    } catch {
      /* already reported */
    }
  };
  const logSaved = async (m: SavedMeal, meal: Meal) => {
    const logged = await food.logMeal(m, date, meal).catch(() => null);
    if (logged) done(m.name, logged);
  };
  const logPortion = async (p: MealPrep, meal: Meal) => {
    const logged = await food.logPrep(p, 1, date, meal).catch(() => null);
    if (logged) done(`${p.name}, 1 portion`, logged);
  };
  const clip = (t: string, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const suggestionsFor = (meal: Meal): { usual: Suggestion | null; options: QuickOption[] } => {
    const usual = yourUsual(history, { date, meal });
    const options: QuickOption[] = [];
    const y = sameAsYesterday(history, { date, meal });
    if (y && y.signature !== usual?.signature)
      options.push({ key: 'yesterday', label: 'Same as yesterday', sub: `${clip(y.title)} · ${fmt(y.kcal)}`, onLog: () => logCopies(y.entries, meal, `Same as yesterday’s ${meal}`) });
    if (meal === 'lunch' || meal === 'dinner')
      for (const p of food.mealPreps.filter((x) => x.portions_left >= 1))
        options.push({ key: `prep-${p.id}`, label: p.name, sub: `1 portion · ${fmt(portionNutrition(p).kcal)} · ${leftLabel(p)}`, onLog: () => logPortion(p, meal) });
    for (const m of food.savedMeals.filter((x) => x.slots?.includes(meal)).slice(0, 3))
      options.push({ key: `meal-${m.id}`, label: m.name, sub: `Saved meal · ${fmt(Math.round(totals(m.items).kcal))}`, onLog: () => logSaved(m, meal) });
    // Go-to snacks, skipping any food already offered above on its own
    const offered = new Set([usual, y].filter((x): x is Suggestion => !!x && x.entries.length === 1).map((x) => x.signature));
    if (meal === 'snacks')
      for (const f of goToFoods(history, { date, meal }).filter((f) => !offered.has(signatureOf([f]))))
        options.push({ key: `go-${f.id}`, label: f.name, sub: `${amountText(f)} · ${fmt(Math.round(f.kcal))}`, onLog: () => logCopies([f], meal, f.name) });
    return { usual, options };
  };
  const preps = food.mealPreps;
  const picked = saving ? meals[saving.meal].filter((e) => !saving.off.includes(e.id)) : [];

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
          <button type="button" className="ring-btn" onClick={() => (tap(), setGoalsOpen(true))} aria-label={`${goal ? `${fmt(eaten)} of ${fmt(goal)} kcal eaten` : `${fmt(eaten)} kcal eaten`}. Calorie and macro targets`}>
            <Ring size={124} stroke={11} value={goal ? eaten : 0} max={goal ?? 1} color="var(--green)" track="var(--mint-tint)" label="">
              <span className="ring-big">{fmt(Math.abs(left ?? eaten))}</span>
              <span className={`ring-small${left !== null && left < 0 ? ' warn' : ''}`}>{left === null ? 'kcal eaten' : left < 0 ? 'kcal over' : 'kcal left'}</span>
            </Ring>
          </button>
          <div className="food-stats">
            <Stat label="Eaten" value={fmt(eaten)} sub={goal ? `of ${fmt(goal)}` : undefined} />
            <Stat label="Burned" value={fmt(energy.active)} sub={energy.partial ? 'active so far' : 'active'} />
            {net === null ? (
              <Stat label="Net" value="–" sub="once you log food" />
            ) : (
              <Stat label="Net" value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(Math.round(net)))}`} sub={`${net <= 0 ? 'deficit' : 'surplus'} · ${netSub}`} />
            )}
          </div>
        </div>
        <MacroBars t={entries.length ? t : { ...t, kcal: eaten }} goals={goals} />
        {goal ? (
          <button type="button" className="link-btn targets-link" onClick={() => (tap(), setGoalsOpen(true))}>
            Targets: {fmt(goal)} kcal{goals ? ` · P ${goals.protein} · C ${goals.carbs} · F ${goals.fat} g` : ''}
            <IconChevron size={14} />
          </button>
        ) : (
          <button type="button" className="btn btn-soft btn-sm targets-set" onClick={() => (tap(), setGoalsOpen(true))}>
            Set a calorie target
          </button>
        )}
        {!entries.length && log?.calories ? (
          <p className="card-sub" style={{ margin: 0 }}>
            {fmt(log.calories)} kcal came in from {log.calories_source === 'manual' ? 'a number typed in' : 'Lifesum'}. Log here and it’s kept as one item.
          </p>
        ) : null}
      </section>

      <div className="log-bar">
        <button type="button" className="log-bar-search" onClick={() => (tap(), setLogger({ meal: mealForTime(), mode: 'search', focus: true }))}>
          {food.ai !== false ? <span aria-hidden="true">✨</span> : <IconSearch size={20} />}
          <span>{food.ai !== false ? 'What did you eat?' : 'Search foods'}</span>
        </button>
        <button type="button" className="log-bar-btn" aria-label="Scan a barcode" onClick={() => (tap(), setLogger({ meal: mealForTime(), mode: 'scan' }))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M10 8v8M13 8v8M16 8v8" />
          </svg>
        </button>
        {food.ai !== false && (
          <button type="button" className="log-bar-btn" aria-label="Snap a photo of a meal" onClick={() => (tap(), photoInput.current?.click())}>
            <IconCamera size={22} />
          </button>
        )}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setLogger({ meal: mealForTime(), mode: 'search', photo: f });
          }}
        />
      </div>

      {MEALS.map((m) => {
        const list = meals[m.id];
        const mt = totals(list);
        const sug = list.length ? null : suggestionsFor(m.id);
        return (
          <section key={m.id} className="card meal-card" aria-labelledby={`meal-${m.id}`}>
            <div className="meal-head">
              <MealIcon meal={m.id} size={36} />
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
            {sug && <MealSuggestions usual={sug.usual} onUsual={() => sug.usual && logCopies(sug.usual.entries, m.id, `Your usual ${m.label.toLowerCase()}`)} options={sug.options} />}
            {list.length >= 2 && (
              <button type="button" className="link-btn save-meal" onClick={() => setSaving({ meal: m.id, name: `My ${m.label.toLowerCase()}`, off: [], slots: [m.id] })}>
                Save as a meal
              </button>
            )}
          </section>
        );
      })}

      <section className="card meal-card prep-card" aria-labelledby="prep-h">
        <div className="meal-head">
          <PrepIcon size={36} />
          <h2 className="card-title" id="prep-h">
            Meal prep
          </h2>
          <span className="meal-kcal" />
          <button type="button" className="add-btn" aria-label="New meal prep" onClick={() => (tap(), setPrepOpen(true))}>
            <IconPlus size={20} strokeWidth={2.6} />
          </button>
        </div>
        {preps.length > 0 ? (
          <div className="entry-list">
            {preps.map((p) => (
              <div key={p.id} className="prep-row">
                <span className="row-text">
                  <span className="row-title">{p.name}</span>
                  <span className={`row-sub${p.portions_left <= 0 ? ' done' : ''}`}>
                    {leftLabel(p)} · {fmt(portionNutrition(p).kcal)} kcal a portion
                  </span>
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={async () => {
                    tap();
                    const gone = await food.deleteMealPrep(p.id);
                    if (gone) setToast({ message: `Removed ${gone.name}`, undo: () => food.restoreMealPrep(gone) });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="card-sub prep-empty">Cooked a batch? Add everything that went in, split it into portions, then log a portion in one tap.</p>
        )}
      </section>

      <MealPrepSheet
        open={prepOpen}
        date={date}
        onClose={() => setPrepOpen(false)}
        onSaved={(prep, logged) => {
          setPrepOpen(false);
          setToast(
            logged.length
              ? { message: `Saved ${prep.name} · 1 of ${prep.portions} portions logged`, undo: () => food.remove(logged.map((e) => e.id)) }
              : { message: `Saved ${prep.name} · ${prep.portions} portions to log` },
          );
        }}
      />

      <FoodLogger
        open={!!logger}
        date={date}
        meal={logger?.meal ?? 'snacks'}
        mode={logger?.mode}
        edit={logger?.edit}
        photo={logger?.photo}
        focus={logger?.focus}
        onClose={() => setLogger(null)}
        onDeleted={(removed) => setToast({ message: `Deleted ${removed[0]?.name ?? 'item'}`, undo: () => food.restore(removed) })}
      />

      <FoodGoalsSheet
        open={goalsOpen}
        profile={profile}
        maintenance={Math.round((restingDay(body).kcal + (profile.active_goal_kcal || activeDefault)) / 10) * 10}
        activeDefault={activeDefault}
        onClose={() => setGoalsOpen(false)}
        onSave={(patch) => {
          updateProfile(patch);
          setGoalsOpen(false);
        }}
      />

      <Sheet open={!!saving} onClose={() => setSaving(null)} title="Save as a meal">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!saving?.name.trim() || !picked.length) return;
            const { name, slots } = saving;
            await food.saveMeal(name, picked, slots);
            setSaving(null);
            setToast({
              message: slots.length
                ? `Saved. It’s a one-tap option at ${slots.map((x) => MEALS.find((m) => m.id === x)!.label.toLowerCase()).join(' and ')}.`
                : 'Saved. It’s under Saved meals when you add food.',
            });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <label className="field">
            Name
            <input className="input" autoFocus maxLength={60} value={saving?.name ?? ''} onChange={(e) => setSaving((s) => (s ? { ...s, name: e.target.value } : s))} />
          </label>
          <div className="save-items" role="group" aria-label="What’s in it">
            {(saving ? meals[saving.meal] : []).map((it) => {
              const on = !saving?.off.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  className="save-item"
                  aria-pressed={on}
                  onClick={() => (tap(), setSaving((s) => (s ? { ...s, off: on ? [...s.off, it.id] : s.off.filter((x) => x !== it.id) } : s)))}
                >
                  <span className={`save-check${on ? ' on' : ''}`} aria-hidden="true">
                    {on && <IconCheck size={14} strokeWidth={3.2} />}
                  </span>
                  <span className="row-text">
                    <span className="row-title">{it.name}</span>
                    <span className="row-sub">{amountText(it)}</span>
                  </span>
                  <span className="entry-kcal">{fmt(Math.round(it.kcal))}</span>
                </button>
              );
            })}
          </div>
          <div className="field">
            Offer it at
            <div className="slot-chips" role="group" aria-label="Offer it at">
              {MEALS.map((x) => {
                const on = !!saving?.slots.includes(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    className="slot-chip"
                    aria-pressed={on}
                    onClick={() => (tap(), setSaving((s) => (s ? { ...s, slots: on ? s.slots.filter((y) => y !== x.id) : [...s.slots, x.id] } : s)))}
                  >
                    {x.label}
                  </button>
                );
              })}
            </div>
            <span className="card-sub">A one-tap option on those meals while they’re empty.</span>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={!picked.length || !saving?.name.trim()}>
            {picked.length ? `Save meal · ${picked.length} ${picked.length === 1 ? 'item' : 'items'} · ${fmt(Math.round(totals(picked).kcal))} kcal` : 'Pick at least one food'}
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
