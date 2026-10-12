/** A little birthday cake with flickering candles. */
export function BirthdayCake({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="bday-cake">
      <ellipse cx="32" cy="58" rx="24" ry="3.5" fill="rgba(20,35,26,0.12)" />
      <rect x="10" y="38" width="44" height="18" rx="5" fill="#F7B6C8" />
      <path d="M10 44 q5.5 5 11 0 t11 0 t11 0 t11 0 V40 a5 5 0 0 0 -5 -5 H15 a5 5 0 0 0 -5 5 z" fill="#FFF3E6" />
      <rect x="16" y="24" width="32" height="14" rx="4" fill="#F59BB5" />
      <path d="M16 29 q4 4 8 0 t8 0 t8 0 t8 0 V27 a3 3 0 0 0 -3 -3 H19 a3 3 0 0 0 -3 3 z" fill="#FFF3E6" />
      <g fill="#7EC8F2">
        <circle cx="18" cy="50" r="1.4" />
        <circle cx="30" cy="52" r="1.4" />
        <circle cx="44" cy="49" r="1.4" />
      </g>
      <g fill="#FFD66B">
        <circle cx="24" cy="50" r="1.4" />
        <circle cx="38" cy="51" r="1.4" />
      </g>
      {[24, 32, 40].map((x, i) => (
        <g key={x}>
          <rect x={x - 1.5} y="14" width="3" height="10" rx="1" fill={['#7EC8F2', '#FFD66B', '#A98BF0'][i]} />
          <path className="bday-flame" style={{ animationDelay: `${i * 0.18}s` }} d={`M${x} 6 C${x + 3} 10 ${x + 2.5} 13 ${x} 13.5 C${x - 2.5} 13 ${x - 3} 10 ${x} 6 Z`} fill="#FF9F43" />
          <path d={`M${x} 9 C${x + 1.2} 11 ${x + 1} 12.6 ${x} 12.8 C${x - 1} 12.6 ${x - 1.2} 11 ${x} 9 Z`} fill="#FFE08A" />
        </g>
      ))}
    </svg>
  );
}
