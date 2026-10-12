import type { ReactNode } from 'react';
import { activityById, type CategoryId } from '../lib/activities';

/** A small line drawing for each kind of workout, in the same style as the app's icons. */
const GLYPHS: Record<CategoryId, ReactNode> = {
  // a figure mid-move
  studio: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M4.5 9.5l7.5 1 7.5-1M12 10.5v4.5l-4 5.5M12 15l4 5.5" />
    </>
  ),
  // dumbbell
  strength: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
  // heart-rate line
  machines: <path d="M2.5 12.5h4l2.5-6 4 11 3-8 1.5 3h4" />,
  // sneaker
  walkrun: (
    <>
      <path d="M3 16.5V9.5c0-.8.6-1.3 1.4-1.1l2.6.7 1.6-2.6c.3-.5.9-.6 1.4-.3l1.6 1 .9 2.4 6.5 2.2A3.6 3.6 0 0 1 21.5 15v1.5z" />
      <path d="M3 19.5h18.5" />
    </>
  ),
  // bicycle
  cycling: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l3.5-7h6L18 16M9.5 9 12 16H6M14 6h2.5" />
    </>
  ),
  // waves
  water: <path d="M2.5 9c1.6 0 1.6-1.6 3.2-1.6S7.3 9 8.9 9s1.6-1.6 3.1-1.6S13.6 9 15.2 9s1.6-1.6 3.2-1.6S20 9 21.5 9M2.5 15.5c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6 1.6-1.6 3.1-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.1 1.6" />,
  // ball
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.8 5.6c3 3.2 3 9.6 0 12.8M18.2 5.6c-3 3.2-3 9.6 0 12.8" />
    </>
  ),
  // music note
  dance: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  // lightning
  combat: <path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H12z" />,
  // house
  everyday: <path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />,
  // leaf
  recovery: (
    <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" />
      <path d="M2 21c0-3 1.9-5.4 5.2-6" />
    </>
  ),
};

export function ActivityIcon({ activity, size = 40 }: { activity: string; size?: number }) {
  const cat = activityById(activity).category;
  return (
    <span className="act-icon" style={{ width: size, height: size, borderRadius: size * 0.32 }} aria-hidden="true">
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[cat]}
      </svg>
    </span>
  );
}
