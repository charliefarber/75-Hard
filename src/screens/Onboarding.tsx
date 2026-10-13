import { useRef, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import { dayNumber, finishDate, toISODate, todayISO } from '../lib/challenge';
import { ToggleRow } from '../components/ui';
import { WATER_PRESETS } from './ProfileScreen';

type Start = 'today' | 'tomorrow' | 'earlier';

export function Onboarding() {
  const { profile, startChallenge, updateProfile, history } = useApp();
  const today = todayISO();
  const yesterday = toISODate(addDays(parseISO(today), -1));

  const [start, setStart] = useState<Start>('today');
  const [earlier, setEarlier] = useState(toISODate(addDays(parseISO(today), -7)));
  const [tickOff, setTickOff] = useState(true);
  const [water, setWater] = useState(profile?.water_goal_ml ?? 3785);
  const [waterText, setWaterText] = useState(String((profile?.water_goal_ml ?? 3785) / 1000));
  const [calories, setCalories] = useState(profile?.calorie_goal?.toString() ?? '');
  const [weeklySteps, setWeeklySteps] = useState(String((profile?.step_goal ?? 10000) * 7));
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const startDate = start === 'today' ? today : start === 'tomorrow' ? toISODate(addDays(parseISO(today), 1)) : earlier;
  const earlierOk = start !== 'earlier' || (!!earlier && earlier <= yesterday);
  const dayToday = dayNumber(startDate, today);
  const restarted = history.some((c) => c.status === 'reset');
  const name = profile?.display_name;
  const missingBirthday = !birthday;

  const submitting = useRef(false);

  async function go() {
    setTried(true);
    if (missingBirthday || !earlierOk || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const cal = parseInt(calories, 10);
      await updateProfile({
        water_goal_ml: water,
        calorie_goal: Number.isFinite(cal) && cal > 0 ? cal : null,
        step_goal: Math.max(1, Math.round((parseInt(weeklySteps, 10) || 70000) / 7)),
        birthday,
      });
      await startChallenge(startDate, { tickOffPast: start === 'earlier' && tickOff });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
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
          <h2 className="card-title">When did day 1 start?</h2>
          <div className="segmented">
            <button aria-pressed={start === 'today'} onClick={() => setStart('today')}>
              Today
            </button>
            <button aria-pressed={start === 'tomorrow'} onClick={() => setStart('tomorrow')}>
              Tomorrow
            </button>
            <button aria-pressed={start === 'earlier'} onClick={() => setStart('earlier')}>
              Earlier
            </button>
          </div>
          {start === 'earlier' && (
            <>
              <label className="field">
                Start date
                <input
                  className="input"
                  type="date"
                  value={earlier}
                  max={yesterday}
                  min={toISODate(addDays(parseISO(today), -365))}
                  onChange={(e) => setEarlier(e.target.value)}
                />
              </label>
              {earlierOk ? (
                <span className="card-sub">
                  That makes today <strong style={{ color: 'var(--ink)' }}>day {dayToday}</strong>.
                </span>
              ) : (
                <span className="card-sub" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                  Pick a date before today.
                </span>
              )}
              <ToggleRow
                title="Tick off the days so far"
                sub={`Marks ${format(parseISO(earlierOk ? earlier : yesterday), 'd MMM')} to yesterday as complete. Change any of them in the calendar.`}
                checked={tickOff}
                onChange={setTickOff}
                style={{ borderBottom: 0, margin: 0, width: '100%', padding: '6px 0' }}
              />
            </>
          )}
          <p className="card-sub" style={{ margin: 0 }}>
            Day 75: <strong style={{ color: 'var(--ink)' }}>{format(parseISO(finishDate(startDate)), 'EEEE d MMMM')}</strong>
          </p>
        </section>

        <section className="card">
          <label className="field">
            <span className="card-title" style={{ color: 'var(--ink)' }}>
              Your birthday
            </span>
            <span className="card-sub" style={{ fontWeight: 500 }}>
              There’s a little something for you when it comes round.
            </span>
            <input
              className="input"
              type="date"
              value={birthday}
              max={today}
              onChange={(e) => setBirthday(e.target.value)}
              aria-invalid={tried && missingBirthday}
              style={tried && missingBirthday ? { borderColor: 'var(--danger)' } : undefined}
            />
          </label>
          {tried && missingBirthday && (
            <span className="card-sub" style={{ color: 'var(--danger)', fontWeight: 600 }}>
              Add your birthday to continue.
            </span>
          )}
        </section>

        <section className="card">
          <label className="field">
            <span className="card-title" style={{ color: 'var(--ink)' }}>
              Daily water
            </span>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                inputMode="decimal"
                value={waterText}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, '');
                  setWaterText(v);
                  const l = parseFloat(v.replace(',', '.'));
                  if (l > 0) setWater(Math.round(l * 1000));
                }}
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>litres</span>
            </div>
          </label>
          <div className="chips">
            {WATER_PRESETS.map((w) => (
              <button
                key={w.ml}
                className="chip-btn"
                aria-pressed={water === w.ml}
                onClick={() => {
                  setWater(w.ml);
                  setWaterText(String(w.ml / 1000));
                }}
              >
                {w.label}
              </button>
            ))}
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
          <label className="field">
            <span className="card-title" style={{ color: 'var(--ink)' }}>
              Weekly steps
            </span>
            <span className="card-sub" style={{ fontWeight: 500 }}>
              Tracked across the week, so a quiet day doesn’t cost you the day.
            </span>
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={weeklySteps}
              onChange={(e) => setWeeklySteps(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </section>

        <button className="btn btn-primary btn-block" style={{ height: 56, borderRadius: 18 }} onClick={go} disabled={busy}>
          {busy ? 'Setting up…' : start === 'earlier' ? `Pick up at day ${earlierOk ? dayToday : '…'}` : start === 'tomorrow' ? 'Start tomorrow' : 'Start day 1'}
        </button>
      </div>
    </div>
  );
}
