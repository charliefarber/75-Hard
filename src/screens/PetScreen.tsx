import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { summarise } from '../lib/challenge';
import { MOODS, STAGES, petState } from '../lib/pet';
import { Sloth } from '../components/Sloth';
import { Sheet } from '../components/ui';
import { success, tap } from '../lib/haptics';

export function fullnessColor(f: number) {
  return f >= 70 ? 'var(--green)' : f >= 40 ? '#E8A33A' : '#D9534F';
}

export function PetScreen() {
  const { profile, challenge, logs, today, updateChallenge } = useApp();
  const [eating, setEating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  const summary = useMemo(() => (challenge && profile ? summarise(challenge, logs, profile, today) : null), [challenge, logs, profile, today]);
  useEffect(() => {
    if (!eating) return;
    const t = setTimeout(() => setEating(false), 2600);
    return () => clearTimeout(t);
  }, [eating]);

  if (!profile || !challenge || !summary) return null;
  const petName = challenge.pet_name || 'Mochi';
  const treats = challenge.treat_dates ?? [];
  const pet = petState(summary, treats, today);
  const mood = MOODS[pet.mood];
  const canTreat = pet.treatsAvailable > 0 && pet.missedRun > 0 && !!pet.treatTarget;

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
        <button
          onClick={() => {
            setName(petName);
            setRenaming(true);
          }}
          aria-label={`Rename ${petName}`}
          style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
        >
          <h1 className="page-title">{petName}</h1>
        </button>
        <span className="chip" style={{ fontSize: 11, marginBottom: 6 }}>
          {pet.stage.name}
        </span>
      </div>

      <section
        className="card"
        style={{ background: 'var(--mint-tint)', alignItems: 'center', gap: 6, paddingTop: 24, position: 'relative', overflow: 'hidden' }}
      >
        <svg aria-hidden="true" width="100%" height="40" viewBox="0 0 340 40" preserveAspectRatio="none" style={{ position: 'absolute', top: 18, left: 0 }}>
          <path d="M0 22 C80 10 140 30 220 18 S320 14 340 20" stroke="#8B6847" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.35" />
          <path d="M60 18 c6 -10 18 -10 22 -6 c-6 8 -16 10 -22 6z M250 16 c6 -10 18 -10 22 -6 c-6 8 -16 10 -22 6z" fill="#5DBB6E" opacity="0.5" />
        </svg>
        <div style={{ position: 'relative', marginTop: 12 }}>
          <Sloth stage={pet.stageIndex} mood={eating ? 'ecstatic' : pet.mood} eating={eating} size={230} />
          {eating && (
            <span className="pet-treat-pop" aria-hidden="true">
              <TreatIcon size={40} />
            </span>
          )}
        </div>
        <p style={{ margin: '4px 8px 6px', textAlign: 'center', fontSize: 15, lineHeight: 1.45, color: 'var(--ink-2)', fontWeight: 600 }} role="status">
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
            return (
              <div
                key={s.name}
                style={{
                  borderRadius: 16,
                  padding: '10px 6px 8px',
                  background: current ? 'var(--mint-tint)' : 'var(--ground)',
                  border: `2px solid ${current ? 'var(--green)' : 'transparent'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <div style={{ filter: unlocked ? undefined : 'brightness(0)', opacity: unlocked ? 1 : 0.13 }}>
                  <Sloth stage={i} mood="happy" size={76} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{unlocked ? s.name : '???'}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Day {s.min || 1}</span>
              </div>
            );
          })}
        </div>
        <p className="card-sub" style={{ margin: 0 }}>
          {pet.stage.blurb}
        </p>
      </section>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Name your sloth">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim().slice(0, 24);
            if (n) updateChallenge({ pet_name: n });
            setRenaming(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <input className="input" aria-label="Pet name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={24} />
          <button className="btn btn-primary btn-block" type="submit">
            Save
          </button>
        </form>
      </Sheet>
    </div>
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
