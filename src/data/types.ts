export type Source = 'manual' | 'health' | 'shortcut';

export interface Workout {
  done: boolean;
  minutes: number;
  type: string;
  outdoor: boolean;
  source?: Source;
  /** Start time of the Apple Health workout this slot was filled from. */
  healthId?: string;
}

export interface DailyLog {
  log_date: string; // yyyy-MM-dd, local calendar day
  workouts: Workout[];
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
}

export interface Profile {
  id: string;
  display_name: string;
  water_goal_ml: number;
  step_goal: number;
  calorie_goal: number | null;
  workout_minutes: number;
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

export const emptyWorkout = (): Workout => ({ done: false, minutes: 0, type: '', outdoor: false });

export const emptyLog = (date: string): DailyLog => ({
  log_date: date,
  workouts: [emptyWorkout(), emptyWorkout()],
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

/** Always returns exactly two workout slots, whatever the stored shape. */
export function normaliseLog(raw: Partial<DailyLog> & { log_date: string }): DailyLog {
  const base = emptyLog(raw.log_date);
  const workouts = Array.isArray(raw.workouts) ? raw.workouts : [];
  const { user_id: _u, updated_at: _t, ...rest } = raw as typeof raw & { user_id?: string; updated_at?: string };
  return {
    ...base,
    ...rest,
    notes: rest.notes ?? '',
    workouts: [0, 1].map((i) => ({ ...emptyWorkout(), ...(workouts[i] ?? {}) })),
  };
}
