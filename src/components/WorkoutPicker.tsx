import { useEffect, useMemo, useRef, useState } from 'react';
import type { Intensity, WorkoutEntry, WorkoutFavorite } from '../data/types';
import {
  ACTIVITIES,
  CATEGORIES,
  CUSTOM_ID,
  INTENSITIES,
  activityById,
  bodyStatsMissing,
  estimateKcal,
  levelText,
  searchActivities,
  type BodyStats,
  type CategoryId,
} from '../lib/activities';
import { POPULAR, favoriteName, formatMinutes, newEntryId, sameFavorite, type RecentWorkout } from '../lib/workouts';
import { ActivityIcon } from './ActivityIcon';
import { Sheet, fmt } from './ui';
import { IconChevron, IconChevronLeft, IconFlame, IconMinus, IconPlus, IconSearch, IconStar, IconX } from './Icons';
import { tap } from '../lib/haptics';

const PRESET_MINUTES = [15, 20, 30, 45, 60, 90];
type Cat = 'popular' | 'all' | CategoryId;

export type PickerStart = { entry: WorkoutEntry } | { preset: RecentWorkout } | null;

interface Draft {
  activity: string;
  name: string;
  minutes: number;
  intensity: Intensity;
}

const intensityLabel = (i: Intensity) => INTENSITIES.find((x) => x.id === i)!.label;

