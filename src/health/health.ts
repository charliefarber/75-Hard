import { Capacitor } from '@capacitor/core';
import { addDays, parseISO, startOfDay } from 'date-fns';
import { toISODate } from '../lib/challenge';

/**
 * Apple Health (HealthKit) integration, available when the app runs as the
 * native iOS build (Capacitor). Lifesum writes the food you log to Apple
 * Health as "Dietary Energy", so reading that gives us Lifesum calories
 * without needing a Lifesum API.
 *
 * In a normal browser HealthKit isn't reachable; the web version uses the
 * iPhone Shortcut bridge (see Profile → Apple Health) or manual entry.
 */

export interface HealthWorkout {
  type: string;
  minutes: number;
  outdoor: boolean;
  start: string;
}

export interface HealthDay {
  date: string;
  steps?: number;
  calories?: number;
  waterMl?: number;
  workouts: HealthWorkout[];
}

const READ_TYPES = ['steps', 'dietaryEnergyConsumed', 'dietaryWater', 'workouts'] as const;

export const isNativeIOS = () => Capacitor.getPlatform() === 'ios';

async function plugin() {
  const mod = await import('@capgo/capacitor-health');
  return mod.Health;
}

export async function healthAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await (await plugin()).isAvailable();
    return res.available;
  } catch {
    return false;
  }
}

export async function requestHealthAccess(): Promise<boolean> {
  const h = await plugin();
  const status = await h.requestAuthorization({ read: [...READ_TYPES] });
  // HealthKit never reveals whether *read* access was denied (privacy), so we
  // treat "the sheet was shown" as connected and simply get empty data if not.
  return status.readDenied.length < READ_TYPES.length;
}

const OUTDOOR_TYPES = new Set([
  'running', 'walking', 'hiking', 'cycling', 'golf', 'skiing', 'snowboarding', 'surfing', 'paddleSports',
  'rowing', 'soccer', 'tennis', 'crossCountrySkiing', 'downhillSkiing', 'sailing', 'swimmingOpenWater', 'trackAndField',
]);

const PRETTY: Record<string, string> = {
  traditionalStrengthTraining: 'Strength',
  functionalStrengthTraining: 'Strength',
  highIntensityIntervalTraining: 'HIIT',
  mixedCardio: 'Cardio',
  coreTraining: 'Core',
  runningTreadmill: 'Treadmill run',
  bikingStationary: 'Indoor cycle',
};

export function prettyWorkoutType(t: string): string {
  if (PRETTY[t]) return PRETTY[t];
  const spaced = t.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isOutdoor(type: string, metadata?: Record<string, string>): boolean {
  const indoor = metadata?.HKIndoorWorkout ?? metadata?.indoor;
  if (indoor !== undefined) return !(indoor === '1' || indoor === 'true');
  return OUTDOOR_TYPES.has(type);
}

/** Read per-day totals for [from, to] inclusive (local dates). */
export async function readHealthDays(from: string, to: string): Promise<HealthDay[]> {
  const h = await plugin();
  const startDate = startOfDay(parseISO(from)).toISOString();
  const endDate = startOfDay(addDays(parseISO(to), 1)).toISOString();

  const days = new Map<string, HealthDay>();
  const day = (iso: string) => {
    const key = toISODate(new Date(iso));
    if (!days.has(key)) days.set(key, { date: key, workouts: [] });
    return days.get(key)!;
  };

  const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };

  const [steps, energy, water, workouts] = await Promise.all([
    safe(h.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' })),
    safe(h.queryAggregated({ dataType: 'dietaryEnergyConsumed', startDate, endDate, bucket: 'day', aggregation: 'sum' })),
    safe(h.queryAggregated({ dataType: 'dietaryWater', startDate, endDate, bucket: 'day', aggregation: 'sum' })),
    safe(h.queryWorkouts({ startDate, endDate, limit: 200, ascending: true })),
  ]);

  steps?.samples.forEach((s) => (day(s.startDate).steps = Math.round(s.value)));
  energy?.samples.forEach((s) => {
    if (s.value > 0) day(s.startDate).calories = Math.round(s.value);
  });
  water?.samples.forEach((s) => {
    const ml = s.unit === 'liter' ? s.value * 1000 : s.value;
    if (ml > 0) day(s.startDate).waterMl = Math.round(ml);
  });
  workouts?.workouts.forEach((w) =>
    day(w.startDate).workouts.push({
      type: prettyWorkoutType(w.workoutType),
      minutes: Math.round(w.duration / 60),
      outdoor: isOutdoor(w.workoutType, w.metadata),
      start: w.startDate,
    }),
  );

  return [...days.values()];
}
