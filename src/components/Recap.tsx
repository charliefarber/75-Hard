import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { litres, summarise, toISODate } from '../lib/challenge';
import { mondayOf, weekRecap } from '../lib/recap';
import { stageFor } from '../lib/pet';
import { PetSprite } from './PetSprite';
import { Sheet, fmt } from './ui';
import { IconCheck, IconChevron, IconChevronLeft } from './Icons';
import { TreatIcon } from '../screens/PetScreen';

const RECAP_KEY = (monday: string) => `seventyfive:recap-${monday}`;

/** The week to show automatically: last week, once, the first time she opens the app in a new week. */
export function pendingRecapWeek(startDate: string, today: string): string | null {
  const lastMonday = toISODate(addDays(parseISO(mondayOf(today)), -7));
  if (startDate > toISODate(addDays(parseISO(lastMonday), 6))) return null; // challenge hadn't started
  try {
    if (localStorage.getItem(RECAP_KEY(lastMonday))) return null;
  } catch {
    return null;
  }
  return lastMonday;
}

export function markRecapSeen(monday: string) {
  try {
    localStorage.setItem(RECAP_KEY(monday), '1');
  } catch {
    /* storage unavailable */
  }
}

export function RecapSheet({ open, monday: initial, onClose }: { open: boolean; monday: string; onClose: () => void }) {
  const { profile, challenge, logs, today } = useApp();
  const [monday, setMonday] = useState(initial);
  useEffect(() => {
    if (open) setMonday(initial);
  }, [open, initial]);

  const summary = useMemo(() => (challenge && profile ? summarise(challenge, logs, profile, today) : null), [challenge, logs, profile, today]);
  if (!profile || !challenge || !summary) return null;

  const r = weekRecap(monday, logs, summary, profile, today);
  const firstMonday = mondayOf(challenge.start_date);
  const thisMonday = mondayOf(today);
  const isCurrent = monday === thisMonday;
  const petName = challenge.pet_name || 'Mochi';
  const finish = format(parseISO(summary.finishDate), 'EEE d MMM');
  const step = (n: number) => setMonday(toISODate(addDays(parseISO(monday), n * 7)));
  const range = `${format(parseISO(r.monday), 'd MMM')} – ${format(parseISO(r.sunday), 'd MMM')}`;

  return (
    <Sheet open={open} onClose={onClose} title={isCurrent ? 'This week so far' : 'Your week'}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -8 }}>
        <button className="icon-btn" aria-label="Previous week" disabled={monday <= firstMonday} onClick={() => step(-1)} style={{ background: 'var(--surface-2)' }}>
          <IconChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{range}</span>
        <button className="icon-btn" aria-label="Next week" disabled={monday >= thisMonday} onClick={() => step(1)} style={{ background: 'var(--surface-2)' }}>
          <IconChevron size={20} />
        </button>
      </div>

      <section
        style={{
          background: 'var(--forest)',
          color: '#fff',
          borderRadius: 22,
          padding: '14px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 18, flex: 'none' }}>
            <PetSprite style={challenge.pet_style ?? 'girl'} stage={stageFor(r.totalCompleted)} mood={r.perfect ? 'ecstatic' : 'happy'} size={84} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{r.headline}</span>
            <span style={{ color: 'var(--mint-soft)', fontWeight: 600, fontSize: 14 }}>
              {r.inPlay ? `${r.completed} of ${r.inPlay} days complete` : 'Your challenge hadn’t started yet'}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }} aria-label="Days this week">
          {r.days.map((d) => {
            const done = d.state === 'complete';
            const missed = d.state === 'missed';
            return (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mint-soft)' }}>{format(parseISO(d.date), 'EEEEE')}</span>
                <span
                  aria-label={`${format(parseISO(d.date), 'EEEE')}: ${d.state ?? 'not in the challenge'}`}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done ? 'var(--mint)' : missed ? '#F5C25B' : 'transparent',
                    color: done ? 'var(--forest)' : '#5B3A00',
                    border: d.state === 'today' ? '2px solid var(--mint)' : d.state === null ? '2px dashed rgba(255,255,255,0.25)' : '0',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {done ? <IconCheck size={16} strokeWidth={3} /> : missed ? '+1' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {r.perfect && (
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, background: '#FFF7E8', border: '1.5px solid #F5DFA8', padding: 12 }}>
          <TreatIcon size={34} />
          <span style={{ fontWeight: 700, lineHeight: 1.35 }}>Perfect week! {petName} earned a treat.</span>
        </div>
      )}
      {r.evolvedTo && (
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, background: 'var(--mint-tint)', padding: 12 }}>
          <PetSprite style={challenge.pet_style ?? 'girl'} stage={stageFor(r.totalCompleted)} mood="ecstatic" size={48} still />
          <span style={{ fontWeight: 700, lineHeight: 1.35 }}>
            {petName} evolved into {r.evolvedTo} this week!
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Stat label="Steps" value={fmt(r.steps.total)} sub={`of ${fmt(r.steps.goal)}`} pct={r.steps.total / r.steps.goal} color="var(--steps)" />
        <Stat
          label="Water"
          value={`${litres(r.water.avgMl, 1)} L`}
          sub={`a day · goal hit ${r.water.daysHit}/${r.inPlay || 0}`}
          pct={r.inPlay ? r.water.daysHit / r.inPlay : 0}
          color="var(--water-fill)"
        />
        <Stat
          label="Workouts"
          value={`${r.workouts.logged}/${r.workouts.possible}`}
          sub={`${Math.round(r.workouts.minutes / 6) / 10} hours moving`}
          pct={r.workouts.possible ? r.workouts.logged / r.workouts.possible : 0}
          color="var(--green)"
        />
        <Stat
          label="Reading"
          value={`${r.readingDays}/${r.inPlay || 0}`}
          sub={`days with ${profile.reading_goal_pages} pages`}
          pct={r.inPlay ? r.readingDays / r.inPlay : 0}
          color="var(--read)"
        />
      </div>
      {r.steps.bestDay && r.steps.bestSteps > 0 && (
        <p className="card-sub" style={{ margin: '-4px 2px 0' }}>
          Best step day: {format(parseISO(r.steps.bestDay), 'EEEE')} with {fmt(r.steps.bestSteps)}.
        </p>
      )}

      <p style={{ margin: 0, color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center' }}>
        {r.totalCompleted} of 75 done · finish line {finish}
      </p>
      <button className="btn btn-primary btn-block" onClick={onClose}>
        {isCurrent ? 'Back to it' : 'Let’s go'}
      </button>
    </Sheet>
  );
}

function Stat({ label, value, sub, pct, color }: { label: string; value: string; sub: string; pct: number; color: string }) {
  return (
    <div style={{ background: 'var(--ground)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--muted)', minHeight: 30 }}>{sub}</span>
      <div className="meter" style={{ height: 6 }} aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, background: color }} />
      </div>
    </div>
  );
}
