import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { CHALLENGE_LENGTH, summarise, toISODate } from '../lib/challenge';
import { fmt } from '../components/ui';
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
  if (!profile || !challenge || !summary) return null;

  const attempt = history.findIndex((c) => c.id === challenge.id) + 1 || history.length;
  const pct = Math.round((summary.completedDays / CHALLENGE_LENGTH) * 100);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = toISODate(addDays(parseISO(today), i - 6));
    const l = logs[d];
    return { d, label: format(parseISO(d), 'EEEEE'), steps: l?.steps ?? 0, water: l?.water_ml ?? 0 };
  });
  const loggedSteps = last7.filter((x) => x.steps > 0);
  const avgSteps = loggedSteps.length ? Math.round(loggedSteps.reduce((a, b) => a + b.steps, 0) / loggedSteps.length) : 0;
  const chartMax = Math.max(profile.step_goal * 1.4, ...last7.map((x) => x.steps));
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

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">75 days</h2>
          <span className="card-sub">Finish {format(parseISO(summary.finishDate), 'EEE d MMM')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 5 }}>
          {summary.timeline.map((t, i) => {
            const s = CELL[t.state];
            const clickable = t.state !== 'future';
            const when = format(parseISO(t.date), 'EEEE d MMMM');
            return (
              <button
                key={t.date}
                disabled={!clickable}
                onClick={() => (tap(), openDay(t.date))}
                aria-label={t.state === 'missed' ? `${when}: didn’t count` : `Day ${t.day}, ${when}: ${t.state === 'today' ? 'in progress' : t.state}`}
                title={when}
                style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  background: s.bg,
                  color: s.fg,
                  border: `2px solid ${s.border}`,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: 0,
                  opacity: 1,
                  transition: 'transform 0.15s var(--ease)',
                  animation: `pop 0.4s var(--ease) ${Math.min(i, 40) * 8}ms both`,
                }}
              >
                {t.day ?? '+1'}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <Legend swatch={{ background: 'var(--green)' }} label="Complete" />
          <Legend swatch={{ border: '2px solid var(--green)' }} label="Today" />
          <Legend swatch={{ background: '#fdf0d8', border: '2px solid #f5dfa8' }} label="Didn’t count (+1 day)" />
        </div>
      </section>

      <section className="card">
        <div className="card-head" style={{ alignItems: 'baseline' }}>
          <h2 className="card-title">Steps, last 7 days</h2>
          <span className="card-sub">
            avg <strong style={{ color: 'var(--ink)', fontSize: 14 }}>{fmt(avgSteps)}</strong>
          </span>
        </div>
        <div
          role="img"
          aria-label={`Steps for the last 7 days: ${last7.map((x) => `${format(parseISO(x.d), 'EEEE')} ${fmt(x.steps)}`).join(', ')}`}
          style={{ position: 'relative', height: 130, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, alignItems: 'end' }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${(profile.step_goal / chartMax) * 100}%`,
              borderTop: '1.5px dashed #b7c2b9',
            }}
          >
            <span style={{ position: 'absolute', right: 0, top: -18, fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
              {fmt(profile.step_goal)}
            </span>
          </div>
          {last7.map((x) => (
            <div
              key={x.d}
              style={{
                height: `${Math.max(2, (x.steps / chartMax) * 100)}%`,
                borderRadius: '8px 8px 4px 4px',
                background: x.steps >= profile.step_goal ? 'var(--steps)' : 'var(--steps-soft)',
                transition: 'height 0.6s var(--ease)',
              }}
            />
          ))}
        </div>
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>
          {last7.map((x) => (
            <span key={x.d} style={x.d === today ? { color: 'var(--ink)', fontWeight: 800 } : undefined}>
              {x.label}
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
