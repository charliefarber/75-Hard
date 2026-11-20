import { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { DailyLog, Profile } from '../data/types';
import { mondayOf } from '../lib/recap';
import { addDays } from '../lib/weeks';
import {
  activitiesBetween,
  allWorkouts,
  byActivity,
  dayStreak,
  durationText,
  fitnessChange,
  fitnessSeries,
  fitnessWord,
  pastWeeks,
  weekStreak,
  type FitnessDay,
  type WeekTraining,
  type WorkoutFilter,
} from '../lib/fitness';
import { tap } from '../lib/haptics';
import { Sheet } from './ui';
import { IconChevron, IconFlame } from './Icons';
import '../styles/fitness.css';

/**
 * The training side of Progress, built from the workouts she logs by hand:
 *  - TrainingCard: this week's time, sessions and active days, and the past 12 weeks as a line,
 *    for everything or one activity; tap any week to read it
 *  - StreakCard: weeks in a row with a workout
 *  - TrainingLogCard: this week and last week, a dot a day sized by minutes
 *  - FitnessCard: the fitness score (see lib/fitness.ts), with a sheet for the longer view
 */

type BodyProfile = Pick<Profile, 'height_cm' | 'sex' | 'birthday'>;
const WEEKS = 12;

/** Width of an element, kept current as it resizes. */
function useWidth(fallback = 320) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, el, w] as const;
}

/** Clean time steps for the weekly axis: 0, step, 2 × step. */
function timeAxis(maxMin: number): { step: number; top: number } {
  for (const step of [30, 60, 120, 180, 240, 300, 480, 600, 900]) if (step * 2 >= maxMin) return { step, top: step * 2 };
  const step = Math.ceil(maxMin / 120) * 60;
  return { step, top: step * 2 };
}
const axisTime = (m: number) => (m === 0 ? '0h' : m < 60 ? `${m}m` : m % 60 ? `${(m / 60).toFixed(1)}h` : `${m / 60}h`);

const minutesOn = (logs: Record<string, DailyLog>, date: string, filter: WorkoutFilter) =>
  (logs[date]?.workouts ?? []).filter(filter).reduce((a, w) => a + (w.minutes || 0), 0);

/** The Monday of the week she logged her first workout: weeks before it say nothing about her training. */
function firstLoggedMonday(logs: Record<string, DailyLog>): string | null {
  let first: string | null = null;
  for (const [date, l] of Object.entries(logs)) if ((l.workouts ?? []).some((w) => (w.minutes || 0) > 0) && (!first || date < first)) first = date;
  return first ? mondayOf(first) : null;
}

/**
 * One line on how the picked week compares: this week against last week by the same day, an
 * earlier week against the average of the weeks before it (from the week she started logging).
 */
function compareLine(weeks: WeekTraining[], sel: number, logs: Record<string, DailyLog>, today: string, filter: WorkoutFilter, since: string | null): string | null {
  const w = weeks[sel];
  if (sel === weeks.length - 1) {
    const last = weeks[sel - 1];
    if (!last || !since || last.monday < since) return null;
    const upTo = differenceInCalendarDays(parseISO(today), parseISO(w.monday));
    let same = 0;
    for (let i = 0; i <= upTo; i++) same += minutesOn(logs, addDays(last.monday, i), filter);
    if (!w.minutes && !same) return null;
    return upTo === 6 ? `Last week: ${durationText(same)}.` : `Last week by ${format(parseISO(today), 'EEEE')}: ${durationText(same)}.`;
  }
  const before = weeks.slice(Math.max(0, sel - 4), sel).filter((x) => since && x.monday >= since);
  if (before.length < 2 || before.every((x) => !x.minutes)) return null;
  const avg = before.reduce((a, x) => a + x.minutes, 0) / before.length;
  const diff = w.minutes - avg;
  const span = `the ${before.length} weeks before`;
  if (Math.abs(diff) < Math.max(10, avg * 0.1)) return `About the same as the average of ${span}.`;
  return diff > 0 ? `${durationText(diff)} more than the average of ${span}.` : `${durationText(-diff)} less than the average of ${span}.`;
}

