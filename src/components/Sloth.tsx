import type { Mood } from '../lib/pet';

/**
 * The challenge pet: an original, hand-built sloth.
 * stage 0–5 adds fitness gear and gets leaner/stronger; mood changes the face.
 */

const FUR = '#A9825F';
const FUR_DARK = '#8B6847';
const FACE = '#F6E8CF';
const PATCH = '#5B3F2A';
const NOSE = '#3A281C';
const BELLY = '#C9A47F';
const BLUSH = '#F4A39B';
const BAND = '#F26B5B';
const GOLD = '#F2B441';

const SCALE = [0.7, 0.79, 0.86, 0.92, 0.97, 1];
const BODY_RX = [54, 53, 51, 49, 48, 48];
const ARM_RX = [12, 13, 14, 16.5, 17.5, 18];

export function Sloth({ stage, mood, size = 200, eating = false }: { stage: number; mood: Mood; size?: number; eating?: boolean }) {
  const s = SCALE[stage] ?? 1;
  const bodyRx = BODY_RX[stage] ?? 48;
  const armRx = ARM_RX[stage] ?? 16;
  const starving = mood === 'starving';
  const sad = mood === 'veryHungry' || starving;
  const happyEyes = mood === 'ecstatic' || eating;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Sloth pet, ${['baby', 'sprout', 'mover', 'athlete', 'champion', 'legend'][stage]} stage, ${mood === 'veryHungry' ? 'very hungry' : mood}`}
      className={`sloth sloth-${mood}`}
      style={{ overflow: 'visible', filter: starving ? 'saturate(0.45) brightness(1.04)' : undefined }}
    >
      <ellipse cx="100" cy="190" rx={44 * s + 4} ry="6.5" fill="rgba(20,35,26,0.13)" />

      {mood === 'hungry' && (
        <g className="sloth-bubble" aria-hidden="true">
          <circle cx="150" cy="58" r="3.5" fill="#fff" stroke="#DDE2D9" strokeWidth="1.5" />
          <circle cx="160" cy="44" r="5.5" fill="#fff" stroke="#DDE2D9" strokeWidth="1.5" />
          <ellipse cx="176" cy="22" rx="20" ry="15" fill="#fff" stroke="#DDE2D9" strokeWidth="1.5" />
          <path d="M168 27 C170 15 182 12 186 16 C184 26 176 29 168 27 Z" fill="#4CAF63" />
          <path d="M169 26 L183 17" stroke="#2E7D45" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}

      <g transform={`translate(100 190) scale(${s}) translate(-100 -190)`}>
      <g className="sloth-body">
        {/* body */}
        <ellipse cx="100" cy="140" rx={bodyRx} ry="46" fill={FUR} />
        <ellipse cx="100" cy="148" rx={bodyRx - 21} ry="29" fill={BELLY} />
        {stage >= 4 && (
          <g stroke="#B48C66" strokeWidth="2" strokeLinecap="round" opacity="0.9">
            <path d="M100 132 V160" />
            <path d="M89 140 H111" />
            <path d="M90 151 H110" />
          </g>
        )}

        {/* feet */}
        {stage >= 2 ? (
          <g>
            <ellipse cx="76" cy="180" rx="19" ry="10.5" fill="#FFFFFF" stroke="#D5DBD2" strokeWidth="1.5" />
            <ellipse cx="124" cy="180" rx="19" ry="10.5" fill="#FFFFFF" stroke="#D5DBD2" strokeWidth="1.5" />
            <path d="M64 181 Q76 175 88 181" stroke="#1F8A4C" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M112 181 Q124 175 136 181" stroke="#1F8A4C" strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="57" y="185" width="38" height="4" rx="2" fill="#E9ECE6" />
            <rect x="105" y="185" width="38" height="4" rx="2" fill="#E9ECE6" />
          </g>
        ) : (
          <g>
            <ellipse cx="76" cy="180" rx="17" ry="10" fill={FUR_DARK} />
            <ellipse cx="124" cy="180" rx="17" ry="10" fill={FUR_DARK} />
            <g stroke={FACE} strokeWidth="2.2" strokeLinecap="round">
              <path d="M66 183 v4" />
              <path d="M72 184 v4" />
              <path d="M78 184 v4" />
              <path d="M122 184 v4" />
              <path d="M128 184 v4" />
              <path d="M134 183 v4" />
            </g>
          </g>
        )}

        {/* arms */}
        <g className={eating ? 'sloth-arm-eat' : undefined}>
          <ellipse cx="60" cy="140" rx={armRx} ry="27" fill={FUR_DARK} transform="rotate(24 60 140)" />
          <g stroke={FACE} strokeWidth="2.2" strokeLinecap="round">
            <path d="M68 163 l3 5" />
            <path d="M73 161 l4 4" />
            <path d="M63 164 l2 5" />
          </g>
        </g>
        <ellipse cx="140" cy="140" rx={armRx} ry="27" fill={FUR_DARK} transform="rotate(-24 140 140)" />
        <g stroke={FACE} strokeWidth="2.2" strokeLinecap="round">
          <path d="M132 163 l-3 5" />
          <path d="M127 161 l-4 4" />
          <path d="M137 164 l-2 5" />
        </g>
        {stage >= 3 && (
          <g>
            <rect x="60" y="148" width="18" height="8" rx="3" fill={BAND} transform="rotate(24 69 152)" />
            <rect x="122" y="148" width="18" height="8" rx="3" fill={BAND} transform="rotate(-24 131 152)" />
            {/* dumbbell in the right hand */}
            <g className="sloth-dumbbell" transform="rotate(-18 150 168)">
              <rect x="136" y="165" width="30" height="5" rx="2.5" fill="#55615A" />
              <rect x="132" y="158" width="8" height="19" rx="3" fill="#2F3A33" />
              <rect x="162" y="158" width="8" height="19" rx="3" fill="#2F3A33" />
            </g>
          </g>
        )}

        {/* medal */}
        {stage >= 4 && (
          <g>
            <path d="M86 118 L100 142 L114 118" fill="none" stroke="#3C6FD8" strokeWidth="6" strokeLinejoin="round" />
            <circle cx="100" cy="146" r="10" fill={GOLD} stroke="#D99A1E" strokeWidth="2" />
            <path d="M100 140 l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#FFF3C4" />
          </g>
        )}

        {/* head */}
        <circle cx="100" cy="84" r="46" fill={FUR} />
        <path d="M90 41 Q96 30 102 39 Q107 29 112 41" fill={FUR_DARK} />
        <ellipse cx="100" cy="91" rx="36" ry="29" fill={FACE} />
        <ellipse cx="82" cy="91" rx="12.5" ry="7.5" fill={PATCH} transform="rotate(-24 82 91)" />
        <ellipse cx="118" cy="91" rx="12.5" ry="7.5" fill={PATCH} transform="rotate(24 118 91)" />

        {/* headband */}
        {stage >= 1 && (
          <g>
            <path d="M57 70 Q100 46 143 70" fill="none" stroke={BAND} strokeWidth="10" strokeLinecap="round" />
            <path d="M60 69 Q100 47 140 69" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            <path d="M142 70 q10 2 14 10" fill="none" stroke={BAND} strokeWidth="5" strokeLinecap="round" />
            <path d="M142 70 q12 -4 17 2" fill="none" stroke={BAND} strokeWidth="5" strokeLinecap="round" />
          </g>
        )}

        {/* baby leaf sprout */}
        {stage === 0 && (
          <g>
            <path d="M101 40 Q101 30 104 24" stroke="#2E7D45" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M104 25 C108 14 121 14 123 18 C120 28 110 30 104 25 Z" fill="#5DBB6E" />
          </g>
        )}

        {/* crown */}
        {stage >= 5 && (
          <g className="sloth-crown">
            <path d="M74 44 L80 22 L92 36 L100 16 L108 36 L120 22 L126 44 Z" fill={GOLD} stroke="#D99A1E" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="100" cy="34" r="3.5" fill="#F26B5B" />
            <circle cx="84" cy="38" r="2.5" fill="#3C6FD8" />
            <circle cx="116" cy="38" r="2.5" fill="#3C6FD8" />
          </g>
        )}

        {/* eyes */}
        {happyEyes ? (
          <g stroke={FACE} strokeWidth="2.6" fill="none" strokeLinecap="round">
            <path d="M78 90 Q83 83 88 90" />
            <path d="M112 90 Q117 83 122 90" />
          </g>
        ) : starving ? (
          <g stroke={FACE} strokeWidth="2.4" fill="none" strokeLinecap="round">
            <path d="M78 87 Q83 92 88 87" />
            <path d="M112 87 Q117 92 122 87" />
          </g>
        ) : (
          <g className="sloth-eyes">
            <circle cx="84" cy="88" r="4.3" fill="#140E0A" />
            <circle cx="116" cy="88" r="4.3" fill="#140E0A" />
            <circle cx="85.6" cy="86.4" r="1.5" fill="#fff" />
            <circle cx="117.6" cy="86.4" r="1.5" fill="#fff" />
          </g>
        )}
        {sad && (
          <g stroke={PATCH} strokeWidth="2.2" strokeLinecap="round">
            <path d="M76 79 L88 74" />
            <path d="M124 79 L112 74" />
          </g>
        )}

        {/* nose + mouth */}
        <ellipse cx="100" cy="100" rx="6.5" ry="4.6" fill={NOSE} />
        <ellipse cx="98" cy="98.6" rx="2" ry="1.2" fill="#6B5545" />
        {mood === 'ecstatic' || eating ? (
          <g>
            <path d="M91 107 Q100 120 109 107 Z" fill="#7A3434" />
            <path d="M95 112 Q100 117 105 112 Q100 110 95 112 Z" fill="#F08A8A" />
          </g>
        ) : mood === 'happy' ? (
          <path d="M93 107 Q100 113 107 107" stroke={NOSE} strokeWidth="2.3" fill="none" strokeLinecap="round" />
        ) : mood === 'hungry' ? (
          <path d="M92 109 q4 -3 8 0 q4 3 8 0" stroke={NOSE} strokeWidth="2.3" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M93 111 Q100 105 107 111" stroke={NOSE} strokeWidth="2.3" fill="none" strokeLinecap="round" />
        )}

        {/* blush or tear */}
        {(mood === 'happy' || mood === 'ecstatic' || eating) && (
          <g fill={BLUSH} opacity="0.75">
            <ellipse cx="72" cy="103" rx="7" ry="4.3" />
            <ellipse cx="128" cy="103" rx="7" ry="4.3" />
          </g>
        )}
        {starving && <path className="sloth-tear" d="M122 96 q3 5 0 8 q-3 -3 0 -8 Z" fill="#8EC5F2" />}

        {/* eating: a leaf at the mouth */}
        {eating && (
          <g className="sloth-leaf-snack">
            <path d="M104 110 C112 98 128 100 130 104 C124 114 112 116 104 110 Z" fill="#5DBB6E" />
            <path d="M106 109 L126 104" stroke="#2E7D45" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        )}
      </g>
      </g>

      {/* tummy rumbles */}
      {sad && (
        <g className="sloth-rumble" stroke="#B7C2B9" strokeWidth="2.2" fill="none" strokeLinecap="round" aria-hidden="true">
          <path d="M160 132 q4 -4 8 0 q4 4 8 0" />
          <path d="M24 140 q4 -4 8 0 q4 4 8 0" />
        </g>
      )}

      {/* sparkles for happy legends and celebrations */}
      {(mood === 'ecstatic' || stage >= 5) && (
        <g className="sloth-sparkles" fill={GOLD} aria-hidden="true">
          <path d="M34 50 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
          <path d="M166 92 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2z" />
          <path d="M150 30 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8z" />
        </g>
      )}
    </svg>
  );
}
