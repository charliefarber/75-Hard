import { useEffect, useRef, useState } from 'react';
import type { Mood } from '../lib/pet';
import { tap as haptic } from '../lib/haptics';

export type PetStyle = 'girl' | 'guy' | 'nb';

export const PET_STYLES: { id: PetStyle; label: string }[] = [
  { id: 'girl', label: 'Girl' },
  { id: 'guy', label: 'Guy' },
  { id: 'nb', label: 'Non-binary' },
];

/** The sloth grows as it evolves. */
const STAGE_SCALE = [0.74, 0.8, 0.86, 0.92, 0.97, 1];

export function petSrc(style: PetStyle, stage: number, mood: Mood | 'eating', hd = false) {
  return `./pet/${hd ? 'hd/' : ''}${style}/${mood === 'eating' ? 'eating' : `${stage}-${mood}`}.webp`;
}

/**
 * The pet, alive: breathes, sways, glances around, reacts to its mood, and
 * does a happy squish with hearts when tapped. Mood extras (thought bubble,
 * tummy rumbles, sparkles) are animated overlays so they move on their own.
 */
export function PetSprite({
  style,
  stage,
  mood,
  size,
  eating = false,
  interactive = false,
  still = false,
  hd = false,
  shade = false,
  label,
}: {
  style: PetStyle;
  stage: number;
  mood: Mood;
  size: number;
  eating?: boolean;
  interactive?: boolean;
  still?: boolean;
  /** Use the sharp, upscaled art (for big displays). Falls back to the standard art if missing. */
  hd?: boolean;
  /** Add a light layer shaped like the sloth, so scene lighting can move across it. */
  shade?: boolean;
  label?: string;
}) {
  const [boops, setBoops] = useState<number[]>([]);
  const [squish, setSquish] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const key = eating ? 'eating' : mood;
  const [hdFailed, setHdFailed] = useState(false);
  const src = petSrc(style, stage, key, hd && !hdFailed);
  const showMood = !still && !eating;

  function boop() {
    if (!interactive) return;
    haptic();
    setSquish(false);
    requestAnimationFrame(() => setSquish(true));
    const id = Date.now();
    setBoops((b) => [...b.slice(-4), id]);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBoops([]), 1600);
  }

  const body = (
    <div
      className={`pet pet-${eating ? 'eating' : mood}${still ? ' pet-still' : ''}`}
      style={{ width: size, height: size, ['--pet-scale' as string]: STAGE_SCALE[stage] ?? 1 }}
    >
      <span className="pet-shadow" />
      <div className={`pet-motion${squish ? ' pet-squish' : ''}`} onAnimationEnd={(e) => e.animationName === 'pet-squish' && setSquish(false)}>
        <div className="pet-breathe">
          <span className="pet-img">
            <img src={src} alt="" draggable={false} decoding="async" onError={() => hd && setHdFailed(true)} />
            {shade && <span className="pet-light" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />}
          </span>
        </div>
      </div>

      {showMood && mood === 'hungry' && (
        <svg className="pet-bubble" viewBox="0 0 60 44" aria-hidden="true">
          <circle cx="8" cy="38" r="3" fill="#fff" stroke="#DDE2D9" strokeWidth="1.4" />
          <circle cx="16" cy="29" r="4.5" fill="#fff" stroke="#DDE2D9" strokeWidth="1.4" />
          <ellipse cx="38" cy="16" rx="20" ry="14" fill="#fff" stroke="#DDE2D9" strokeWidth="1.4" />
          <path d="M30 21 C32 9 44 6 48 10 C46 20 38 23 30 21 Z" fill="#4CAF63" />
          <path d="M31 20 L45 11" stroke="#2E7D45" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {showMood && (mood === 'veryHungry' || mood === 'starving') && (
        <svg className="pet-rumble" viewBox="0 0 100 30" aria-hidden="true">
          <path d="M4 15 q4 -5 8 0 q4 5 8 0" />
          <path d="M80 15 q4 -5 8 0 q4 5 8 0" />
        </svg>
      )}
      {showMood && mood === 'ecstatic' && (
        <div className="pet-sparkles" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <svg key={i} viewBox="0 0 20 20">
              <path d="M10 0 l2.6 7.4 7.4 2.6 -7.4 2.6 -2.6 7.4 -2.6 -7.4 -7.4 -2.6 7.4 -2.6z" fill="#F2B441" />
            </svg>
          ))}
        </div>
      )}
      {boops.map((id, i) => (
        <svg key={id} className="pet-heart" style={{ left: `${38 + ((i * 17) % 30)}%` }} viewBox="0 0 24 22" aria-hidden="true">
          <path d="M12 21 C5 15 1 11 1 6.5 A5.5 5.5 0 0 1 12 4 A5.5 5.5 0 0 1 23 6.5 C23 11 19 15 12 21 Z" fill="#F26B8A" />
        </svg>
      ))}
    </div>
  );

  if (!interactive) return <div aria-label={label} role={label ? 'img' : undefined}>{body}</div>;
  return (
    <button type="button" className="pet-button" onClick={boop} aria-label={label ? `${label}. Tap to give a cuddle` : 'Give a cuddle'}>
      {body}
    </button>
  );
}
