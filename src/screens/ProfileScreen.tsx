import { useEffect, useState, type ReactNode } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useApp } from '../data/AppData';
import type { Profile } from '../data/types';
import { supabaseAnonKey, supabaseUrl } from '../data/repo';
import { litres, summarise } from '../lib/challenge';
import { Sheet, fmt } from '../components/ui';
import { IconChevron, IconCopy, IconHeart, IconLeaf } from '../components/Icons';

type GoalKey = 'water_goal_ml' | 'step_goal' | 'calorie_goal' | 'workout_minutes' | 'reading_goal_pages';

export const WATER_PRESETS = [
  { ml: 2000, label: '2 L' },
  { ml: 2500, label: '2.5 L' },
  { ml: 3000, label: '3 L' },
  { ml: 3785, label: 'US gallon · 3.8 L' },
  { ml: 4546, label: 'UK gallon · 4.5 L' },
];

const GOALS: { key: GoalKey; label: string; unit: string; show: (p: Profile) => string }[] = [
  { key: 'water_goal_ml', label: 'Water', unit: 'ml', show: (p) => `${litres(p.water_goal_ml, 1)} L` },
  { key: 'step_goal', label: 'Steps', unit: 'a week', show: (p) => `${fmt(p.step_goal * 7)} a week` },
  { key: 'calorie_goal', label: 'Calorie target', unit: 'kcal', show: (p) => (p.calorie_goal ? `${fmt(p.calorie_goal)} kcal` : 'Not set') },
  { key: 'workout_minutes', label: 'Workout length', unit: 'min', show: (p) => `2 × ${p.workout_minutes} min` },
  { key: 'reading_goal_pages', label: 'Reading', unit: 'pages', show: (p) => `${p.reading_goal_pages} pages` },
];

