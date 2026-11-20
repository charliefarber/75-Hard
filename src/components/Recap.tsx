import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { useFood } from '../data/FoodData';
import { summarise, toISODate } from '../lib/challenge';
import { mondayOf } from '../lib/recap';
import { formatChange, formatWeight, weightUnitFor } from '../lib/body';
import { fullDayFloor, timeText, weekReport, type EntriesFor, type HabitId, type Highlight, type WeekReport } from '../lib/report';
import { mealLabel } from '../lib/nutrition';
import type { WeightUnit } from '../data/types';
import { Ring, Sheet, fmt } from './ui';
import { IconBook, IconCalendarCheck, IconCheck, IconChevron, IconChevronLeft, IconDrop, IconFlame, IconFork, IconLeaf, IconScale, IconShoe } from './Icons';
import { MacroBars } from './food/bits';
import '../styles/report.css';

const RECAP_KEY = (monday: string) => `seventyfive:recap-${monday}`;

/** The week to show automatically: last week, once, the first time she opens the app in a new week. */
export function pendingRecapWeek(startDate: string, today: string): string | null {
  const lastMonday = toISODate(addDays(parseISO(mondayOf(today)), -7));
  if (startDate > toISODate(addDays(parseISO(lastMonday), 6))) return null; // challenge hadn't started
  try {
    if (localStorage.getItem(RECAP_KEY(lastMonday))) return null;
  } catch {
    return null;
  }
  return lastMonday;
}

export function markRecapSeen(monday: string) {
  try {
    localStorage.setItem(RECAP_KEY(monday), '1');
  } catch {
    /* storage unavailable */
  }
}

/** The week the "Weekly report" button opens: last week, or this one in the challenge's first week. */
export function reportWeek(startDate: string, today: string): string {
  const thisMonday = mondayOf(today);
  return thisMonday === mondayOf(startDate) ? thisMonday : toISODate(addDays(parseISO(thisMonday), -7));
}

/**
 * Everything the report needs, from the app's data: the diary loads for the whole challenge (it's
 * small), and days that haven't loaded yet fall back to their calorie total.
 */
export function useReportInput() {
  const { profile, challenge, logs, today } = useApp();
  const food = useFood();
  const { ensure } = food;
  const start = challenge?.start_date;
  useEffect(() => {
    if (start && start <= today) void ensure(start, today);
  }, [start, today, ensure]);
  return useMemo(() => {
    if (!profile || !challenge) return null;
    const summary = summarise(challenge, logs, profile, today);
    const entries: EntriesFor = (d) => (food.isLoaded(d) ? food.entriesFor(d) : undefined);
    return { logs, entries, summary, profile, start: challenge.start_date, today, unit: weightUnitFor(profile.weight_unit) };
  }, [profile, challenge, logs, today, food]);
}

