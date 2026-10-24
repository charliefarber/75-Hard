import type { Suggestion } from '../../lib/usual';
import { PORTION_SIZES, formatPortions } from '../../lib/mealPrep';
import { tap } from '../../lib/haptics';
import { fmt } from '../ui';
import { IconPlus } from '../Icons';

/** A one-tap option shown as a chip: same as yesterday, a meal-prep portion, a saved meal, a go-to snack. */
export interface QuickOption {
  key: string;
  label: string;
  sub: string;
  onLog: () => void;
}

/**
 * What an empty meal offers: her usual as the main action, everything else as chips.
 * Each one logs in a single tap (with Undo in the toast that follows).
 */
export function MealSuggestions({ usual, onUsual, options }: { usual: Suggestion | null; onUsual: () => void; options: QuickOption[] }) {
  if (!usual && !options.length) return null;
  return (
    <div className="meal-suggest">
      {usual && (
        <div className="usual-card">
          <span className="row-text">
            <span className="usual-tag">Your usual</span>
            <span className="usual-title">{usual.title}</span>
            <span className="row-sub">
              {fmt(usual.kcal)} kcal · {usual.why}
            </span>
          </span>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => (tap(), onUsual())} aria-label={`Log your usual: ${usual.title}, ${fmt(usual.kcal)} kcal`}>
            Log it
          </button>
        </div>
      )}
      {options.length > 0 && (
        <div className="quick-chips">
          {options.map((o) => (
            <button key={o.key} type="button" className="quick-chip" onClick={() => (tap(), o.onLog())} aria-label={`Log ${o.label}: ${o.sub}`}>
              <span className="quick-chip-plus" aria-hidden="true">
                <IconPlus size={14} strokeWidth={3} />
              </span>
              <span className="quick-chip-text">
                <span className="quick-chip-label">{o.label}</span>
                <span className="quick-chip-sub">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ½ · 1 · 1½ portions. */
export function PortionPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="portion-pick" role="group" aria-label={label}>
      {PORTION_SIZES.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} aria-label={`${formatPortions(s)} ${s <= 1 ? 'portion' : 'portions'}`} onClick={() => (tap(), onChange(s))}>
          {formatPortions(s)}
        </button>
      ))}
    </div>
  );
}
