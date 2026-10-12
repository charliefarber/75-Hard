import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { DailyLog, WeightUnit } from '../data/types';
import { toISODate } from '../lib/challenge';
import { formatChange, formatWeight, kgToLb, weighIns, weightTrend } from '../lib/body';
import { tap } from '../lib/haptics';

type Range = '1m' | '3m' | 'all';
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '1m': 30, '3m': 91 };

/** In the unit she reads (stone charts in pounds: one number per point is easier to scan). */
const toUnit = (kg: number, unit: WeightUnit) => (unit === 'kg' ? kg : kgToLb(kg));
const unitLabel = (unit: WeightUnit) => (unit === 'kg' ? 'kg' : 'lb');

/** Round tick step so the axis shows 3–5 clean values. */
function niceStep(span: number): number {
  for (const s of [0.2, 0.5, 1, 2, 5, 10, 20]) if (span / s <= 4) return s;
  return 50;
}

/** Width of an element that may come and go (chart ↔ table), kept current as it resizes. */
function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, el, w] as const;
}

/**
 * Weight over time: each weigh-in as a quiet grey dot, the 7-day average as the green line
 * (that's the trend that matters; single days bounce around with water). Drag or use the arrow
 * keys to read any day; "Table" lists every value.
 */
export function WeightCard({
  logs,
  unit,
  today,
  onLog,
}: {
  logs: Record<string, DailyLog>;
  unit: WeightUnit;
  today: string;
  onLog: () => void;
}) {
  const all = useMemo(() => weightTrend(weighIns(logs)), [logs]);
  const [range, setRange] = useState<Range>('all');
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [boxRef, box, width] = useWidth();

  const from = range === 'all' ? all[0]?.date ?? today : toISODate(addDays(parseISO(today), -RANGE_DAYS[range]));
  const points = all.filter((p) => p.date >= from);
  useEffect(() => setActive(null), [range]);

  if (all.length === 0) {
    return (
      <section className="card" aria-labelledby="wt-h">
        <h2 className="card-title" id="wt-h">
          Weight
        </h2>
        <p className="card-sub" style={{ margin: 0, lineHeight: 1.5, fontSize: 13 }}>
          Weigh in each morning and your trend shows up here: every weigh-in, plus the 7-day average that smooths out water weight.
        </p>
        <button type="button" className="btn btn-dark btn-block" style={{ height: 46 }} onClick={onLog}>
          Log today’s weight
        </button>
      </section>
    );
  }

  const latest = all[all.length - 1];
  const first = all[0];
  const change = latest.avg - first.avg;

  // ---- geometry
  const H = 168;
  const pad = { l: 34, r: 14, t: 14, b: 26 };
  const plotW = Math.max(40, width - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  const startDate = parseISO(points.length ? (range === 'all' ? points[0].date : from) : from);
  const days = Math.max(1, differenceInCalendarDays(parseISO(today), startDate));
  const x = (d: string) => pad.l + (differenceInCalendarDays(parseISO(d), startDate) / days) * plotW;
  const vals = points.flatMap((p) => [toUnit(p.kg, unit), toUnit(p.avg, unit)]);
  const lo0 = Math.min(...vals);
  const hi0 = Math.max(...vals);
  const minSpan = unit === 'kg' ? 2 : 4;
  const mid = (lo0 + hi0) / 2;
  const span = Math.max(minSpan, (hi0 - lo0) * 1.25);
  const step = niceStep(span);
  const lo = Math.floor((mid - span / 2) / step) * step;
  const hi = Math.ceil((mid + span / 2) / step) * step;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * plotH;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(toUnit(p.avg, unit)).toFixed(1)}`).join(' ');
  const end = points[points.length - 1];
  const act = active !== null ? points[active] : null;

  const pick = (clientX: number) => {
    const r = box?.getBoundingClientRect();
    if (!r || !points.length) return;
    const px = clientX - r.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    setActive(best);
  };

  return (
    <section className="card" aria-labelledby="wt-h">
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 className="card-title" id="wt-h">
            Weight
          </h2>
          <span className="wt-big">{formatWeight(latest.avg, unit)}</span>
          <span className="card-sub">7-day average</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, paddingTop: 22 }}>
          <span className={`wt-change${change <= -0.05 ? ' down' : change >= 0.05 ? ' up' : ''}`}>{formatChange(change, unit)}</span>
          <span className="card-sub">since {format(parseISO(first.date), 'd MMM')}</span>
        </div>
      </div>

      <div className="wt-controls">
        <div className="segmented segmented-sm" role="group" aria-label="Time range">
          {(['1m', '3m', 'all'] as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => (tap(), setRange(r))}>
              {r === '1m' ? '1M' : r === '3m' ? '3M' : 'All'}
            </button>
          ))}
        </div>
        <button type="button" className="link-btn" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? 'Chart' : 'Table'}
        </button>
      </div>

      {table ? (
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Weigh-in</th>
                <th scope="col">7-day avg</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{format(parseISO(p.date), 'EEE d MMM')}</td>
                  <td>{formatWeight(p.kg, unit)}</td>
                  <td>{formatWeight(p.avg, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div
            ref={boxRef}
            className="wt-chart"
            tabIndex={0}
            role="group"
            aria-label={`Weight chart, ${points.length} weigh-ins. Use the arrow keys to read each day.`}
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
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="wt-grid" />
                  <text x={pad.l - 6} y={y(t)} className="wt-tick" textAnchor="end" dominantBaseline="middle">
                    {Number.isInteger(step) ? t.toFixed(0) : t.toFixed(1)}
                  </text>
                </g>
              ))}
              <text x={pad.l} y={H - 6} className="wt-tick">
                {format(startDate, 'd MMM')}
              </text>
              <text x={width - pad.r} y={H - 6} className="wt-tick" textAnchor="end">
                {format(parseISO(today), 'd MMM')}
              </text>
              {act && <line x1={x(act.date)} x2={x(act.date)} y1={pad.t} y2={pad.t + plotH} className="wt-cross" />}
              {points.map((p, i) => (
                <circle key={p.date} cx={x(p.date)} cy={y(toUnit(p.kg, unit))} r={i === active ? 5 : 4} className={i === active ? 'wt-dot on' : 'wt-dot'} />
              ))}
              {points.length > 1 && <path d={line} className="wt-line" />}
              {end && (
                <>
                  <circle cx={x(end.date)} cy={y(toUnit(end.avg, unit))} r={4.5} className="wt-end" />
                  {!act && (
                    <text
                      x={x(end.date) - 8}
                      y={y(toUnit(end.avg, unit)) - 10}
                      className="wt-label"
                      textAnchor="end"
                    >
                      {toUnit(end.avg, unit).toFixed(1)}
                    </text>
                  )}
                </>
              )}
              {act && <circle cx={x(act.date)} cy={y(toUnit(act.avg, unit))} r={4.5} className="wt-end" />}
            </svg>
            {act && (
              <div
                className="wt-tip"
                style={{ left: Math.min(Math.max(8, x(act.date) - 70), width - 148) }}
                role="status"
              >
                <span className="wt-tip-date">{format(parseISO(act.date), 'EEE d MMM')}</span>
                <span>
                  <i className="key-line" /> <strong>{toUnit(act.avg, unit).toFixed(1)}</strong> avg
                </span>
                <span>
                  <i className="key-dot" /> <strong>{toUnit(act.kg, unit).toFixed(1)}</strong> {unitLabel(unit)} that day
                </span>
              </div>
            )}
          </div>
          <div className="wt-legend" aria-hidden="true">
            <span>
              <i className="key-line" /> 7-day average
            </span>
            <span>
              <i className="key-dot" /> Daily weigh-in
            </span>
            {unit === 'st' && <span style={{ marginLeft: 'auto' }}>in lb</span>}
          </div>
        </>
      )}
    </section>
  );
}
