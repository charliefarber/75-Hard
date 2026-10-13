import { useState } from 'react';
import type { Food, FoodEntry } from '../../data/foodTypes';
import { foodEmoji } from '../../lib/basics';
import type { MacroGoals, Totals } from '../../lib/nutrition';
import { fmt } from '../ui';

/** Product photo if there is one, otherwise a friendly emoji tile. */
export function FoodThumb({ food, entry, size = 40 }: { food?: Food | null; entry?: FoodEntry; size?: number }) {
  const [broken, setBroken] = useState(false);
  const f = food ?? entry?.food ?? null;
  const key = f?.key ?? entry?.food_key ?? (entry?.source === 'quick' ? 'quick:' : entry?.source === 'photo' || entry?.source === 'describe' ? 'est:' : null);
  const style = { width: size, height: size, borderRadius: size * 0.3 };
  if (f?.image && !broken)
    return (
      <span className="food-thumb img" style={style} aria-hidden="true">
        <img src={f.image} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  return (
    <span className="food-thumb" style={{ ...style, fontSize: size * 0.5 }} aria-hidden="true">
      {foodEmoji(key)}
    </span>
  );
}

export const g1 = (n: number | null | undefined) => (n == null ? '–' : n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());

/** "P 23 · C 40 · F 9" */
export function MacroLine({ p, c, f }: { p: number | null | undefined; c: number | null | undefined; f: number | null | undefined }) {
  return (
    <span className="macro-line">
      <i className="m-p" />P {g1(p)} <i className="m-c" />C {g1(c)} <i className="m-f" />F {g1(f)}
    </span>
  );
}

const MACROS = [
  { key: 'protein', label: 'Protein', cls: 'm-p' },
  { key: 'carbs', label: 'Carbs', cls: 'm-c' },
  { key: 'fat', label: 'Fat', cls: 'm-f' },
] as const;

/** Protein / carbs / fat against her goals (or just grams + share of calories without goals). */
export function MacroBars({ t, goals, compact }: { t: Pick<Totals, 'protein' | 'carbs' | 'fat' | 'kcal'>; goals: MacroGoals | null; compact?: boolean }) {
  const kcalOf = { protein: t.protein * 4, carbs: t.carbs * 4, fat: t.fat * 9 };
  const sum = kcalOf.protein + kcalOf.carbs + kcalOf.fat;
  return (
    <div className={`macro-bars${compact ? ' compact' : ''}`}>
      {MACROS.map((m) => {
        const have = t[m.key];
        const goal = goals?.[m.key] ?? 0;
        const pct = goal ? have / goal : sum ? kcalOf[m.key] / sum : 0;
        return (
          <div key={m.key} className="macro-bar">
            <div className="macro-bar-head">
              <span>{m.label}</span>
              <span>
                <strong>{fmt(Math.round(have))}</strong>
                {goal ? ` / ${fmt(goal)} g` : ' g'}
              </span>
            </div>
            <span className={`macro-track ${m.cls}`} aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }} className={goal && have > goal * 1.05 ? 'over' : undefined} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
