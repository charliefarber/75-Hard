import { useEffect } from 'react';

/**
 * Day-complete celebration: an original unicorn gallops across the sky
 * trailing a rainbow, with a little banner. Purely decorative.
 */
export function Celebration({ title, subtitle, onDone }: { title: string; subtitle: string; onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(onDone, reduced ? 2200 : 3400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="celebrate" aria-live="polite">
      <div className="celebrate-flight" aria-hidden="true">
        <div className="celebrate-bob">
          <div className="celebrate-rainbow" />
          <Unicorn />
        </div>
      </div>
      <div className="celebrate-stars" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, top: `${12 + ((i * 53) % 46)}%`, animationDelay: `${0.25 + (i % 7) * 0.16}s` }} />
        ))}
      </div>
      <div className="celebrate-banner" role="status">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

function Unicorn() {
  return (
    <svg className="celebrate-unicorn" width="150" height="104" viewBox="0 0 160 110">
      {/* tail */}
      <path d="M44 56 C26 50 18 64 8 58 C16 70 30 72 42 64" fill="#B79CFF" />
      <path d="M44 60 C28 62 22 78 10 76 C22 86 36 80 44 68" fill="#FF9FC8" />
      {/* back legs */}
      <rect x="52" y="70" width="10" height="22" rx="5" fill="#fff" stroke="#E4DAF4" strokeWidth="2" transform="rotate(-38 57 72)" />
      <rect x="66" y="72" width="10" height="20" rx="5" fill="#fff" stroke="#E4DAF4" strokeWidth="2" transform="rotate(-50 71 74)" />
      {/* body */}
      <ellipse cx="80" cy="60" rx="36" ry="21" fill="#fff" stroke="#E4DAF4" strokeWidth="2" />
      {/* front legs */}
      <rect x="92" y="68" width="10" height="22" rx="5" fill="#fff" stroke="#E4DAF4" strokeWidth="2" transform="rotate(52 97 70)" />
      <rect x="102" y="64" width="10" height="20" rx="5" fill="#fff" stroke="#E4DAF4" strokeWidth="2" transform="rotate(64 107 66)" />
      {/* wing */}
      <path className="celebrate-wing" d="M70 48 C62 26 76 14 92 22 C86 30 90 38 84 46 Z" fill="#F4F0FF" stroke="#D9CCF3" strokeWidth="2" />
      {/* neck + head */}
      <path d="M100 52 C104 40 110 32 118 30 L128 44 C122 52 114 58 106 62 Z" fill="#fff" stroke="#E4DAF4" strokeWidth="2" />
      <ellipse cx="128" cy="36" rx="17" ry="13" fill="#fff" stroke="#E4DAF4" strokeWidth="2" transform="rotate(18 128 36)" />
      <ellipse cx="141" cy="42" rx="7" ry="6" fill="#FFE6F0" />
      <circle cx="128" cy="33" r="2.6" fill="#2B2340" />
      <circle cx="129" cy="32" r="0.9" fill="#fff" />
      <ellipse cx="133" cy="40" rx="3.5" ry="2" fill="#FFB3CF" opacity="0.8" />
      {/* ear */}
      <path d="M120 24 L118 14 L126 21 Z" fill="#fff" stroke="#E4DAF4" strokeWidth="2" strokeLinejoin="round" />
      {/* horn */}
      <path d="M127 22 L140 3 L133 25 Z" fill="#FFD66B" stroke="#E9B53C" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M130 18 L135 16 M132 13 L137 11" stroke="#E9B53C" strokeWidth="1.3" strokeLinecap="round" />
      {/* mane */}
      <circle cx="114" cy="28" r="6" fill="#FF9FC8" />
      <circle cx="108" cy="36" r="6" fill="#B79CFF" />
      <circle cx="104" cy="45" r="5.5" fill="#8FD3FF" />
      <circle cx="119" cy="22" r="4.5" fill="#FFD66B" />
    </svg>
  );
}
