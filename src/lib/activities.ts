import type { Intensity } from '../data/types';

/**
 * Workout library + calorie estimates.
 *
 * Each activity has three MET values (light / normal / hard). A MET is the energy cost of an
 * activity as a multiple of sitting still; values follow the Compendium of Physical Activities
 * where it lists the activity, and sensible neighbours where it doesn't (e.g. reformer Pilates
 * sits between mat Pilates and circuit training).
 *
 * Calories are shown as ACTIVE calories: what the workout burned on top of what her body would
 * have burned at rest in the same time (the same idea as Apple's "active energy"). That's the
 * number that belongs next to "calories eaten", because her resting burn is already part of any
 * daily calorie target.
 *
 *   gross kcal/min = MET × 3.5 ml/kg/min × weight(kg) / 200
 *   resting kcal/min = her resting metabolic rate (Mifflin-St Jeor, from weight, height, age, sex)
 *                      ÷ 1440, or 1 MET if we don't know enough about her yet
 *   active kcal = (gross − resting) × minutes
 */

export type CategoryId =
  | 'studio'
  | 'strength'
  | 'machines'
  | 'walkrun'
  | 'cycling'
  | 'water'
  | 'sports'
  | 'dance'
  | 'combat'
  | 'everyday'
  | 'recovery';

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: 'studio', name: 'Classes' },
  { id: 'strength', name: 'Strength' },
  { id: 'machines', name: 'Cardio machines' },
  { id: 'walkrun', name: 'Walk & run' },
  { id: 'cycling', name: 'Cycling' },
  { id: 'water', name: 'Water' },
  { id: 'sports', name: 'Sports' },
  { id: 'dance', name: 'Dance' },
  { id: 'combat', name: 'Boxing & martial arts' },
  { id: 'everyday', name: 'Everyday' },
  { id: 'recovery', name: 'Recovery' },
];

export interface Activity {
  id: string;
  name: string;
  category: CategoryId;
  /** MET for light, normal, hard. */
  met: [number, number, number];
  /** What light / normal / hard means for this activity (falls back to the talk test). */
  levels?: [string, string, string];
  /** Extra words for search. */
  keywords?: string;
}

const A = (
  id: string,
  name: string,
  category: CategoryId,
  met: [number, number, number],
  levels?: [string, string, string],
  keywords?: string,
): Activity => ({ id, name, category, met, levels, keywords });

