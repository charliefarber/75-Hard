import type { FoodEntry, Meal } from '../../data/foodTypes';
import { MEALS } from '../../data/foodTypes';
import { byMeal, totals } from '../../lib/nutrition';
import { fmt } from '../ui';
import { IconChevron, IconPlus } from '../Icons';
import { MacroLine } from './bits';
import { tap } from '../../lib/haptics';

export const MEAL_EMOJI: Record<Meal, string> = { breakfast: '🥣', lunch: '🥗', dinner: '🍝', snacks: '🍎' };

/** Today's meals at a glance, each with its own "+" (the Lifesum layout she's used to). */
export function TodayFood({
  entries,
  outside,
  onAdd,
  onOpen,
}: {
  entries: FoodEntry[];
  /** Calories that came from Lifesum or were typed in, while the diary is empty. */
  outside: { kcal: number; from: string } | null;
  onAdd: (meal: Meal) => void;
  onOpen: () => void;
}) {
  const meals = byMeal(entries);
  const t = totals(entries);
  return (
    <section className="card food-today" aria-labelledby="food-today-h">
      <div className="card-head">
        <div className="row-text">
          <h2 className="card-title" id="food-today-h">
            Food
          </h2>
          {entries.length > 0 ? (
            <MacroLine p={t.protein} c={t.carbs} f={t.fat} />
          ) : outside ? (
            <span className="card-sub">
              {fmt(outside.kcal)} kcal from {outside.from}
            </span>
          ) : (
            <span className="card-sub">Tap + to log a meal</span>
          )}
        </div>
        <button type="button" className="link-btn diary-link" onClick={() => (tap(), onOpen())}>
          Diary <IconChevron size={16} />
        </button>
      </div>
      <div className="meal-rows">
        {MEALS.map((m) => {
          const list = meals[m.id];
          const kcal = totals(list).kcal;
          return (
            <div key={m.id} className="meal-row">
              <button type="button" className="meal-row-main" onClick={() => (tap(), list.length ? onOpen() : onAdd(m.id))}>
                <span className="meal-emoji" aria-hidden="true">
                  {MEAL_EMOJI[m.id]}
                </span>
                <span className="row-text">
                  <span className="row-title">{m.label}</span>
                  <span className="row-sub">{list.length ? list.map((e) => e.name).join(', ') : 'Nothing yet'}</span>
                </span>
                {list.length > 0 && <span className="meal-row-kcal">{fmt(kcal)}</span>}
              </button>
              <button type="button" className="add-btn" aria-label={`Add to ${m.label.toLowerCase()}`} onClick={() => (tap(), onAdd(m.id))}>
                <IconPlus size={20} strokeWidth={2.6} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
