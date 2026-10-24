import { useMemo, useState } from 'react';
import {
  buildWeeks,
  changeSinceFirst,
  type Aggregate,
  type DatedValue,
  type WeekSummary,
} from '../lib/weeks';

/** One metric the chips can switch to. Pass values already in her display unit (kg, lb…). */
export interface WeeklyMetric {
  key: string; // 'weight', 'steps', …
  label: string; // chip text: 'Weight'
  title: string; // chart title: 'Weekly average weight'
  unit: string; // 'kg', 'steps', 'min/day'
  aggregate: Aggregate; // 'average' or 'total'
  values: DatedValue[]; // one or more entries per day; the last entry for a day wins
  decimals?: number; // default 0
  goal?: number; // per week for totals, per day for averages; drawn as a dashed line
  chart?: 'line' | 'bar'; // default: line for averages without a goal, bar otherwise
}

export interface WeeklyProgressProps {
  start: string; // challenge start date, yyyy-mm-dd
  today: string; // yyyy-mm-dd
  metrics: WeeklyMetric[];
  totalDays?: number; // default 75
  initialMetric?: string;
  onOpenWeek?: (week: WeekSummary, metricKey: string) => void;
}

const C = {
  ink: '#15211A',
  muted: '#56635B',
  faint: '#66716A',
  line: '#EDF0EC',
  card: '#FFFFFF',
  accent: '#1D6B44',
  accentSoft: '#E1F0E6',
  current: '#8CC3A2',
  stub: '#B9C2BB',
  goal: '#9AA59E',
  chipBorder: '#CBD3CD',
};
const FONT = "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif";
const MINUS = '\u2212';

