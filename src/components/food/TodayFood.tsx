import type { FoodEntry, Meal } from '../../data/foodTypes';
import { MEALS } from '../../data/foodTypes';
import { byMeal, totals } from '../../lib/nutrition';
import { useRef } from 'react';
import { fmt } from '../ui';
import { IconCamera, IconChevron, IconPlus } from '../Icons';
import { MacroLine } from './bits';
import { MealIcon } from './MealIcon';
import { tap } from '../../lib/haptics';

/** Today's meals at a glance, each with its own "+" (the Lifesum layout she's used to). */
export function TodayFood({
  entries,
  outside,
  ai,
  onAdd,
  onOpen,
  onType,
  onPhoto,
  usual,
}: {
  entries: FoodEntry[];
  /** Calories that came from Lifesum or were typed in, while the diary is empty. */
  outside: { kcal: number; from: string } | null;
  /** Photo and type-it logging are switched on. */
  ai: boolean;
  onAdd: (meal: Meal) => void;
  onOpen: () => void;
  /** Open the logger with the keyboard up, ready to type what she ate. */
  onType: () => void;
  onPhoto: (file: File) => void;
  /** One tap to log what she usually has for the meal coming up (only while that meal is empty). */
  usual?: { meal: Meal; title: string; kcal: number; onLog: () => void } | null;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
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
            <span className="card-sub">{ai ? 'Type it, snap it, or tap + on a meal' : 'Tap + to log a meal'}</span>
          )}
        </div>
        <button type="button" className="link-btn diary-link" onClick={() => (tap(), onOpen())}>
          Diary <IconChevron size={16} />
        </button>
      </div>
      <div className="eat-bar">
        <button type="button" className="eat-bar-input" onClick={() => (tap(), onType())}>
          <span aria-hidden="true">{ai ? '✨' : '🔍'}</span>
          <span>{ai ? 'What did you eat?' : 'Search foods'}</span>
        </button>
        {ai && (
          <button type="button" className="eat-bar-cam" aria-label="Snap a photo of a meal" onClick={() => (tap(), photoInput.current?.click())}>
            <IconCamera size={22} />
          </button>
        )}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onPhoto(f);
          }}
        />
      </div>
      <div className="meal-rows">
        {MEALS.map((m) => {
          const list = meals[m.id];
          const kcal = totals(list).kcal;
          return (
            <div key={m.id} className={`meal-row${usual && usual.meal === m.id && !list.length ? ' has-usual' : ''}`}>
              <button type="button" className="meal-row-main" onClick={() => (tap(), list.length ? onOpen() : onAdd(m.id))}>
                <MealIcon meal={m.id} />
                <span className="row-text">
                  <span className="row-title">{m.label}</span>
                  <span className="row-sub">{list.length ? list.map((e) => e.name).join(', ') : 'Nothing yet'}</span>
                </span>
                {list.length > 0 && <span className="meal-row-kcal">{fmt(kcal)}</span>}
              </button>
              <button type="button" className="add-btn" aria-label={`Add to ${m.label.toLowerCase()}`} onClick={() => (tap(), onAdd(m.id))}>
                <IconPlus size={20} strokeWidth={2.6} />
              </button>
              {usual && usual.meal === m.id && !list.length && (
                <div className="usual-strip">
                  <span className="row-text">
                    <span className="usual-tag">Your usual</span>
                    <span className="row-title">{usual.title}</span>
                    <span className="row-sub">{fmt(usual.kcal)} kcal</span>
                  </span>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => (tap(), usual.onLog())}>
                    Log it
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
