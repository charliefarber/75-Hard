import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isAfter, parseISO, startOfWeek } from 'date-fns';
import { useApp } from '../data/AppData';
import type { DailyLog, WeightUnit, WorkoutEntry, WorkoutFavorite } from '../data/types';
import { workoutGoal, workoutMinutes } from '../data/types';
import { dayNumber, litres, summarise, taskStatuses, toISODate, weekSteps } from '../lib/challenge';
import { GLASS_ML, Glass } from '../components/Glass';
import { Ring, Sheet, Toast, ToggleRow, fmt } from '../components/ui';
import { IconCheck, IconFlame, IconGrid, IconNote, IconRefresh, IconUndo } from '../components/Icons';
import { success, tap } from '../lib/haptics';
import { bodyStats, dayBurned, latestWeight, weighIns, weightTrend, weightUnitFor } from '../lib/body';
import { favoriteName, newEntryId, recentWorkouts, toggleFavorite, type RecentWorkout } from '../lib/workouts';
import { photoDays } from '../lib/photos';
import { usePhotoUrls } from '../data/usePhotoUrls';
import { DaySummary, BurnedSheet } from '../components/DaySummary';
import { WorkoutsCard } from '../components/WorkoutsCard';
import { WorkoutPicker, type PickerStart } from '../components/WorkoutPicker';
import { CheckInCard, WeightSheet } from '../components/CheckIn';
import { PhotoViewer } from '../components/PhotoViewer';
import '../styles/log.css';
import { Celebration } from '../components/Celebration';
import { BirthdayCake } from '../components/BirthdayCake';
import { RecapSheet, markRecapSeen, pendingRecapWeek } from '../components/Recap';
import { birthdayPass } from '../lib/birthday';
import { PetSprite } from '../components/PetSprite';
import { MOODS, STAGES, petState, stageFor } from '../lib/pet';
import { fullnessColor } from './PetScreen';