function fmt(v: number, decimals = 0): string {
  return v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function signed(v: number, decimals = 0): string {
  const s = fmt(Math.abs(v), decimals);
  if (Number(s.replace(/,/g, '')) === 0) return '±0';
  return (v > 0 ? '+' : MINUS) + s;
}
function short(v: number, decimals = 0): string {
  return Math.abs(v) >= 10000 ? fmt(v / 1000, 1) + 'k' : fmt(v, decimals);
}

export default function WeeklyProgress(props: WeeklyProgressProps) {
  const { start, today, metrics, totalDays, onOpenWeek } = props;
  const [key, setKey] = useState(props.initialMetric ?? metrics[0]?.key);
  const metric = metrics.find((m) => m.key === key) ?? metrics[0];

  const weeks = useMemo(
    () =>
      metric
        ? buildWeeks({ start, today, values: metric.values, aggregate: metric.aggregate, totalDays })
        : [],
    [metric, start, today, totalDays],
  );

  if (!metric) return null;
  const d = metric.decimals ?? 0;
  const isLine = metric.chart ? metric.chart === 'line' : metric.aggregate === 'average' && metric.goal === undefined;
  const shown = weeks.filter((w) => w.status !== 'upcoming');
  const current = weeks.find((w) => w.status === 'current');
  const latest = [...shown].reverse().find((w) => w.value !== null);

  // Summary card
  let pill: string | null = null;
  const sinceFirst = changeSinceFirst(weeks, metric.aggregate);
  if (sinceFirst !== null) {
    const first = weeks.find((w) => w.value !== null)!;
    pill = `${signed(sinceFirst, d)} ${metric.unit} since Week ${first.week}`;
  } else if (metric.aggregate === 'total' && metric.goal !== undefined && latest && latest.status === 'done') {
    pill = (latest.value as number) >= metric.goal
      ? `Week ${latest.week} goal met`
      : `${fmt(metric.goal - (latest.value as number), d)} short of the goal`;
  }

  // Row text
  const rowNote = (w: WeekSummary): string => {
    if (w.value === null) return w.status === 'current' ? 'Nothing logged yet' : 'Nothing logged';
    if (w.status === 'current' && metric.aggregate === 'total') return `${w.daysElapsed} of ${w.length} days so far`;
    if (w.change !== null) return `${signed(w.change, d)} ${metric.unit} vs Week ${w.week - 1}`;
    return w.week === 1 ? 'First week' : '';
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, color: C.ink }}>
      <div role="group" aria-label="Metric" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {metrics.map((m) => {
          const on = m.key === metric.key;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() => setKey(m.key)}
              style={{
                flex: '0 0 auto', minHeight: 44, padding: '0 18px', borderRadius: 22,
                border: `1.5px solid ${on ? C.accent : C.chipBorder}`,
                background: on ? C.accent : C.card, color: on ? '#FFFFFF' : C.ink,
                font: `600 14px ${FONT}`, cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ background: C.card, borderRadius: 20, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.muted }}>
          {latest ? `Week ${latest.week}${latest.status === 'current' ? ' so far' : ''}` : 'Nothing logged yet'}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05 }}>
            {latest ? fmt(latest.value as number, d) : '–'}
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.muted }}>{metric.unit}</span>
        </div>
        {pill && (
          <span style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 999, background: C.accentSoft, color: C.accent, fontSize: 13, fontWeight: 700 }}>
            {pill}
          </span>
        )}
      </div>

      <div style={{ background: C.card, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{metric.title}</h2>
          <span style={{ fontSize: 12, color: C.muted }}>Weeks 1–{weeks.length}</span>
        </div>
        <Chart weeks={weeks} isLine={isLine} goal={metric.goal} decimals={d} title={metric.title} />
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.line}`, paddingTop: 10, fontSize: 12, color: C.muted }}>
          <span>Challenge week</span>
          {current && <span>Week {current.week}: day {current.firstDay + current.daysElapsed - 1} of {weeks[weeks.length - 1].lastDay}</span>}
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: 0, padding: '16px 16px 10px', fontSize: 16, fontWeight: 700 }}>Week by week</h2>
        {[...shown].reverse().map((w) => {
          const content = (
            <>
              <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Week {w.week}</span>
                  {w.status === 'current' && (
                    <span style={{ padding: '2px 8px', borderRadius: 999, background: C.accentSoft, color: C.accent, fontSize: 11, fontWeight: 700 }}>
                      In progress
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>Days {w.firstDay}–{w.lastDay}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {w.value === null ? '–' : `${fmt(w.value, d)} ${metric.unit}`}
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>{rowNote(w)}</span>
              </span>
            </>
          );
          const rowStyle = {
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, width: '100%',
            padding: '10px 16px', borderTop: `1px solid ${C.line}`, color: C.ink,
          } as const;
          return onOpenWeek ? (
            <button
              key={w.week}
              type="button"
              onClick={() => onOpenWeek(w, metric.key)}
              style={{ ...rowStyle, border: 0, borderTop: rowStyle.borderTop, background: 'transparent', font: 'inherit', cursor: 'pointer' }}
            >
              {content}
            </button>
          ) : (
            <div key={w.week} style={rowStyle}>{content}</div>
          );
        })}
        {weeks.length > shown.length && (
          <p style={{ margin: 0, padding: '12px 16px 16px', borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted }}>
            Weeks {shown.length + 1}–{weeks.length} appear as they start
            {weeks[weeks.length - 1].length < 7
              ? `. Week ${weeks.length} is days ${weeks[weeks.length - 1].firstDay}–${weeks[weeks.length - 1].lastDay}.`
              : '.'}
          </p>
        )}
      </div>
    </section>
  );
}

function Chart(props: { weeks: WeekSummary[]; isLine: boolean; goal?: number; decimals: number; title: string }) {
  const { weeks, isLine, goal, decimals, title } = props;
  const W = 330, PLOT = 150, TOP = 20, GAP = 6;
  const n = weeks.length;
  const colW = (W - GAP * (n - 1)) / n;
  const cx = (i: number) => i * (colW + GAP) + colW / 2;
  const vals = weeks.map((w) => w.value).filter((v): v is number => v !== null);

  let y: (v: number) => number;
  if (isLine) {
    const lo0 = vals.length ? Math.min(...vals) : 0;
    const hi0 = vals.length ? Math.max(...vals) : 1;
    const pad = Math.max((hi0 - lo0) * 0.25, 0.5);
    const lo = lo0 - pad, hi = hi0 + pad;
    y = (v) => TOP + ((hi - v) / (hi - lo)) * (PLOT - TOP - 10);
  } else {
    const max = Math.max(goal ?? 0, ...vals, 1) * 1.1;
    y = (v) => PLOT - (v / max) * (PLOT - TOP);
  }
  const pts = weeks
    .map((w, i) => (w.value === null ? null : `${cx(i).toFixed(1)},${y(w.value).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${PLOT + 22}`} width="100%" role="img" aria-label={`${title}, by challenge week`} style={{ display: 'block', overflow: 'visible' }}>
      {goal !== undefined && !isLine && (
        <g>
          <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke={C.goal} strokeWidth={1.5} strokeDasharray="4 4" />
          <text x={W} y={y(goal) - 4} textAnchor="end" fontSize={10} fontWeight={600} fill={C.muted}>
            Goal {short(goal, decimals)}
          </text>
        </g>
      )}
      {isLine && <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {weeks.map((w, i) => {
        const cur = w.status === 'current';
        const label = w.value === null ? null : short(w.value, decimals);
        if (w.value === null) {
          return !isLine && w.status === 'upcoming' ? (
            <rect key={w.week} x={i * (colW + GAP) + 0.75} y={PLOT - 10} width={colW - 1.5} height={9.25} rx={4} fill="none" stroke={C.stub} strokeWidth={1.5} strokeDasharray="3 3" />
          ) : null;
        }
        if (isLine) {
          return (
            <g key={w.week}>
              <circle cx={cx(i)} cy={y(w.value)} r={5} fill={cur ? '#FFFFFF' : C.accent} stroke={C.accent} strokeWidth={2.5} />
              <text x={cx(i)} y={y(w.value) - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.ink}>{label}</text>
            </g>
          );
        }
        const top = y(w.value);
        return (
          <g key={w.week}>
            <rect x={i * (colW + GAP)} y={top} width={colW} height={Math.max(PLOT - top, 3)} rx={5} fill={cur ? C.current : C.accent} />
            <text x={cx(i)} y={top - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.ink}>{label}</text>
          </g>
        );
      })}
      {weeks.map((w, i) => (
        <text key={`l${w.week}`} x={cx(i)} y={PLOT + 16} textAnchor="middle" fontSize={11}
          fontWeight={w.status === 'current' ? 800 : 600}
          fill={w.status === 'current' ? C.accent : w.status === 'done' ? C.ink : C.faint}>
          {w.week}
        </text>
      ))}
    </svg>
  );
}
