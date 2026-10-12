import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { addDays, addMonths, format, getDay, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';
import { useApp } from '../data/AppData';
import { CHALLENGE_LENGTH, summarise, toISODate, weekSteps } from '../lib/challenge';
import { fmt } from '../components/ui';
import { RecapSheet } from '../components/Recap';
import { mondayOf } from '../lib/recap';
import { IconCalendarCheck, IconChevron } from '../components/Icons';
import { tap } from '../lib/haptics';

const CELL: Record<string, { bg: string; fg: string; border: string }> = {
  complete: { bg: 'var(--green)', fg: '#fff', border: 'transparent' },
  missed: { bg: '#fdf0d8', fg: '#8a4b00', border: '#f5dfa8' },
  today: { bg: '#fff', fg: 'var(--forest)', border: 'var(--green)' },
  future: { bg: 'var(--line)', fg: 'var(--faint)', border: 'transparent' },
};

export function ProgressScreen({ openDay }: { openDay: (date: string) => void }) {
  const { profile, challenge, logs, today, history } = useApp();
  const summary = useMemo(
    () => (challenge && profile ? summarise(challenge, logs, profile, today) : null),
    [challenge, logs, profile, today],
  );
  const [recap, setRecap] = useState<string | null>(null);
  if (!profile || !challenge || !summary) return null;

  const attempt = history.findIndex((c) => c.id === challenge.id) + 1 || history.length;
  const pct = Math.round((summary.completedDays / CHALLENGE_LENGTH) * 100);

  const byDate = new Map(summary.timeline.map((t) => [t.date, t]));
  const first = parseISO(summary.timeline[0]?.date ?? challenge.start_date);
  const last = parseISO(summary.timeline[summary.timeline.length - 1]?.date ?? challenge.start_date);
  const months: { key: string; title: string; cells: (string | null)[] }[] = [];
  for (let m = startOfMonth(first); m <= last; m = addMonths(m, 1)) {
    const lead = (getDay(m) + 6) % 7; // Monday-first
    const days = Array.from({ length: getDaysInMonth(m) }, (_, i) => toISODate(addDays(m, i)));
    const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
    // Keep only the weeks that touch the challenge.
    const weeks: (string | null)[][] = [];
    for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));
    const kept = weeks.filter((wk) => wk.some((c) => c && byDate.has(c)));
    if (kept.length) months.push({ key: toISODate(m), title: format(m, 'MMMM yyyy'), cells: kept.flat() });
  }

  const sw = weekSteps(logs, today);
  const weekGoal = profile.step_goal * 7;
  const daysLeft = sw.days.filter((d) => d.date > today).length + 1; // including today
  const perDayNeeded = Math.max(0, Math.ceil((weekGoal - sw.total) / daysLeft));

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = toISODate(addDays(parseISO(today), i - 6));
    const l = logs[d];
    return { d, label: format(parseISO(d), 'EEEEE'), steps: l?.steps ?? 0, water: l?.water_ml ?? 0 };
  });
  const chartMax = Math.max(profile.step_goal * 1.4, ...sw.days.map((x) => x.steps));
  const waterDays = last7.filter((x) => x.water >= profile.water_goal_ml).length;
  const past = history.filter((c) => c.status !== 'active').reverse();

  return (
    <div className="screen page-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 4px', gap: 8, flexWrap: 'wrap' }}>
        <h1 className="page-title">Progress</h1>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', paddingBottom: 4 }}>
          Attempt {attempt} · from {format(parseISO(challenge.start_date), 'd MMM')}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <Tile value={String(summary.completedDays)} label="days complete" dark />
        <Tile value={String(summary.remaining)} label="days to go" />
        {summary.missedDays.length > 0 ? (
          <Tile value={`+${summary.missedDays.length}`} label={summary.missedDays.length === 1 ? 'day added' : 'days added'} />
        ) : (
          <Tile value={`${pct}%`} label="of the way" />
        )}
      </div>

      <button
        className="card"
        onClick={() => (tap(), setRecap(mondayOf(today) === mondayOf(challenge.start_date) ? mondayOf(today) : toISODate(addDays(parseISO(mondayOf(today)), -7))))}
        style={{ border: 0, flexDirection: 'row', alignItems: 'center', gap: 14, textAlign: 'left' }}
      >
        <span className="icon-badge" style={{ background: 'var(--mint-tint)', color: 'var(--green-ink)' }}>
          <IconCalendarCheck size={22} />
        </span>
        <span className="row-text">
          <span className="row-title">Weekly recap</span>
          <span className="row-sub">How your week went, every week</span>
        </span>
        <IconChevron size={18} style={{ color: '#9aa59d' }} />
      </button>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Calendar</h2>
          <span className="card-sub">Finish {format(parseISO(summary.finishDate), 'EEE d MMM')}</span>
        </div>
        <div className="card-sub" style={{ marginTop: -6 }}>
          Tap any day to fill it in or change it.
        </div>
        {months.map((m) => (
          <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{m.title}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, textAlign: 'center' }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} aria-hidden="true" style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', paddingBottom: 2 }}>
                  {d}
                </span>
              ))}
              {m.cells.map((c, i) => {
                if (!c) return <span key={`b${i}`} />;
                const t = byDate.get(c);
                const dateNum = format(parseISO(c), 'd');
                if (!t) {
                  return (
                    <span key={c} aria-hidden="true" style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#b7c2b9' }}>
                      {dateNum}
                    </span>
                  );
                }
                const st = CELL[t.state];
                const when = format(parseISO(c), 'EEEE d MMMM');
                return (
                  <button
                    key={c}
                    disabled={t.state === 'future'}
                    onClick={() => (tap(), openDay(c))}
                    aria-label={t.state === 'missed' ? `${when}: didn’t count` : `${when}, day ${t.day}: ${t.state === 'today' ? 'in progress' : t.state}`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 10,
                      background: st.bg,
                      color: st.fg,
                      border: `2px solid ${st.border}`,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0,
                      lineHeight: 1.1,
                      opacity: 1,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{dateNum}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.8 }}>{t.day ? `D${t.day}` : '+1'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <Legend swatch={{ background: 'var(--green)' }} label="Complete" />
          <Legend swatch={{ border: '2px solid var(--green)' }} label="Today" />
          <Legend swatch={{ background: '#fdf0d8', border: '2px solid #f5dfa8' }} label="Didn’t count (+1)" />
          <Legend swatch={{ background: 'var(--line)' }} label="To come" />
        </div>
      </section>

      <section className="card">
        <div className="card-head" style={{ alignItems: 'baseline' }}>
          <h2 className="card-title">Steps this week</h2>
          <span className="card-sub">
            <strong style={{ color: 'var(--ink)', fontSize: 15 }}>{fmt(sw.total)}</strong> / {fmt(weekGoal)}
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--steps-tint)', overflow: 'hidden' }} aria-hidden="true">
          <div style={{ height: '100%', width: `${Math.min(100, (sw.total / weekGoal) * 100)}%`, background: 'var(--steps)', borderRadius: 5, transition: 'width 0.6s var(--ease)' }} />
        </div>
        <span className="card-sub">
          {sw.total >= weekGoal
            ? 'Weekly goal hit. Nice.'
            : `${fmt(perDayNeeded)} a day from here hits ${fmt(weekGoal)} by Sunday.`}
        </span>
        <div
          role="img"
          aria-label={`Steps this week: ${sw.days.map((x) => `${format(parseISO(x.date), 'EEEE')} ${fmt(x.steps)}`).join(', ')}`}
          style={{ position: 'relative', height: 110, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, alignItems: 'end' }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(profile.step_goal / chartMax) * 100}%`, borderTop: '1.5px dashed #b7c2b9' }}>
            <span style={{ position: 'absolute', right: 0, top: -18, fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{fmt(profile.step_goal)} avg</span>
          </div>
          {sw.days.map((x) => (
            <div
              key={x.date}
              style={{
                height: `${Math.max(2, (x.steps / chartMax) * 100)}%`,
                borderRadius: '8px 8px 4px 4px',
                background: x.date > today ? 'transparent' : x.steps >= profile.step_goal ? 'var(--steps)' : 'var(--steps-soft)',
                transition: 'height 0.6s var(--ease)',
              }}
            />
          ))}
        </div>
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>
          {sw.days.map((x) => (
            <span key={x.date} style={x.date === today ? { color: 'var(--ink)', fontWeight: 800 } : undefined}>
              {format(parseISO(x.date), 'EEEEE')}
            </span>
          ))}
        </div>
      </section>

      <section className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <div className="row-text">
          <span className="row-title">Water goal hit</span>
          <span className="row-sub">Last 7 days</span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--water)' }}>
          {waterDays}
          <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}> / 7</span>
        </span>
      </section>

      {past.length > 0 && (
        <>
          <span className="section-label">Earlier attempts</span>
          <section className="card list">
            {past.map((c, i) => {
              return (
                <div className="row" key={c.id}>
                  <div className="row-text">
                    <span className="row-title">Attempt {history.indexOf(c) + 1 || past.length - i}</span>
                    <span className="row-sub">
                      {format(parseISO(c.start_date), 'd MMM')}
                      {c.ended_on ? ` – ${format(parseISO(c.ended_on), 'd MMM')}` : ''}
                    </span>
                  </div>
                  <span className={c.status === 'completed' ? 'chip' : 'chip warn'}>
                    {c.status === 'completed' ? 'Finished' : 'Restarted'}
                  </span>
                </div>
              );
            })}
          </section>
        </>
      )}
      {recap && <RecapSheet open monday={recap} onClose={() => setRecap(null)} />}
    </div>
  );
}

function Tile({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  return (
    <div
      style={{
        background: dark ? 'var(--forest)' : '#fff',
        color: dark ? '#fff' : 'var(--ink)',
        borderRadius: 18,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 800 }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: dark ? 'var(--mint-soft)' : 'var(--muted)' }}>{label}</span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: CSSProperties; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 12, borderRadius: 4, boxSizing: 'border-box', ...swatch }} />
      {label}
    </span>
  );
}
