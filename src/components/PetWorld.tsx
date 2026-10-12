import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Mood } from '../lib/pet';
import { PetSprite, type PetStyle } from './PetSprite';
import { BiomeScene, type Biome } from './Biomes';
import '../styles/pet-world.css';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export function timeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The sloth's world: one immersive place per evolution stage (see Biomes), lit for the
 * real time of day, with weather that follows the sloth's mood.
 *  - far / mid / near layers move at different speeds when you drag (parallax)
 *  - the sloth stands on its stage's platform; later stages get a power aura
 *  - drag sideways to turn the sloth while the light slides across it
 * Built so a real 3D model can replace <PetSprite> later without touching the rest.
 */
export function PetWorld({
  biome,
  style,
  stage,
  mood,
  eating,
  label,
  top,
  throwing,
  onThrowLanded,
  photo = false,
  children,
}: {
  biome: Biome;
  style: PetStyle;
  stage: number;
  mood: Mood;
  eating: boolean;
  label: string;
  /** Overlay at the top of the scene (the arc and day count). */
  top?: ReactNode;
  /** A treat is flying in. */
  throwing: boolean;
  onThrowLanded: () => void;
  /** Photo mode: the scene fills the screen, no overlays. */
  photo?: boolean;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [tod, setTod] = useState<TimeOfDay>(() => timeOfDay());
  const drag = useRef({ x0: 0, tilt: 0, active: false, moved: false, raf: 0 });

  useEffect(() => {
    const t = setInterval(() => setTod(timeOfDay()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => cancelAnimationFrame(drag.current.raf), []);

  const setTilt = (t: number) => {
    drag.current.tilt = t;
    root.current?.style.setProperty('--tilt', t.toFixed(3));
  };

  function springBack() {
    const d = drag.current;
    cancelAnimationFrame(d.raf);
    if (reducedMotion()) return setTilt(0);
    let v = 0;
    const step = () => {
      v = v * 0.82 - d.tilt * 0.09;
      const t = d.tilt + v;
      if (Math.abs(t) < 0.002 && Math.abs(v) < 0.002) return setTilt(0);
      setTilt(t);
      d.raf = requestAnimationFrame(step);
    };
    d.raf = requestAnimationFrame(step);
  }

  const weather = mood === 'starving' ? 'storm' : mood === 'veryHungry' ? 'overcast' : 'clear';
  const hud = tod === 'night' || tod === 'dusk' ? 'light' : biome.hud;

  return (
    <div
      ref={root}
      className={`world world-${biome.id} tod-${tod} world-${weather} hud-${hud}${photo ? ' world-photo' : ''}`}
      onPointerDown={(e) => {
        const d = drag.current;
        cancelAnimationFrame(d.raf);
        d.x0 = e.clientX - d.tilt * 160;
        d.active = true;
        d.moved = false;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d.active) return;
        const dx = e.clientX - d.x0;
        if (Math.abs(dx - d.tilt * 160) > 6) d.moved = true;
        setTilt(Math.max(-1, Math.min(1, dx / 160)));
      }}
      onPointerUp={() => {
        drag.current.active = false;
        springBack();
      }}
      onPointerCancel={() => {
        drag.current.active = false;
        springBack();
      }}
      onClickCapture={(e) => {
        if (drag.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          drag.current.moved = false;
        }
      }}
    >
      <BiomeScene
        biome={biome}
        slot={
          <>
            <div className="world-pet">
              <PetSprite
                style={style}
                stage={stage}
                mood={eating ? 'ecstatic' : mood}
                eating={eating}
                size={300}
                scale={biome.scale}
                interactive
                hd
                shade
                label={label}
              />
            </div>
            {throwing && (
              <span className="treat-throw" onAnimationEnd={onThrowLanded} aria-hidden="true">
                <TreatGlyph />
              </span>
            )}
          </>
        }
      />
      <div className={`world-tint`} aria-hidden="true" />
      {tod === 'night' && <NightSky />}
      <Particles kind={tod === 'night' ? 'firefly' : biome.particles} hidden={weather === 'storm'} />
      {weather !== 'clear' && <div className="world-clouds-weather" aria-hidden="true" />}
      {weather === 'storm' && <div className="world-rain" aria-hidden="true" />}
      <div className="world-vignette" aria-hidden="true" />
      {top && !photo && <div className="world-top">{top}</div>}
      {children}
    </div>
  );
}

function NightSky() {
  return (
    <div className="world-layer world-night" aria-hidden="true">
      <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMin slice">
        <g fill="#fff">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} className="star" style={{ animationDelay: `${(i % 7) * 0.6}s` }} />
          ))}
        </g>
        <circle cx="330" cy="64" r="22" fill="#FFF6D8" />
        <circle cx="340" cy="56" r="20" fill="#1b2a52" />
      </svg>
    </div>
  );
}

const STARS: [number, number, number][] = [
  [30, 30, 1.3], [80, 64, 0.9], [130, 22, 1.4], [176, 90, 0.8], [210, 36, 1.1], [258, 70, 0.9],
  [290, 18, 1.2], [370, 120, 1], [16, 120, 0.8], [110, 130, 0.7], [236, 128, 0.8], [384, 30, 0.9], [150, 160, 0.7], [60, 180, 0.8],
];

function Particles({ kind, hidden }: { kind: string; hidden: boolean }) {
  // Near particles are big and soft (out of focus), far ones small and sharp.
  if (hidden) return null;
  return (
    <div className={`world-particles p-${kind}`} aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p[0]}%`,
            top: `${p[1]}%`,
            width: p[2],
            height: kind === 'blossom' || kind === 'petals' || kind === 'leaves' ? p[2] * 0.7 : p[2],
            filter: p[2] > 8 ? 'blur(1.5px)' : undefined,
            animationDuration: `${7 + (i % 5) * 1.7}s`,
            animationDelay: `${-i * 1.3}s`,
          }}
        />
      ))}
    </div>
  );
}

const PARTICLES: [number, number, number][] = [
  [8, 34, 5], [18, 58, 10], [30, 24, 4], [44, 66, 6], [58, 18, 4], [70, 52, 11], [82, 30, 5], [90, 62, 7], [64, 76, 4], [36, 44, 4], [94, 14, 5],
];

export function TreatGlyph({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M7 17 h18 l-2.5 11 a2 2 0 0 1 -2 1.5 h-9 a2 2 0 0 1 -2 -1.5 z" fill="#F5B971" />
      <path d="M11 17 l1 12 M16 17 v12 M21 17 l-1 12" stroke="#E39A4C" strokeWidth="1.3" />
      <path d="M5.5 17.5 C4 12 9 9 11 10 C12 6 20 5 21.5 9.5 C26 9 28 14 26.5 17.5 Z" fill="#FFB3CF" />
      <circle cx="16" cy="6" r="3" fill="#F26B5B" />
    </svg>
  );
}