export function TodayScreen({
  date,
  setDate,
  openProgress,
  openPet,
  openProfile,
}: {
  date: string;
  setDate: (d: string) => void;
  openProgress: () => void;
  openPet: () => void;
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
  const [sheet, setSheet] = useState<null | 'steps' | 'calories' | 'burned' | 'weight'>(null);
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
    const petName = challenge.pet_name || 'Mochi';
    const n = summary.timeline.find((t) => t.date === date)?.day ?? summary.completedDays;
    const evolved = n === STAGES.find((st) => st.min === n && st.min > 0)?.min;
    setParty({
      title: `Day ${n} done!`,
      subtitle: evolved
        ? `${petName} evolved into ${STAGES[stageFor(n)].name}!`
        : passDay
          ? `Birthday pass used. ${petName} got cake!`
          : `${petName} is fed and happy.`,
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

  const petName = challenge.pet_name || 'Mochi';
  const pet = petState(summary, challenge.treat_dates ?? [], today);
  const isToday = date === today;
  const calendarIndex = dayNumber(challenge.start_date, date); // 1 = start date
  const credited = calendarIndex >= 1 && calendarIndex <= challenge.credited_days;
  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const viewing = byDate.get(date);
  const headline =
    calendarIndex < 1 ? 'Starts soon' : viewing?.state === 'missed' ? 'Didn’t count' : `Day ${viewing?.day ?? summary.currentDay}`;
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

  // Only nudge about recent misses; older ones are visible on Progress.
  const weekAgo = toISODate(addDays(parseISO(today), -7));
  const missed = isToday ? summary.missedDays.filter((m) => m.date >= weekAgo) : [];
  const lastMissed = missed[missed.length - 1];
  const healthSourced = (s: string | null) => s === 'health' || s === 'shortcut';

  const glassCount = Math.min(32, Math.max(Math.ceil(profile.water_goal_ml / GLASS_ML), Math.ceil(log.water_ml / GLASS_ML)));
  const stepWeek = weekSteps(logs, date);
  const weekGoal = profile.step_goal * 7;

  // Workouts
  const goal = workoutGoal(profile);
  const minutes = workoutMinutes(log);
  const stats = body!;
  const burned = dayBurned(log, stats);
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
            value={credited || passDay ? 1 : doneCount}
            max={credited || passDay ? 1 : tasks.length}
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
        <DaySummary
          eaten={log.calories}
          calorieGoal={profile.calorie_goal}
          eatenFromHealth={healthSourced(log.calories_source)}
          burned={burned}
          workoutMinutes={minutes}
          workoutGoal={goal}
          steps={log.steps}
          weekSteps={stepWeek.total}
          weekGoal={weekGoal}
          onEaten={() => setSheet('calories')}
          onBurned={() => setSheet('burned')}
          onSteps={() => setSheet('steps')}
        />
        <button
          className="card"
          onClick={openPet}
          aria-label={`${petName}, ${MOODS[pet.mood].label}. Open pet`}
          style={{ border: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: '10px 16px 10px 8px', textAlign: 'left' }}
        >
          <PetSprite style={challenge.pet_style ?? 'girl'} stage={pet.stageIndex} mood={pet.mood} size={84} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{petName}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: fullnessColor(pet.fullness) }}>{MOODS[pet.mood].label}</span>
            </span>
            <span className="meter" aria-hidden="true">
              <span style={{ width: `${pet.fullness}%`, background: fullnessColor(pet.fullness) }} />
            </span>
            <span className="card-sub">
              {pet.stage.name}
              {pet.next ? ` · ${pet.daysToNext} ${pet.daysToNext === 1 ? 'day' : 'days'} to ${pet.next.name}` : ' · fully evolved'}
              {pet.treatsAvailable > 0 ? ` · ${pet.treatsAvailable} treat${pet.treatsAvailable === 1 ? '' : 's'}` : ''}
            </span>
          </span>
        </button>

        {passDay && (
          <section className="card bday-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BirthdayCake size={52} />
            <div className="row-text">
              <span className="row-title">Birthday pass used</span>
              <span className="row-sub">This day counts as complete.</span>
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
                <span className="row-sub">One free day: pick any day and it counts as complete, and {challenge.pet_name || 'Mochi'} gets cake.</span>
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

        {!isToday && calendarIndex >= 1 && !allDone && (
          <button
            className="btn btn-soft"
            style={{ height: 46 }}
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
                followed_diet: true,
                no_cheat_meal: true,
                no_alcohol: true,
              }));
            }}
          >
            <IconCheck size={18} strokeWidth={2.6} /> Tick everything off for {format(parseISO(date), 'EEE d MMM')}
          </button>
        )}

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

        <section className="card list" aria-label="Daily habits">
          <DietRow
            title={`Read ${profile.reading_goal_pages} pages`}
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

      <BurnedSheet open={sheet === 'burned'} log={log} body={stats} onClose={() => setSheet(null)} openProfile={openProfile} logWeight={() => setSheet('weight')} />

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
            : 'Type today’s steps from the Health app, or set up the Apple Health shortcut in Profile to fill this in for you.'
        }
        onClose={() => setSheet(null)}
        onSave={(v) => {
          set({ steps: v, steps_source: v === null ? null : 'manual' });
          setSheet(null);
        }}
      />

      <NumberSheet
        open={sheet === 'calories'}
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

      <Sheet open={bdayIntro} onClose={() => setBdayIntro(false)} title={pass?.isBirthday ? 'Happy birthday!' : 'Your birthday is coming!'}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <BirthdayCake size={120} />
        </div>
        <p style={{ margin: 0, lineHeight: 1.55, color: 'var(--ink-2)' }}>
          Here’s a free <strong>birthday pass</strong>. Use it on any day you like, your birthday or any other, and that day counts as complete. {challenge.pet_name || 'Mochi'} gets birthday cake too.
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
