import { useId, type ReactNode } from 'react';

/**
 * One world per evolution stage, so every evolution is a big, visible step:
 * a new place, a new platform, a bigger sloth and (at the top) a power aura.
 * Each biome is drawn as depth layers (far / mid / near) so the scene has real
 * parallax and haze, plus the platform the sloth stands on.
 */
export interface Biome {
  id: string;
  name: string;
  /** Sloth size in this world (relative). */
  scale: number;
  sky: [string, string, string];
  /** Colour of the day/HUD text on this sky. */
  hud: 'dark' | 'light';
  particles: 'petals' | 'motes' | 'leaves' | 'sparkle' | 'blossom' | 'gold';
  aura: 'none' | 'warm' | 'gold';
  mottos: string[];
}

export const BIOMES: Biome[] = [
  {
    id: 'meadow', name: 'Sunny Meadow', scale: 0.6, sky: ['#9fd8f5', '#d9f0f7', '#fff1d6'], hud: 'dark', particles: 'petals', aura: 'none',
    mottos: ['Small steps count', 'Day one energy', 'Just keep going'],
  },
  {
    id: 'glade', name: 'Forest Glade', scale: 0.7, sky: ['#bfe3c9', '#e4f1d0', '#fbf0c8'], hud: 'dark', particles: 'motes', aura: 'none',
    mottos: ['Roots before branches', 'Growing every day', 'Habits are forming'],
  },
  {
    id: 'trail', name: 'Mountain Trail', scale: 0.82, sky: ['#6fbfee', '#a9dcf5', '#e8f6ff'], hud: 'dark', particles: 'leaves', aura: 'none',
    mottos: ['Momentum is real', 'One more mile', 'Keep climbing'],
  },
  {
    id: 'lake', name: 'Lakeside Cliffs', scale: 0.94, sky: ['#3f8fd8', '#86c3ee', '#dff1fb'], hud: 'light', particles: 'sparkle', aura: 'none',
    mottos: ['Discipline builds freedom', 'Stronger than yesterday', 'Built, not born'],
  },
  {
    id: 'peaks', name: 'Sunset Peaks', scale: 1.04, sky: ['#47306f', '#d9708f', '#ffc98a'], hud: 'light', particles: 'blossom', aura: 'warm',
    mottos: ['Stronger every day', 'Champions show up', 'Nothing stops you now'],
  },
  {
    id: 'summit', name: 'The Summit', scale: 1.14, sky: ['#1f3d73', '#e48f5e', '#ffd78a'], hud: 'light', particles: 'gold', aura: 'gold',
    mottos: ['Legend status', 'Above the clouds', '75 and unstoppable'],
  },
];

export const biomeFor = (stage: number) => BIOMES[Math.max(0, Math.min(BIOMES.length - 1, stage))];

/** Layers of a biome, back to front. `slot` lets the caller put the sloth between platform and foreground. */
export function BiomeScene({ biome, slot }: { biome: Biome; slot?: ReactNode }) {
  const uid = useId().replace(/:/g, '');
  const g = (name: string) => `${uid}-${name}`;
  const Art = ART[biome.id];
  return (
    <>
      <div className="world-sky" style={{ background: `linear-gradient(180deg, ${biome.sky[0]} 0%, ${biome.sky[1]} 52%, ${biome.sky[2]} 100%)` }} />
      <div className="world-layer world-far" aria-hidden="true">
        <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMax slice">{Art.far(g)}</svg>
      </div>
      <div className="world-layer world-mid" aria-hidden="true">
        <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMax slice">{Art.mid(g)}</svg>
      </div>
      <div className="world-stage">
        {biome.aura !== 'none' && <div className={`world-aura world-aura-${biome.aura}`} aria-hidden="true" />}
        <svg className="world-platform" viewBox="0 0 300 130" aria-hidden="true">
          {Art.platform(g)}
        </svg>
        {slot}
      </div>
      <div className="world-layer world-near" aria-hidden="true">
        <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMax slice">{Art.near(g)}</svg>
      </div>
    </>
  );
}