export function RecapSheet({ open, monday: initial, onClose }: { open: boolean; monday: string; onClose: () => void }) {
  const { profile, challenge, today } = useApp();
  const input = useReportInput();
  const [monday, setMonday] = useState(initial);
  useEffect(() => {
    if (open) setMonday(initial);
  }, [open, initial]);
  const r = useMemo(() => (input ? weekReport(monday, input) : null), [monday, input]);
  if (!profile || !challenge || !input || !r) return null;

  const firstMonday = mondayOf(challenge.start_date);
  const thisMonday = mondayOf(today);
  const finish = format(parseISO(input.summary.finishDate), 'EEE d MMM');
  const share = Math.round(r.recap.taskShare * 100);
  const step = (n: number) => setMonday(toISODate(addDays(parseISO(monday), n * 7)));
  const range = `${format(parseISO(r.monday), 'd MMM')} – ${format(parseISO(r.sunday), 'd MMM')}`;

  return (
    <Sheet open={open} onClose={onClose} title={r.current ? 'This week so far' : 'Your week'}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -8 }}>
        <button className="icon-btn" aria-label="Previous week" disabled={monday <= firstMonday} onClick={() => step(-1)} style={{ background: 'var(--surface-2)' }}>
          <IconChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{range}</span>
        <button className="icon-btn" aria-label="Next week" disabled={monday >= thisMonday} onClick={() => step(1)} style={{ background: 'var(--surface-2)' }}>
          <IconChevron size={20} />
        </button>
      </div>

      <section style={{ background: 'var(--forest)', color: '#fff', borderRadius: 22, padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Ring size={76} stroke={8} value={r.recap.taskShare} max={1} color="var(--mint)" track="rgba(255,255,255,0.14)" label={`${share}% of tasks done`}>
            <span style={{ fontSize: 19, fontWeight: 800 }}>{share}%</span>
          </Ring>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span className="rep-hero-title">{r.headline}</span>
            <span style={{ color: 'var(--mint-soft)', fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>
              {r.recap.inPlay
                ? `${share}% of tasks done · ${r.recap.completed} full ${r.recap.completed === 1 ? 'day' : 'days'} of ${r.recap.inPlay}`
                : 'Your challenge hadn’t started yet'}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }} aria-label="Days this week">
          {r.recap.days.map((d) => {
            const done = d.state === 'complete';
            const partial = d.state === 'partial';
            return (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mint-soft)' }}>{format(parseISO(d.date), 'EEEEE')}</span>
                <span
                  aria-label={`${format(parseISO(d.date), 'EEEE')}: ${d.state === null ? 'not in the challenge' : done ? 'full day' : `${d.done} of ${d.of} done`}`}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done ? 'var(--mint)' : partial ? 'rgba(255,255,255,0.16)' : 'transparent',
                    color: done ? 'var(--forest)' : '#fff',
                    border: d.state === 'today' ? '2px solid var(--mint)' : d.state === null ? '2px dashed rgba(255,255,255,0.25)' : '0',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {done ? <IconCheck size={16} strokeWidth={3} /> : partial ? `${d.done}/${d.of}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {r.highlights.length > 0 && (
        <ul className="rep-highlights" aria-label="Highlights">
          {r.highlights.map((h) => (
            <li key={h.text}>
              <span className={`rep-ico t-${h.topic}`} aria-hidden="true">
                {TOPIC_ICON[h.topic]}
              </span>
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      )}

      {r.recap.inPlay > 0 && <HabitsByDay r={r} />}
      <WeightPart r={r} unit={input.unit} />
      <FoodPart r={r} />
      <ActivityPart r={r} />

      {r.focus && (
        <section className="rep-focus" aria-label="Focus">
          <h3>{r.current ? 'Focus for the rest of the week' : 'Focus for next week'}</h3>
          <strong>{r.focus.title}</strong>
          <p>{r.focus.text}</p>
        </section>
      )}

      <p style={{ margin: 0, color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center' }}>
        {r.recap.totalCompleted} full {r.recap.totalCompleted === 1 ? 'day' : 'days'} so far · day 75 is {finish}
      </p>
      <button className="btn btn-primary btn-block" onClick={onClose}>
        {r.current ? 'Back to it' : 'Let’s go'}
      </button>
    </Sheet>
  );
}

const TOPIC_ICON: Record<Highlight['topic'], ReactNode> = {
  weight: <IconScale size={18} />,
  steps: <IconShoe size={18} />,
  workouts: <IconFlame size={18} />,
  full: <IconCheck size={18} strokeWidth={2.6} />,
  tasks: <IconCalendarCheck size={18} />,
  water: <IconDrop size={18} />,
  reading: <IconBook size={18} />,
  alcohol: <IconLeaf size={18} />,
  food: <IconFork size={18} />,
  protein: <IconFork size={18} />,
};

export const HABIT_ICON: Record<HabitId, ReactNode> = {
  workouts: <IconFlame size={15} />,
  water: <IconDrop size={15} />,
  reading: <IconBook size={15} />,
  alcohol: <IconLeaf size={15} />,
  steps: <IconShoe size={15} />,
};

function HabitsByDay({ r }: { r: WeekReport }) {
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(parseISO(r.monday), i)));
  return (
    <section className="rep-card" aria-labelledby="rep-habits-h">
      <div className="rep-head">
        <h3 id="rep-habits-h">Habits by day</h3>
        {r.habits[0]?.prev && !r.current && <span>vs last week</span>}
      </div>
      <table className="rep-habits">
        <colgroup>
          <col className="label" />
          {days.map((d) => (
            <col key={d} />
          ))}
          <col className="count" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Habit</span>
            </th>
            {days.map((d) => (
              <th key={d} scope="col" abbr={format(parseISO(d), 'EEEE')}>
                {format(parseISO(d), 'EEEEE')}
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">Days</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {r.habits.map((h) => {
            const delta = h.prev && h.prev.of && h.of && !r.current ? h.hit - h.prev.hit : null;
            return (
              <tr key={h.id} className={`h-${h.id}`}>
                <th scope="row" title={h.id === 'steps' ? `Steps: days with ${fmt(stepGoal(r))} or more` : h.label}>
                  {HABIT_ICON[h.id]}
                  {h.label}
                </th>
                {h.days.map((v, i) => (
                  <td key={days[i]}>
                    {v === null ? (
                      <span className="rep-dot none" role="img" aria-label={`${format(parseISO(days[i]), 'EEEE')}: not counted`} />
                    ) : v ? (
                      <span className="rep-dot on" role="img" aria-label={`${format(parseISO(days[i]), 'EEEE')}: done`}>
                        <IconCheck size={12} strokeWidth={3.4} />
                      </span>
                    ) : (
                      <span className="rep-dot off" role="img" aria-label={`${format(parseISO(days[i]), 'EEEE')}: missed`} />
                    )}
                  </td>
                ))}
                <td className="rep-count">
                  {h.hit}/{h.of}
                  {delta !== null && delta !== 0 && <em className={delta > 0 ? 'up' : undefined}>{delta > 0 ? `+${delta}` : `−${-delta}`}</em>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="rep-note">Steps counts days at or over {fmt(stepGoal(r))}, your daily share of the weekly goal.</p>
    </section>
  );
}

const stepGoal = (r: WeekReport) => r.activity.dayGoal;

function WeightPart({ r, unit }: { r: WeekReport; unit: WeightUnit }) {
  const w = r.weight;
  return (
    <section className="rep-card" aria-labelledby="rep-weight-h">
      <div className="rep-head">
        <h3 id="rep-weight-h">Weight</h3>
        {w && <span>{w.weighIns ? `${w.weighIns} weigh-${w.weighIns === 1 ? 'in' : 'ins'}` : 'no weigh-ins this week'}</span>}
      </div>
      {!w ? (
        <p className="rep-note">Weigh in a few mornings a week and your trend shows up here.</p>
      ) : (
        <>
          <div className="rep-big">
            <strong>{formatWeight(w.end, unit)}</strong>
            <span>7-day average{w.weighIns ? '' : `, ${format(parseISO(w.endDate), 'EEE d MMM')}`}</span>
          </div>
          {w.change != null && (
            <span className={`rep-pill${w.change <= -0.09 ? '' : ' flat'}`}>
              {Math.abs(w.change) < 0.09 ? 'Steady this week' : `${formatChange(w.change, unit)} this week`}
            </span>
          )}
          <ul className="rep-lines">
            {w.sinceStart != null && (
              <li>
                <b>{formatChange(w.sinceStart, unit)}</b> since day 1
              </li>
            )}
            {w.change != null && w.change >= 0.09 && <li>Weight moves day to day with water, salt and food. The trend over a few weeks is what counts.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

function FoodPart({ r }: { r: WeekReport }) {
  const f = r.food;
  const so = r.current ? ' so far' : '';
  return (
    <section className="rep-card" aria-labelledby="rep-food-h">
      <div className="rep-head">
        <h3 id="rep-food-h">Food</h3>
        {f.inPlay > 0 && (
          <span>
            logged {f.logged} of {f.inPlay} {f.inPlay === 1 ? 'day' : 'days'}
            {so}
          </span>
        )}
      </div>
      {!f.avg ? (
        <p className="rep-note">
          {f.inPlay === 0 ? 'Today counts once it’s over.' : 'No food logged this week. Type what you ate or snap a photo and it adds up here.'}
        </p>
      ) : (
        <>
          <div className="rep-big">
            <strong>{fmt(f.avg.kcal)}</strong>
            <span>
              kcal a day{f.goal ? ` · goal ${fmt(f.goal)}` : ''}
            </span>
          </div>
          {f.avg.protein != null && (
            <MacroBars t={{ kcal: f.avg.kcal, protein: f.avg.protein, carbs: f.avg.carbs ?? 0, fat: f.avg.fat ?? 0 }} goals={f.goals} compact />
          )}
          <ul className="rep-lines">
            {f.net != null && (
              <li>
                Eaten minus burned: <b>{f.net > 0 ? '+' : f.net < 0 ? '−' : ''}{fmt(Math.abs(f.net))} kcal</b> a day
              </li>
            )}
            {f.meals.length >= 2 && (
              <li>
                Biggest meal: <b>{mealLabel(f.meals[0].meal)}</b>, {Math.round(f.meals[0].share * 100)}% of the day’s calories
              </li>
            )}
            {f.top.length > 0 && (
              <li>
                Most logged: <b>{f.top.map((t) => `${t.name} (${t.count})`).join(', ')}</b>
              </li>
            )}
          </ul>
          {f.basis === 'all' ? (
            <p className="rep-note">No day looked fully logged, so these averages are from part-logged days and will read low.</p>
          ) : f.part > 0 ? (
            <p className="rep-note">
              {f.part} {f.part === 1 ? 'day looked' : 'days looked'} part-logged (one meal or under {fmt(fullDayFloor(f.goal))} kcal), so {f.part === 1 ? 'it’s' : 'they’re'} left out of these averages.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function ActivityPart({ r }: { r: WeekReport }) {
  const a = r.activity;
  const stepsDelta = !r.current && a.prevSteps ? Math.round((a.steps / a.prevSteps - 1) * 100) : null;
  return (
    <section className="rep-card" aria-labelledby="rep-act-h">
      <div className="rep-head">
        <h3 id="rep-act-h">Activity</h3>
      </div>
      <div className="rep-grid2">
        <div className="rep-mini">
          <span>Steps</span>
          <strong>{fmt(a.steps)}</strong>
          <div className="meter" style={{ height: 6 }} aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.round((a.steps / Math.max(1, a.goal)) * 100))}%`, background: 'var(--steps)' }} />
          </div>
          <small>
            of {fmt(a.goal)}
            {stepsDelta !== null && stepsDelta !== 0 ? ` · ${stepsDelta > 0 ? '+' : '−'}${Math.abs(stepsDelta)}% on last week` : ''}
          </small>
        </div>
        <div className="rep-mini">
          <span>Workouts</span>
          <strong>{timeText(a.minutes)}</strong>
          <div className="meter" style={{ height: 6 }} aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.round((a.minutes / Math.max(1, a.goalMinutes)) * 100))}%`, background: 'var(--green)' }} />
          </div>
          <small>
            of {timeText(a.goalMinutes)} · {a.sessions} {a.sessions === 1 ? 'session' : 'sessions'}
            {a.kcal > 0 ? ` · ≈${fmt(Math.round(a.kcal))} kcal` : ''}
          </small>
        </div>
      </div>
      {a.top.length > 0 && (
        <p className="rep-note">
          Mostly {a.top.map((t) => `${t.name} (${timeText(t.minutes)})`).join(' and ')}.
        </p>
      )}
    </section>
  );
}
