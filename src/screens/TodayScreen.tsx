import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isAfter, parseISO, startOfWeek } from 'date-fns';
import { useApp } from '../data/AppData';
import type { DailyLog, WeightUnit, WorkoutEntry, WorkoutFavorite } from '../data/types';
import { workoutGoal, workoutMinutes } from '../data/types';
import { dayNumber, litres, summarise, taskStatuses, toISODate, weekSteps } from '../lib/challenge';
import { GLASS_ML, Glass } from '../components/Glass';
import { Ring, Sheet, Toast, ToggleRow, fmt } from '../components/ui';
import { IconCheck, IconGrid, IconNote, IconRefresh, IconUndo } from '../components/Icons';
import { success, tap } from '../lib/haptics';
import { bodyStats, latestWeight, weighIns, weightTrend, weightUnitFor } from '../lib/body';
import { favoriteName, newEntryId, recentWorkouts, toggleFavorite, type RecentWorkout } from '../lib/workouts';
import { photoDays } from '../lib/photos';
import { usePhotoUrls } from '../data/usePhotoUrls';
import { EnergyCard, EnergySheet } from '../components/Energy';
import { dayEnergy, defaultActiveGoal } from '../lib/energy';
import { useFood } from '../data/FoodData';
import type { FoodEntry, Meal } from '../data/foodTypes';
import { mealForTime, mealLabel, mealsWithFood, totals } from '../lib/nutrition';
import { copyEntries, yourUsual } from '../lib/usual';
import { addDays as addIsoDays } from '../lib/weeks';
import { FoodLogger } from '../components/food/FoodLogger';
import { TodayFood } from '../components/food/TodayFood';
import { useMinuteTick } from '../lib/useMinuteTick';
import { WorkoutsCard } from '../components/WorkoutsCard';
import { WorkoutPicker, type PickerStart } from '../components/WorkoutPicker';
import { CheckInCard, WeightSheet } from '../components/CheckIn';
import { PhotoViewer } from '../components/PhotoViewer';
import '../styles/log.css';
import '../styles/today.css';
import { Celebration } from '../components/Celebration';
import { BirthdayCake } from '../components/BirthdayCake';
import { RecapSheet, markRecapSeen, pendingRecapWeek } from '../components/Recap';
import { birthdayPass } from '../lib/birthday';
import { canRunShortcuts, runShortcut } from '../lib/shortcut';

