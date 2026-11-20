import { useMemo } from 'react';
import type { FoodEntry, Meal } from '../../data/foodTypes';
import { MEALS } from '../../data/foodTypes';
import { mealForTime } from '../../lib/nutrition';
import { foodPatterns, mealToLog, PATTERN_DAYS, type MealPart, type OftenFood } from '../../lib/patterns';
import { addDays } from '../../lib/weeks';
import { tap } from '../../lib/haptics';
import { fmt } from '../ui';
import { IconPlus } from '../Icons';
import { FoodThumb } from './bits';

const LABEL = Object.fromEntries(MEALS.map((m) => [m.id, m.label])) as Record<Meal, string>;
const lower = (m: Meal) => LABEL[m].toLowerCase();

/** Where protein is easy to add, by meal. */
const PROTEIN_IDEAS: Record<Meal, string> = {
  breakfast: 'eggs, Greek yoghurt or skyr',
  lunch: 'chicken, tuna, eggs or beans',
  dinner: 'chicken, fish, tofu or lentils',
  snacks: 'yoghurt, a protein bar or edamame',
};

/**
 * Her last four weeks of food, on today's diary: where the day's calories come from, meal by meal
 * (fully logged days only), and the foods she logs most, each one tap from logged again.
 * It describes and never judges how much she eats; the only pointer is a gentle one about protein.
 */
export function FoodPatternsCard({
  today,
  entriesFor,
  isLoaded,
  calorieGoal,
  onLog,
}: {
  today: string;
  entriesFor: (date: string) => FoodEntry[];
  isLoaded: (date: string) => boolean;
  calorieGoal: number | null;
  onLog: (entry: FoodEntry, meal: Meal) => void;
}) {
  const dates = useMemo(() => Array.from({ length: PATTERN_DAYS }, (_, i) => addDays(today, i - PATTERN_DAYS)), [today]);
  // Wait for the whole four weeks, so the numbers don't shuffle while days arrive.
  const ready = dates.every(isLoaded);
  const p = useMemo(() => (ready ? foodPatterns(dates, entriesFor, calorieGoal) : null), [ready, dates, entriesFor, calorieGoal]);
  if (!p || (!p.meals.length && !p.often.length)) return null;

  const now = mealForTime();
  return (
    <section className="card pat-card" aria-labelledby="pat-h">
      <h2 className="card-title" id="pat-h">
        Your last 4 weeks
      </h2>
      {p.meals.length > 0 && <MealSplit meals={p.meals} biggest={p.biggest} lowProtein={p.lowProtein} full={p.full} />}
      {p.often.length > 0 && (
        <div className="pat-often">
          <h3 className="pat-sub">Most logged</h3>
          <div className="entry-list">
            {p.often.map((f) => (
              <OftenRow key={f.key} f={f} meal={mealToLog(f, now)} onLog={onLog} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MealSplit({ meals, biggest, lowProtein, full }: { meals: MealPart[]; biggest: MealPart | null; lowProtein: MealPart | null; full: number }) {
  const notes: string[] = [];
  if (biggest && biggest.pct >= 35) notes.push(`${LABEL[biggest.meal]} is your biggest meal, about ${biggest.pct}% of the day’s calories.`);
  if (lowProtein) notes.push(`${LABEL[lowProtein.meal]} averages ${lowProtein.protein} g of protein: ${PROTEIN_IDEAS[lowProtein.meal]} would add some easily.`);
  return (
    <div className="pat-split">
      <span className="pat-sub">Where your calories come from</span>
      <div className="pat-bar" role="img" aria-label={`Calories by meal: ${meals.map((m) => `${LABEL[m.meal]} ${m.pct}%`).join(', ')}`}>
        {meals.map((m) => (
          <span key={m.meal} className={`pat-seg m-${m.meal}`} style={{ flexGrow: m.share }} />
        ))}
      </div>
      <ul className="pat-legend">
        {meals.map((m) => (
          <li key={m.meal}>
            <span className={`pat-key m-${m.meal}`} aria-hidden="true" />
            <span className="pat-name">
              {LABEL[m.meal]} <b>{m.pct}%</b>
            </span>
            <span className="pat-val">
              {fmt(m.kcal)} kcal · {m.protein} g protein
            </span>
          </li>
        ))}
      </ul>
      <p className="pat-note">
        {notes.length ? `${notes.join(' ')} ` : ''}
        <span>
          Averages a day, from {full} fully logged {full === 1 ? 'day' : 'days'}.
        </span>
      </p>
    </div>
  );
}

function OftenRow({ f, meal, onLog }: { f: OftenFood; meal: Meal; onLog: (entry: FoodEntry, meal: Meal) => void }) {
  return (
    <div className="pat-row">
      <FoodThumb entry={f.entry} size={36} />
      <span className="row-text">
        <span className="row-title">{f.name}</span>
        <span className="row-sub">
          {f.days} days · {f.meals.length > 1 ? 'mostly ' : ''}
          {lower(f.meal)} · {fmt(Math.round(f.entry.kcal))} kcal
        </span>
      </span>
      <button type="button" className="add-btn" aria-label={`Log ${f.name} at ${lower(meal)}`} onClick={() => (tap(), onLog(f.entry, meal))}>
        <IconPlus size={20} strokeWidth={2.6} />
      </button>
    </div>
  );
}
