import { useEffect, useRef, useState } from 'react';
import { STAGES } from '../lib/pet';
import { petSrc, type PetStyle } from './PetSprite';
import { success } from '../lib/haptics';

/**
 * The evolution moment: the old sloth glows white, flickers between its old and new
 * shapes faster and faster, a flash, and the new form appears in a burst of light.
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
    }, 3900);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (phase === 'reveal') setTimeout(() => btn.current?.focus({ preventScroll: true }), 900);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const oldSrc = petSrc(style, from, 'happy', true);
  const newSrc = petSrc(style, to, 'ecstatic', true);

  return (
    <div className={`evo evo-${phase}`} role="dialog" aria-modal="true" aria-label={`${name} is evolving`}>
      <div className="evo-rays" aria-hidden="true" />
      <div className="evo-stage" aria-hidden="true">
        {phase === 'glow' ? (
          <>
            <img className="evo-sil evo-old" src={oldSrc} alt="" />
            <img className="evo-sil evo-new" src={newSrc} alt="" />
          </>
        ) : (
          <img className="evo-final" src={newSrc} alt="" />
        )}
      </div>
      <div className="evo-flash" aria-hidden="true" />
      <div className="evo-text" aria-live="polite">
        {phase === 'glow' ? (
          <p>What? {name} is evolving!</p>
        ) : (
          <>
            <p>
              Congratulations! {name} evolved into <strong>{STAGES[to].name}</strong>!
            </p>
            <span>{STAGES[to].blurb}</span>
            <button ref={btn} className="btn btn-primary" onClick={onDone}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
