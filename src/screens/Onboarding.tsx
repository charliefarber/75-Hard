import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { CHALLENGE_LENGTH, finishDate, toISODate, todayISO } from '../lib/challenge';
import { Stepper, Toggle } from '../components/ui';

type Start = 'today' | 'tomorrow' | 'already';

export function Onboarding() {
  const { profile, startChallenge, updateProfile, history } = useApp();
  const [start, setStart] = useState<Start>('today');
  const [currentDay, setCurrentDay] = useState(2);
  const [credit, setCredit] = useState(true);
  const [water, setWater] = useState(profile?.water_goal_ml ?? 3785);
  const [calories, setCalories] = useState(profile?.calorie_goal?.toString() ?? '');
  const [stepsRequired, setStepsRequired] = useState(profile?.steps_required ?? true);
  const [busy, setBusy] = useState(false);

  const today = todayISO();
  const startDate =
    start === 'today'
      ? today
      : start === 'tomorrow'
        ? toISODate(addDays(parseISO(today), 1))
        : toISODate(addDays(parseISO(today), -(currentDay - 1)));

  const restarted = history.some((c) => c.status === 'reset');
  const name = profile?.display_name;

  async function go() {
    setBusy(true);
    const cal = parseInt(calories, 10);
    await updateProfile({
      water_goal_ml: water,
      calorie_goal: Number.isFinite(cal) && cal > 0 ? cal : null,
      steps_required: stepsRequired,
    });
    await startChallenge(startDate, start === 'already' && credit ? currentDay - 1 : 0);
    setBusy(false);
  }

  return (
    <div className="shell">
      <div className="page-pad screen" style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 4px 4px' }}>
          <span className="section-label" style={{ padding: 0 }}>
            {restarted ? 'Fresh start' : 'Set up'}
          </span>
          <h1 className="page-title">{name ? `Let’s do this, ${name}.` : 'Let’s do this.'}</h1>
        </div>

        <section className="card">
          <h2 className="card-title">When does day 1 start?</h2>
          <div className="segmented">
            <button aria-pressed={start === 'today'} onClick={() => setStart('today')}>
              Today
            </button>
            <button aria-pressed={start === 'tomorrow'} onClick={() => setStart('tomorrow')}>
              Tomorrow
            </button>
            <button aria-pressed={start === 'already'} onClick={() => setStart('already')}>
              Underway
            </button>
          </div>
          {start === 'already' && (
            <>
              <div className="row" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <div className="row-text">
                  <span className="row-title">Today is day</span>
                  <span className="row-sub">Started {format(parseISO(startDate), 'EEE d MMM')}</span>
                </div>
                <Stepper value={currentDay} onChange={setCurrentDay} min={2} max={CHALLENGE_LENGTH} label="current day" />
              </div>
              <div className="row" style={{ borderBottom: 0, paddingTop: 4 }}>
                <div className="row-text">
                  <span className="row-title">{currentDay === 2 ? 'Count day 1 as done' : `Count days 1–${currentDay - 1} as done`}</span>
                  <span className="row-sub">You tracked these somewhere else</span>
                </div>
                <Toggle checked={credit} onChange={setCredit} label="Count earlier days as done" />
              </div>
            </>
          )}
          <p className="card-sub" style={{ margin: 0 }}>
            Finish line: <strong style={{ color: 'var(--ink)' }}>{format(parseISO(finishDate(startDate)), 'EEEE d MMMM')}</strong>
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">Daily water</h2>
          <div className="segmented">
            <button aria-pressed={water === 3785} onClick={() => setWater(3785)}>
              3.8 L · US gallon
            </button>
            <button aria-pressed={water === 4546} onClick={() => setWater(4546)}>
              4.5 L · UK gallon
            </button>
          </div>
        </section>

        <section className="card">
          <label className="field">
            <span className="card-title" style={{ color: 'var(--ink)' }}>
              Calorie target
            </span>
            <span className="card-sub" style={{ fontWeight: 500 }}>
              Optional. Use the same number as your Lifesum plan.
            </span>
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 1800"
              value={calories}
              onChange={(e) => setCalories(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <div className="row" style={{ borderBottom: 0, padding: 0 }}>
            <div className="row-text">
              <span className="row-title">10,000 steps every day</span>
              <span className="row-sub">Counts towards finishing each day</span>
            </div>
            <Toggle checked={stepsRequired} onChange={setStepsRequired} label="Require 10,000 steps" />
          </div>
        </section>

        <button className="btn btn-primary btn-block" style={{ height: 56, borderRadius: 18 }} onClick={go} disabled={busy}>
          {start === 'already' ? `Pick up at day ${currentDay}` : 'Start day 1'}
        </button>
      </div>
    </div>
  );
}
