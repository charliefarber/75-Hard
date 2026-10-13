import { useEffect, useState } from 'react';
import { useApp } from '../data/AppData';
import { Sheet } from './ui';
import { success } from '../lib/haptics';

/**
 * Pick a new password: opens by itself after a password-reset email link, and from Profile.
 */
export function PasswordSheet({ open, fromEmail, onClose }: { open: boolean; fromEmail?: boolean; onClose: () => void }) {
  const { setNewPassword } = useApp();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      setPw('');
      setErr(null);
      setDone(false);
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={done ? 'Password saved' : fromEmail ? 'Choose a new password' : 'Change password'}>
      {done ? (
        <>
          <p style={{ margin: 0, lineHeight: 1.5 }}>All set. Use the new password next time you sign in, on any phone.</p>
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </>
      ) : (
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < 8) return setErr('Use at least 8 characters.');
            setBusy(true);
            setErr(null);
            try {
              await setNewPassword(pw);
              success();
              setDone(true);
            } catch (x) {
              setErr(x instanceof Error ? x.message : String(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          {fromEmail && <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--ink-2)' }}>You’re signed in from the reset email. Pick a new password to finish.</p>}
          <label className="field">
            New password
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              value={pw}
              autoFocus
              onChange={(e) => setPw(e.target.value)}
            />
          </label>
          {err && (
            <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
              {err}
            </p>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </Sheet>
  );
}
