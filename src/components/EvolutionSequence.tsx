import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { STAGES } from '../lib/pet';
import { petSrc, type PetStyle } from './PetSprite';
import { BiomeScene, biomeFor } from './Biomes';
import { success } from '../lib/haptics';

/**
 * The evolution moment, as a big step:
 *  1. the old world darkens; the sloth glows white and flickers between its old (small)
 *     and new (bigger) shape, faster and faster
 *  2. flash, shockwave, screen shake: we're in the NEW world, the new form lands on its
 *     new platform in a burst of light
 *  3. "Congratulations!" + the world it just unlocked
 */
export function EvolutionSequence({
  style,
  from,
  to,
  name,
  onDone,
}: {
  style: PetStyle;
  from: number;
  to: number;
  name: string;
  onDone: () => void;
}) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'glow' | 'reveal'>(reduced ? 'reveal' : 'glow');
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (reduced) {
      success();
      return;
    }
    const t = setTimeout(() => {
      setPhase('reveal');
      success();
    }, 4200);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (phase === 'reveal') {
      const t = setTimeout(() => btn.current?.focus({ preventScroll: true }), 1400);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const fromBiome = biomeFor(from);
  const toBiome = biomeFor(to);
  const biome = phase === 'glow' ? fromBiome : toBiome;
  const size = (scale: number): CSSProperties => ({ width: 300 * scale, height: 300 * scale });

  const pet = (
    <div className="evo-pet">
      {phase === 'glow' ? (
        <>
          <img className="evo-sil evo-old" src={petSrc(style, from, 'happy', true)} alt="" style={size(fromBiome.scale)} />
          <img className="evo-sil evo-new" src={petSrc(style, to, 'ecstatic', true)} alt="" style={size(toBiome.scale)} />
        </>
      ) : (
        <img className="evo-final" src={petSrc(style, to, 'ecstatic', true)} alt="" style={size(toBiome.scale)} />
      )}
    </div>
  );

  return (
    <div className={`evo evo-${phase}`} role="dialog" aria-modal="true" aria-label={`${name} is evolving`}>
      <div className={`world evo-world world-${biome.id} hud-light`} key={biome.id}>
        <BiomeScene biome={biome} slot={pet} />
        <div className="evo-dim" aria-hidden="true" />
      </div>
      <div className="evo-rays" aria-hidden="true" />
      {phase === 'reveal' && (
        <div className="evo-burst" aria-hidden="true">
          <span className="evo-shock" />
          <span className="evo-shock evo-shock-2" />
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ ['--a' as string]: `${(i / 14) * 360}deg`, ['--d' as string]: `${120 + (i % 3) * 50}px` }} />
          ))}
        </div>
      )}
      <div className="evo-flash" aria-hidden="true" />
      <div className="evo-text" aria-live="polite">
        {phase === 'glow' ? (
          <p>What? {name} is evolving!</p>
        ) : (
          <>
            <p>
              {name} evolved into <strong>{STAGES[to].name}</strong>!
            </p>
            <span className="evo-unlock">New world unlocked: {toBiome.name}</span>
            <button ref={btn} className="btn btn-primary" onClick={onDone}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
