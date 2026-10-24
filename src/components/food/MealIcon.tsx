import type { Meal } from '../../data/foodTypes';

/** Line icons (24 × 24, drawn with a stroke): a cup, the midday sun, an apple, a moon. */
const PATHS: Record<Meal, string> = {
  breakfast: 'M5 10h11v3.5A5.5 5.5 0 0 1 10.5 19A5.5 5.5 0 0 1 5 13.5zM16 11.5h1.25a2.5 2.5 0 0 1 0 5H15.5M8.5 3.5c0 1.2-1 1.6-1 2.8M12 3.5c0 1.2-1 1.6-1 2.8',
  lunch: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  dinner: 'M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z',
  snacks: 'M12 8c-1.6-1.3-5.2-1.3-6 2-.8 3.2 1 7.4 3.5 8.8.9.5 1.7.3 2.5-.1.8.4 1.6.6 2.5.1 2.5-1.4 4.3-5.6 3.5-8.8-.8-3.3-4.4-3.3-6-2zM12 8c0-1.9.9-3.1 2.4-3.6',
};

/** A meal's icon: white line drawing on a forest-green tile. Decorative; the meal's name is always shown beside it. */
export function MealIcon({ meal, size = 38 }: { meal: Meal; size?: number }) {
  const s = Math.round(size * 0.55);
  return (
    <span className="meal-icon" style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[meal]} />
      </svg>
    </span>
  );
}

/** Meal prep: a pot, in the same style as the meal icons. */
export function PrepIcon({ size = 38 }: { size?: number }) {
  const s = Math.round(size * 0.55);
  return (
    <span className="meal-icon" style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10h16v3.5A5.5 5.5 0 0 1 14.5 19h-5A5.5 5.5 0 0 1 4 13.5zM2 10h2M20 10h2M9 6.5c0-1.1 1-1.5 1-2.6M14 6.5c0-1.1 1-1.5 1-2.6" />
      </svg>
    </span>
  );
}
