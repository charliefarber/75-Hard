import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Mood } from '../lib/pet';
import { PetSprite, type PetStyle } from './PetSprite';
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
 * The sloth's little world: a layered, lit scene that reads as 3D.
 *  - sky follows the real time of day; the weather follows the sloth's mood
 *  - far / mid / near layers move at different speeds (parallax) and get hazier with distance
 *  - the sloth stands on a round grassy platform with a contact shadow
 *  - drag sideways to turn the sloth: the world shifts and the light slides across it
 * Built so a real 3D model can replace <PetSprite> later without touching the rest.
 */
export function PetWorld({
  style,
  stage,
  mood,
  eating,
  label,
  top,
  throwing,
  onThrowLanded,
  children,
}: {
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
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [tod, setTod] = useState<TimeOfDay>(() => timeOfDay());
  const drag = useRef({ x0: 0, tilt: 0, active: false, moved: false, raf: 0 });

  // Keep the sky in step with the clock.
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
      // Damped spring back to centre: a little overshoot, then settle.
      v = v * 0.82 - d.tilt * 0.09;
      const t = d.tilt + v;
      if (Math.abs(t) < 0.002 && Math.abs(v) < 0.002) return setTilt(0);
      setTilt(t);
      d.raf = requestAnimationFrame(step);
    };
    d.raf = requestAnimationFrame(step);
  }

  const weather = mood === 'starving' ? 'storm' : mood === 'veryHungry' ? 'overcast' : mood === 'ecstatic' ? 'sparkle' : 'clear';

  return (
    <div
      ref={root}
      className={`world world-${tod} world-${weather}`}
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
        // A drag isn't a tap on the sloth.
        if (drag.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          drag.current.moved = false;
        }
      }}
    >
      <div className="world-sky" />
      <Celestial tod={tod} />
      <div className="world-layer world-clouds" aria-hidden="true">
        <Cloud className="cloud cloud-a" />
        <Cloud className="cloud cloud-b" />
        <Cloud className="cloud cloud-c" />
      </div>
      <div className="world-layer world-far" aria-hidden="true">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
          <path d="M-40 230 C10 170 60 160 110 190 C150 150 200 140 250 175 C300 140 360 150 440 200 V300 H-40z" fill="var(--hill-far)" />
        </svg>
      </div>
      <div className="world-layer world-mid" aria-hidden="true">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
          <g fill="var(--tree)">
            <ellipse cx="34" cy="214" rx="30" ry="36" />
            <ellipse cx="66" cy="226" rx="24" ry="28" />
            <ellipse cx="352" cy="210" rx="34" ry="40" />
            <ellipse cx="384" cy="228" rx="24" ry="28" />
          </g>
          <g fill="var(--trunk)">
            <rect x="31" y="240" width="6" height="22" rx="2" />
            <rect x="349" y="240" width="7" height="24" rx="2" />
          </g>
          <path d="M-40 250 C40 232 120 244 200 238 S340 230 440 246 V300 H-40z" fill="var(--hill-mid)" />
        </svg>
      </div>

      <div className="world-ground" aria-hidden="true" />
      <div className="world-stage">
        <Platform stage={stage} />
        <div className="world-pet">
          <PetSprite style={style} stage={stage} mood={eating ? 'ecstatic' : mood} eating={eating} size={250} interactive hd shade label={label} />
        </div>
        {throwing && (
          <span className="treat-throw" onAnimationEnd={onThrowLanded} aria-hidden="true">
            <TreatGlyph />
          </span>
        )}
      </div>

      <div className="world-layer world-near" aria-hidden="true">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
          <g fill="var(--grass-near)">
            <path d="M-10 300 C0 262 8 250 14 236 C16 258 20 272 26 300z" />
            <path d="M12 300 C18 270 30 252 40 244 C36 266 36 282 40 300z" />
            <path d="M30 300 C34 280 42 270 52 262 C48 280 50 290 54 300z" />
            <path d="M410 300 C400 262 392 250 386 236 C384 258 380 272 374 300z" />
            <path d="M388 300 C382 270 370 252 360 244 C364 266 364 282 360 300z" />
          </g>
          <g>
            <circle cx="46" cy="262" r="5" fill="var(--flower)" />
            <circle cx="46" cy="262" r="1.8" fill="#FFE27A" />
            <circle cx="366" cy="256" r="4" fill="var(--flower)" />
            <circle cx="366" cy="256" r="1.5" fill="#FFE27A" />
          </g>
        </svg>
      </div>

      <Particles tod={tod} weather={weather} />
      {weather === 'storm' && <div className="world-rain" aria-hidden="true" />}
      <div className="world-vignette" aria-hidden="true" />
      {top && <div className="world-top">{top}</div>}
      {children}
    </div>
  );
}

