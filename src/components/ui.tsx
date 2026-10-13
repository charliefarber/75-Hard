import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { tap } from '../lib/haptics';

export function Ring({
  size,
  stroke,
  value,
  max,
  color,
  track,
  label,
  children,
}: {
  size: number;
  stroke: number;
  value: number;
  max: number;
  color: string;
  track: string;
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ opacity: pct === 0 ? 0 : 1 }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="toggle">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(e) => {
          tap();
          onChange(e.target.checked);
        }}
      />
      <span className="track" />
      <span className="knob" />
    </span>
  );
}

/**
 * A whole row that acts as one big switch: tap anywhere on it (title, blank
 * space or the switch) to flip it. Much easier to hit than the switch alone.
 */
export function ToggleRow({
  title,
  sub,
  checked,
  onChange,
  style,
}: {
  title: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="row toggle-row"
      style={style}
      onClick={() => {
        tap();
        onChange(!checked);
      }}
    >
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <span className={`toggle toggle-visual${checked ? ' on' : ''}`} aria-hidden="true">
        <span className="track" />
        <span className="knob" />
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => (tap(), onChange(Math.max(min, value - 1)))}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => (tap(), onChange(Math.min(max, value + 1)))}>
        +
      </button>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  onBack,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Shows a back arrow beside the title. */
  onBack?: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open/close effect. Parents often pass a
  // new arrow function every render; re-running would steal focus from the text box on each
  // keystroke (on iPhone the keyboard closes and typing seems not to work).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Focus the sheet only if nothing inside it (e.g. an autoFocus input) already has focus.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={() => closeRef.current()} />
      <div className={`sheet${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="sheet-grip" />
        {onBack ? (
          <div className="sheet-head">
            <button type="button" className="sheet-back" aria-label="Back" onClick={() => (tap(), onBack())}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <h2 id={id}>{title}</h2>
          </div>
        ) : (
          <h2 id={id}>{title}</h2>
        )}
        {children}
      </div>
    </>
  );
}

export function Toast({
  message,
  onClose,
  action,
  tone = 'error',
}: {
  message: string;
  onClose: () => void;
  /** e.g. Undo. */
  action?: { label: string; onClick: () => void };
  tone?: 'error' | 'info';
}) {
  const act = useRef(action);
  act.current = action;
  useEffect(() => {
    const t = setTimeout(onClose, act.current ? 6000 : 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div className="toast" role={tone === 'error' ? 'alert' : 'status'}>
      <span style={{ flex: 1 }}>{message}</span>
      {action ? (
        <button
          className="link-btn"
          style={{ color: 'var(--mint)' }}
          onClick={() => {
            action.onClick();
            onClose();
          }}
        >
          {action.label}
        </button>
      ) : (
        <button className="link-btn" style={{ color: 'var(--mint)' }} onClick={onClose}>
          OK
        </button>
      )}
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString('en-GB');
