import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { summarise } from '../lib/challenge';
import { MOODS, STAGES, petState } from '../lib/pet';
import { PET_STYLES, PetSprite, type PetStyle } from '../components/PetSprite';
import { Sheet } from '../components/ui';
import { success, tap } from '../lib/haptics';

export function fullnessColor(f: number) {
  return f >= 70 ? 'var(--green)' : f >= 40 ? '#E8A33A' : '#D9534F';
}

const INTRO_KEY = 'seventyfive:pet-intro';

export function PetScreen() {
  const { profile, challenge, logs, today, updateChallenge } = useApp();
  const [eating, setEating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [style, setStyle] = useState<PetStyle>('girl');

  const summary = useMemo(() => (challenge && profile ? summarise(challenge, logs, profile, today) : null), [challenge, logs, profile, today]);

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

  if (!profile || !challenge || !summary) return null;
  const petName = challenge.pet_name || 'Mochi';
  const petStyle: PetStyle = challenge.pet_style ?? 'girl';
  const treats = challenge.treat_dates ?? [];
  const pet = petState(summary, treats, today);
  const mood = MOODS[pet.mood];
  const canTreat = pet.treatsAvailable > 0 && pet.missedRun > 0 && !!pet.treatTarget;
  const scene = pet.stageIndex >= 4 ? 'sunset' : 'forest';

  function openEditor() {
    setName(challenge?.pet_name || 'Mochi');
    setStyle(challenge?.pet_style ?? 'girl');
    setEditing(true);
  }

  async function giveTreat() {
    if (!pet.treatTarget) return;
    tap();
    setEating(true);
    success();
    await updateChallenge({ treat_dates: [...treats, pet.treatTarget] });
  }

  return (
    <div className="screen page-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 4px', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1 className="page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {petName}
          </h1>
          <span className="card-sub" style={{ fontWeight: 700 }}>
            {pet.stage.name} · {PET_STYLES.find((s) => s.id === petStyle)?.label}
          </span>
        </div>
        <button className="btn btn-sm btn-soft" onClick={openEditor} style={{ marginBottom: 4 }}>
          Edit
        </button>
      </div>

      <section className={`pet-scene pet-scene-${scene}${pet.mood === 'starving' && !eating ? ' pet-scene-starving' : ''}`}>
        <Scenery kind={scene} />
        <PetSprite
          style={petStyle}
          stage={pet.stageIndex}
          mood={eating ? 'ecstatic' : pet.mood}
          eating={eating}
          size={260}
          interactive
          label={`${petName}, ${pet.stage.name}, ${mood.label}`}
        />
        <p style={{ margin: '0 8px', textAlign: 'center', fontSize: 15, lineHeight: 1.45, color: 'var(--ink-2)', fontWeight: 600 }} role="status">
          {eating ? `Nom nom. ${petName} loved that treat!` : mood.line(petName)}
        </p>
      </section>

      <section className="card" style={{ gap: 10 }}>
        <div className="card-head">
          <span className="row-title">Fullness</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: fullnessColor(pet.fullness) }}>{mood.label}</span>
        </div>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pet.fullness} aria-label="Fullness">
          <span style={{ width: `${pet.fullness}%`, background: fullnessColor(pet.fullness) }} />
        </div>
        <span className="card-sub">
          {summary.todayComplete
            ? 'Fed for today. Come back tomorrow.'
            : pet.missedRun === 0
              ? 'Finish today’s tasks to feed them.'
              : `${pet.missedRun} missed ${pet.missedRun === 1 ? 'day' : 'days'} in a row. Finishing today fills them back up.`}
        </span>
      </section>

      <section className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-badge" style={{ background: '#FFF1DC' }}>
            <TreatIcon size={26} />
          </span>
          <div className="row-text">
            <span className="row-title">
              {pet.treatsAvailable} {pet.treatsAvailable === 1 ? 'treat' : 'treats'}
            </span>
            <span className="row-sub">One for every perfect Monday-to-Sunday week</span>
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={!canTreat} onClick={giveTreat}>
          Give {petName} a treat
        </button>
        <span className="card-sub">
          {canTreat
            ? `Covers ${format(parseISO(pet.treatTarget!), 'EEEE d MMM')} so ${petName} isn’t hungry for it. It doesn’t change your 75.`
            : pet.treatsAvailable > 0
              ? `Save it for a hungry day. ${petName} is fine right now.`
              : 'Get a full week of complete days to earn one.'}
        </span>
      </section>

      <span className="section-label">Evolution</span>
      <section className="card" style={{ gap: 14 }}>
        {pet.next ? (
          <>
            <div className="card-head">
              <span className="row-title">
                {pet.daysToNext} {pet.daysToNext === 1 ? 'day' : 'days'} to {pet.next.name}
              </span>
              <span className="card-sub">{summary.completedDays} done</span>
            </div>
            <div className="meter">
              <span style={{ width: `${Math.round(pet.stageProgress * 100)}%`, background: 'var(--green)' }} />
            </div>
          </>
        ) : (
          <span className="row-title">Fully evolved. Legend status.</span>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {STAGES.map((s, i) => {
            const unlocked = i <= pet.stageIndex;
            const current = i === pet.stageIndex;
            const nextStart = STAGES[i + 1]?.min;
            return (
              <div
                key={s.name}
                style={{
                  borderRadius: 16,
                  padding: '8px 4px',
                  background: current ? 'var(--mint-tint)' : 'var(--ground)',
                  border: `2px solid ${current ? 'var(--green)' : 'transparent'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <div style={{ filter: unlocked ? undefined : 'brightness(0)', opacity: unlocked ? 1 : 0.14 }}>
                  <PetSprite style={petStyle} stage={i} mood="happy" size={84} still={!current} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{unlocked ? s.name : '???'}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                  Day {Math.max(1, s.min)}–{nextStart ? nextStart - 1 : 75}
                </span>
              </div>
            );
          })}
        </div>
        <p className="card-sub" style={{ margin: 0 }}>
          {pet.stage.blurb}
        </p>
      </section>

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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
                    <GenderMark id={s.id} />
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="field">
            Name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Mochi" />
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
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, 'aria-hidden': true };
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

function Scenery({ kind }: { kind: 'forest' | 'sunset' }) {
  return kind === 'forest' ? (
    <svg className="pet-scenery" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true">
      <g fill="#B9D3A6" opacity="0.55">
        <path d="M20 170 l26 -70 26 70z M70 175 l20 -55 20 55z M300 172 l24 -64 24 64z M350 176 l18 -48 18 48z" />
      </g>
      <g fill="#9DC38B" opacity="0.6">
        <path d="M-10 190 l34 -80 34 80z M330 190 l30 -70 30 70z" />
      </g>
      <path d="M0 200 C80 180 140 196 210 188 S330 178 400 192 V240 H0z" fill="#C7E0A9" />
      <path d="M0 215 C90 204 170 220 260 210 S360 206 400 214 V240 H0z" fill="#B3D493" />
      <g fill="#F2A7B8">
        <circle cx="60" cy="214" r="3" />
        <circle cx="342" cy="208" r="3" />
        <circle cx="300" cy="222" r="2.4" />
      </g>
    </svg>
  ) : (
    <svg className="pet-scenery" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 160 L60 90 L110 140 L170 70 L240 150 L300 95 L360 140 L400 110 V240 H0z" fill="#C9B7DA" opacity="0.7" />
      <path d="M0 190 L70 130 L130 175 L200 120 L270 180 L340 135 L400 170 V240 H0z" fill="#B19FC9" opacity="0.6" />
      <path d="M0 208 C100 196 200 214 300 204 S380 200 400 206 V240 H0z" fill="#A8C98F" />
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
