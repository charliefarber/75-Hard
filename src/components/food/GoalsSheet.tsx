import { useEffect, useState } from 'react';
import type { Profile } from '../../data/types';
import { MACRO_SPLITS, splitGoals } from '../../lib/nutrition';
import { Sheet, fmt } from '../ui';
import { tap } from '../../lib/haptics';

type Mode = (typeof MACRO_SPLITS)[number]['id'] | 'custom';

/** Which preset (if any) her saved macro grams match. */
function modeFor(p: Profile): Mode {
  if (!p.protein_goal_g && !p.carbs_goal_g && !p.fat_goal_g) return 'balanced';
  if (!p.calorie_goal) return 'custom';
  for (const s of MACRO_SPLITS) {
    const g = splitGoals(p.calorie_goal, s.split);
    if (Math.abs(g.protein - (p.protein_goal_g ?? 0)) <= 2 && Math.abs(g.carbs - (p.carbs_goal_g ?? 0)) <= 2 && Math.abs(g.fat - (p.fat_goal_g ?? 0)) <= 2) return s.id;
  }
  return 'custom';
}

const digits = (v: string, n = 5) => v.replace(/\D/g, '').slice(0, n);

/**
 * Calorie target, macros and the daily active-calorie goal in one place.
 * Macros follow the calorie target (a preset split) unless she types her own grams.
 */
export function FoodGoalsSheet({
  open,
  profile,
  maintenance,
  activeDefault,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: Profile;
  /** Roughly what she burns on a normal day (resting + her active goal), for a hint. */
  maintenance: number | null;
  activeDefault: number;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const [kcal, setKcal] = useState('');
  const [mode, setMode] = useState<Mode>('balanced');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [active, setActive] = useState('');

  useEffect(() => {
    if (!open) return;
    setKcal(profile.calorie_goal ? String(profile.calorie_goal) : '');
    setMode(modeFor(profile));
    setP(profile.protein_goal_g ? String(profile.protein_goal_g) : '');
    setC(profile.carbs_goal_g ? String(profile.carbs_goal_g) : '');
    setF(profile.fat_goal_g ? String(profile.fat_goal_g) : '');
    setActive(profile.active_goal_kcal ? String(profile.active_goal_kcal) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const target = parseInt(kcal, 10) || 0;
  const preset = MACRO_SPLITS.find((s) => s.id === mode);
  const grams = preset && target ? splitGoals(target, preset.split) : null;
  const custom = { protein: parseInt(p, 10) || 0, carbs: parseInt(c, 10) || 0, fat: parseInt(f, 10) || 0 };
  const customKcal = custom.protein * 4 + custom.carbs * 4 + custom.fat * 9;
  const activeN = parseInt(active, 10) || 0;
  const valid = (!kcal || (target >= 500 && target <= 10000)) && (!active || (activeN >= 50 && activeN <= 5000)) && (mode !== 'custom' || [custom.protein, custom.carbs, custom.fat].every((g) => g <= 1000));

  return (
    <Sheet open={open} onClose={onClose} title="Calories & macros">
      <form
        className="goals-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const macros =
            mode === 'custom'
              ? { protein_goal_g: custom.protein || null, carbs_goal_g: custom.carbs || null, fat_goal_g: custom.fat || null }
              : mode === 'balanced' || !grams
                ? { protein_goal_g: null, carbs_goal_g: null, fat_goal_g: null }
                : { protein_goal_g: grams.protein, carbs_goal_g: grams.carbs, fat_goal_g: grams.fat };
          onSave({ calorie_goal: target || null, ...macros, active_goal_kcal: activeN || null });
        }}
      >
        <div className="goal-block">
          <span className="pick-label">Daily calorie target</span>
          <label className="dur-value goal-kcal">
            <span className="sr-only">Calories a day</span>
            <input inputMode="numeric" placeholder="–" value={kcal} onChange={(e) => setKcal(digits(e.target.value))} style={{ width: `${Math.max(2, kcal.length) + 0.6}ch` }} />
            <span>kcal a day</span>
          </label>
          {maintenance ? (
            <p className="card-sub goal-hint">
              You burn about <strong>{fmt(maintenance)}</strong> on a normal day (resting plus your active goal), so that’s roughly where your weight holds steady.{' '}
              {String(maintenance) !== kcal && (
                <button type="button" className="link-btn tiny" onClick={() => (tap(), setKcal(String(maintenance)))}>
                  Use {fmt(maintenance)}
                </button>
              )}
            </p>
          ) : null}
          {kcal && target > 0 && target < 500 && <p className="card-sub goal-hint warn">That’s too low to be a daily target.</p>}
        </div>

        <div className="goal-block">
          <span className="pick-label">Macros</span>
          <div className="chips" role="group" aria-label="Macro split">
            {MACRO_SPLITS.map((s) => (
              <button key={s.id} type="button" className="chip-btn" aria-pressed={mode === s.id} onClick={() => (tap(), setMode(s.id))}>
                {s.label}
              </button>
            ))}
            <button type="button" className="chip-btn" aria-pressed={mode === 'custom'} onClick={() => (tap(), setMode('custom'))}>
              Custom
            </button>
          </div>
          {mode === 'custom' ? (
            <>
              <div className="quick-macros">
                {(
                  [
                    ['Protein', p, setP, 'm-p'],
                    ['Carbs', c, setC, 'm-c'],
                    ['Fat', f, setF, 'm-f'],
                  ] as const
                ).map(([label, v, set, cls]) => (
                  <label key={label} className="field">
                    <span>
                      <i className={`dot ${cls}`} aria-hidden="true" /> {label} (g)
                    </span>
                    <input className="input" inputMode="numeric" placeholder="–" value={v} onChange={(e) => set(digits(e.target.value, 4))} />
                  </label>
                ))}
              </div>
              <p className="card-sub goal-hint">
                {customKcal ? `These add up to ${fmt(customKcal)} kcal${target ? ` (target ${fmt(target)})` : ''}.` : 'Grams of each a day. Leave any blank to skip it.'}
              </p>
            </>
          ) : (
            <div className="goal-grams">
              {(
                [
                  ['Protein', grams?.protein, 'm-p'],
                  ['Carbs', grams?.carbs, 'm-c'],
                  ['Fat', grams?.fat, 'm-f'],
                ] as const
              ).map(([label, g, cls]) => (
                <span key={label} className="goal-gram">
                  <i className={`dot ${cls}`} aria-hidden="true" />
                  <strong>{g ? `${g} g` : '–'}</strong>
                  <span>{label}</span>
                </span>
              ))}
            </div>
          )}
          {mode !== 'custom' && <p className="card-sub goal-hint">{target ? preset?.note : 'Set a calorie target to see grams.'}</p>}
        </div>

        <div className="goal-block">
          <span className="pick-label">Active calories goal</span>
          <label className="dur-value goal-kcal">
            <span className="sr-only">Active calories a day</span>
            <input inputMode="numeric" placeholder={String(activeDefault)} value={active} onChange={(e) => setActive(digits(e.target.value, 4))} style={{ width: `${Math.max(String(activeDefault).length, active.length) + 0.6}ch` }} />
            <span>kcal a day</span>
          </label>
          <p className="card-sub goal-hint">Fills the Burned ring on Today: workouts plus everyday steps. Leave it empty for {fmt(activeDefault)}, worked out from your workout and step goals.</p>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={!valid}>
          Save
        </button>
      </form>
    </Sheet>
  );
}
