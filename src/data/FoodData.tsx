import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, parseISO } from 'date-fns';
import { useApp } from './AppData';
import type { EstimateRequest } from './repo';
import type { EstimatedItem, Food, FoodEntry, Meal, MealPrep, MyFood, SavedMeal } from './foodTypes';
import { toISODate } from '../lib/challenge';
import { newId, quickEntry, totals } from '../lib/nutrition';
import type { OffProxy } from '../lib/off';
import { portionEntry, prepIdOf, withPortionsLeft } from '../lib/mealPrep';

/**
 * The food diary: what she ate (by day), her food library (favourites, her own foods,
 * everything she's logged before) and saved meals. Every change is shown at once and saved
 * in the background; the day's calories in daily_logs follow the diary, so Today, the rings
 * and the weekly recap all see the same number.
 *
 * Meal prep: batches she cooked, split into portions. A portion in the diary points back at its
 * batch (food key "prep:<id>"), and the batch counts down however the portion got there or left:
 * logged, copied, changed, deleted or undone.
 */

interface FoodState {
  ready: boolean;
  entriesFor(date: string): FoodEntry[];
  isLoaded(date: string): boolean;
  /** Load these days if they aren't loaded yet. */
  ensure(from: string, to: string): Promise<void>;
  myFoods: MyFood[];
  savedMeals: SavedMeal[];
  add(entries: FoodEntry[]): Promise<void>;
  update(entry: FoodEntry): Promise<void>;
  /** Removes entries and returns them (for undo). */
  remove(ids: string[]): Promise<FoodEntry[]>;
  restore(entries: FoodEntry[]): Promise<void>;
  toggleFavorite(food: Food): Promise<void>;
  saveCustomFood(food: Food): Promise<void>;
  forgetFood(id: string): Promise<void>;
  /** `slots`: the meals to offer it at as a one-tap suggestion. */
  saveMeal(name: string, entries: FoodEntry[], slots?: Meal[]): Promise<void>;
  logMeal(meal: SavedMeal, date: string, slot: Meal): Promise<FoodEntry[]>;
  deleteMeal(id: string): Promise<void>;
  mealPreps: MealPrep[];
  /** Save a new batch; with `logNow`, one portion goes straight into the diary (returned for undo). */
  addMealPrep(prep: MealPrep, logNow?: { date: string; meal: Meal } | null): Promise<FoodEntry[]>;
  /** Log `size` portions of a batch (½, 1, 1½…); returns the diary entry, for undo. */
  logPrep(prep: MealPrep, size: number, date: string, meal: Meal): Promise<FoodEntry[]>;
  /** Removes a batch and returns it (for undo). Portions already in the diary stay there. */
  deleteMealPrep(id: string): Promise<MealPrep | null>;
  restoreMealPrep(prep: MealPrep): Promise<void>;
  estimate(req: EstimateRequest): Promise<{ items: EstimatedItem[]; note: string }>;
  /** Photo / description estimates are available (null until known; assume yes). */
  ai: boolean | null;
  offProxy: OffProxy;
}

const Ctx = createContext<FoodState | null>(null);

export function useFood(): FoodState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFood outside provider');
  return v;
}

const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = toISODate(addDays(parseISO(d), 1))) out.push(d);
  return out;
};

const stripEntryForMeal = ({ id: _i, log_date: _d, meal: _m, created_at: _c, ...rest }: FoodEntry) => rest;