export function TrainingCard({ logs, today, profile }: { logs: Record<string, DailyLog>; today: string; profile: BodyProfile }) {
  const first = addDays(mondayOf(today), -7 * (WEEKS - 1));
  const acts = useMemo(() => activitiesBetween(logs, first, today).slice(0, 5), [logs, first, today]);
  const [act, setAct] = useState<string | null>(null);
  const picked = act && acts.some((a) => a.key === act) ? act : null;
  const filter = useMemo<WorkoutFilter>(() => (picked ? byActivity(picked) : allWorkouts), [picked]);
  const weeks = useMemo(() => pastWeeks(logs, today, profile, WEEKS, filter), [logs, today, profile, filter]);
  const [sel, setSel] = useState(WEEKS - 1);
  useEffect(() => setSel(WEEKS - 1), [picked, today]);
  const w = weeks[sel];
  const title = sel === WEEKS - 1 ? 'This week' : sel === WEEKS - 2 ? 'Last week' : `Week of ${format(parseISO(w.monday), 'd MMM')}`;
  const since = useMemo(() => firstLoggedMonday(logs), [logs]);
  const note = compareLine(weeks, sel, logs, today, filter, since);
  const empty = weeks.every((x) => !x.sessions);

  return (
    <section className="card tr-card" aria-labelledby="tr-h">
      {acts.length > 1 && (
        <div className="tr-chips" role="group" aria-label="Activity">
          <button type="button" className="chip-btn" aria-pressed={!picked} onClick={() => (tap(), setAct(null))}>
            All
          </button>
          {acts.map((a) => (
            <button key={a.key} type="button" className="chip-btn" aria-pressed={picked === a.key} onClick={() => (tap(), setAct(a.key))}>
              {a.name}
            </button>
          ))}
        </div>
      )}
      <h2 className="card-title tr-title" id="tr-h" aria-live="polite">
        {title}
      </h2>
      <div className="tr-stats">
        <div>
          <span>Time</span>
          <strong>{durationText(w.minutes)}</strong>
        </div>
        <div>
          <span>Workouts</span>
          <strong>{w.sessions}</strong>
        </div>
        <div>
          <span>Active days</span>
          <strong>{w.days}</strong>
        </div>
      </div>
      <span className="tr-sub">Past 12 weeks</span>
      <WeeksChart weeks={weeks} sel={sel} onSel={setSel} />
      <p className="tr-note">{empty ? 'Log a workout and your weeks fill in here.' : note ?? 'Tap a week to see it.'}</p>
    </section>
  );
}

