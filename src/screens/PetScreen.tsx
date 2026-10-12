import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { summarise } from '../lib/challenge';
import { MOODS, STAGES, petState } from '../lib/pet';
import { PET_STYLES, PetSprite, type PetStyle } from '../components/PetSprite';
import { Sheet } from '../components/ui';
import { PetWorld } from '../components/PetWorld';
import { EvolutionSequence } from '../components/EvolutionSequence';
import { BirthdayCake } from '../components/BirthdayCake';
import { birthdayPass } from '../lib/birthday';
import { success, tap } from '../lib/haptics';

export function fullnessColor(f: number) {
  return f >= 70 ? 'var(--green)' : f >= 40 ? '#E8A33A' : '#D9534F';
}

const INTRO_KEY = 'seventyfive:pet-intro';

export function PetScreen() {
  const { profile, challenge, logs, today, updateChallenge } = useApp();
  const [eating, setEating] = useState(false);
  const [throwing, setThrowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [style, setStyle] = useState<PetStyle>('girl');
  const [preview, setPreview] = useState<number | null>(null);
  const [evo, setEvo] = useState<{ from: number; to: number } | null>(null);
  const chainRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => (challenge && profile ? summarise(challenge, logs, profile, today) : null), [challenge, logs, profile, today]);
  const pet = useMemo(() => (summary && challenge ? petState(summary, challenge.treat_dates ?? [], today) : null), [summary, challenge, today]);

  useEffect(() => {
    if (!eating) return;
    const t = setTimeout(() => setEating(false), 2800);
    return () => clearTimeout(t);
  }, [eating]);

  // First visit: meet your sloth (name + style).
  useEffect(() => {
    if (!challenge) return;
    try {
      if (!localStorage.getItem(INTRO_KEY)) {
        localStorage.setItem(INTRO_KEY, '1');
        openEditor();
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id]);

  // Evolved since she last looked? Play the evolution.
  const stageIndex = pet?.stageIndex;
  useEffect(() => {
    if (!challenge || stageIndex === undefined) return;
    const key = `seventyfive:seen-stage-${challenge.id}`;
    try {
      const seen = localStorage.getItem(key);
      if (seen !== null && stageIndex > Number(seen)) setEvo({ from: Number(seen), to: stageIndex });
      localStorage.setItem(key, String(stageIndex));
    } catch {
      /* storage unavailable */
    }
  }, [challenge, stageIndex]);

  // Keep the current stage in view in the evolution chain.
  useEffect(() => {
    const el = chainRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [stageIndex]);

  if (!profile || !challenge || !summary || !pet) return null;
  const petName = challenge.pet_name || 'Mochi';
  const petStyle: PetStyle = challenge.pet_style ?? 'girl';
  const treats = challenge.treat_dates ?? [];
  const mood = MOODS[pet.mood];
  const canTreat = pet.treatsAvailable > 0 && pet.missedRun > 0 && !!pet.treatTarget;
  const bday = birthdayPass(profile.birthday, profile.birthday_pass_year, today);
  const shownStage = preview ?? pet.stageIndex;
  const day = Math.max(1, summary.currentDay);

  function openEditor() {
    setName(challenge?.pet_name || 'Mochi');
    setStyle(challenge?.pet_style ?? 'girl');
    setEditing(true);
  }

  function feed() {
    if (!canTreat || throwing) return;
    tap();
    setPreview(null);
    // Bring the scene into view first so she sees the throw.
    const away = window.scrollY > 40;
    if (away) window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setThrowing(true), away ? 420 : 0);
  }

  async function treatLanded() {
    setThrowing(false);
    setEating(true);
    success();
    if (pet?.treatTarget) await updateChallenge({ treat_dates: [...treats, pet.treatTarget] });
  }

  const arc = (
    <>
      <div className="world-day-count">
        <span>Day</span>
        <strong>{day}</strong>
      </div>
      <svg className="world-arc" viewBox="0 0 300 150" aria-hidden="true">
        <path d="M14 146 A136 136 0 0 1 286 146" className="arc-track" pathLength={1} />
        <path d="M14 146 A136 136 0 0 1 286 146" className="arc-fill" pathLength={1} strokeDasharray={`${pet.stageProgress} 1`} />
        <circle
          className="arc-dot"
          r="6"
          cx={150 - 136 * Math.cos(Math.PI * pet.stageProgress)}
          cy={146 - 136 * Math.sin(Math.PI * pet.stageProgress)}
        />
      </svg>
      {preview !== null && preview !== pet.stageIndex && (
        <button className="world-chip" onClick={() => setPreview(null)}>
          Showing {STAGES[preview].name}. Back to {petName}
        </button>
      )}
    </>
  );

  return (
    <div className="screen pet-screen">
      <PetWorld
        style={petStyle}
        stage={shownStage}
        mood={preview !== null ? 'happy' : pet.mood}
        eating={eating}
        throwing={throwing}
        onThrowLanded={treatLanded}
        label={`${petName}, ${STAGES[shownStage].name}, ${mood.label}`}
        top={arc}
      />

      <div className="pet-sheet">
        <button className="pet-name" onClick={openEditor} aria-label={`${petName}. Edit name and sloth`}>
          <span>{petName}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="M13.5 6.5l4 4" />
          </svg>
        </button>

        <div className="pet-hp" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pet.fullness} aria-label={`Fullness: ${mood.label}`}>
          <div className="pet-hp-bar">
            <span style={{ width: `${pet.fullness}%`, background: fullnessColor(pet.fullness) }} />
          </div>
          <span className="pet-hp-label">{mood.label}</span>
        </div>

        <div className="pet-stats">
          <div>
            <strong>{STAGES[pet.stageIndex].name}</strong>
            <span>Stage</span>
          </div>
          <div>
            <strong>
              {summary.streak} {summary.streak === 1 ? 'day' : 'days'}
            </strong>
            <span>Streak</span>
          </div>
          <div>
            <strong>{summary.completedDays}</strong>
            <span>Days done</span>
          </div>
        </div>

        <div className="pet-goods">
          <div>
            <TreatIcon size={28} />
            <span>
              <strong>{pet.treatsAvailable}</strong> {pet.treatsAvailable === 1 ? 'treat' : 'treats'}
            </span>
          </div>
          {bday?.available ? (
            <div>
              <BirthdayCake size={30} />
              <span>
                <strong>1</strong> birthday pass
              </span>
            </div>
          ) : (
            <div>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="var(--gold)" />
              </svg>
              <span>
                <strong>{pet.perfectWeeks.length}</strong> perfect {pet.perfectWeeks.length === 1 ? 'week' : 'weeks'}
              </span>
            </div>
          )}
        </div>

        <button className="pet-pill pet-pill-feed" disabled={!canTreat || throwing || eating} onClick={feed}>
          <span className="pet-pill-main">Feed {petName}</span>
          <span className="pet-pill-cost">
            <TreatIcon size={18} /> 1
          </span>
        </button>
        <div
          className="pet-pill pet-pill-evolve"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pet.stageProgress * 100)}
          aria-label={pet.next ? `Evolves into ${pet.next.name} in ${pet.daysToNext} days` : 'Fully evolved'}
        >
          <span className="pet-pill-progress" style={{ width: `${Math.round(pet.stageProgress * 100)}%` }} />
          <span className="pet-pill-main">{pet.next ? `Evolve into ${pet.next.name}` : 'Fully evolved'}</span>
          <span className="pet-pill-cost">{pet.next ? `${pet.daysToNext} ${pet.daysToNext === 1 ? 'day' : 'days'}` : 'Legend'}</span>
        </div>

        <p className="pet-line" role="status">
          {eating
            ? `Nom nom. ${petName} loved that treat!`
            : canTreat
              ? `${mood.line(petName)} A treat covers ${format(parseISO(pet.treatTarget!), 'EEEE')}.`
              : summary.todayComplete
                ? `${petName} is fed for today. Come back tomorrow.`
                : mood.line(petName)}
        </p>
      </div>

      <div className="pet-chain-head">
        <h2>Evolution</h2>
        <span>{pet.stage.blurb}</span>
      </div>
      <div className="pet-chain" ref={chainRef}>
        {STAGES.map((s, i) => {
          const unlocked = i <= pet.stageIndex;
          const current = i === pet.stageIndex;
          const nextStart = STAGES[i + 1]?.min;
          return (
            <Fragment key={s.name}>
              {i > 0 && (
                <svg className="pet-chain-arrow" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <button
                className={`pet-chain-item${current ? ' is-current' : ''}${shownStage === i ? ' is-shown' : ''}`}
                aria-current={current}
                disabled={!unlocked}
                aria-label={unlocked ? `${s.name}${current ? ', now' : ''}` : `Locked until day ${s.min}`}
                onClick={() => {
                  tap();
                  if (current && i > 0) {
                    setPreview(null);
                    setEvo({ from: i - 1, to: i });
                  } else setPreview(current ? null : i);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <span className="pet-chain-art" style={unlocked ? undefined : { filter: 'brightness(0)', opacity: 0.16 }}>
                  <PetSprite style={petStyle} stage={i} mood="happy" size={74} still />
                </span>
                <strong>{unlocked ? s.name : '???'}</strong>
                <span>
                  Day {Math.max(1, s.min)}–{nextStart ? nextStart - 1 : 75}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <p className="pet-chain-hint">Tap a stage to see it in the world. Tap {petName}’s current stage to replay the evolution.</p>

      {evo && <EvolutionSequence style={petStyle} from={evo.from} to={evo.to} name={petName} onDone={() => setEvo(null)} />}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Your sloth">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim().slice(0, 24) || 'Mochi';
            updateChallenge({ pet_name: n, pet_style: style });
            setEditing(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div role="radiogroup" aria-label="Sloth style" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {PET_STYLES.map((s) => {
              const on = style === s.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  key={s.id}
                  onClick={() => (tap(), setStyle(s.id))}
                  style={{
                    border: `2px solid ${on ? 'var(--green)' : 'var(--line-strong)'}`,
                    background: on ? 'var(--mint-tint)' : '#fff',
                    borderRadius: 18,
                    padding: '8px 4px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  <PetSprite style={s.id} stage={Math.max(1, pet.stageIndex)} mood="happy" size={86} still={!on} />
                  <GenderMark id={s.id} />
                  <span style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.15, textAlign: 'center' }}>{s.label}</span>
                </button>
              );
            })}
          </div>
          <label className="field">
            Name
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Mochi"
              autoCapitalize="words"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit">
            Save
          </button>
        </form>
      </Sheet>
    </div>
  );
}

function GenderMark({ id }: { id: PetStyle }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, 'aria-hidden': true };
  if (id === 'girl')
    return (
      <svg {...p} style={{ color: '#D9467A' }}>
        <circle cx="12" cy="9" r="6" />
        <path d="M12 15v7M8.5 19h7" />
      </svg>
    );
  if (id === 'guy')
    return (
      <svg {...p} style={{ color: '#2F6FD0' }}>
        <circle cx="10" cy="14" r="6" />
        <path d="M14.5 9.5 21 3M15 3h6v6" />
      </svg>
    );
  // non-binary symbol: circle with an asterisk-style stem on top
  return (
    <svg {...p} style={{ color: '#7A4FD0' }}>
      <circle cx="12" cy="16" r="5.5" />
      <path d="M12 10.5V2M8.5 3.8l7 4.4M15.5 3.8l-7 4.4" />
    </svg>
  );
}

export function TreatIcon({ size = 24 }: { size?: number }) {
  // A little cupcake.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 17 h18 l-2.5 11 a2 2 0 0 1 -2 1.5 h-9 a2 2 0 0 1 -2 -1.5 z" fill="#F5B971" />
      <path d="M11 17 l1 12 M16 17 v12 M21 17 l-1 12" stroke="#E39A4C" strokeWidth="1.3" />
      <path d="M5.5 17.5 C4 12 9 9 11 10 C12 6 20 5 21.5 9.5 C26 9 28 14 26.5 17.5 Z" fill="#FFB3CF" />
      <circle cx="16" cy="6" r="3" fill="#F26B5B" />
      <path d="M16 3 q2 -3 4 -2" stroke="#2E7D45" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <g fill="#fff">
        <circle cx="11" cy="13" r="0.9" />
        <circle cx="17" cy="11" r="0.9" />
        <circle cx="22" cy="14" r="0.9" />
      </g>
    </svg>
  );
}