export function TodayScreen({
  date,
  setDate,
  openProgress,
  openFood,
  openProfile,
}: {
  date: string;
  setDate: (d: string) => void;
  openProgress: () => void;
  /** Switch to the Food tab (the full diary). */
  openFood: () => void;
  /** Open Profile at the "about you" section (for calorie estimates). */
  openProfile: () => void;
}) {
  const {
    profile,
    challenge,
    logs,
    logFor,
    updateLog,
    updateProfile,
    setPhoto,
    removePhoto,
    reportError,
    today,
    health,
    syncHealth,
    applyBirthdayPass,
    undoBirthdayPass,
    refresh,
  } = useApp();
  const [bdayIntro, setBdayIntro] = useState(false);
  // Weekly recap: last week's, once, on the first open of a new week.
  const [recapWeek, setRecapWeek] = useState<string | null>(null);
  const [recapChecked, setRecapChecked] = useState(false);
  useEffect(() => {
    if (!challenge || recapChecked) return;
    setRecapChecked(true);
    setRecapWeek(pendingRecapWeek(challenge.start_date, today));
  }, [challenge, today, recapChecked]);
  const [sheet, setSheet] = useState<null | 'steps' | 'burned' | 'weight'>(null);
  const [logger, setLogger] = useState<null | { meal: Meal; edit?: FoodEntry; focus?: boolean; photo?: File }>(null);
  const food = useFood();
  const { ensure } = food;
  useEffect(() => {
    ensure(date, date);
  }, [ensure, date]);
  const now = useMinuteTick(date === today);
  const [picker, setPicker] = useState<{ open: boolean; start: PickerStart }>({ open: false, start: null });
  const [viewer, setViewer] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState<null | { message: string; undo?: () => void }>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const log = logFor(date);
  const body = useMemo(() => (profile ? bodyStats(profile, logs, date) : null), [profile, logs, date]);
  const recents = useMemo(() => recentWorkouts(logs, date), [logs, date]);
  const trend = useMemo(() => weightTrend(weighIns(logs)), [logs]);
  const thumb = usePhotoUrls([log.photo_path], true);
  const tasks = useMemo(() => (profile ? taskStatuses(log, profile) : []), [log, profile]);
  const summary = useMemo(
    () => (challenge && profile ? summarise(challenge, logs, profile, today) : null),
    [challenge, logs, profile, today],
  );

  const doneCount = tasks.filter((t) => t.done).length;
  const passDay = !!log.birthday_pass;
  const allDone = passDay || (tasks.length > 0 && doneCount === tasks.length);

  // Celebrate once when the day being viewed flips to complete (not when switching days).
  const [party, setParty] = useState<null | { title: string; subtitle: string }>(null);
  const wasDone = useRef({ date, done: allDone });
  useEffect(() => {
    const prev = wasDone.current;
    wasDone.current = { date, done: allDone };
    if (prev.date !== date || !allDone || prev.done || !summary || !challenge) return;
    success();
    const n = summary.timeline.find((t) => t.date === date)?.day ?? summary.currentDay;
    setParty({
      title: `Day ${n} done!`,
      subtitle: passDay ? 'Birthday pass used. Enjoy it!' : 'Everything ticked off. Lovely work.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, date, summary, challenge]);

  // Birthday pass: a week before her birthday, show the surprise once per year.
  const pass = profile ? birthdayPass(profile.birthday, profile.birthday_pass_year, today) : null;
  useEffect(() => {
    if (!pass?.available || !recapChecked || recapWeek) return;
    const key = `seventyfive:bday-intro-${pass.year}`;
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setBdayIntro(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, [pass?.available, pass?.year, recapChecked, recapWeek]);
  const endParty = useCallback(() => setParty(null), []);

  if (!profile || !challenge || !summary) return null;

  const isToday = date === today;
  const calendarIndex = dayNumber(challenge.start_date, date); // 1 = start date
  const credited = calendarIndex >= 1 && calendarIndex <= challenge.credited_days;
  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const headline = calendarIndex < 1 ? 'Starts soon' : calendarIndex > 75 ? 'After day 75' : `Day ${calendarIndex}`;
  const set = (patch: Partial<DailyLog>) => updateLog(date, (l) => ({ ...l, ...patch }));

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

  // The web app can't read Health itself: offer to run her Shortcut (once she's set it up, or on an iPhone).
  const shortcutSync = !health.available && (!!profile.health_synced_at || canRunShortcuts());

  const glassCount = Math.min(32, Math.max(Math.ceil(profile.water_goal_ml / GLASS_ML), Math.ceil(log.water_ml / GLASS_ML)));
  const stepWeek = weekSteps(logs, date);

  // Workouts
  const goal = workoutGoal(profile);
  const minutes = workoutMinutes(log);
  const stats = body!;

  // Food and energy: the diary when there is one, otherwise calories from Lifesum or typed in.
  const entries = food.entriesFor(date);
  const eaten = entries.length ? Math.round(totals(entries).kcal) : (log.calories ?? null);
  const outside =
    !entries.length && log.calories && log.calories_source !== 'food'
      ? { kcal: log.calories, from: log.calories_source === 'manual' ? 'a number typed in' : 'Lifesum' }
      : null;
  const energy = dayEnergy({ ...log, calories: eaten }, stats, { date, today, now });
  // Net calories say how much of the day they cover: meals logged in the diary, or where the number came from.
  const mealsLogged = entries.length ? mealsWithFood(entries) : null;

  // "Your usual" for the meal coming up, while it's still empty: one tap logs it.
  const nextMeal = isToday ? mealForTime(now) : null;
  const history: FoodEntry[] = [];
  for (let i = 1; i <= 14; i++) history.push(...food.entriesFor(addIsoDays(date, -i)));
  const usual = nextMeal && !entries.some((e) => e.meal === nextMeal) ? yourUsual(history, { date, meal: nextMeal }) : null;
  const logUsual = async () => {
    if (!usual || !nextMeal) return;
    const copies = copyEntries(usual.entries, date, nextMeal);
    try {
      await food.add(copies);
    } catch {
      return; // already reported
    }
    success();
    setToast({ message: `${mealLabel(nextMeal)} logged · ${fmt(totals(copies).kcal)} kcal`, undo: () => food.remove(copies.map((c) => c.id)) });
  };
  const activeGoal = profile.active_goal_kcal || defaultActiveGoal(profile, stats);
  const favorites = profile.workout_favorites ?? [];
  const quick: (WorkoutFavorite | RecentWorkout)[] = favorites.length ? favorites : recents.slice(0, 4);
  const saveEntry = (entry: WorkoutEntry) =>
    updateLog(date, (l) => ({
      ...l,
      workouts: l.workouts.some((w) => w.id === entry.id) ? l.workouts.map((w) => (w.id === entry.id ? entry : w)) : [...l.workouts, entry],
    }));
  const quickLog = (f: WorkoutFavorite | RecentWorkout) => {
    const entry: WorkoutEntry = {
      id: newEntryId(),
      activity: f.activity,
      ...(f.name ? { name: f.name } : {}),
      minutes: f.minutes,
      intensity: f.intensity,
      kcal: null,
      source: 'manual',
    };
    success();
    saveEntry(entry);
    setToast({
      message: `Added ${favoriteName(f)}, ${f.minutes} min`,
      undo: () => updateLog(date, (l) => ({ ...l, workouts: l.workouts.filter((w) => w.id !== entry.id) })),
    });
  };

  // Weight & photo
  const unit: WeightUnit = weightUnitFor(profile.weight_unit);
  const weightKg = typeof log.weight_kg === 'number' ? log.weight_kg : null;
  const lastBefore = latestWeight(logs, toISODate(addDays(parseISO(date), -1)));
  const point = trend.find((t) => t.date === date) ?? null;
  const weekAgo7 = toISODate(addDays(parseISO(date), -7));
  const earlier = [...trend].reverse().find((t) => t.date <= weekAgo7) ?? null;
  const photos = photoDays(logs, (d) => byDate.get(d)?.day ?? null);
  const pickPhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      await setPhoto(date, file);
      success();
    } catch (e) {
      reportError(e);
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div className="screen today">
      <header className="today-head">
        <div className="today-head-top">
          <div className="today-title">
            <span className="today-date">
              {isToday ? 'Today · ' : ''}
              {format(parseISO(date), 'EEEE d MMMM')}
            </span>
            <span className="today-day">
              {headline} <span>of 75</span>
            </span>
          </div>
          <div className="today-head-actions">
            {health.connected && health.available ? (
              <button className="icon-btn head-btn" aria-label="Sync Apple Health" onClick={() => syncHealth()}>
                <span style={{ display: 'flex', animation: health.syncing ? 'spin 1s linear infinite' : undefined }}>
                  <IconRefresh size={20} />
                </span>
              </button>
            ) : (
              shortcutSync && (
                <button className="icon-btn head-btn" aria-label="Sync steps from Apple Health" onClick={() => (tap(), runShortcut(refresh))}>
                  <IconRefresh size={20} />
                </button>
              )
            )}
            <button className="icon-btn head-btn" aria-label="See all 75 days" onClick={openProgress}>
              <IconGrid size={20} />
            </button>
          </div>
        </div>

        <div className="today-hero">
          <Ring
            size={116}
            stroke={11}
            value={credited || passDay ? 1 : doneCount}
            max={credited || passDay ? 1 : tasks.length}
            color="var(--mint)"
            track="rgba(255,255,255,0.14)"
            label={`${doneCount} of ${tasks.length} done`}
          >
            {allDone || credited ? (
              <span className="hero-done">
                <IconCheck size={36} strokeWidth={3} style={{ color: 'var(--mint)' }} />
                <span>day done</span>
              </span>
            ) : (
              <>
                <span className="hero-count">
                  {doneCount}/{tasks.length}
                </span>
                <span className="hero-unit">done today</span>
              </>
            )}
          </Ring>
          <div className="hero-stats">
            <Stat label="Full days so far" value={`${summary.completedDays} of ${Math.max(1, summary.currentDay)}`} />
            <Stat label="Day 75" value={format(parseISO(summary.finishDate), 'EEE d MMM')} />
          </div>
        </div>

        <nav aria-label="This week" className="week-strip">
          {week.map((w) => {
            const selected = w.d === date;
            return (
              <button
                key={w.d}
                disabled={!w.selectable}
                aria-pressed={selected}
                aria-label={format(parseISO(w.d), 'EEEE d MMMM')}
                className={`week-day${w.state ? ` ${w.state}` : ''}`}
                onClick={() => (tap(), setDate(w.d))}
              >
                <span className="week-letter">{w.label}</span>
                <span className="week-num">{w.num}</span>
                <span className="week-dot" />
              </button>
            );
          })}
        </nav>
      </header>

      <main className="today-main">
        <EnergyCard
          energy={energy}
          eaten={eaten}
          calorieGoal={profile.calorie_goal}
          activeGoal={activeGoal}
          steps={log.steps}
          stepGoal={profile.step_goal}
          weekSteps={stepWeek.total}
          mealsLogged={mealsLogged}
          outsideFrom={outside?.from}
          onEaten={openFood}
          onBurned={() => setSheet('burned')}
          onSteps={() => setSheet('steps')}
        />

        {passDay && (
          <section className="card bday-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BirthdayCake size={52} />
            <div className="row-text">
              <span className="row-title">Birthday pass used</span>
              <span className="row-sub">This day counts as a full day.</span>
            </div>
            <button className="link-btn" onClick={() => undoBirthdayPass(date)}>
              Undo
            </button>
          </section>
        )}

        {pass?.available && !passDay && (
          <section className="card bday-card" style={{ gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <BirthdayCake size={56} />
              <div className="row-text">
                <span className="row-title">
                  {pass.isBirthday
                    ? `Happy birthday${profile.display_name ? `, ${profile.display_name}` : ''}!`
                    : pass.daysUntil > 0
                      ? `Happy early birthday${profile.display_name ? `, ${profile.display_name}` : ''}!`
                      : 'Your birthday pass is waiting'}
                </span>
                <span className="row-sub">One free day: pick any day and it counts as a full day.</span>
              </div>
            </div>
            {calendarIndex >= 1 && !allDone ? (
              <button className="btn btn-primary" style={{ height: 46 }} onClick={() => applyBirthdayPass(date, pass.year)}>
                Use it on {isToday ? 'today' : format(parseISO(date), 'EEE d MMM')}
              </button>
            ) : (
              <span className="card-sub">Open the day you want to use it on, then tap “Use it”.</span>
            )}
          </section>
        )}

        {credited && (
          <section className="card">
            <p className="card-sub" style={{ margin: 0 }}>
              You counted this day as done when you set up. Anything you log here is extra.
            </p>
          </section>
        )}

        {!isToday && (
          <div className="past-actions">
            <button className="btn btn-soft btn-sm" onClick={() => setDate(today)}>
              Back to today
            </button>
            {calendarIndex >= 1 && !allDone && (
              <button
                className="btn btn-soft btn-sm"
                onClick={() => {
                  tap();
                  updateLog(date, (l) => ({
                    ...l,
                    workouts:
                      workoutMinutes(l) >= goal
                        ? l.workouts
                        : [
                            ...l.workouts,
                            { id: newEntryId(), activity: 'workout', minutes: goal - workoutMinutes(l), intensity: 'normal', kcal: null, source: 'manual' },
                          ],
                    water_ml: Math.max(l.water_ml, profile.water_goal_ml),
                    pages_read: Math.max(l.pages_read, profile.reading_goal_pages),
                    no_alcohol: true,
                  }));
                }}
              >
                <IconCheck size={16} strokeWidth={2.6} /> Tick everything off
              </button>
            )}
          </div>
        )}

        <TodayFood
          entries={entries}
          outside={outside}
          ai={food.ai !== false}
          onAdd={(meal) => setLogger({ meal })}
          onOpen={openFood}
          onType={() => setLogger({ meal: mealForTime(), focus: true })}
          onPhoto={(photo) => setLogger({ meal: mealForTime(), photo })}
          usual={usual && nextMeal ? { meal: nextMeal, title: usual.title, kcal: usual.kcal, onLog: logUsual } : null}
        />

        <h2 className="section-label">
          Daily tasks
          <span>{passDay || credited ? 'all done' : `${doneCount} of ${tasks.length}`}</span>
        </h2>

        <WorkoutsCard
          entries={log.workouts}
          goal={goal}
          body={stats}
          quick={quick}
          quickIsRecent={!favorites.length}
          onAdd={() => setPicker({ open: true, start: null })}
          onEdit={(entry) => setPicker({ open: true, start: { entry } })}
          onQuickLog={quickLog}
        />

        <section className="card" aria-labelledby="water-h">
          <div className="card-head" style={{ alignItems: 'baseline' }}>
            <h2 className="card-title" id="water-h">
              Water
            </h2>
            <span className="card-amount">
              <strong style={{ color: 'var(--water)' }}>{litres(log.water_ml)}</strong> / {litres(profile.water_goal_ml, 1)} L
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
            <button className="btn water-add" onClick={() => (tap(), set({ water_ml: log.water_ml + GLASS_ML }))}>
              <Glass fill={1} size={24} />
              Add a glass
              <span className="water-ml">· {GLASS_ML} ml</span>
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

        <section className="card list" aria-label="Daily habits">
          <DietRow
            title={`Read ${profile.reading_goal_pages} pages`}
            checked={log.pages_read >= profile.reading_goal_pages}
            onChange={(v) => set({ pages_read: v ? profile.reading_goal_pages : 0 })}
          />
          <DietRow title="No alcohol" checked={log.no_alcohol} onChange={(v) => set({ no_alcohol: v })} />
        </section>

        <h2 className="section-label">Check-in</h2>

        <CheckInCard
          weightKg={weightKg}
          last={lastBefore}
          avg={point?.avg ?? null}
          weekChange={point && earlier ? point.avg - earlier.avg : null}
          unit={unit}
          photoUrl={log.photo_path ? thumb[log.photo_path] : undefined}
          hasPhoto={!!log.photo_path}
          busy={photoBusy}
          isToday={isToday}
          onWeight={() => setSheet('weight')}
          onPhoto={() => setViewer(Math.max(0, photos.findIndex((p) => p.date === date)))}
          onPickPhoto={pickPhoto}
        />

        <section className="card">
          <label className="field" style={{ gap: 10 }}>
            <span className="notes-label">
              <IconNote size={20} style={{ color: 'var(--muted)' }} /> Notes
            </span>
            <textarea className="input" placeholder="How did today feel?" value={log.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </section>
      </main>

      <FoodLogger
        open={!!logger}
        date={date}
        meal={logger?.meal ?? 'snacks'}
        edit={logger?.edit}
        focus={logger?.focus}
        photo={logger?.photo}
        onClose={() => setLogger(null)}
        onDeleted={(removed) => setToast({ message: `Deleted ${removed[0]?.name ?? 'item'}`, undo: () => food.restore(removed) })}
      />

      <WorkoutPicker
        open={picker.open}
        start={picker.start}
        dayMinutes={minutes}
        goal={goal}
        body={stats}
        favorites={favorites}
        recents={recents}
        onToggleFavorite={(f) => updateProfile({ workout_favorites: toggleFavorite(favorites, f) })}
        onSave={(entry) => {
          saveEntry(entry);
          setPicker({ open: false, start: null });
        }}
        onDelete={(id) => {
          const removed = log.workouts.find((w) => w.id === id);
          const at = log.workouts.findIndex((w) => w.id === id);
          updateLog(date, (l) => ({ ...l, workouts: l.workouts.filter((w) => w.id !== id) }));
          setPicker({ open: false, start: null });
          if (removed)
            setToast({
              message: 'Workout deleted',
              undo: () =>
                updateLog(date, (l) => {
                  const next = [...l.workouts];
                  next.splice(Math.min(at, next.length), 0, removed);
                  return { ...l, workouts: next };
                }),
            });
        }}
        onClose={() => setPicker({ open: false, start: null })}
      />

      <EnergySheet
        open={sheet === 'burned'}
        energy={energy}
        log={log}
        body={stats}
        activeGoal={activeGoal}
        calorieGoal={profile.calorie_goal}
        mealsLogged={mealsLogged}
        outsideFrom={outside?.from}
        title={isToday ? 'Calories today' : `Calories · ${format(parseISO(date), 'EEE d MMM')}`}
        onClose={() => setSheet(null)}
        openProfile={openProfile}
        logWeight={() => setSheet('weight')}
      />

      <WeightSheet
        open={sheet === 'weight'}
        date={date}
        isToday={isToday}
        current={weightKg}
        last={lastBefore}
        avg={point?.avg ?? (lastBefore ? trend.find((t) => t.date === lastBefore.date)?.avg ?? null : null)}
        unit={unit}
        onUnit={(u) => updateProfile({ weight_unit: u })}
        onSave={(kg) => {
          set({ weight_kg: kg });
          setSheet(null);
          if (kg !== null) success();
        }}
        onClose={() => setSheet(null)}
      />

      {viewer !== null && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          startIndex={viewer}
          onClose={() => setViewer(null)}
          onDelete={async (d) => {
            try {
              await removePhoto(d);
            } catch (e) {
              reportError(e);
            }
          }}
        />
      )}
      {toast && <Toast tone="info" message={toast.message} onClose={closeToast} action={toast.undo ? { label: 'Undo', onClick: toast.undo } : undefined} />}

      <NumberSheet
        open={sheet === 'steps'}
        title="Steps"
        unit="steps"
        initial={log.steps}
        presets={[profile.step_goal]}
        note={
          health.available
            ? 'Apple Health updates this automatically. A number you type is kept unless Health has a higher one.'
            : shortcutSync
              ? 'Your Shortcut fills this in from Apple Health. Tap Sync steps now to run it, then come back to the app.'
              : 'Type today’s steps from the Health app, or set up the Apple Health shortcut in Profile to fill this in for you.'
        }
        action={
          shortcutSync
            ? {
                label: 'Sync steps now',
                onClick: () => {
                  setSheet(null);
                  runShortcut(refresh);
                },
              }
            : undefined
        }
        onClose={() => setSheet(null)}
        onSave={(v) => {
          set({ steps: v, steps_source: v === null ? null : 'manual' });
          setSheet(null);
        }}
      />

      <Sheet open={bdayIntro} onClose={() => setBdayIntro(false)} title={pass?.isBirthday ? 'Happy birthday!' : 'Your birthday is coming!'}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <BirthdayCake size={120} />
        </div>
        <p style={{ margin: 0, lineHeight: 1.55, color: 'var(--ink-2)' }}>
          Here’s a free <strong>birthday pass</strong>. Use it on any day you like, your birthday or any other, and that day counts as a full day.
        </p>
        <p className="card-sub" style={{ margin: 0 }}>
          Open the day you want, then tap “Use it” on the birthday card.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => setBdayIntro(false)}>
          Yay, got it
        </button>
      </Sheet>
      {recapWeek && (
        <RecapSheet
          open
          monday={recapWeek}
          onClose={() => {
            markRecapSeen(recapWeek);
            setRecapWeek(null);
          }}
        />
      )}
      {party && <Celebration title={party.title} subtitle={party.subtitle} onDone={endParty} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hero-stat">
      <span className="hero-stat-label">{label}</span>
      <span className="hero-stat-value">{value}</span>
    </div>
  );
}

function DietRow({ title, sub, checked, onChange }: { title: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <ToggleRow title={title} sub={sub} checked={checked} onChange={onChange} />;
}

function NumberSheet({
  open,
  title,
  unit,
  initial,
  note,
  presets = [],
  action,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  unit: string;
  initial: number | null;
  note: string;
  presets?: number[];
  /** An extra button under the note (e.g. run the steps Shortcut). */
  action?: { label: string; onClick: () => void };
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
        {action && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => (tap(), action.onClick())}>
            <IconRefresh size={18} /> {action.label}
          </button>
        )}
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