export function FoodDataProvider({ children }: { children: ReactNode }) {
  const { repo, status, user, today, logsRef, updateLog, reportError } = useApp();
  const [byDate, setByDate] = useState<Record<string, FoodEntry[]>>({});
  const [myFoods, setMyFoods] = useState<MyFood[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPreps, setMealPreps] = useState<MealPrep[]>([]);
  const mealPrepsRef = useRef(mealPreps);
  mealPrepsRef.current = mealPreps;
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const loaded = useRef(new Set<string>());
  const byDateRef = useRef(byDate);
  byDateRef.current = byDate;
  const myFoodsRef = useRef(myFoods);
  myFoodsRef.current = myFoods;

  // Start fresh for each account.
  useEffect(() => {
    loaded.current = new Set();
    setByDate({});
    setMyFoods([]);
    setSavedMeals([]);
    setMealPreps([]);
    setReady(false);
    setAi(null);
  }, [user?.id]);

  // Are photo / description estimates switched on? Asked once per session.
  useEffect(() => {
    if (status !== 'ready' || !user) return;
    let live = true;
    repo
      .foodStatus()
      .then((s) => live && s && setAi(s.ai))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [status, user, repo]);

  const ensure = useCallback(
    async (from: string, to: string) => {
      const missing = daysBetween(from, to).filter((d) => !loaded.current.has(d));
      if (!missing.length) return;
      missing.forEach((d) => loaded.current.add(d));
      try {
        const rows = await repo.getFoodEntries(missing[0], missing[missing.length - 1]);
        setByDate((prev) => {
          const next = { ...prev };
          for (const d of missing) next[d] = prev[d] ?? [];
          for (const r of rows) if (missing.includes(r.log_date) && !next[r.log_date].some((x) => x.id === r.id)) next[r.log_date] = [...next[r.log_date], r];
          return next;
        });
      } catch (e) {
        missing.forEach((d) => loaded.current.delete(d));
        reportError(e);
      }
    },
    [repo, reportError],
  );

  useEffect(() => {
    if (status !== 'ready' || !user) return;
    let live = true;
    (async () => {
      try {
        const [foods, meals, preps] = await Promise.all([
          repo.getMyFoods(),
          repo.getSavedMeals(),
          repo.getMealPreps(),
          ensure(toISODate(addDays(parseISO(today), -13)), today),
        ]);
        if (!live) return;
        setMyFoods(foods);
        setSavedMeals(meals);
        mealPrepsRef.current = preps;
        setMealPreps(preps);
      } catch (e) {
        reportError(e);
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [status, user, repo, today, ensure, reportError]);

  /** Keep the day's calories in daily_logs in step with the diary. */
  const syncDay = useCallback(
    (date: string, list: FoodEntry[]) => {
      const kcal = Math.round(totals(list).kcal);
      updateLog(date, (l) =>
        list.length
          ? { ...l, calories: kcal, calories_source: 'food' }
          : l.calories_source === 'food'
            ? { ...l, calories: null, calories_source: null }
            : l,
      );
    },
    [updateLog],
  );

  /** Remember what she logged: recents, last amounts, how often. */
  const remember = useCallback(
    (entries: FoodEntry[]) => {
      const now = new Date().toISOString();
      const changed: MyFood[] = [];
      const list = [...myFoodsRef.current];
      for (const e of entries) {
        if (!e.food || prepIdOf(e)) continue; // meal-prep portions don't belong in Recent
        const i = list.findIndex((f) => f.key === e.food!.key);
        const prev = i >= 0 ? list[i] : null;
        const next: MyFood = {
          id: prev?.id ?? newId(),
          key: e.food.key,
          food: e.food,
          favorite: prev?.favorite ?? false,
          custom: prev?.custom ?? false,
          uses: (prev?.uses ?? 0) + 1,
          last_amount: e.amount,
          last_unit: e.unit,
          last_meal: e.meal,
          last_used: now,
        };
        if (i >= 0) list[i] = next;
        else list.unshift(next);
        changed.push(next);
      }
      if (!changed.length) return;
      list.sort((a, b) => (b.last_used ?? '').localeCompare(a.last_used ?? ''));
      setMyFoods(list);
      repo.saveMyFoods(changed).catch(() => {}); // recents are a nicety; never block logging
    },
    [repo],
  );

  /**
   * Count meal-prep portions down (sign 1) or back up (sign −1) for these diary entries, and
   * save the batches that changed. Entries that aren't portions are ignored.
   */
  const shiftPreps = useCallback(
    (entries: Pick<FoodEntry, 'food_key' | 'amount'>[], sign: 1 | -1) => {
      const deltas = new Map<string, number>();
      for (const e of entries) {
        const id = prepIdOf(e);
        if (id) deltas.set(id, (deltas.get(id) ?? 0) + sign * e.amount);
      }
      if (!deltas.size) return;
      const changed: MealPrep[] = [];
      const next = mealPrepsRef.current.map((p) => {
        const d = deltas.get(p.id);
        if (!d) return p;
        const q = withPortionsLeft(p, d);
        if (q.portions_left !== p.portions_left) changed.push(q);
        return q;
      });
      if (!changed.length) return;
      mealPrepsRef.current = next;
      setMealPreps(next);
      for (const p of changed) repo.saveMealPrep(p).catch(reportError);
    },
    [repo, reportError],
  );

  const add = useCallback(
    async (entries: FoodEntry[]) => {
      if (!entries.length) return;
      const dates = [...new Set(entries.map((e) => e.log_date))];
      const extra: FoodEntry[] = [];
      for (const d of dates) {
        // First thing logged in the diary on a day Lifesum (or a typed number) already filled in:
        // keep that number as a quick add so the day's total doesn't drop.
        const existing = byDateRef.current[d] ?? [];
        const log = logsRef.current[d];
        if (!existing.length && log?.calories && log.calories > 0 && log.calories_source && log.calories_source !== 'food') {
          const q = quickEntry({ name: log.calories_source === 'manual' ? 'Calories typed in earlier' : 'Logged in Lifesum', kcal: log.calories }, 'snacks', d);
          extra.push({ ...q, food: null, food_key: null });
        }
      }
      const all = [...extra, ...entries];
      const before = byDateRef.current;
      const next = { ...before };
      for (const e of all) next[e.log_date] = [...(next[e.log_date] ?? []), e];
      byDateRef.current = next;
      setByDate(next);
      for (const d of dates) syncDay(d, next[d]);
      remember(entries);
      shiftPreps(entries, 1);
      try {
        await repo.saveFoodEntries(all);
      } catch (e) {
        byDateRef.current = before;
        setByDate(before);
        for (const d of dates) syncDay(d, before[d] ?? []);
        shiftPreps(entries, -1);
        reportError(e);
        throw e;
      }
    },
    [repo, logsRef, syncDay, remember, shiftPreps, reportError],
  );

  const update = useCallback(
    async (entry: FoodEntry) => {
      const before = byDateRef.current;
      const old = Object.values(before).flat().find((e) => e.id === entry.id);
      const next = { ...before };
      if (old && old.log_date !== entry.log_date) next[old.log_date] = (next[old.log_date] ?? []).filter((e) => e.id !== entry.id);
      const list = next[entry.log_date] ?? [];
      next[entry.log_date] = list.some((e) => e.id === entry.id) ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry];
      byDateRef.current = next;
      setByDate(next);
      syncDay(entry.log_date, next[entry.log_date]);
      if (old && old.log_date !== entry.log_date) syncDay(old.log_date, next[old.log_date]);
      if (entry.food && old?.food && (old.amount !== entry.amount || old.unit !== entry.unit)) remember([entry]);
      // ½ → 1 portion of a meal prep: the batch follows
      if (old && prepIdOf(old) && prepIdOf(old) === prepIdOf(entry)) shiftPreps([{ food_key: entry.food_key, amount: entry.amount - old.amount }], 1);
      try {
        await repo.saveFoodEntries([entry]);
      } catch (e) {
        byDateRef.current = before;
        setByDate(before);
        if (old && prepIdOf(old) && prepIdOf(old) === prepIdOf(entry)) shiftPreps([{ food_key: entry.food_key, amount: entry.amount - old.amount }], -1);
        reportError(e);
      }
    },
    [repo, syncDay, remember, shiftPreps, reportError],
  );

  const remove = useCallback(
    async (ids: string[]) => {
      const before = byDateRef.current;
      const removed = Object.values(before).flat().filter((e) => ids.includes(e.id));
      if (!removed.length) return [];
      const next = { ...before };
      const dates = [...new Set(removed.map((e) => e.log_date))];
      for (const d of dates) next[d] = (next[d] ?? []).filter((e) => !ids.includes(e.id));
      byDateRef.current = next;
      setByDate(next);
      for (const d of dates) syncDay(d, next[d]);
      shiftPreps(removed, -1); // a deleted portion goes back into its batch
      try {
        await repo.deleteFoodEntries(ids);
      } catch (e) {
        byDateRef.current = before;
        setByDate(before);
        for (const d of dates) syncDay(d, before[d]);
        shiftPreps(removed, 1);
        reportError(e);
      }
      return removed;
    },
    [repo, syncDay, shiftPreps, reportError],
  );

  const restore = useCallback(
    async (entries: FoodEntry[]) => {
      const next = { ...byDateRef.current };
      const back = entries.filter((e) => !(next[e.log_date] ?? []).some((x) => x.id === e.id));
      shiftPreps(back, 1);
      for (const e of entries) if (!(next[e.log_date] ?? []).some((x) => x.id === e.id)) next[e.log_date] = [...(next[e.log_date] ?? []), e];
      for (const d of Object.keys(next)) next[d] = [...next[d]].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
      byDateRef.current = next;
      setByDate(next);
      for (const d of new Set(entries.map((e) => e.log_date))) syncDay(d, next[d]);
      try {
        await repo.saveFoodEntries(entries);
      } catch (e) {
        reportError(e);
      }
    },
    [repo, syncDay, shiftPreps, reportError],
  );

  const upsertMyFood = useCallback(
    async (key: string, change: (prev: MyFood | null) => MyFood | null) => {
      const list = [...myFoodsRef.current];
      const i = list.findIndex((f) => f.key === key);
      const next = change(i >= 0 ? list[i] : null);
      if (!next) return;
      if (i >= 0) list[i] = next;
      else list.unshift(next);
      setMyFoods(list);
      try {
        await repo.saveMyFoods([next]);
      } catch (e) {
        reportError(e);
      }
    },
    [repo, reportError],
  );

  const toggleFavorite = useCallback(
    (food: Food) =>
      upsertMyFood(food.key, (prev) => ({
        id: prev?.id ?? newId(),
        key: food.key,
        food: prev?.food ?? food,
        favorite: !prev?.favorite,
        custom: prev?.custom ?? food.key.startsWith('custom:'),
        uses: prev?.uses ?? 0,
        last_amount: prev?.last_amount ?? null,
        last_unit: prev?.last_unit ?? null,
        last_meal: prev?.last_meal ?? null,
        last_used: prev?.last_used ?? null,
      })),
    [upsertMyFood],
  );

  const saveCustomFood = useCallback(
    (food: Food) =>
      upsertMyFood(food.key, (prev) => ({
        id: prev?.id ?? newId(),
        key: food.key,
        food,
        favorite: prev?.favorite ?? false,
        custom: true,
        uses: prev?.uses ?? 0,
        last_amount: prev?.last_amount ?? null,
        last_unit: prev?.last_unit ?? null,
        last_meal: prev?.last_meal ?? null,
        last_used: prev?.last_used ?? new Date().toISOString(),
      })),
    [upsertMyFood],
  );

  const forgetFood = useCallback(
    async (id: string) => {
      setMyFoods((l) => l.filter((f) => f.id !== id));
      try {
        await repo.deleteMyFood(id);
      } catch (e) {
        reportError(e);
      }
    },
    [repo, reportError],
  );

  const saveMeal = useCallback(
    async (name: string, entries: FoodEntry[], slots?: Meal[]) => {
      const meal: SavedMeal = {
        id: newId(),
        name: name.trim().slice(0, 60),
        items: entries.map(stripEntryForMeal),
        uses: 0,
        last_used: new Date().toISOString(),
        slots: slots?.length ? slots : null,
      };
      setSavedMeals((l) => [meal, ...l]);
      try {
        await repo.saveSavedMeal(meal);
      } catch (e) {
        setSavedMeals((l) => l.filter((m) => m.id !== meal.id));
        reportError(e);
      }
    },
    [repo, reportError],
  );

  const logMeal = useCallback(
    async (meal: SavedMeal, date: string, slot: Meal) => {
      const entries: FoodEntry[] = meal.items.map((it) => ({ ...it, id: newId(), log_date: date, meal: slot }));
      const used = { ...meal, uses: meal.uses + 1, last_used: new Date().toISOString() };
      setSavedMeals((l) => [used, ...l.filter((m) => m.id !== meal.id)]);
      repo.saveSavedMeal(used).catch(() => {});
      await add(entries);
      return entries;
    },
    [repo, add],
  );

  const deleteMeal = useCallback(
    async (id: string) => {
      setSavedMeals((l) => l.filter((m) => m.id !== id));
      try {
        await repo.deleteSavedMeal(id);
      } catch (e) {
        reportError(e);
      }
    },
    [repo, reportError],
  );

  const addMealPrep = useCallback(
    async (prep: MealPrep, logNow?: { date: string; meal: Meal } | null) => {
      mealPrepsRef.current = [prep, ...mealPrepsRef.current];
      setMealPreps(mealPrepsRef.current);
      try {
        await repo.saveMealPrep(prep);
      } catch (e) {
        mealPrepsRef.current = mealPrepsRef.current.filter((p) => p.id !== prep.id);
        setMealPreps(mealPrepsRef.current);
        reportError(e);
        throw e;
      }
      if (!logNow) return [];
      const entries = [portionEntry(prep, 1, logNow.meal, logNow.date)];
      await add(entries); // counts the batch down
      return entries;
    },
    [repo, add, reportError],
  );

  const logPrep = useCallback(
    async (prep: MealPrep, size: number, date: string, slot: Meal) => {
      const entries = [portionEntry(prep, size, slot, date)];
      await add(entries); // counts the batch down
      return entries;
    },
    [add],
  );

  const deleteMealPrep = useCallback(
    async (id: string) => {
      const prep = mealPrepsRef.current.find((p) => p.id === id) ?? null;
      if (!prep) return null;
      mealPrepsRef.current = mealPrepsRef.current.filter((p) => p.id !== id);
      setMealPreps(mealPrepsRef.current);
      try {
        await repo.deleteMealPrep(id);
      } catch (e) {
        mealPrepsRef.current = [prep, ...mealPrepsRef.current];
        setMealPreps(mealPrepsRef.current);
        reportError(e);
        return null;
      }
      return prep;
    },
    [repo, reportError],
  );

  const restoreMealPrep = useCallback(
    async (prep: MealPrep) => {
      if (mealPrepsRef.current.some((p) => p.id === prep.id)) return;
      mealPrepsRef.current = [prep, ...mealPrepsRef.current].sort((a, b) => (b.created_at ?? b.made_on).localeCompare(a.created_at ?? a.made_on));
      setMealPreps(mealPrepsRef.current);
      try {
        await repo.saveMealPrep(prep);
      } catch (e) {
        reportError(e);
      }
    },
    [repo, reportError],
  );

  const offProxy = useCallback<OffProxy>((action, params) => repo.offProxy(action, params), [repo]);
  const estimate = useCallback((req: EstimateRequest) => repo.estimateMeal(req), [repo]);
  const entriesFor = useCallback((date: string) => byDate[date] ?? [], [byDate]);
  const isLoaded = useCallback((date: string) => loaded.current.has(date), []);

  const value = useMemo<FoodState>(
    () => ({
      ready,
      entriesFor,
      isLoaded,
      ensure,
      myFoods,
      savedMeals,
      add,
      update,
      remove,
      restore,
      toggleFavorite,
      saveCustomFood,
      forgetFood,
      saveMeal,
      logMeal,
      deleteMeal,
      mealPreps,
      addMealPrep,
      logPrep,
      deleteMealPrep,
      restoreMealPrep,
      estimate,
      ai,
      offProxy,
    }),
    [
      ready, entriesFor, isLoaded, ensure, myFoods, savedMeals, add, update, remove, restore, toggleFavorite, saveCustomFood, forgetFood,
      saveMeal, logMeal, deleteMeal, mealPreps, addMealPrep, logPrep, deleteMealPrep, restoreMealPrep, estimate, ai, offProxy,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
