import { useEffect, useState } from 'react';
import type { FoodEntry, Meal, MealPrep } from '../../data/foodTypes';
import { MEALS } from '../../data/foodTypes';
import { useFood } from '../../data/FoodData';
import { asIngredients, batchNutrition, MAX_PORTIONS, newMealPrep, portionNutrition } from '../../lib/mealPrep';
import { amountText, mealForTime, mealLabel } from '../../lib/nutrition';
import { success, tap } from '../../lib/haptics';
import { Sheet, Stepper, ToggleRow, fmt } from '../ui';
import { IconPlus, IconX } from '../Icons';
import { FoodLogger } from './FoodLogger';
import { FoodThumb, MacroLine } from './bits';

/**
 * A new meal prep: add everything that went into the batch (search, scan, photo or quick add,
 * the same as logging food), split it into portions, and optionally log one straight away.
 * While she's adding ingredients this sheet steps aside for the food logger, then comes back.
 */
export function MealPrepSheet({
  open,
  date,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  /** Saved; `logged` is the portion put in the diary straight away, if she asked for one. */
  onSaved: (prep: MealPrep, logged: FoodEntry[]) => void;
}) {
  const food = useFood();
  const [name, setName] = useState('');
  const [items, setItems] = useState<FoodEntry[]>([]);
  const [portions, setPortions] = useState(4);
  const [logNow, setLogNow] = useState(true);
  const [meal, setMeal] = useState<Meal>('dinner');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time it opens.
  useEffect(() => {
    if (!open) return;
    const now = mealForTime();
    setName('');
    setItems([]);
    setPortions(4);
    setLogNow(true);
    setMeal(now === 'lunch' || now === 'dinner' ? now : 'dinner');
    setAdding(false);
    setSaving(false);
    setError(null);
  }, [open]);

  const batch = batchNutrition(items);
  const each = items.length ? portionNutrition({ items, portions }) : null;
  const ready = items.length > 0 && name.trim().length > 0 && !saving;

  async function save() {
    setError(null);
    let prep: MealPrep;
    try {
      prep = newMealPrep({ name, items: asIngredients(items), portions, madeOn: date });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSaving(true);
    try {
      const logged = await food.addMealPrep(prep, logNow ? { date, meal } : null);
      success();
      onSaved(prep, logged);
    } catch {
      setSaving(false); // already reported
    }
  }

  return (
    <>
      <Sheet open={open && !adding} onClose={onClose} title="New meal prep" className="sheet-tall prep-sheet">
        <label className="field">
          Name
          <input className="input" maxLength={60} placeholder="e.g. Chicken teriyaki rice" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="prep-block">
          <div className="prep-block-head">
            <span className="pick-label">Everything that went in</span>
            {items.length > 0 && <span className="prep-count">{items.length === 1 ? '1 ingredient' : `${items.length} ingredients`}</span>}
          </div>
          {items.length > 0 ? (
            <div className="pick-list">
              {items.map((e, i) => (
                <div key={e.id} className="food-line">
                  <FoodThumb entry={e} />
                  <span className="food-line-main" style={{ cursor: 'default' }}>
                    <span className="row-title">{e.name}</span>
                    <span className="row-sub">
                      {amountText(e)} · {fmt(Math.round(e.kcal))} kcal
                    </span>
                  </span>
                  <button type="button" className="icon-btn" aria-label={`Remove ${e.name}`} onClick={() => (tap(), setItems(items.filter((_, j) => j !== i)))}>
                    <IconX size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="card-sub" style={{ margin: 0 }}>
              Add each ingredient the way you’d log a food: search, scan the barcode, snap it, or quick add.
            </p>
          )}
          <button type="button" className="btn btn-soft btn-block" onClick={() => (tap(), setAdding(true))}>
            <IconPlus size={18} strokeWidth={2.6} /> {items.length ? 'Add more ingredients' : 'Add ingredients'}
          </button>
        </div>

        {each && (
          <>
            <div className="prep-batch">
              <span className="prep-batch-label">Whole batch</span>
              <strong>{fmt(Math.round(batch.kcal))} kcal</strong>
              <MacroLine p={batch.protein} c={batch.carbs} f={batch.fat} />
            </div>

            <div className="prep-split">
              <span className="row-text">
                <span className="row-title">Split into</span>
                <span className="row-sub">Equal portions</span>
              </span>
              <Stepper value={portions} onChange={setPortions} min={1} max={MAX_PORTIONS} label="portions" />
            </div>

            <div className="prep-portion" aria-live="polite">
              <span className="prep-portion-label">Each portion</span>
              <span className="prep-portion-kcal">
                <strong>{fmt(each.kcal)}</strong> kcal
              </span>
              <MacroLine p={each.protein} c={each.carbs} f={each.fat} />
            </div>

            <ToggleRow title="Log one portion now" sub={logNow ? `Adds it to ${mealLabel(meal).toLowerCase()} today` : 'Keep them all for later'} checked={logNow} onChange={setLogNow} />
            {logNow && (
              <div className="segmented" role="group" aria-label="Log it at">
                {MEALS.map((m) => (
                  <button key={m.id} type="button" aria-pressed={meal === m.id} onClick={() => (tap(), setMeal(m.id))}>
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {error && (
          <p className="note-card" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="btn btn-primary btn-block" disabled={!ready} onClick={save}>
          {saving ? 'Saving…' : items.length ? `Save ${portions} ${portions === 1 ? 'portion' : 'portions'}` : 'Save meal prep'}
        </button>
        {items.length > 0 && !name.trim() && <p className="card-sub" style={{ margin: '-6px 0 0', textAlign: 'center' }}>Give it a name to save it.</p>}
      </Sheet>

      <FoodLogger open={open && adding} date={date} meal={meal} onClose={() => setAdding(false)} collect={(entries) => setItems((list) => [...list, ...entries])} />
    </>
  );
}
