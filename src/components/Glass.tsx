import { useId } from 'react';

/** A drinking glass that fills from the bottom; `fill` is 0…1. */
export function Glass({ fill, size = 34 }: { fill: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const f = Math.max(0, Math.min(1, fill));
  // Glass body: tapered tumbler inside a 24×30 box.
  const body = 'M3.5 3 H20.5 L18.6 26.2 A2.4 2.4 0 0 1 16.2 28.4 H7.8 A2.4 2.4 0 0 1 5.4 26.2 Z';
  const top = 6; // water line when full
  const bottom = 28.4;
  const y = bottom - (bottom - top) * f;
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 24 30" aria-hidden="true">
      <defs>
        <clipPath id={`g${id}`}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill="var(--water-empty)" />
      <rect
        x="0"
        y={y}
        width="24"
        height={30 - y}
        fill="var(--water-fill)"
        clipPath={`url(#g${id})`}
        style={{ transition: 'y 0.45s var(--ease), height 0.45s var(--ease)' }}
      />
      {f > 0 && f < 1 && <path d={`M4 ${y} H20`} stroke="#7fb6ee" strokeWidth="1" clipPath={`url(#g${id})`} />}
      <path d={body} fill="none" stroke={f >= 1 ? 'var(--water-fill)' : '#bcd3ee'} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 7.5 L8 22" stroke="#fff" strokeOpacity={f > 0.3 ? 0.55 : 0} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export const GLASS_ML = 250;
