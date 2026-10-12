import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { WeightUnit } from '../data/types';
import { formatChange, formatWeight, parseWeight, weightParts, weightStepKg } from '../lib/body';
import { Sheet } from './ui';
import { IconCamera, IconMinus, IconPlus, IconScale } from './Icons';
import { tap } from '../lib/haptics';

/** Weight + progress photo for the day, side by side. */
export function CheckInCard({
  weightKg,
  last,
  avg,
  weekChange,
  unit,
  photoUrl,
  hasPhoto,
  busy,
  isToday,
  onWeight,
  onPhoto,
  onPickPhoto,
}: {
  weightKg: number | null;
  /** Most recent earlier weigh-in, shown until she weighs in today. */
  last: { date: string; kg: number } | null;
  /** 7-day average ending this day. */
  avg: number | null;
  /** Change in the 7-day average over the past week. */
  weekChange: number | null;
  unit: WeightUnit;
  photoUrl: string | undefined;
  hasPhoto: boolean;
  busy: boolean;
  isToday: boolean;
  onWeight: () => void;
  onPhoto: () => void;
  onPickPhoto: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="card checkin" aria-label="Weight and progress photo">
      <button type="button" className="ci-weight" onClick={() => (tap(), onWeight())}>
        <span className="ci-icon" aria-hidden="true">
          <IconScale size={22} />
        </span>
        <span className="row-text">
          <span className="ci-label">{isToday ? 'Today’s weight' : 'Weight'}</span>
          {weightKg !== null ? (
            <span className="ci-value">{formatWeight(weightKg, unit)}</span>
          ) : (
            <span className="ci-value ci-empty">Log weight</span>
          )}
          <span className="ci-sub">
            {weightKg !== null
              ? avg !== null
                ? `7-day avg ${formatWeight(avg, unit)}${weekChange !== null ? ` · ${formatChange(weekChange, unit)}` : ''}`
                : 'Your trend starts here'
              : last
                ? `Last ${formatWeight(last.kg, unit)} · ${format(parseISO(last.date), 'EEE d MMM')}`
                : 'Same time each morning'}
          </span>
        </span>
      </button>
      <span className="ci-divider" aria-hidden="true" />
      <button
        type="button"
        className="ci-photo"
        disabled={busy}
        aria-label={hasPhoto ? 'Open progress photo' : 'Add a progress photo'}
        onClick={() => {
          tap();
          if (hasPhoto) onPhoto();
          else input.current?.click();
        }}
      >
        {hasPhoto ? (
          photoUrl ? (
            <img src={photoUrl} alt="" className="ci-thumb" />
          ) : (
            <span className="ci-thumb ci-thumb-loading" />
          )
        ) : (
          <span className={`ci-cam${busy ? ' busy' : ''}`} aria-hidden="true">
            {busy ? <span className="spinner" /> : <IconCamera size={24} />}
          </span>
        )}
        <span className="ci-photo-label">{busy ? 'Saving…' : hasPhoto ? 'Photo' : 'Add photo'}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPickPhoto(f);
        }}
      />
    </section>
  );
}

export function WeightSheet({
  open,
  date,
  isToday,
  current,
  last,
  avg,
  unit,
  onUnit,
  onSave,
  onClose,
}: {
  open: boolean;
  date: string;
  isToday: boolean;
  /** This day's weigh-in, if any. */
  current: number | null;
  /** Latest weigh-in before this day, to start from. */
  last: { date: string; kg: number } | null;
  avg: number | null;
  unit: WeightUnit;
  onUnit: (u: WeightUnit) => void;
  onSave: (kg: number | null) => void;
  onClose: () => void;
}) {
  const [u, setU] = useState<WeightUnit>(unit);
  const [main, setMain] = useState('');
  const [lb, setLb] = useState('');

  const fill = (kg: number | null, unitNow: WeightUnit) => {
    if (kg === null) {
      setMain('');
      setLb('');
      return;
    }
    const p = weightParts(kg, unitNow);
    setMain(p.main);
    setLb(p.lb ?? '');
  };

  useEffect(() => {
    if (!open) return;
    setU(unit);
    fill(current ?? last?.kg ?? null, unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const kg = parseWeight(main, u, lb);
  const nudge = (dir: 1 | -1) => {
    tap();
    const base = kg ?? last?.kg ?? 65;
    fill(Math.min(400, Math.max(20, base + dir * weightStepKg(u))), u);
  };
  const switchUnit = (next: WeightUnit) => {
    tap();
    fill(kg, next);
    setU(next);
    onUnit(next);
  };
  const decimal = (v: string) => v.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 6);

  return (
    <Sheet open={open} onClose={onClose} title={isToday ? 'Today’s weight' : `Weight · ${format(parseISO(date), 'EEE d MMM')}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (kg !== null) onSave(kg);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div className="dur wt-dial">
          <button type="button" className="dur-btn" aria-label={`0.1 ${u === 'kg' ? 'kg' : 'lb'} less`} onClick={() => nudge(-1)}>
            <IconMinus size={22} />
          </button>
          {u === 'st' ? (
            <span className="wt-st">
              <label className="dur-value">
                <span className="sr-only">Stone</span>
                <input inputMode="numeric" value={main} placeholder="10" onChange={(e) => setMain(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ width: '2.1ch' }} />
                <span>st</span>
              </label>
              <label className="dur-value">
                <span className="sr-only">Pounds</span>
                <input inputMode="decimal" value={lb} placeholder="0" onChange={(e) => setLb(decimal(e.target.value).slice(0, 4))} style={{ width: `${Math.max(2, lb.length) + 0.3}ch` }} />
                <span>lb</span>
              </label>
            </span>
          ) : (
            <label className="dur-value">
              <span className="sr-only">Weight in {u === 'kg' ? 'kilograms' : 'pounds'}</span>
              <input
                inputMode="decimal"
                value={main}
                placeholder={u === 'kg' ? '65.0' : '143.0'}
                onChange={(e) => setMain(decimal(e.target.value))}
                style={{ width: `${Math.max(4, main.length) + 0.3}ch` }}
              />
              <span>{u}</span>
            </label>
          )}
          <button type="button" className="dur-btn" aria-label={`0.1 ${u === 'kg' ? 'kg' : 'lb'} more`} onClick={() => nudge(1)}>
            <IconPlus size={22} />
          </button>
        </div>

        <div className="segmented" role="group" aria-label="Units">
          {(['kg', 'lb', 'st'] as WeightUnit[]).map((x) => (
            <button key={x} type="button" aria-pressed={u === x} onClick={() => switchUnit(x)}>
              {x === 'kg' ? 'kg' : x === 'lb' ? 'lb' : 'st & lb'}
            </button>
          ))}
        </div>

        {(last || avg !== null) && (
          <p className="card-sub" style={{ margin: 0, textAlign: 'center', fontSize: 13 }}>
            {last && `Last: ${formatWeight(last.kg, u)} on ${format(parseISO(last.date), 'EEE d MMM')}`}
            {last && avg !== null && ' · '}
            {avg !== null && `7-day average ${formatWeight(avg, u)}`}
          </p>
        )}
        {main !== '' && kg === null && (
          <p className="card-sub" style={{ margin: 0, textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>
            That doesn’t look like a weight. Check the number and units.
          </p>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={kg === null}>
          Save
        </button>
        {current !== null && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => onSave(null)}>
            Remove this weigh-in
          </button>
        )}
        <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
          Weigh in at the same time each day, ideally after waking up. Day-to-day changes are mostly water; the 7-day average shows the real trend.
        </p>
      </form>
    </Sheet>
  );
}