type Draw = (g: (n: string) => string) => ReactNode;
const ART: Record<string, { far: Draw; mid: Draw; near: Draw; platform: Draw }> = {
  // ---------------- Baby: soft pastel meadow ----------------
  meadow: {
    far: () => (
      <>
        <circle cx="318" cy="96" r="58" fill="#fff6d6" opacity="0.6" />
        <circle cx="318" cy="96" r="30" fill="#fff3c2" />
        <Cloud x={40} y={70} s={1.1} c="#ffffff" />
        <Cloud x={230} y={150} s={0.7} c="#ffffff" o={0.85} />
        <path d="M-20 330 C60 270 140 280 200 300 C260 270 340 268 420 310 V520 H-20z" fill="#bfe0c6" />
      </>
    ),
    mid: () => (
      <>
        <path d="M-20 370 C80 330 160 350 220 345 C300 330 360 335 420 360 V520 H-20z" fill="#9fd08a" />
        {[[40, 338, 22], [78, 346, 16], [330, 330, 24], [366, 342, 16]].map(([x, y, r], i) => (
          <g key={i}>
            <rect x={x - 2.5} y={y} width="5" height={r * 0.9} rx="2" fill="#8a6a4a" />
            <circle cx={x} cy={y} r={r} fill="#7cc06a" />
            <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.55} fill="#98d482" />
          </g>
        ))}
        <path d="M-20 420 C100 395 200 410 300 400 S380 398 420 410 V520 H-20z" fill="#86c46f" />
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={(i * 53) % 400} cy={410 + ((i * 37) % 90)} r={2.6} fill={i % 3 ? '#ffb7cc' : '#ffe27a'} />
        ))}
      </>
    ),
    near: () => <Tufts c="#5d9e4a" flower="#ff9fbd" />,
    platform: (g) => (
      <>
        <Defs g={g} top={['#c4ea96', '#93cf6d', '#6aa74e']} rim={['#a07a55', '#6e5038']} />
        <Shadow g={g} />
        <ellipse cx="150" cy="78" rx="138" ry="16" fill={`url(#${g('rim')})`} />
        <ellipse cx="150" cy="64" rx="138" ry="32" fill={`url(#${g('top')})`} />
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={40 + i * 27} cy={60 + ((i * 13) % 18)} r="3" fill={i % 2 ? '#ffb7cc' : '#fff'} />
        ))}
      </>
    ),
  },

  // ---------------- Sprout: sunlit forest glade ----------------
  glade: {
    far: (g) => (
      <>
        <defs>
          <linearGradient id={g('ray')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffbe0" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fffbe0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <Pines y={300} n={12} h={120} c="#a9cdb4" seed={1} />
        <Pines y={330} n={10} h={150} c="#86b596" seed={2} />
        <g opacity="0.55">
          <path d="M150 -10 L190 -10 L120 420 L40 420z" fill={`url(#${g('ray')})`} />
          <path d="M230 -10 L250 -10 L220 420 L170 420z" fill={`url(#${g('ray')})`} />
          <path d="M290 -10 L320 -10 L330 420 L270 420z" fill={`url(#${g('ray')})`} />
        </g>
      </>
    ),
    mid: () => (
      <>
        <Pines y={380} n={6} h={220} c="#5a9670" seed={3} />
        <path d="M-20 400 C100 385 300 390 420 402 V520 H-20z" fill="#7fb36b" />
        {[[60, 430], [330, 425], [300, 450]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 2} y={y - 10} width="4" height="10" fill="#f3e6d3" />
            <ellipse cx={x} cy={y - 10} rx="9" ry="6" fill="#e2574c" />
            <circle cx={x - 3} cy={y - 12} r="1.4" fill="#fff" />
          </g>
        ))}
      </>
    ),
    near: () => (
      <>
        <Ferns x={-10} c="#3f7a45" />
        <Ferns x={360} c="#3f7a45" flip />
      </>
    ),
    platform: (g) => (
      <>
        <defs>
          <linearGradient id={g('bark')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5e3f2a" />
            <stop offset="0.45" stopColor="#8b6040" />
            <stop offset="1" stopColor="#4e3423" />
          </linearGradient>
          <radialGradient id={g('rings')} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#f1d6a4" />
            <stop offset="1" stopColor="#d6ab6e" />
          </radialGradient>
        </defs>
        <Shadow g={g} />
        <path d="M22 60 L22 96 C22 120 278 120 278 96 L278 60z" fill={`url(#${g('bark')})`} />
        <path d="M40 98 v14 M90 104 v12 M150 106 v12 M210 104 v12 M260 98 v12" stroke="#3e2a1c" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <ellipse cx="150" cy="60" rx="128" ry="30" fill={`url(#${g('rings')})`} />
        {[100, 76, 52, 28].map((r) => (
          <ellipse key={r} cx="150" cy="60" rx={r} ry={r * 0.23} fill="none" stroke="#c2955a" strokeWidth="1.6" opacity="0.7" />
        ))}
        <path d="M30 56 C50 40 70 46 76 54 M232 50 C250 38 270 44 274 56" stroke="#5a9a4a" strokeWidth="7" strokeLinecap="round" fill="none" />
      </>
    ),
  },

  // ---------------- Mover: mountain trailhead ----------------
  trail: {
    far: () => (
      <>
        <Cloud x={20} y={60} s={1} c="#fff" />
        <Cloud x={260} y={110} s={0.8} c="#fff" o={0.9} />
        <path d="M-20 300 L60 200 L110 250 L180 150 L250 240 L300 190 L420 290 V520 H-20z" fill="#9fb9d6" />
        <path d="M180 150 L162 172 L176 168 L186 180 L196 168 L208 174z M60 200 L48 216 L62 212 L70 220z M300 190 L288 206 L302 202 L312 210z" fill="#fff" />
        <path d="M-20 330 C80 290 160 300 230 310 C300 290 360 296 420 320 V520 H-20z" fill="#9cc79a" />
      </>
    ),
    mid: () => (
      <>
        <path d="M-20 370 C90 345 300 350 420 372 V520 H-20z" fill="#7dbb66" />
        <path d="M206 352 C190 380 240 400 196 430 C170 450 240 480 210 520 L280 520 C300 480 230 452 256 430 C300 400 220 380 218 352z" fill="#d9c08f" opacity="0.9" />
        <Pines y={372} n={4} h={110} c="#4f8a5c" seed={5} />
      </>
    ),
    near: () => <Tufts c="#4b8d3c" flower="#ffd166" tall />,
    platform: (g) => (
      <>
        <defs>
          <linearGradient id={g('rock')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b7b3a6" />
            <stop offset="1" stopColor="#77736a" />
          </linearGradient>
          <radialGradient id={g('rtop')} cx="45%" cy="35%" r="70%">
            <stop offset="0" stopColor="#d9d5c8" />
            <stop offset="1" stopColor="#a8a497" />
          </radialGradient>
        </defs>
        <Shadow g={g} />
        <path d="M14 66 C10 96 40 116 150 118 C262 116 292 96 286 66z" fill={`url(#${g('rock')})`} />
        <path d="M60 92 l20 10 M200 96 l18 -8 M140 104 l10 8" stroke="#5f5b53" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M20 64 C30 36 90 30 150 32 C220 30 276 38 282 62 C270 92 30 94 20 64z" fill={`url(#${g('rtop')})`} />
        <path d="M22 62 C40 54 52 60 60 52 M240 52 C250 58 264 54 280 62" stroke="#6fae58" strokeWidth="6" strokeLinecap="round" fill="none" />
      </>
    ),
  },

  // ---------------- Athlete: lakeside cliffs ----------------
  lake: {
    far: (g) => (
      <>
        <defs>
          <linearGradient id={g('water')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fbfe8" />
            <stop offset="1" stopColor="#2f78b8" />
          </linearGradient>
        </defs>
        <Cloud x={10} y={50} s={1.4} c="#fff" />
        <Cloud x={220} y={90} s={1.1} c="#fff" o={0.95} />
        <path d="M-20 290 L40 200 L90 240 L150 160 L210 230 L260 180 L320 240 L370 190 L420 260 L420 300 H-20z" fill="#6d8fb8" />
        <path d="M150 160 L136 182 L152 176 L160 186 L170 176 L180 182z M260 180 L248 198 L262 194 L270 202z" fill="#eef5ff" />
        <rect x="-20" y="298" width="440" height="80" fill={`url(#${g('water')})`} />
        <path d="M-20 300 L40 352 L90 330 L150 372 L210 336 L260 362 L320 330 L370 356 L420 318 L420 300z" fill="#6d8fb8" opacity="0.35" />
        {[310, 324, 340, 356].map((y, i) => (
          <path key={y} d={`M${30 + i * 40} ${y} h${50 - i * 6} M${220 + i * 20} ${y + 6} h${40 - i * 4}`} stroke="#fff" strokeWidth="1.6" opacity="0.5" strokeLinecap="round" />
        ))}
      </>
    ),
    mid: () => (
      <>
        <path d="M-20 250 C10 240 40 260 60 300 C70 340 90 360 60 400 L-20 420z" fill="#7c7a72" />
        <path d="M420 230 C380 236 350 270 340 310 C334 350 350 380 330 410 L420 420z" fill="#86837a" />
        <Pines y={250} n={2} h={70} c="#2f6b4a" seed={8} x0={-10} span={60} />
        <Pines y={240} n={2} h={80} c="#2f6b4a" seed={9} x0={350} span={60} />
        <path d="M-20 390 C100 376 300 380 420 396 V520 H-20z" fill="#6aa65c" />
      </>
    ),
    near: () => <Tufts c="#3f7d36" flower="#ffffff" tall />,
    platform: (g) => (
      <>
        <defs>
          <radialGradient id={g('stone')} cx="45%" cy="35%" r="70%">
            <stop offset="0" stopColor="#e6e2d6" />
            <stop offset="1" stopColor="#b3ad9e" />
          </radialGradient>
          <linearGradient id={g('side')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9a9486" />
            <stop offset="1" stopColor="#68635a" />
          </linearGradient>
        </defs>
        <Shadow g={g} />
        <path d="M12 60 L12 92 C12 122 288 122 288 92 L288 60z" fill={`url(#${g('side')})`} />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${20 + i * 28} ${92 + Math.sin((i / 9) * Math.PI) * 18} v-28`} stroke="#57534b" strokeWidth="2" opacity="0.6" />
        ))}
        <ellipse cx="150" cy="60" rx="138" ry="32" fill={`url(#${g('stone')})`} />
        <ellipse cx="150" cy="60" rx="96" ry="21" fill="none" stroke="#a49d8c" strokeWidth="2.5" />
        <ellipse cx="150" cy="60" rx="54" ry="12" fill="none" stroke="#a49d8c" strokeWidth="2" opacity="0.7" />
      </>
    ),
  },

  // ---------------- Champion: sunset peaks ----------------
  peaks: {
    far: (g) => (
      <>
        <defs>
          <radialGradient id={g('sun')}>
            <stop offset="0" stopColor="#fff2c4" />
            <stop offset="0.35" stopColor="#ffd28a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff9a7a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="210" cy="250" r="160" fill={`url(#${g('sun')})`} />
        <circle cx="210" cy="250" r="34" fill="#fff4cf" />
        <path d="M-20 230 L50 140 L100 200 L170 110 L230 190 L290 130 L350 200 L420 150 V520 H-20z" fill="#8a5d8f" opacity="0.75" />
        <rect x="-20" y="230" width="440" height="40" fill="#f2a2a8" opacity="0.35" />
        <path d="M-20 300 L30 230 L90 280 L150 210 L220 290 L280 240 L340 290 L420 240 V520 H-20z" fill="#6c4479" opacity="0.9" />
        <rect x="-20" y="290" width="440" height="40" fill="#f5b2a0" opacity="0.25" />
      </>
    ),
    mid: () => (
      <>
        <path d="M-20 320 C20 300 40 330 70 360 C90 380 70 400 40 420 L-20 430z" fill="#4c3256" />
        <path d="M420 300 C380 310 360 340 350 370 C344 396 360 410 340 430 L420 440z" fill="#553863" />
        <path d="M-20 400 C100 380 300 384 420 402 V520 H-20z" fill="#5d7b52" />
        <g fill="#ffc3d4">
          <circle cx="30" cy="330" r="16" />
          <circle cx="50" cy="318" r="12" />
          <circle cx="16" cy="316" r="10" />
          <circle cx="372" cy="320" r="14" />
          <circle cx="390" cy="306" r="11" />
        </g>
      </>
    ),
    near: () => <Tufts c="#3c5a36" flower="#ffc3d4" tall />,
    platform: (g) => (
      <>
        <defs>
          <linearGradient id={g('crag')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8e7a74" />
            <stop offset="1" stopColor="#4f4144" />
          </linearGradient>
          <radialGradient id={g('ctop')} cx="40%" cy="30%" r="75%">
            <stop offset="0" stopColor="#f2c3a6" />
            <stop offset="1" stopColor="#a87f72" />
          </radialGradient>
        </defs>
        <Shadow g={g} />
        <path d="M8 62 L26 112 L90 124 L210 126 L276 112 L292 62z" fill={`url(#${g('crag')})`} />
        <path d="M60 80 l14 30 M150 84 l-8 34 M230 80 l12 28" stroke="#3b3033" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        <path d="M10 60 C24 34 94 26 150 28 C214 26 280 34 290 60 C276 90 26 90 10 60z" fill={`url(#${g('ctop')})`} />
        <path d="M14 58 C30 50 46 56 56 48 M246 48 C256 56 272 52 288 58" stroke="#7a9a5a" strokeWidth="6" strokeLinecap="round" fill="none" />
      </>
    ),
  },

  // ---------------- Legend: summit above the clouds ----------------
  summit: {
    far: (g) => (
      <>
        <defs>
          <radialGradient id={g('glow')}>
            <stop offset="0" stopColor="#fff3c8" />
            <stop offset="0.4" stopColor="#ffd27a" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ff9f5a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="300" r="190" fill={`url(#${g('glow')})`} />
        <path d="M-20 300 L40 250 L80 270 L120 230 L160 262 L240 262 L280 228 L330 268 L370 244 L420 290 V340 H-20z" fill="#7d6a9a" opacity="0.6" />
        <SeaOfClouds y={300} c1="#fff3e2" c2="#ffd9b0" />
      </>
    ),
    mid: () => <SeaOfClouds y={360} c1="#ffffff" c2="#ffe3c2" big />,
    near: () => (
      <g fill="#fff8ec" opacity="0.95">
        <circle cx="-10" cy="500" r="60" />
        <circle cx="50" cy="520" r="50" />
        <circle cx="410" cy="500" r="60" />
        <circle cx="350" cy="525" r="46" />
      </g>
    ),
    platform: (g) => (
      <>
        <defs>
          <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8a5a1c" />
            <stop offset="0.5" stopColor="#f5c95a" />
            <stop offset="1" stopColor="#8a5a1c" />
          </linearGradient>
          <linearGradient id={g('peak')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8d8399" />
            <stop offset="1" stopColor="#4c4558" />
          </linearGradient>
          <radialGradient id={g('ptop')} cx="45%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fbf3e2" />
            <stop offset="1" stopColor="#d9c9a8" />
          </radialGradient>
        </defs>
        <Shadow g={g} />
        <path d="M10 62 L40 128 L260 128 L290 62z" fill={`url(#${g('peak')})`} />
        <path d="M10 62 L290 62 L290 74 C220 92 80 92 10 74z" fill={`url(#${g('gold')})`} />
        <ellipse cx="150" cy="60" rx="140" ry="30" fill={`url(#${g('ptop')})`} />
        <ellipse cx="150" cy="60" rx="140" ry="30" fill="none" stroke="#e9b949" strokeWidth="4" />
        <g fill="#6f9a3e">
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={60 + i * 9} cy={86 - i * 2} rx="6" ry="3" transform={`rotate(-30 ${60 + i * 9} ${86 - i * 2})`} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={240 - i * 9} cy={86 - i * 2} rx="6" ry="3" transform={`rotate(30 ${240 - i * 9} ${86 - i * 2})`} />
          ))}
        </g>
      </>
    ),
  },
};

// ---------- shared drawing helpers ----------

function Defs({ g, top, rim }: { g: (n: string) => string; top: [string, string, string]; rim: [string, string] }) {
  return (
    <defs>
      <radialGradient id={g('top')} cx="45%" cy="35%" r="70%">
        <stop offset="0" stopColor={top[0]} />
        <stop offset="0.7" stopColor={top[1]} />
        <stop offset="1" stopColor={top[2]} />
      </radialGradient>
      <linearGradient id={g('rim')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={rim[0]} />
        <stop offset="1" stopColor={rim[1]} />
      </linearGradient>
    </defs>
  );
}

function Shadow({ g }: { g: (n: string) => string }) {
  return (
    <>
      <defs>
        <radialGradient id={g('shadow')}>
          <stop offset="0" stopColor="rgba(10,25,15,0.42)" />
          <stop offset="1" stopColor="rgba(10,25,15,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="118" rx="156" ry="16" fill={`url(#${g('shadow')})`} />
    </>
  );
}

function Cloud({ x, y, s, c, o = 1 }: { x: number; y: number; s: number; c: string; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o} fill={c}>
      <ellipse cx="40" cy="30" rx="40" ry="16" />
      <circle cx="30" cy="20" r="16" />
      <circle cx="54" cy="14" r="20" />
      <circle cx="78" cy="26" r="14" />
    </g>
  );
}

function Pines({ y, n, h, c, seed, x0 = -20, span = 440 }: { y: number; n: number; h: number; c: string; seed: number; x0?: number; span?: number }) {
  return (
    <g fill={c}>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + (span / Math.max(1, n - 1)) * i + (((i + seed) * 37) % 23) - 11;
        const hh = h * (0.75 + (((i + seed) * 53) % 40) / 100);
        const w = hh * 0.36;
        return <path key={i} d={`M${x} ${y - hh} L${x + w} ${y} L${x - w} ${y}z`} />;
      })}
      <rect x={x0 - 20} y={y - 2} width={span + 40} height="300" />
    </g>
  );
}