export function ProfileScreen() {
  const { repo, user, profile, challenge, logs, today, health, connectHealth, syncHealth, updateProfile, signOut, restartChallenge, history, changeStartDate, exportData } = useApp();
  const [editing, setEditing] = useState<GoalKey | 'name' | null>(null);
  const [dateEdit, setDateEdit] = useState<null | 'start' | 'birthday'>(null);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  if (!profile || !challenge) return null;

  const day = Math.max(1, summarise(challenge, logs, profile, today).currentDay);
  const attempt = history.findIndex((c) => c.id === challenge.id) + 1 || 1;
  const initial = (profile.display_name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="screen page-pad">
      <button
        onClick={() => setEditing('name')}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 4px', background: 'none', border: 0, textAlign: 'left' }}
        aria-label="Edit name"
      >
        <span
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'var(--forest)',
            color: 'var(--mint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          {initial}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{profile.display_name || 'Add your name'}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Day {day} · attempt {attempt}
          </span>
        </span>
      </button>

      <span className="section-label">Connections</span>
      <section className="card list">
        <div className="row">
          <span className="icon-badge" style={{ background: '#fde8ec', color: '#d1294b' }}>
            <IconHeart size={22} strokeWidth={2.2} />
          </span>
          <div className="row-text">
            <span className="row-title">Apple Health</span>
            <span className="row-sub">
              {health.available
                ? health.connected
                  ? health.lastSync
                    ? `Synced ${formatDistanceToNow(health.lastSync, { addSuffix: true })}`
                    : 'Steps, calories, water, workouts'
                  : 'Steps, calories, water, workouts'
                : 'Sync through an iPhone Shortcut'}
            </span>
          </div>
          {health.available ? (
            health.connected ? (
              <button className="btn btn-sm btn-ghost" onClick={() => syncHealth()} disabled={health.syncing}>
                {health.syncing ? 'Syncing…' : 'Sync'}
              </button>
            ) : (
              <button className="btn btn-sm btn-dark" onClick={() => connectHealth()}>
                Connect
              </button>
            )
          ) : (
            <button className="btn btn-sm btn-dark" onClick={() => setShortcutOpen(true)} disabled={repo.kind === 'local'}>
              Set up
            </button>
          )}
        </div>
        <div className="row">
          <span className="icon-badge" style={{ background: 'var(--green)', color: '#fff' }}>
            <IconLeaf size={20} strokeWidth={2.2} />
          </span>
          <div className="row-text">
            <span className="row-title">Lifesum</span>
            <span className="row-sub">Calories come in through Apple Health</span>
          </div>
          <span className="chip">Via Health</span>
        </div>
      </section>
      {!health.available && repo.kind === 'local' && (
        <p className="card-sub" style={{ margin: '-4px 4px 0' }}>
          Shortcut sync needs an account. Add Supabase keys to turn it on.
        </p>
      )}

      <span className="section-label">Your challenge</span>
      <section className="card list">
        {[
          { id: 'start' as const, label: 'Start date', value: format(parseISO(challenge.start_date), 'EEE d MMM yyyy') },
          { id: 'birthday' as const, label: 'Birthday', value: profile.birthday ? format(parseISO(profile.birthday), 'd MMMM') : 'Add' },
        ].map((r, i) => (
          <button key={r.id} className="row" style={{ ...ROW_BTN, borderBottomWidth: i === 0 ? 1 : 0 }} onClick={() => setDateEdit(r.id)}>
            <span className="row-text">
              <span className="row-title" style={{ fontWeight: 600 }}>
                {r.label}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--green-ink)' }}>
              {r.value}
              <IconChevron size={16} style={{ color: '#9aa59d' }} />
            </span>
          </button>
        ))}
      </section>

      <span className="section-label">Daily goals</span>
      <section className="card list">
        {GOALS.map((g, i) => (
          <button key={g.key} className="row" style={{ ...ROW_BTN, borderBottomWidth: i === GOALS.length - 1 ? 0 : 1 }} onClick={() => setEditing(g.key)}>
            <span className="row-text">
              <span className="row-title" style={{ fontWeight: 600 }}>
                {g.label}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--green-ink)' }}>
              {g.show(profile)}
              <IconChevron size={16} style={{ color: '#9aa59d' }} />
            </span>
          </button>
        ))}
      </section>

      <span className="section-label">Your data</span>
      <section className="card list">
        <button
          className="row"
          style={{ ...ROW_BTN, borderBottomWidth: 1 }}
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            await exportData();
            setExporting(false);
          }}
        >
          <span className="row-text">
            <span className="row-title" style={{ fontWeight: 600 }}>
              {exporting ? 'Preparing…' : 'Download my data'}
            </span>
            <span className="row-sub">Everything you’ve logged, as a file</span>
          </span>
          <IconChevron size={16} style={{ color: '#9aa59d' }} />
        </button>
        <button className="row" style={{ ...ROW_BTN, borderBottomWidth: 0 }} onClick={() => setDeleteOpen(true)}>
          <span className="row-text">
            <span className="row-title" style={{ fontWeight: 600, color: 'var(--danger)' }}>
              Delete account
            </span>
            <span className="row-sub">Removes your account and everything in it</span>
          </span>
          <IconChevron size={16} style={{ color: '#9aa59d' }} />
        </button>
      </section>
      <p className="card-sub" style={{ margin: '-4px 4px 0', lineHeight: 1.5 }}>
        Only you can see what you log here. Nobody else, including other people using the app, can read it.
      </p>

      {user?.email && <p className="card-sub" style={{ margin: '4px 4px 0' }}>Signed in as {user.email}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-soft" style={{ flex: 1, height: 48 }} onClick={() => signOut()}>
          Sign out
        </button>
        <button className="btn btn-danger" style={{ flex: 1, height: 48 }} onClick={() => setRestartOpen(true)}>
          Start over
        </button>
      </div>

      <DateSheet
        open={dateEdit === 'start'}
        title="Start date"
        initial={challenge.start_date}
        max={today}
        note="Day 1 moves to this date and every day re-numbers from it. Your logged days stay as they are."
        onClose={() => setDateEdit(null)}
        onSave={(d) => {
          changeStartDate(d);
          setDateEdit(null);
        }}
      />
      <DateSheet
        open={dateEdit === 'birthday'}
        title="Your birthday"
        initial={profile.birthday ?? ''}
        max={today}
        note="A week before your birthday you get a birthday pass: pick any day and it counts as complete."
        onClose={() => setDateEdit(null)}
        onSave={(d) => {
          updateProfile({ birthday: d });
          setDateEdit(null);
        }}
      />

      <GoalSheet
        field={editing}
        profile={profile}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          updateProfile(patch);
          setEditing(null);
        }}
      />

      <ShortcutSheet open={shortcutOpen} onClose={() => setShortcutOpen(false)} token={profile.health_sync_token} />

      <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} />

      <Sheet open={restartOpen} onClose={() => setRestartOpen(false)} title="Restart at day 1?">
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
          This attempt ends here and day 1 starts today. Your history and notes stay saved.
        </p>
        <button
          className="btn btn-danger btn-block"
          onClick={async () => {
            await restartChallenge();
            setRestartOpen(false);
          }}
        >
          Restart today
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => setRestartOpen(false)}>
          Cancel
        </button>
      </Sheet>
    </div>
  );
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { deleteAccount, repo } = useApp();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTyped('');
      setErr(null);
      setBusy(false);
    }
  }, [open]);
  const ready = typed.trim().toUpperCase() === 'DELETE';
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Delete your account?">
      <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
        This permanently deletes your account, every day you’ve logged, your notes, your challenges and your sloth
        {repo.kind === 'local' ? ' from this device' : ''}. It can’t be undone. If you want a copy, use <strong>Download my data</strong> first.
      </p>
      <label className="field">
        Type DELETE to confirm
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="DELETE"
        />
      </label>
      {err && (
        <span className="card-sub" style={{ color: 'var(--danger)', fontWeight: 600 }}>
          {err}
        </span>
      )}
      <button
        className="btn btn-danger btn-block"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await deleteAccount();
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Something went wrong. Nothing was deleted.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Deleting…' : 'Delete everything'}
      </button>
      <button className="btn btn-ghost btn-block" disabled={busy} onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}