function Platform({ stage }: { stage: number }) {
  // A round grassy pedestal: lit top face, darker earth rim for thickness, grass fringe on the lip.
  // Later stages get a stone ring, like an arena.
  const stone = stage >= 3;
  return (
    <svg className="world-platform" viewBox="0 0 300 110" aria-hidden="true">
      <defs>
        <radialGradient id="pf-top" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="var(--grass-lit)" />
          <stop offset="0.7" stopColor="var(--grass)" />
          <stop offset="1" stopColor="var(--grass-dark)" />
        </radialGradient>
        <linearGradient id="pf-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--earth)" />
          <stop offset="1" stopColor="var(--earth-dark)" />
        </linearGradient>
        <radialGradient id="pf-shadow">
          <stop offset="0" stopColor="rgba(10,30,15,0.38)" />
          <stop offset="1" stopColor="rgba(10,30,15,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="96" rx="150" ry="14" fill="url(#pf-shadow)" />
      <path d="M12 50 A138 34 0 0 0 288 50 L288 66 A138 34 0 0 1 12 66 Z" fill="url(#pf-rim)" />
      {stone && (
        <g fill="var(--stone)" opacity="0.9">
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.08 + (i / 8) * 0.84);
            const x = 150 - Math.cos(a) * 136;
            const y = 58 + Math.sin(a) * 30;
            return <rect key={i} x={x - 9} y={y - 4} width="18" height="9" rx="3" />;
          })}
        </g>
      )}
      <ellipse cx="150" cy="50" rx="138" ry="34" fill="url(#pf-top)" />
      <g stroke="var(--grass-dark)" strokeWidth="2" strokeLinecap="round" opacity="0.55">
        {Array.from({ length: 22 }, (_, i) => {
          const a = Math.PI * (0.06 + (i / 21) * 0.88);
          const x = 150 - Math.cos(a) * 134;
          const y = 50 + Math.sin(a) * 32;
          return <path key={i} d={`M${x} ${y} l${(i % 3) - 1} -${5 + (i % 4)}`} />;
        })}
      </g>
    </svg>
  );
}

function Celestial({ tod }: { tod: TimeOfDay }) {
  if (tod === 'night')
    return (
      <div className="world-layer world-celestial" aria-hidden="true">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMin slice">
          <g fill="#fff">
            {STARS.map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} className="star" style={{ animationDelay: `${(i % 7) * 0.6}s` }} />
            ))}
          </g>
          <circle cx="322" cy="62" r="20" fill="#FFF6D8" />
          <circle cx="331" cy="55" r="18" fill="var(--sky-top)" />
        </svg>
      </div>
    );
  const sun = tod === 'day' ? { cx: 330, cy: 58 } : { cx: tod === 'dawn' ? 70 : 330, cy: 150 };
  return (
    <div className="world-layer world-celestial" aria-hidden="true">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMin slice">
        <circle cx={sun.cx} cy={sun.cy} r="46" fill="var(--sun-glow)" />
        <circle cx={sun.cx} cy={sun.cy} r="22" fill="var(--sun)" />
      </svg>
    </div>
  );
}

const STARS: [number, number, number][] = [
  [30, 30, 1.2], [80, 64, 0.9], [130, 22, 1.4], [176, 80, 0.8], [210, 36, 1.1], [258, 70, 0.9],
  [290, 18, 1.2], [370, 110, 1], [16, 110, 0.8], [110, 120, 0.7], [236, 118, 0.8], [384, 30, 0.9],
];

function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 50">
      <path d="M18 44 C4 44 2 28 16 26 C14 12 36 6 44 18 C50 4 76 4 80 22 C96 16 112 28 102 42 Z" fill="var(--cloud)" />
    </svg>
  );
}

function Particles({ tod, weather }: { tod: TimeOfDay; weather: string }) {
  // Fireflies at night, drifting pollen by day. Near ones are big and soft (out of focus), far ones small and sharp.
  if (weather === 'storm') return null;
  const kind = tod === 'night' || tod === 'dusk' ? 'firefly' : 'pollen';
  return (
    <div className={`world-particles world-${kind}`} aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p[0]}%`,
            top: `${p[1]}%`,
            width: p[2],
            height: p[2],
            filter: p[2] > 7 ? 'blur(2px)' : undefined,
            animationDuration: `${7 + (i % 5) * 1.7}s`,
            animationDelay: `${-i * 1.3}s`,
          }}
        />
      ))}
    </div>
  );
}

const PARTICLES: [number, number, number][] = [
  [8, 40, 4], [18, 62, 9], [30, 30, 3], [44, 70, 5], [58, 24, 3], [70, 58, 10], [82, 36, 4], [90, 66, 6], [64, 78, 3],
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