function Ferns({ x, c, flip = false }: { x: number; c: string; flip?: boolean }) {
  return (
    <g transform={`translate(${x} 520) scale(${flip ? -1 : 1} 1)`} fill={c}>
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`rotate(${-20 + k * 18})`}>
          <path d={`M0 0 C10 -50 20 -90 ${30 + k * 6} -${120 + k * 10}`} stroke={c} strokeWidth="4" fill="none" />
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={6 + i * 4} cy={-20 - i * 14} rx="14" ry="4" transform={`rotate(-30 ${6 + i * 4} ${-20 - i * 14})`} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Tufts({ c, flower, tall = false }: { c: string; flower: string; tall?: boolean }) {
  const h = tall ? 1.4 : 1;
  return (
    <g>
      <g fill={c}>
        {[-6, 10, 24, 40].map((x, i) => (
          <path key={i} d={`M${x} 520 C${x + 4} ${520 - 50 * h} ${x + 12} ${520 - 70 * h} ${x + 20} ${520 - 86 * h + i * 8} C${x + 18} ${520 - 50 * h} ${x + 22} ${520 - 30 * h} ${x + 28} 520z`} />
        ))}
        {[406, 390, 374, 358].map((x, i) => (
          <path key={i} d={`M${x} 520 C${x - 4} ${520 - 50 * h} ${x - 12} ${520 - 70 * h} ${x - 20} ${520 - 86 * h + i * 8} C${x - 18} ${520 - 50 * h} ${x - 22} ${520 - 30 * h} ${x - 28} 520z`} />
        ))}
      </g>
      <circle cx="58" cy={490 - 30 * h} r="7" fill={flower} />
      <circle cx="58" cy={490 - 30 * h} r="2.6" fill="#ffe27a" />
      <circle cx="346" cy={494 - 30 * h} r="6" fill={flower} />
      <circle cx="346" cy={494 - 30 * h} r="2.2" fill="#ffe27a" />
    </g>
  );
}

function SeaOfClouds({ y, c1, c2, big = false }: { y: number; c1: string; c2: string; big?: boolean }) {
  const r = big ? 48 : 32;
  return (
    <g>
      <rect x="-20" y={y + r * 0.3} width="440" height={520 - y} fill={c2} />
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={-20 + i * 48} cy={y + ((i * 17) % 20)} r={r + ((i * 13) % 14)} fill={i % 2 ? c1 : c2} />
      ))}
    </g>
  );
}