export const ACTIVITIES: Activity[] = [
  // Classes
  A('pilates_reformer', 'Reformer Pilates', 'studio', [3.0, 4.0, 5.5], ['Gentle class, light springs', 'Steady class', 'Advanced, jumpboard, little rest'], 'reformer machine'),
  A('pilates_mat', 'Mat Pilates', 'studio', [2.5, 3.0, 4.0], ['Beginner, slow', 'Steady class', 'Advanced, flowing, no breaks']),
  A('lagree', 'Lagree / Megaformer', 'studio', [4.0, 5.0, 6.5], ['Taking it easy', 'Full class', 'Shaking the whole time'], 'megaformer microformer'),
  A('barre', 'Barre', 'studio', [3.0, 3.8, 5.0], ['Gentle', 'Steady class', 'Cardio barre, burning'], 'ballet fitness'),
  A('yoga_hatha', 'Yoga (gentle / hatha)', 'studio', [2.0, 2.5, 3.0], undefined, 'hatha'),
  A('yoga_vinyasa', 'Yoga (vinyasa / power)', 'studio', [3.0, 3.8, 4.5], ['Slow flow', 'Steady flow', 'Power yoga, sweating'], 'flow ashtanga power'),
  A('yoga_hot', 'Hot yoga', 'studio', [2.5, 3.2, 4.0], undefined, 'bikram'),
  A('yoga_yin', 'Yin / restorative yoga', 'studio', [1.8, 2.0, 2.3], undefined, 'restorative'),
  A('spin', 'Spin class', 'studio', [5.5, 7.5, 9.5], ['Easy legs', 'Steady class', 'Sprints and climbs, flat out'], 'indoor cycling peloton soulcycle rpm'),
  A('hiit', 'HIIT', 'studio', [5.5, 8.0, 10.0], ['Long rests', 'Work and rest even', 'All-out intervals'], 'tabata intervals f45'),
  A('bootcamp', 'Bootcamp', 'studio', [5.0, 7.0, 9.0]),
  A('circuit', 'Circuit training', 'studio', [4.3, 6.0, 8.0], ['Light circuits, rests', 'Steady circuits', 'Minimal rest, heavy'], 'circuits'),
  A('pump', 'Pump / weights class', 'studio', [3.5, 5.0, 6.0], undefined, 'bodypump les mills'),
  A('step', 'Step aerobics', 'studio', [5.5, 7.5, 9.5], ['Low step, gentle', '6–8 inch step', '10–12 inch step, fast']),
  A('aerobics', 'Aerobics', 'studio', [4.0, 5.0, 7.3], ['Low impact', 'Mixed', 'High impact']),
  A('zumba', 'Zumba / dance fitness', 'studio', [4.5, 6.0, 7.5], undefined, 'dance cardio'),
  A('kickboxing_class', 'Cardio kickboxing', 'studio', [5.5, 7.0, 9.0], undefined, 'kickbox'),
  A('treadmill_class', 'Treadmill class (e.g. Barry’s)', 'studio', [6.0, 8.0, 10.0], undefined, 'barrys orangetheory'),
  A('rowing_class', 'Rowing class', 'studio', [5.0, 7.0, 9.0], undefined, 'row'),
  A('trx', 'TRX / suspension', 'studio', [3.5, 4.5, 6.0], undefined, 'suspension'),
  A('crossfit', 'CrossFit WOD', 'studio', [6.0, 8.0, 10.0], undefined, 'wod metcon'),
  A('stretch_class', 'Stretch / mobility class', 'studio', [2.0, 2.3, 2.8], undefined, 'mobility'),

  // Strength
  A('weights', 'Weight lifting', 'strength', [3.5, 5.0, 6.0], ['Light weights, long rests', 'Moderate, steady sets', 'Heavy compound lifts, short rests'], 'gym lifting strength free weights machines'),
  A('weights_lower', 'Leg day', 'strength', [3.5, 5.0, 6.5], undefined, 'legs squats lunges glutes'),
  A('weights_upper', 'Upper body day', 'strength', [3.0, 3.8, 5.0], undefined, 'arms back chest shoulders'),
  A('glutes', 'Glute workout', 'strength', [3.0, 4.0, 5.0], undefined, 'booty hip thrusts'),
  A('powerlifting', 'Powerlifting / heavy lifts', 'strength', [4.0, 5.0, 6.0], undefined, 'deadlift squat bench'),
  A('bodyweight', 'Bodyweight training', 'strength', [2.8, 3.8, 6.0], ['Slow reps, rests', 'Steady', 'Fast, jumping moves'], 'calisthenics push ups squats'),
  A('kettlebell', 'Kettlebells', 'strength', [4.5, 6.5, 9.0], undefined, 'swings'),
  A('bands', 'Resistance bands', 'strength', [2.8, 3.5, 4.5], undefined, 'band'),
  A('core', 'Core / abs', 'strength', [2.8, 3.8, 5.0], undefined, 'abs plank'),
  A('calisthenics', 'Pull-ups, dips & bars', 'strength', [4.0, 6.0, 8.0], undefined, 'calisthenics street workout'),

  // Cardio machines
  A('stair_stepper', 'Stair stepper / StairMaster', 'machines', [5.0, 7.0, 9.0], ['Slow, holding the rails', 'Steady pace', 'Fast, no hands'], 'stairmaster stepmill stairs climber'),
  A('elliptical', 'Elliptical / cross trainer', 'machines', [4.0, 5.0, 7.0], undefined, 'cross trainer'),
  A('row_machine', 'Rowing machine', 'machines', [4.8, 7.0, 8.5], ['Easy pace', 'Steady, around 100 W', '150 W and up'], 'erg concept2'),
  A('treadmill_walk', 'Treadmill walk', 'machines', [3.0, 3.8, 5.0], ['About 2.5 mph', 'About 3.5 mph', 'About 4 mph'], 'walking'),
  A('incline_walk', 'Incline treadmill walk', 'machines', [5.0, 6.5, 8.0], ['Low incline', '12-3-30 style', 'Steep and fast'], '12 3 30 hill'),
  A('treadmill_run', 'Treadmill run', 'machines', [8.3, 9.8, 11.8], ['12 min/mile', '10 min/mile', '8 min/mile'], 'running jog'),
  A('exercise_bike', 'Exercise bike', 'machines', [4.8, 6.8, 8.8], ['Easy', 'Steady', 'Hard, sweating'], 'stationary bike'),
  A('recumbent_bike', 'Recumbent bike', 'machines', [3.5, 4.8, 7.0]),
  A('air_bike', 'Air bike / Assault bike', 'machines', [6.0, 9.0, 12.0], undefined, 'assault echo fan bike'),
  A('ski_erg', 'SkiErg', 'machines', [5.0, 7.0, 9.5], undefined, 'ski erg'),
  A('versaclimber', 'VersaClimber', 'machines', [6.0, 8.5, 11.0]),
  A('jump_rope', 'Jump rope', 'machines', [8.8, 11.0, 12.3], ['Slow, breaks', 'Steady', 'Fast'], 'skipping'),

  // Walk & run
  A('walk', 'Walking', 'walkrun', [2.8, 3.5, 5.0], ['Strolling, about 2 mph', 'Normal pace, about 3 mph', 'Brisk, about 4 mph'], 'walk'),
  A('walk_hill', 'Hill walk', 'walkrun', [4.5, 5.3, 8.0], undefined, 'uphill'),
  A('dog_walk', 'Dog walk', 'walkrun', [2.5, 3.0, 3.8], undefined, 'dog'),
  A('hike', 'Hiking', 'walkrun', [5.3, 6.0, 7.8], ['Easy trail', 'Hilly trail', 'Steep, with a pack'], 'trail'),
  A('run', 'Running', 'walkrun', [8.3, 9.8, 11.8], ['12 min/mile (7:30/km)', '10 min/mile (6:15/km)', '8 min/mile (5:00/km)'], 'jog run'),
  A('trail_run', 'Trail running', 'walkrun', [7.5, 9.0, 11.0]),
  A('sprints', 'Sprint intervals', 'walkrun', [8.0, 10.0, 13.0], undefined, 'intervals track'),
  A('stairs', 'Stair climbing (real stairs)', 'walkrun', [4.0, 6.0, 8.8], undefined, 'steps'),

  // Cycling
  A('cycle_road', 'Cycling (outdoor)', 'cycling', [4.0, 6.8, 10.0], ['Leisurely, under 10 mph', 'Steady, 10–13 mph', 'Fast, 14 mph and up'], 'bike road'),
  A('cycle_commute', 'Bike commute', 'cycling', [4.0, 6.0, 8.0], undefined, 'cycling'),
  A('mtb', 'Mountain biking', 'cycling', [6.5, 8.5, 12.0], undefined, 'mtb'),
  A('ebike', 'E-bike', 'cycling', [2.5, 3.5, 4.5], undefined, 'electric'),

  // Water
  A('swim_laps', 'Swimming laps', 'water', [5.8, 8.3, 9.8], ['Easy freestyle', 'Steady laps', 'Fast laps'], 'swim pool'),
  A('swim_leisure', 'Swimming (casual)', 'water', [4.5, 6.0, 7.0], undefined, 'swim'),
  A('open_water', 'Open water swim', 'water', [6.0, 8.0, 10.0], undefined, 'sea lake swim'),
  A('aqua_aerobics', 'Aqua aerobics', 'water', [4.0, 5.3, 6.5], undefined, 'water aerobics aqua fit'),
  A('paddleboard', 'Paddleboarding', 'water', [4.0, 6.0, 8.0], undefined, 'sup'),
  A('kayak', 'Kayaking', 'water', [3.5, 5.0, 8.0], undefined, 'canoe'),
  A('surf', 'Surfing', 'water', [3.0, 4.0, 5.0], undefined, 'surf'),

  // Sports
  A('tennis', 'Tennis', 'sports', [5.0, 7.3, 8.0], ['Doubles, casual', 'Singles rally', 'Competitive singles']),
  A('padel', 'Padel', 'sports', [4.5, 6.0, 7.5]),
  A('pickleball', 'Pickleball', 'sports', [3.5, 4.5, 6.0]),
  A('squash', 'Squash', 'sports', [7.3, 9.0, 12.0]),
  A('badminton', 'Badminton', 'sports', [4.5, 5.5, 7.0]),
  A('table_tennis', 'Table tennis', 'sports', [3.0, 4.0, 5.5], undefined, 'ping pong'),
  A('golf', 'Golf (walking)', 'sports', [3.5, 4.3, 4.8], undefined, 'golf'),
  A('soccer', 'Football / soccer', 'sports', [5.0, 7.0, 10.0], undefined, 'football'),
  A('basketball', 'Basketball', 'sports', [4.5, 6.5, 8.0]),
  A('netball', 'Netball', 'sports', [5.0, 6.5, 8.0]),
  A('volleyball', 'Volleyball', 'sports', [3.0, 4.0, 6.0], undefined, 'beach volleyball'),
  A('hockey', 'Hockey', 'sports', [5.5, 7.8, 9.0]),
  A('rugby', 'Rugby', 'sports', [6.3, 8.3, 10.0]),
  A('softball', 'Softball / baseball', 'sports', [3.0, 5.0, 6.0], undefined, 'baseball rounders'),
  A('climbing', 'Climbing / bouldering', 'sports', [5.0, 5.8, 7.5], undefined, 'bouldering rock'),
  A('ski', 'Skiing', 'sports', [4.3, 5.3, 8.0], undefined, 'ski'),
  A('xc_ski', 'Cross-country skiing', 'sports', [6.8, 9.0, 12.5], undefined, 'nordic'),
  A('snowboard', 'Snowboarding', 'sports', [4.3, 5.3, 8.0]),
  A('skate', 'Ice skating', 'sports', [5.5, 7.0, 9.0]),
  A('rollerblade', 'Roller skating / blading', 'sports', [5.5, 7.0, 9.8], undefined, 'inline'),
  A('horse', 'Horse riding', 'sports', [3.8, 5.5, 7.3], undefined, 'equestrian'),
  A('frisbee', 'Ultimate frisbee', 'sports', [5.0, 8.0, 10.0]),

  // Dance
  A('dance', 'Dancing', 'dance', [3.0, 5.0, 7.0], ['Slow', 'Steady', 'Fast, non-stop'], 'party'),
  A('ballet', 'Ballet / contemporary', 'dance', [4.0, 5.0, 6.8]),
  A('hip_hop', 'Hip hop / street dance', 'dance', [4.5, 6.0, 7.5]),
  A('salsa', 'Salsa / Latin', 'dance', [3.5, 5.0, 7.0], undefined, 'bachata latin'),
  A('pole', 'Pole fitness', 'dance', [3.5, 4.5, 6.0], undefined, 'pole'),
  A('trampoline', 'Trampoline fitness', 'dance', [3.5, 4.5, 6.5], undefined, 'rebounder'),

  // Boxing & martial arts
  A('boxing_bag', 'Boxing (bag work)', 'combat', [5.5, 7.0, 9.0], undefined, 'punching bag'),
  A('boxing_spar', 'Boxing (sparring)', 'combat', [7.8, 9.0, 12.8], undefined, 'spar'),
  A('muay_thai', 'Muay Thai / kickboxing', 'combat', [5.3, 7.5, 10.3], undefined, 'kickboxing'),
  A('bjj', 'BJJ / grappling', 'combat', [5.3, 7.5, 10.3], undefined, 'jiu jitsu wrestling'),
  A('karate', 'Karate / taekwondo', 'combat', [5.3, 7.5, 10.3], undefined, 'martial arts judo'),

  // Everyday
  A('cleaning', 'Cleaning (proper workout)', 'everyday', [2.5, 3.5, 4.0], undefined, 'housework'),
  A('gardening', 'Gardening', 'everyday', [2.5, 3.8, 5.0], undefined, 'garden'),
  A('mowing', 'Mowing the lawn', 'everyday', [4.0, 5.5, 6.0], undefined, 'lawn'),
  A('moving', 'Moving / carrying boxes', 'everyday', [3.5, 5.8, 7.5], undefined, 'lifting carrying'),
  A('kids', 'Playing with kids', 'everyday', [2.5, 4.0, 5.8], undefined, 'children'),

  // Recovery
  A('stretching', 'Stretching', 'recovery', [2.0, 2.3, 2.8], undefined, 'stretch'),
  A('foam_rolling', 'Foam rolling / mobility', 'recovery', [2.0, 2.3, 2.8], undefined, 'mobility'),
  A('tai_chi', 'Tai chi / qigong', 'recovery', [2.5, 3.0, 4.0]),
  A('physio', 'Physio exercises', 'recovery', [2.5, 3.0, 3.5], undefined, 'rehab'),

  // Catch-alls
  A('workout', 'Workout', 'strength', [3.5, 5.0, 7.0], undefined, 'general other'),
];

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

