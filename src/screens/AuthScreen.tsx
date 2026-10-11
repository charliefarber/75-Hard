import { useState, type FormEvent } from 'react';
import { useApp } from '../data/AppData';

type Mode = 'signup' | 'signin' | 'reset';

export function AuthScreen() {
  const { repo } = useApp();
  const local = repo.kind === 'local';
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMessage(null);
    setBusy(true);
    try {
      if (local) {
        await repo.signUp('', '', name.trim());
      } else if (mode === 'signup') {
        const { needsConfirmation } = await repo.signUp(email.trim(), password, name.trim());
        if (needsConfirmation) setMessage('Check your email to confirm your account, then sign in.');
      } else if (mode === 'signin') {
        await repo.signIn(email.trim(), password);
      } else {
        await repo.sendPasswordReset(email.trim());
        setMessage('Password reset email sent.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--forest)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          padding: 'calc(var(--safe-top) + 56px) 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 32,
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'var(--mint)',
            color: 'var(--forest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.04em',
          }}
        >
          75
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Seventy-five days.
            <br />
            One day at a time.
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--mint-soft)' }}>
            Two workouts, a gallon of water, ten pages, clean eating and 10k steps, all in one place.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        style={{
          background: '#fff',
          color: 'var(--ink)',
          borderRadius: '32px 32px 0 0',
          padding: '28px 24px calc(var(--safe-bottom) + 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          animation: 'sheet-in 0.5s var(--ease)',
        }}
      >
        {!local && mode !== 'reset' && (
          <div className="segmented">
            <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
              Create account
            </button>
            <button type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
              Sign in
            </button>
          </div>
        )}

        {(local || mode === 'signup') && (
          <label className="field">
            First name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
          </label>
        )}

        {!local && (
          <label className="field">
            Email
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
        )}

        {!local && mode !== 'reset' && (
          <label className="field">
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>
        )}

        {err && (
          <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
            {err}
          </p>
        )}
        {message && (
          <p role="status" style={{ margin: 0, color: 'var(--green-ink)', fontSize: 14, fontWeight: 600 }}>
            {message}
          </p>
        )}

        <button className="btn btn-primary btn-block" style={{ marginTop: 6, height: 56, borderRadius: 18 }} disabled={busy}>
          {busy ? 'One sec…' : local ? 'Get started' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>

        {!local && mode === 'signin' && (
          <button type="button" className="link-btn" onClick={() => setMode('reset')}>
            Forgot password?
          </button>
        )}
        {!local && mode === 'reset' && (
          <button type="button" className="link-btn" onClick={() => setMode('signin')}>
            Back to sign in
          </button>
        )}
        {local && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            Saved on this device only. Add Supabase keys to sync across devices.
          </p>
        )}
      </form>
    </div>
  );
}