export function WorkoutPicker({
  open,
  start,
  dayMinutes,
  goal,
  body,
  favorites,
  recents,
  onToggleFavorite,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  start: PickerStart;
  /** Minutes already logged that day (including the entry being edited). */
  dayMinutes: number;
  goal: number;
  body: BodyStats;
  favorites: WorkoutFavorite[];
  recents: RecentWorkout[];
  onToggleFavorite: (f: WorkoutFavorite) => void;
  onSave: (entry: WorkoutEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const editing = start && 'entry' in start ? start.entry : null;
  const [step, setStep] = useState<'choose' | 'detail'>('choose');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<Cat>('popular');
  const [draft, setDraft] = useState<Draft>({ activity: 'workout', name: '', minutes: 45, intensity: 'normal' });
  const [minText, setMinText] = useState('45');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sheetTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCat('popular');
    setConfirmDelete(false);
    if (start && 'entry' in start) {
      const e = start.entry;
      openDetail({ activity: e.activity, name: e.name ?? '', minutes: e.minutes, intensity: e.intensity });
    } else if (start && 'preset' in start) {
      const p = start.preset;
      openDetail({ activity: p.activity, name: p.name ?? '', minutes: p.minutes, intensity: p.intensity });
    } else setStep('choose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, start]);

  // Minutes still needed today, not counting the workout being edited.
  const others = dayMinutes - (editing?.minutes ?? 0);
  const toFinish = Math.max(0, goal - others);

  function openDetail(d: Partial<Draft> & { activity: string }) {
    // New workouts start at whatever finishes the day (if that's an hour or less), else 45.
    const minutes = d.minutes ?? (toFinish > 0 && toFinish <= 60 ? toFinish : 45);
    setDraft({ activity: d.activity, name: d.name ?? '', minutes, intensity: d.intensity ?? 'normal' });
    setMinText(String(minutes));
    setStep('detail');
    requestAnimationFrame(() => sheetTop.current?.closest('.sheet')?.scrollTo({ top: 0 }));
  }

  const setMinutes = (m: number) => {
    const v = Math.max(1, Math.min(600, Math.round(m)));
    setDraft((d) => ({ ...d, minutes: v }));
    setMinText(String(v));
  };

  const results = useMemo(() => {
    if (query.trim()) return searchActivities(query);
    if (cat === 'popular') return POPULAR.map((id) => activityById(id));
    if (cat === 'all') return [...ACTIVITIES].filter((a) => a.id !== 'workout').sort((a, b) => a.name.localeCompare(b.name));
    return ACTIVITIES.filter((a) => a.category === cat && a.id !== 'workout');
  }, [query, cat]);

  const isCustom = draft.activity === CUSTOM_ID;
  const activity = activityById(draft.activity);
  const kcal = estimateKcal(draft.activity, draft.intensity, draft.minutes, body);
  const missing = bodyStatsMissing(body);
  const fav: WorkoutFavorite = {
    activity: draft.activity,
    minutes: draft.minutes,
    intensity: draft.intensity,
    ...(isCustom && draft.name.trim() ? { name: draft.name.trim() } : {}),
  };
  const pinned = favorites.some((f) => sameFavorite(f, fav));
  const valid = draft.minutes >= 1 && draft.minutes <= 600 && (!isCustom || draft.name.trim().length > 0);
  const keepName = editing && editing.activity === draft.activity && !isCustom ? editing.name : undefined;

  function save() {
    if (!valid) return;
    onSave({
      id: editing?.id ?? newEntryId(),
      activity: draft.activity,
      name: isCustom ? draft.name.trim() : keepName,
      minutes: draft.minutes,
      intensity: draft.intensity,
      // Worked out when shown (from her weight on that day), so it improves as she adds details.
      kcal: null,
      source: editing?.source ?? 'manual',
      healthId: editing?.healthId,
    });
  }

  const title =
    step === 'choose' ? (editing ? 'Change workout' : 'Add a workout') : isCustom ? 'Your own workout' : activity.name;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div ref={sheetTop} style={{ height: 0, marginTop: -16 }} aria-hidden="true" />
      {step === 'choose' ? (
        <>
          <label className="pick-search">
            <IconSearch size={20} />
            <span className="sr-only">Search workouts</span>
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={`Search ${Math.floor((ACTIVITIES.length - 1) / 10) * 10}+ workouts`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="pick-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <IconX size={16} />
              </button>
            )}
          </label>

          {!query && favorites.length > 0 && (
            <div className="pick-group">
              <span className="pick-label">Your quick log</span>
              <div className="pick-list">
                {favorites.map((f, i) => (
                  <PickRow
                    key={`f${i}`}
                    activity={f.activity}
                    title={favoriteName(f)}
                    sub={`${f.minutes} min · ${intensityLabel(f.intensity)}`}
                    star
                    onClick={() => openDetail({ ...f, name: f.name })}
                  />
                ))}
              </div>
            </div>
          )}

          {!query && recents.length > 0 && (
            <div className="pick-group">
              <span className="pick-label">Recent</span>
              <div className="pick-list">
                {recents.map((r, i) => (
                  <PickRow
                    key={`r${i}`}
                    activity={r.activity}
                    title={favoriteName(r)}
                    sub={`Last time: ${r.minutes} min · ${intensityLabel(r.intensity)}`}
                    onClick={() => openDetail({ ...r, name: r.name })}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="pick-group">
            {!query && (
              <>
                <span className="pick-label">Browse</span>
                <div className="hscroll" role="group" aria-label="Kinds of workout">
                  {(['popular', ...CATEGORIES.map((c) => c.id), 'all'] as Cat[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="chip-btn"
                      aria-pressed={cat === c}
                      onClick={() => (tap(), setCat(c))}
                    >
                      {c === 'popular' ? 'Popular' : c === 'all' ? 'All A–Z' : CATEGORIES.find((x) => x.id === c)!.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="pick-list" aria-live="polite">
              {results.map((a) => (
                <PickRow
                  key={a.id}
                  activity={a.id}
                  title={a.name}
                  sub={query || cat === 'popular' || cat === 'all' ? CATEGORIES.find((c) => c.id === a.category)?.name : undefined}
                  onClick={() => openDetail({ activity: a.id })}
                />
              ))}
              {results.length === 0 && <p className="pick-empty">Nothing called “{query.trim()}” yet.</p>}
            </div>
            <button type="button" className="pick-custom" onClick={() => openDetail({ activity: CUSTOM_ID, name: query.trim() })}>
              <span className="act-icon" style={{ width: 40, height: 40, borderRadius: 13 }} aria-hidden="true">
                <IconPlus size={20} />
              </span>
              <span className="row-text">
                <span className="row-title">{query.trim() ? `Add “${query.trim()}”` : 'Something else?'}</span>
                <span className="row-sub">Log your own workout with the same smart estimate</span>
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pick-detail-head">
            <ActivityIcon activity={draft.activity} size={44} />
            <span className="row-text">
              <span className="row-sub" style={{ fontSize: 13 }}>
                {isCustom ? 'Counts towards your workout time' : CATEGORIES.find((c) => c.id === activity.category)?.name}
                {editing?.source === 'health' ? ' · from Apple Health' : ''}
              </span>
              {keepName && <span className="row-sub">Logged as “{keepName}”</span>}
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setStep('choose');
                requestAnimationFrame(() => sheetTop.current?.closest('.sheet')?.scrollTo({ top: 0 }));
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <IconChevronLeft size={16} /> Change
            </button>
          </div>

          {isCustom && (
            <label className="field">
              What did you do?
              <input
                className="input"
                autoFocus={!draft.name}
                maxLength={40}
                placeholder="e.g. Sculpt class, Rock climbing"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
          )}

          <div className="pick-block">
            <span className="pick-label">How long?</span>
            <div className="dur">
              <button type="button" className="dur-btn" aria-label="5 minutes less" onClick={() => (tap(), setMinutes(Math.ceil(draft.minutes / 5) * 5 - 5 || 5))}>
                <IconMinus size={22} />
              </button>
              <label className="dur-value">
                <span className="sr-only">Minutes</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={minText}
                  onChange={(e) => {
                    const t = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setMinText(t);
                    const n = parseInt(t, 10);
                    if (n >= 1) setDraft((d) => ({ ...d, minutes: Math.min(600, n) }));
                  }}
                  onBlur={() => setMinutes(draft.minutes)}
                  style={{ width: `${Math.max(2, minText.length) + 0.4}ch` }}
                />
                <span>min</span>
              </label>
              <button type="button" className="dur-btn" aria-label="5 minutes more" onClick={() => (tap(), setMinutes(Math.floor(draft.minutes / 5) * 5 + 5))}>
                <IconPlus size={22} />
              </button>
            </div>
            <div className="chips" style={{ justifyContent: 'center' }}>
              {PRESET_MINUTES.map((m) => (
                <button key={m} type="button" className="chip-btn" aria-pressed={draft.minutes === m} onClick={() => (tap(), setMinutes(m))}>
                  {m}
                </button>
              ))}
              {toFinish > 0 && !PRESET_MINUTES.includes(toFinish) && (
                <button type="button" className="chip-btn chip-finish" aria-pressed={draft.minutes === toFinish} onClick={() => (tap(), setMinutes(toFinish))}>
                  {toFinish} · finishes today
                </button>
              )}
            </div>
            {others > 0 && (
              <span className="card-sub" style={{ textAlign: 'center' }}>
                {others + draft.minutes >= goal
                  ? `That makes ${formatMinutes(others + draft.minutes)} today. Goal done!`
                  : `That makes ${formatMinutes(others + draft.minutes)} of ${formatMinutes(goal)} today.`}
              </span>
            )}
          </div>

          <div className="pick-block">
            <span className="pick-label">How hard was it?</span>
            <div className="segmented" role="group" aria-label="Effort">
              {INTENSITIES.map((i) => (
                <button key={i.id} type="button" aria-pressed={draft.intensity === i.id} onClick={() => (tap(), setDraft((d) => ({ ...d, intensity: i.id })))}>
                  {i.label}
                </button>
              ))}
            </div>
            <p className="pick-level">{levelText(activity, draft.intensity)}</p>
          </div>

          <div className="estimate" aria-live="polite">
            <span className="estimate-icon" aria-hidden="true">
              <IconFlame size={22} />
            </span>
            <span className="row-text">
              <span className="estimate-value">
                ≈ {fmt(kcal)} <small>kcal burned</small>
              </span>
              <span className="estimate-note">
                {missing.includes('weight')
                  ? 'Using 65 kg until you log your weight, so it’ll sharpen up.'
                  : missing.length
                    ? 'Based on your weight. Add your height and sex in Profile for an even closer number.'
                    : 'Tuned to your weight, height, age and how hard you went.'}
              </span>
            </span>
          </div>

          <button type="button" className={`pin-row${pinned ? ' on' : ''}`} aria-pressed={pinned} disabled={!valid} onClick={() => (tap(), onToggleFavorite(fav))}>
            <IconStar size={22} filled={pinned} />
            <span className="row-text">
              <span className="row-title">{pinned ? 'In your quick log' : 'Add to quick log'}</span>
              <span className="row-sub">
                {pinned ? 'One tap to log it again from Today' : `Log ${draft.minutes} min of ${isCustom ? draft.name.trim() || 'this' : activity.name} in one tap`}
              </span>
            </span>
          </button>

          <button type="button" className="btn btn-primary btn-block" disabled={!valid} onClick={save}>
            {editing ? 'Save changes' : `Add ${formatMinutes(draft.minutes)}`}
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ color: 'var(--danger)' }}
              onClick={() => (confirmDelete ? onDelete(editing.id) : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Tap again to delete' : 'Delete this workout'}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

function PickRow({ activity, title, sub, star, onClick }: { activity: string; title: string; sub?: string; star?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="pick-row" onClick={() => (tap(), onClick())}>
      <ActivityIcon activity={activity} size={40} />
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {star ? <IconStar size={18} filled style={{ color: 'var(--gold)' }} /> : <IconChevron size={18} style={{ color: '#9aa59d' }} />}
    </button>
  );
}