const ROW_BTN = {
  width: '100%',
  background: 'none',
  borderWidth: '0 0 1px',
  borderStyle: 'solid',
  borderColor: 'var(--line)',
  textAlign: 'left' as const,
};

function DateSheet({
  open,
  title,
  initial,
  max,
  note,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: string;
  max: string;
  note: string;
  onClose: () => void;
  onSave: (date: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value && value <= max) onSave(value);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <input className="input" type="date" aria-label={title} value={value} max={max} onChange={(e) => setValue(e.target.value)} />
        <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
          {note}
        </p>
        <button className="btn btn-primary btn-block" type="submit" disabled={!value || value > max}>
          Save
        </button>
      </form>
    </Sheet>
  );
}

function GoalSheet({
  field,
  profile,
  onClose,
  onSave,
}: {
  field: GoalKey | 'name' | null;
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const [value, setValue] = useState('');
  const goal = GOALS.find((g) => g.key === field);

  useEffect(() => {
    if (!field) return;
    if (field === 'name') setValue(profile.display_name);
    else if (field === 'water_goal_ml') setValue(String(profile.water_goal_ml / 1000));
    else if (field === 'step_goal') setValue(String(profile.step_goal * 7));
    else setValue(profile[field]?.toString() ?? '');
  }, [field, profile]);

  function save() {
    if (field === 'name') return onSave({ display_name: value.trim() });
    if (!field) return;
    if (field === 'water_goal_ml') {
      const l = parseFloat(value.replace(',', '.'));
      if (l > 0) onSave({ water_goal_ml: Math.round(l * 1000) });
      return;
    }
    const n = parseInt(value, 10);
    if (field === 'calorie_goal') return onSave({ calorie_goal: n > 0 ? n : null });
    if (field === 'step_goal') return n > 0 ? onSave({ step_goal: Math.round(n / 7) }) : undefined;
    if (n > 0) onSave({ [field]: n } as Partial<Profile>);
  }

  const isWater = field === 'water_goal_ml';
  return (
    <Sheet open={!!field} onClose={onClose} title={field === 'name' ? 'Your name' : (goal?.label ?? '')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            aria-label={field === 'name' ? 'Name' : goal?.label}
            style={{ height: 64, fontSize: field === 'name' ? 20 : 28, fontWeight: 800, paddingRight: 80 }}
            inputMode={field === 'name' ? 'text' : isWater ? 'decimal' : 'numeric'}
            autoFocus
            value={value}
            onChange={(e) => setValue(field === 'name' ? e.target.value : e.target.value.replace(isWater ? /[^\d.,]/g : /\D/g, ''))}
          />
          {field !== 'name' && (
            <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>
              {isWater ? 'litres' : goal?.unit}
            </span>
          )}
        </div>
        {isWater && (
          <div className="chips">
            {WATER_PRESETS.map((w) => (
              <button type="button" key={w.ml} className="chip-btn" aria-pressed={value === String(w.ml / 1000)} onClick={() => setValue(String(w.ml / 1000))}>
                {w.label}
              </button>
            ))}
          </div>
        )}
        {field === 'step_goal' && (
          <p className="card-sub" style={{ margin: 0 }}>
            Steps don’t decide whether a day counts. Today shows how the week is going.
          </p>
        )}
        {field === 'calorie_goal' && (
          <p className="card-sub" style={{ margin: 0 }}>
            Match your Lifesum daily goal. Leave empty for no target.
          </p>
        )}
        <button className="btn btn-primary btn-block" type="submit">
          Save
        </button>
      </form>
    </Sheet>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--surface-2)',
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </code>
        <button
          className="icon-btn"
          aria-label={`Copy ${label}`}
          style={{ background: copied ? 'var(--mint-tint)' : 'var(--surface-2)', color: copied ? 'var(--green-ink)' : 'var(--ink)' }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          <IconCopy size={18} />
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          flex: 'none',
          background: 'var(--forest)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</span>
    </li>
  );
}

function ShortcutSheet({ open, onClose, token }: { open: boolean; onClose: () => void; token: string }) {
  const { regenerateSyncToken } = useApp();
  const endpoint = `${supabaseUrl ?? ''}/rest/v1/rpc/ingest_health`;
  return (
    <Sheet open={open} onClose={onClose} title="Sync Apple Health with a Shortcut">
      <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5, fontSize: 14 }}>
        Until this is an App Store app, an iPhone Shortcut can send steps and Lifesum calories from Apple Health. It sends the last 7
        days each time, so late-evening steps and days the Shortcut didn’t run still get filled in, and each run corrects those days. Set it up once and it runs on its own.
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Step n={1}>
          In <strong>Lifesum → Settings → Apple Health</strong>, turn on writing nutrition data.
        </Step>
        <Step n={2}>
          In the <strong>Shortcuts</strong> app, make a new shortcut. Add <strong>Find Health Samples</strong>: Type <strong>Steps</strong>,
          Start Date <strong>is in the last 7 days</strong>, Group by <strong>Day</strong>.
        </Step>
        <Step n={3}>
          Add <strong>Repeat with Each</strong> over those samples. Inside the repeat, add <strong>Format Date</strong> of{' '}
          <strong>Repeat Item › Start Date</strong> (Custom: <code>yyyy-MM-dd</code>).
        </Step>
        <Step n={4}>
          Still inside the repeat, add <strong>Get Contents of URL</strong>: the URL below, Method <strong>POST</strong>, a header{' '}
          <code>apikey</code> with the key below, and a JSON body with <code>p_token</code> (text), <code>p_steps</code> (number:{' '}
          <strong>Repeat Item › Value</strong>) and <code>p_date</code> (text: <strong>Formatted Date</strong>).
        </Step>
        <Step n={5}>
          After <strong>End Repeat</strong>, do steps 2–4 again with Type <strong>Dietary Energy</strong>, sending <code>p_calories</code>{' '}
          instead of <code>p_steps</code>.
        </Step>
        <Step n={6}>
          In <strong>Automation</strong>, add <strong>App → Lifesum → Is Closed</strong> and a few <strong>Time of Day</strong> ones
          (say 08:00, 12:00, 18:00, 22:00). Pick this shortcut and choose <strong>Run Immediately</strong>.
        </Step>
      </ol>
      <CopyField label="URL" value={endpoint} />
      <CopyField label="apikey header" value={supabaseAnonKey ?? ''} />
      <CopyField label="p_token (keep private)" value={token} />
      <button className="link-btn" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => regenerateSyncToken()}>
        Make a new token (the old one stops working)
      </button>
    </Sheet>
  );
}