/** A custom activity she names herself uses general workout values. */
export const CUSTOM_ID = 'custom';

export function activityById(id: string): Activity {
  return BY_ID.get(id) ?? { ...BY_ID.get('workout')!, id, name: id === CUSTOM_ID ? 'Custom workout' : 'Workout' };
}

export const INTENSITIES: { id: Intensity; label: string; talk: string }[] = [
  { id: 'light', label: 'Light', talk: 'Easy. You could chat the whole time.' },
  { id: 'normal', label: 'Normal', talk: 'Working. A bit out of breath.' },
  { id: 'hard', label: 'Hard', talk: 'Pushing. Only a few words at a time.' },
];

export const intensityIndex = (i: Intensity) => (i === 'light' ? 0 : i === 'hard' ? 2 : 1);

export function levelText(a: Activity, i: Intensity): string {
  return a.levels?.[intensityIndex(i)] ?? INTENSITIES[intensityIndex(i)].talk;
}

/** Search by name, keyword or category; every word must match somewhere. */
export function searchActivities(q: string): Activity[] {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ACTIVITIES;
  return ACTIVITIES.filter((a) => {
    const hay = `${a.name} ${a.keywords ?? ''} ${CATEGORIES.find((c) => c.id === a.category)?.name ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// ---------------------------------------------------------------- calories

export interface BodyStats {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: 'female' | 'male' | null;
}

/** Used until she logs a weight. */
export const FALLBACK_WEIGHT_KG = 65;

/** Resting metabolic rate, kcal/day (Mifflin-St Jeor). Null if we're missing something. */
export function restingKcalPerDay(b: BodyStats): number | null {
  if (!b.weightKg || !b.heightCm || !b.ageYears || !b.sex) return null;
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.ageYears;
  return b.sex === 'female' ? base - 161 : base + 5;
}

/** Active calories for a session, rounded to the nearest whole kcal. */
export function activeKcal(met: number, minutes: number, b: BodyStats): number {
  const kg = b.weightKg || FALLBACK_WEIGHT_KG;
  const grossPerMin = (met * 3.5 * kg) / 200;
  const rmr = restingKcalPerDay({ ...b, weightKg: kg });
  const restPerMin = rmr ? rmr / 1440 : (3.5 * kg) / 200;
  return Math.max(0, Math.round((grossPerMin - restPerMin) * Math.max(0, minutes)));
}

export function estimateKcal(activityId: string, intensity: Intensity, minutes: number, b: BodyStats): number {
  return activeKcal(activityById(activityId).met[intensityIndex(intensity)], minutes, b);
}

/** How complete her details are for calorie estimates, for a gentle nudge in the UI. */
export function bodyStatsMissing(b: BodyStats): ('weight' | 'height' | 'age' | 'sex')[] {
  const out: ('weight' | 'height' | 'age' | 'sex')[] = [];
  if (!b.weightKg) out.push('weight');
  if (!b.heightCm) out.push('height');
  if (!b.ageYears) out.push('age');
  if (!b.sex) out.push('sex');
  return out;
}
