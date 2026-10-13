import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, parseISO } from 'date-fns';
import { useApp } from './AppData';
import type { EstimateRequest } from './repo';
import type { EstimatedItem, Food, FoodEntry, Meal, MyFood, SavedMeal } from './foodTypes';
import { toISODate } from '../lib/challenge';
import { newId, quickEntry, totals } from '../lib/nutrition';
import type { OffProxy } from '../lib/off';

/**
 * The food diary: what she ate (by day), her food library (favourites, her own foods,
 * everything she's logged before) and saved meals. Every change is shown at once and saved
 * in the background; the day's calories in daily_logs follow the diary, so Today, the rings
 * and the weekly recap all see the same number.
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
  saveMeal(name: string, entries: FoodEntry[]): Promise<void>;
  logMeal(meal: SavedMeal, date: string, slot: Meal): Promise<FoodEntry[]>;
  deleteMeal(id: string): Promise<void>;
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
        const [foods, meals] = await Promise.all([repo.getMyFoods(), repo.getSavedMeals(), ensure(toISODate(addDays(parseISO(today), -13)), today)]);
        if (!live) return;
        setMyFoods(foods);
        setSavedMeals(meals);
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
        if (!e.food) continue;
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
      try {
        await repo.saveFoodEntries(all);
      } catch (e) {
        byDateRef.current = before;
        setByDate(before);
        for (const d of dates) syncDay(d, before[d] ?? []);
        reportError(e);
        throw e;
      }
    },
    [repo, logsRef, syncDay, remember, reportError],
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
      try {
        await repo.saveFoodEntries([entry]);
      } catch (e) {
        byDateRef.current = before;
        setByDate(before);
        reportError(e);
      }
    },
    [repo, syncDay, remember, reportError],
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
      try {
        await repo.deleteFoodEntries(ids);
      } catch (e) {
        byDateRef.current = before;
        setByDate(before);
        for (const d of dates) syncDay(d, before[d]);
        reportError(e);
      }
      return removed;
    },
    [repo, syncDay, reportError],
  );

  const restore = useCallback(
    async (entries: FoodEntry[]) => {
      const next = { ...byDateRef.current };
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
    [repo, syncDay, reportError],
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
    async (name: string, entries: FoodEntry[]) => {
      const meal: SavedMeal = { id: newId(), name: name.trim().slice(0, 60), items: entries.map(stripEntryForMeal), uses: 0, last_used: new Date().toISOString() };
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
      estimate,
      ai,
      offProxy,
    }),
    [ready, entriesFor, isLoaded, ensure, myFoods, savedMeals, add, update, remove, restore, toggleFavorite, saveCustomFood, forgetFood, saveMeal, logMeal, deleteMeal, estimate, ai, offProxy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
