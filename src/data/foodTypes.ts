export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

/** Nutrition for some amount of food. Anything but calories can be unknown. */
export interface Nutrition {
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  sugar?: number | null;
  satFat?: number | null;
  salt?: number | null;
}

export interface Serving {
  /** e.g. "1 medium", "1 slice", "1 serving", "1 tbsp". */
  label: string;
  /** Grams (or ml) in one of these. */
  grams: number;
}

export type FoodSource = 'basic' | 'off' | 'custom';

/** A food she can log: built-in basics, a product from Open Food Facts, or one she made. */
export interface Food {
  /** 'basic:banana' | 'off:5000168001142' | 'custom:<id>' */
  key: string;
  name: string;
  brand?: string;
  source: FoodSource;
  /** Nutrition per 100 g (or 100 ml). */
  per100: Nutrition;
  /** 'ml' for drinks. */
  base: 'g' | 'ml';
  servings: Serving[];
  /** The serving to start with (index into servings); grams when absent. */
  defaultServing?: number;
  barcode?: string;
  /** Small product photo (Open Food Facts). */
  image?: string;
}

export type EntrySource = FoodSource | 'quick' | 'photo' | 'describe' | 'meal';

/** One thing she ate. Nutrition is stored for the amount eaten. */
export interface FoodEntry {
  id: string;
  log_date: string;
  meal: Meal;
  name: string;
  brand?: string | null;
  food_key?: string | null;
  /** How many of `unit`: 1.5 (servings), 150 (g)… */
  amount: number;
  /** 'g' | 'ml' | a serving label like '1 medium' | 'portion' */
  unit: string;
  grams?: number | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sat_fat_g?: number | null;
  salt_g?: number | null;
  source: EntrySource;
  /** The food as it was when logged, so the amount can be changed later. */
  food?: Food | null;
  created_at?: string;
}

/** Her library: favourites, foods she made, and everything she's logged before. */
export interface MyFood {
  id: string;
  key: string;
  food: Food;
  favorite: boolean;
  custom: boolean;
  uses: number;
  last_amount: number | null;
  last_unit: string | null;
  last_meal: Meal | null;
  last_used: string | null;
}

/** A saved meal: one tap logs every item. */
export interface SavedMeal {
  id: string;
  name: string;
  items: Omit<FoodEntry, 'id' | 'log_date' | 'meal' | 'created_at'>[];
  uses: number;
  last_used: string | null;
  /** The meals it's offered at as a one-tap suggestion (empty or missing: only under Saved meals). */
  slots?: Meal[] | null;
}

/** A batch she cooked (meal prep): what went in, split into equal portions that count down as she eats them. */
export interface MealPrep {
  id: string;
  name: string;
  items: SavedMeal['items'];
  /** How many portions the batch was split into. */
  portions: number;
  /** Portions not eaten yet (can be a half). */
  portions_left: number;
  /** The day it was made, yyyy-MM-dd. */
  made_on: string;
  created_at?: string;
}

/** What the photo / description estimate sends back for each item. */
export interface EstimatedItem {
  name: string;
  /** e.g. "1 cup", "2 slices", "a large bowl" */
  portion: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 0–1, how sure the model is. */
  confidence: number;
}