function WeeksChart({ weeks, sel, onSel }: { weeks: WeekTraining[]; sel: number; onSel: (i: number) => void }) {
  const [ref, box, width] = useWidth();
  const fill = useId();
  const H = 150;
  const pad = { l: 10, r: 40, t: 12, b: 24 };
  const plotW = Math.max(40, width - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  const { step, top } = timeAxis(Math.max(60, ...weeks.map((w) => w.minutes)));
  const x = (i: number) => pad.l + (i / (weeks.length - 1)) * plotW;
  const y = (m: number) => pad.t + (1 - m / top) * plotH;
  const pt = (i: number) => `${x(i).toFixed(1)},${y(weeks[i].minutes).toFixed(1)}`;
  const full = weeks.map((_, i) => `${i ? 'L' : 'M'}${pt(i)}`).join(' ');
  const area = `${full} L${x(weeks.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  // This week isn't over, so its stretch of the line is dashed.
  const done = weeks.slice(0, -1).map((_, i) => `${i ? 'L' : 'M'}${pt(i)}`).join(' ');
  const tail = `M${pt(weeks.length - 2)} L${pt(weeks.length - 1)}`;
  // A month's name under the first week that starts in it (and the first week, when there's room).
  const months = weeks
    .map((w, i) => ({ i, m: w.monday.slice(0, 7) }))
    .filter((p, i, all) => (i === 0 ? all.findIndex((q) => q.m !== p.m) > 2 : all[i - 1].m !== p.m));
  const pick = (clientX: number) => {
    const r = box?.getBoundingClientRect();
    if (!r) return;
    const i = Math.round(((clientX - r.left - pad.l) / plotW) * (weeks.length - 1));
    onSel(Math.min(weeks.length - 1, Math.max(0, i)));
  };

  return (
    <div
      ref={ref}
      className="tr-chart"
      tabIndex={0}
      role="group"
      aria-label={`Workout time by week: ${weeks.map((w) => `week of ${format(parseISO(w.monday), 'd MMMM')}, ${durationText(w.minutes)}`).join('; ')}. Use the arrow keys to pick a week.`}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && pick(e.clientX)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSel(Math.min(weeks.length - 1, sel + 1));
        else if (e.key === 'ArrowLeft') onSel(Math.max(0, sel - 1));
        else return;
        e.preventDefault();
      }}
    >
      <svg width={width} height={H} aria-hidden="true">
        <defs>
          <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--green)', stopOpacity: 0.2 }} />
            <stop offset="1" style={{ stopColor: 'var(--green)', stopOpacity: 0.02 }} />
          </linearGradient>
        </defs>
        {[0, step, top].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r + 2} y1={y(t)} y2={y(t)} className="wt-grid" />
            <text x={width - pad.r + 8} y={y(t)} className="wt-tick" dominantBaseline="middle">
              {axisTime(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${fill})`} />
        <path d={done} className="wt-line" />
        <path d={tail} className="wt-line tr-tail" />
        <line x1={x(sel)} x2={x(sel)} y1={pad.t - 6} y2={y(0)} className="tr-sel" />
        {weeks.map((w, i) => (
          <circle key={w.monday} cx={x(i)} cy={y(w.minutes)} r={i === sel ? 6 : 4} className={i === sel ? 'tr-dot on' : 'tr-dot'} />
        ))}
        {months.map((p) => (
          <text key={p.m} x={x(p.i)} y={H - 6} className="wt-tick" textAnchor={p.i === 0 ? 'start' : 'middle'}>
            {format(parseISO(`${p.m}-01`), 'MMM')}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function StreakCard({ logs, today }: { logs: Record<string, DailyLog>; today: string }) {
  const { weeks, thisWeek } = weekStreak(logs, today);
  const days = dayStreak(logs, today);
  const sub = weeks === 0 ? 'A workout starts one' : !thisWeek ? 'A workout this week keeps it going' : days > 1 ? `${days} days in a row` : 'A workout every week';
  return (
    <section className="card tr-mini streak-card" aria-labelledby="streak-h">
      <h2 className="card-title" id="streak-h">
        Streak
      </h2>
      <div className="streak-flame" aria-hidden="true">
        <IconFlame size={54} strokeWidth={1.5} />
        <strong>{weeks}</strong>
      </div>
      <span className="streak-unit">
        <span className="sr-only">{weeks} </span>
        {weeks === 1 ? 'week' : 'weeks'}
      </span>
      <small>{sub}</small>
    </section>
  );
}

export function TrainingLogCard({ logs, today }: { logs: Record<string, DailyLog>; today: string }) {
  const thisMonday = mondayOf(today);
  const rows = [
    { label: 'This week', monday: thisMonday },
    { label: 'Last week', monday: addDays(thisMonday, -7) },
  ].map((r) => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(r.monday, i);
      return { d, min: minutesOn(logs, d, allWorkouts), future: d > today };
    });
    return { ...r, days, total: days.reduce((a, x) => a + x.min, 0) };
  });
  const max = Math.max(30, ...rows.flatMap((r) => r.days.map((x) => x.min)));
  return (
    <section className="card tr-mini" aria-labelledby="tlog-h">
      <h2 className="card-title" id="tlog-h">
        Training log
      </h2>
      {rows.map((r) => (
        <div key={r.label} className="tlog-row">
          <div className="tlog-head">
            <span>{r.label}</span>
            <b>{durationText(r.total)}</b>
          </div>
          <div
            className="tlog-dots"
            role="img"
            aria-label={`${r.label}: ${r.days.map((x) => `${format(parseISO(x.d), 'EEEE')} ${x.future ? 'to come' : x.min ? durationText(x.min) : 'rest'}`).join(', ')}`}
          >
            {r.days.map((x) => {
              const s = x.min ? Math.round(8 + 10 * Math.sqrt(x.min / max)) : 6;
              return (
                <span key={x.d} className="tlog-slot">
                  <span className={`tlog-dot${x.min ? ' on' : ''}${x.d === today ? ' today' : ''}${x.future ? ' future' : ''}`} style={{ width: s }} />
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div className="tlog-days" aria-hidden="true">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- fitness

function changeText(change: { pts: number; from: string } | null, days: number, series: FitnessDay[]): string | null {
  if (!change) return null;
  const span = series.length - 1 < days ? `since ${format(parseISO(change.from), 'd MMM')}` : `over the past ${days} days`;
  if (change.pts === 0) return `No change ${span}`;
  return `${change.pts > 0 ? '+' : '−'}${Math.abs(change.pts)} ${Math.abs(change.pts) === 1 ? 'pt' : 'pts'} ${span}`;
}

function Spark({ points, width: w0 }: { points: FitnessDay[]; width?: number }) {
  const [ref, , width] = useWidth(w0 ?? 160);
  const fill = useId();
  const H = 64;
  const pad = { l: 2, r: 30, t: 10, b: 6 };
  const plotW = Math.max(20, width - pad.l - pad.r);
  const vals = points.map((p) => p.score);
  const lo = Math.max(0, Math.min(...vals) - 5);
  const hi = Math.max(lo + 10, Math.max(...vals) + 5);
  const x = (i: number) => pad.l + (points.length > 1 ? i / (points.length - 1) : 1) * plotW;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const end = points[points.length - 1];
  return (
    <div ref={ref} className="fit-spark" aria-hidden="true">
      <svg width={width} height={H}>
        <defs>
          <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--green)', stopOpacity: 0.18 }} />
            <stop offset="1" style={{ stopColor: 'var(--green)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {points.length > 1 && <path d={`${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`} fill={`url(#${fill})`} />}
        <path d={line} className="wt-line" />
        <circle cx={x(points.length - 1)} cy={y(end.score)} r={4.5} className="wt-end" />
        <text x={x(points.length - 1) + 8} y={y(end.score)} className="wt-label" dominantBaseline="middle">
          {end.score}
        </text>
      </svg>
    </div>
  );
}

export function FitnessCard({ logs, today }: { logs: Record<string, DailyLog>; today: string }) {
  const series = useMemo(() => fitnessSeries(logs, today), [logs, today]);
  const [open, setOpen] = useState(false);
  if (!series.length) {
    return (
      <section className="card" aria-labelledby="fit-h">
        <h2 className="card-title" id="fit-h">
          Fitness
        </h2>
        <p className="card-sub fit-empty">Your fitness score starts with your first workout. Every session adds to it, by how long it was and how hard it felt.</p>
      </section>
    );
  }
  const now = series[series.length - 1];
  const change = fitnessChange(series, 30);
  const line = changeText(change, 30, series);
  return (
    <>
      <button type="button" className="card fit-card" onClick={() => (tap(), setOpen(true))}>
        <span className="fit-top">
          <span className="card-title">Fitness</span>
          <span className="card-sub">
            Past month <IconChevron size={14} />
          </span>
        </span>
        <span className="fit-row">
          <span className="fit-score">
            <strong>{now.score}</strong>
            <span>{fitnessWord(now.score)}</span>
          </span>
          <Spark points={series.slice(-31)} />
        </span>
        {line && <span className={`fit-change${change && change.pts > 0 ? ' up' : ''}`}>{line}</span>}
      </button>
      <FitnessSheet open={open} onClose={() => setOpen(false)} series={series} today={today} />
    </>
  );
}

type Range = '1m' | '3m' | '6m' | 'all';
const RANGE: Record<Exclude<Range, 'all'>, number> = { '1m': 30, '3m': 91, '6m': 182 };

function FitnessSheet({ open, onClose, series, today }: { open: boolean; onClose: () => void; series: FitnessDay[]; today: string }) {
  const [range, setRange] = useState<Range>('1m');
  const from = range === 'all' ? series[0].date : addDays(today, -RANGE[range]);
  const points = series.filter((p) => p.date >= from);
  const now = series[series.length - 1];
  const change = points.length > 1 ? { pts: now.score - points[0].score, from: points[0].date } : null;
  const line = changeText(change, range === 'all' ? Infinity : RANGE[range], range === 'all' ? [] : points.length - 1 < RANGE[range] ? points : series);
  return (
    <Sheet open={open} onClose={onClose} title="Fitness">
      <p className="fit-lead">Your training added up over time.</p>
      <div className="segmented segmented-sm" role="group" aria-label="Time range">
        {(['1m', '3m', '6m', 'all'] as Range[]).map((r) => (
          <button key={r} type="button" aria-pressed={range === r} onClick={() => (tap(), setRange(r))}>
            {r === 'all' ? 'All' : r.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="fit-sheet-head">
        <strong>{now.score}</strong>
        <span>
          {fitnessWord(now.score)}
          {line ? ` · ${line}` : ''}
        </span>
      </div>
      <ScoreChart points={points} />
      <section className="fit-explain" aria-labelledby="fit-how">
        <h3 id="fit-how">How it works</h3>
        <p>Every workout you log adds to your score, by how long it was and how hard it felt: an hour of hard HIIT counts for more than an easy walk.</p>
        <p>It builds over about six weeks of steady training and fades slowly on rest days, so a day off never wipes it out. The first 45 minutes of an activity in a day count in full, then less, so steady weeks beat one huge session.</p>
        <ul className="fit-levels">
          <li>
            <b>80+</b> Peak
          </li>
          <li>
            <b>60–79</b> Fit
          </li>
          <li>
            <b>40–59</b> Steady
          </li>
          <li>
            <b>20–39</b> Building
          </li>
        </ul>
      </section>
    </Sheet>
  );
}

function ScoreChart({ points }: { points: FitnessDay[] }) {
  const [ref, box, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const fill = useId();
  useEffect(() => setActive(null), [points.length]);
  const H = 190;
  const pad = { l: 30, r: 14, t: 14, b: 26 };
  const plotW = Math.max(40, width - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  const vals = points.map((p) => p.score);
  const step = Math.max(...vals) - Math.min(...vals) > 40 ? 20 : 10;
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 2) / step) * step);
  const hi = Math.min(100, Math.max(lo + 2 * step, Math.ceil((Math.max(...vals) + 2) / step) * step));
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const x = (i: number) => pad.l + (points.length > 1 ? i / (points.length - 1) : 1) * plotW;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * plotH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const act = active !== null ? points[active] : null;
  const end = points[points.length - 1];
  const pick = (clientX: number) => {
    const r = box?.getBoundingClientRect();
    if (!r || !points.length) return;
    const i = Math.round(((clientX - r.left - pad.l) / plotW) * (points.length - 1));
    setActive(Math.min(points.length - 1, Math.max(0, i)));
  };
  if (!points.length) return null;
  return (
    <div
      ref={ref}
      className="wt-chart"
      tabIndex={0}
      role="group"
      aria-label={`Fitness score from ${format(parseISO(points[0].date), 'd MMMM')} (${points[0].score}) to ${format(parseISO(end.date), 'd MMMM')} (${end.score}). Use the arrow keys to read each day.`}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e.clientX)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
        else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
        else if (e.key === 'Escape') setActive(null);
        else return;
        e.preventDefault();
      }}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={H} aria-hidden="true">
        <defs>
          <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--green)', stopOpacity: 0.2 }} />
            <stop offset="1" style={{ stopColor: 'var(--green)', stopOpacity: 0.02 }} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="wt-grid" />
            <text x={pad.l - 6} y={y(t)} className="wt-tick" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="wt-tick">
          {format(parseISO(points[0].date), 'd MMM')}
        </text>
        <text x={width - pad.r} y={H - 6} className="wt-tick" textAnchor="end">
          Today
        </text>
        {points.length > 1 && <path d={`${line} L${x(points.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`} fill={`url(#${fill})`} />}
        <path d={line} className="wt-line" />
        {act && <line x1={x(active!)} x2={x(active!)} y1={pad.t} y2={pad.t + plotH} className="wt-cross" />}
        <circle cx={x(act ? active! : points.length - 1)} cy={y((act ?? end).score)} r={5} className="wt-end" />
        {!act && (
          <text x={x(points.length - 1) - 8} y={y(end.score) - 12} className="wt-label" textAnchor="end">
            {end.score}
          </text>
        )}
      </svg>
      {act && (
        <div className="wt-tip" style={{ left: Math.min(Math.max(8, x(active!) - 60), width - 128) }} role="status">
          <span className="wt-tip-date">{format(parseISO(act.date), 'EEE d MMM')}</span>
          <span>
            <strong>{act.score}</strong> {fitnessWord(act.score).toLowerCase()}
          </span>
        </div>
      )}
    </div>
  );
}
