/** Where a number came from. 'food' = added up from the food diary. */
export type Source = 'manual' | 'health' | 'shortcut' | 'food';

export type Intensity = 'light' | 'normal' | 'hard';

/** One logged activity. A day's workouts are complete when their minutes add up to her daily goal. */
export interface WorkoutEntry {
  id: string;
  /** Activity id from lib/activities.ts ('custom' for her own). */
  activity: string;
  /** Her own name for a custom activity, or the Apple Health / older label. */
  name?: string;
  minutes: number;
  intensity: Intensity;
  /**
   * Her own calorie number, if she ever enters one. Null (the normal case) means it's estimated
   * when shown, from the activity, effort, minutes and her weight on that day.
   */
  kcal?: number | null;
  source?: Source;
  /** Start time of the Apple Health workout this came from. */
  healthId?: string;
}

/** A saved workout she can log in one tap. */
export interface WorkoutFavorite {
  activity: string;
  name?: string;
  minutes: number;
  intensity: Intensity;
}

export type WeightUnit = 'kg' | 'lb' | 'st';

export interface DailyLog {
  log_date: string; // yyyy-MM-dd, local calendar day
  workouts: WorkoutEntry[];
  water_ml: number;
  pages_read: number;
  followed_diet: boolean;
  no_cheat_meal: boolean;
  no_alcohol: boolean;
  steps: number | null;
  steps_source: Source | null;
  calories: number | null;
  calories_source: Source | null;
  notes: string;
  /** The yearly birthday pass was spent on this day: it counts as complete (0004_birthday.sql). */
  birthday_pass?: boolean;
  /** Morning weigh-in, always stored in kg (0010). */
  weight_kg?: number | null;
  /** Storage path of the day's progress photo (0010). */
  photo_path?: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  water_goal_ml: number;
  step_goal: number;
  calorie_goal: number | null;
  /** Legacy: length of each of the two workouts. Replaced by workout_goal_minutes. */
  workout_minutes: number;
  /** Total workout minutes needed per day (0010). Defaults to 90. */
  workout_goal_minutes?: number;
  /** For calorie estimates (0010). */
  height_cm?: number | null;
  /** Daily macro targets in grams; unset = a balanced split of calorie_goal (0012). */
  protein_goal_g?: number | null;
  carbs_goal_g?: number | null;
  fat_goal_g?: number | null;
  /** Daily active-calorie target for the Burned ring; unset = worked out from her goals (0012). */
  active_goal_kcal?: number | null;
  sex?: 'female' | 'male' | null;
  weight_unit?: WeightUnit;
  workout_favorites?: WorkoutFavorite[];
  reading_goal_pages: number;
  steps_required: boolean;
  /** yyyy-MM-dd (0004_birthday.sql). */
  birthday?: string | null;
  /** The birthday year whose pass has been used (0004_birthday.sql). */
  birthday_pass_year?: number | null;
  timezone: string;
  health_sync_token: string;
}

export type ChallengeStatus = 'active' | 'completed' | 'reset';

export interface Challenge {
  id: string;
  start_date: string;
  /** Days 1…n completed before using the app; counted as complete. */
  credited_days: number;
  status: ChallengeStatus;
  ended_on: string | null;
  created_at: string;
  /** The challenge pet's name (column added in 0002_pet.sql). */
  pet_name?: string;
  /** Missed days a treat was spent on (0002_pet.sql). */
  treat_dates?: string[];
  /** Which sloth: 'girl' | 'guy' | 'nb' (0003_pet_style.sql). */
  pet_style?: 'girl' | 'guy' | 'nb';
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export const emptyLog = (date: string): DailyLog => ({
  log_date: date,
  workouts: [],
  water_ml: 0,
  pages_read: 0,
  followed_diet: false,
  no_cheat_meal: false,
  no_alcohol: false,
  steps: null,
  steps_source: null,
  calories: null,
  calories_source: null,
  notes: '',
});

/** Daily workout goal in minutes (90 unless she changed it). */
export const workoutGoal = (p: Pick<Profile, 'workout_goal_minutes' | 'workout_minutes'>) =>
  p.workout_goal_minutes ?? (p.workout_minutes ? p.workout_minutes * 2 : 90);

export const workoutMinutes = (log: Pick<DailyLog, 'workouts'> | undefined) =>
  (log?.workouts ?? []).reduce((a, w) => a + (w.minutes || 0), 0);

// Older logs stored two fixed slots: { done, minutes, type, outdoor }.
const LEGACY_TYPES: Record<string, string> = {
  run: 'run', running: 'run', walk: 'walk', walking: 'walk', strength: 'weights', hiit: 'hiit', cycle: 'cycle_road',
  cycling: 'cycle_road', yoga: 'yoga_vinyasa', pilates: 'pilates_mat', swim: 'swim_laps', swimming: 'swim_laps',
  class: 'circuit', other: 'workout', '': 'workout',
};

function toEntry(raw: unknown, i: number): WorkoutEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  if ('activity' in w) {
    const minutes = Number(w.minutes) || 0;
    if (minutes <= 0) return null;
    return {
      id: String(w.id ?? `w${i}`),
      activity: String(w.activity),
      name: typeof w.name === 'string' ? w.name : undefined,
      minutes,
      intensity: w.intensity === 'light' || w.intensity === 'hard' ? w.intensity : 'normal',
      kcal: typeof w.kcal === 'number' ? w.kcal : null,
      source: (w.source as Source | undefined) ?? 'manual',
      healthId: typeof w.healthId === 'string' ? w.healthId : undefined,
    };
  }
  // Legacy slot
  if (!w.done || !(Number(w.minutes) > 0)) return null;
  const type = typeof w.type === 'string' ? w.type : '';
  return {
    id: `legacy${i}`,
    activity: LEGACY_TYPES[type.toLowerCase()] ?? 'workout',
    name: type && !LEGACY_TYPES[type.toLowerCase()] ? type : undefined,
    minutes: Number(w.minutes),
    intensity: 'normal',
    kcal: null,
    source: (w.source as Source | undefined) ?? 'manual',
    healthId: typeof w.healthId === 'string' ? w.healthId : undefined,
  };
}

/** Normalise a stored row: workouts become a clean list of entries (older two-slot logs convert). */
export function normaliseLog(raw: Partial<DailyLog> & { log_date: string }): DailyLog {
  const base = emptyLog(raw.log_date);
  const list: unknown[] = Array.isArray(raw.workouts) ? raw.workouts : [];
  const { user_id: _u, updated_at: _t, ...rest } = raw as typeof raw & { user_id?: string; updated_at?: string };
  return {
    ...base,
    ...rest,
    notes: rest.notes ?? '',
    weight_kg: rest.weight_kg == null ? null : Number(rest.weight_kg),
    workouts: list.map(toEntry).filter((x): x is WorkoutEntry => !!x),
  };
}
