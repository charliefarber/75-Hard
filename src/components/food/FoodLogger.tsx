import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EstimatedItem, Food, FoodEntry, Meal, MyFood, SavedMeal } from '../../data/foodTypes';
import { MEALS } from '../../data/foodTypes';
import { useFood } from '../../data/FoodData';
import { useApp } from '../../data/AppData';
import { EstimateError } from '../../data/repo';
import { BASICS, searchBasics } from '../../lib/basics';
import { lookupBarcode, searchProducts } from '../../lib/off';
import {
  amountText,
  defaultAmount,
  entryFor,
  foodFromEstimate,
  gramsFor,
  mealLabel,
  newId,
  niceNumber,
  quickEntry,
  scale,
  totals,
  unitsFor,
  withAmount,
} from '../../lib/nutrition';
import { photoDataUrl } from '../../lib/photos';
import { success, tap } from '../../lib/haptics';
import { Sheet, fmt } from '../ui';
import { IconCamera, IconCheck, IconMinus, IconPlus, IconSearch, IconStar, IconX } from '../Icons';
import { BarcodeScanner } from './BarcodeScanner';
import { FoodThumb, MacroLine, g1 } from './bits';

export type LoggerMode = 'search' | 'scan' | 'describe' | 'quick';

type Review = (EstimatedItem & { on: boolean; scale: number })[];

type Screen =
  | { name: 'home' }
  | { name: 'detail'; food: Food; amount: number; unit: string; editing?: FoodEntry }
  | { name: 'quick'; editing?: FoodEntry }
  | { name: 'describe'; text?: string }
  | { name: 'working'; label: string; photo?: string }
  | { name: 'review'; items: Review; source: 'photo' | 'describe'; note: string; photo?: string }
  | { name: 'custom'; barcode?: string; foodName?: string; notFound?: boolean };

const STARTERS = ['basic:banana', 'basic:egg', 'basic:oats', 'basic:greek_0', 'basic:chicken_breast', 'basic:rice_white', 'basic:avocado', 'basic:latte'];

/**
 * The one place she logs food. Built for speed:
 *  - the "+" on any recent, favourite or search result logs it straight away (last amount used)
 *  - the sheet stays open so several things can go in one after another
 *  - barcode, photo, "describe it" and quick add are one tap from the top
 */
export function FoodLogger({
  open,
  date,
  meal: initialMeal,
  mode = 'search',
  edit,
  photo,
  onClose,
  onDeleted,
}: {
  open: boolean;
  date: string;
  meal: Meal;
  mode?: LoggerMode;
  edit?: FoodEntry | null;
  /** A meal photo picked before the sheet opened (the camera button on the Food tab). */
  photo?: File | null;
  onClose: () => void;
  /** After an entry is deleted from the edit view (for an undo toast). */
  onDeleted?: (removed: FoodEntry[]) => void;
}) {
  const food = useFood();
  const { reportError } = useApp();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [batches, setBatches] = useState<FoodEntry[][]>([]);
  const added = batches.flat();
  const [flash, setFlash] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // Open fresh each time.
  useEffect(() => {
    if (!open) return;
    setMeal(edit?.meal ?? initialMeal);
    setQuery('');
    setBatches([]);
    setFlash(null);
    if (edit) {
      if (edit.food) setScreen({ name: 'detail', food: edit.food, amount: edit.amount, unit: edit.unit, editing: edit });
      else setScreen({ name: 'quick', editing: edit });
    } else if (mode === 'quick') setScreen({ name: 'quick' });
    else if (mode === 'describe') setScreen({ name: 'describe' });
    else setScreen({ name: 'home' });
    if (!edit && mode === 'scan') setScanning(true);
    if (!edit && photo) onPhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = (s: Screen) => {
    setScreen(s);
    requestAnimationFrame(() => top.current?.closest('.sheet')?.scrollTo({ top: 0 }));
  };

  const lastFor = (key: string) => food.myFoods.find((f) => f.key === key) ?? null;

  /** Log straight away, stay in the sheet. */
  async function logNow(entries: FoodEntry[], label: string) {
    try {
      await food.add(entries);
      success();
      setBatches((b) => [...b, entries]);
      setFlash(label);
      setTimeout(() => setFlash((f) => (f === label ? null : f)), 1600);
    } catch {
      /* already reported */
    }
  }

  function quickLog(f: Food) {
    tap();
    const { amount, unit } = defaultAmount(f, lastFor(f.key));
    const e = entryFor(f, amount, unit, meal, date);
    logNow([e], `${f.name} · ${e.kcal} kcal`);
  }

  function openFood(f: Food) {
    tap();
    const { amount, unit } = defaultAmount(f, lastFor(f.key));
    go({ name: 'detail', food: f, amount, unit });
  }

  async function onBarcode(code: string) {
    setScanning(false);
    const mine = food.myFoods.find((m) => m.food.barcode === code);
    if (mine) return openFood(mine.food);
    go({ name: 'working', label: 'Looking it up…' });
    try {
      const f = await lookupBarcode(code, food.offProxy);
      if (f) openFood(f);
      else go({ name: 'custom', barcode: code, notFound: true });
    } catch (e) {
      reportError(e);
      go({ name: 'home' });
    }
  }

  async function onPhoto(file: File) {
    let preview: string | undefined;
    try {
      preview = URL.createObjectURL(file);
      go({ name: 'working', label: 'Looking at your photo…', photo: preview });
      const image = await photoDataUrl(file);
      const res = await food.estimate({ action: 'photo', meal, image });
      go({ name: 'review', source: 'photo', note: res.note, photo: preview, items: res.items.map((i) => ({ ...i, on: true, scale: 1 })) });
    } catch (e) {
      go({ name: 'home' });
      if (e instanceof EstimateError) setFlash(e.message);
      else reportError(e);
    }
  }

  async function onDescribe(text: string) {
    go({ name: 'working', label: 'Working it out…' });
    try {
      const res = await food.estimate({ action: 'describe', meal, text });
      go({ name: 'review', source: 'describe', note: res.note, items: res.items.map((i) => ({ ...i, on: true, scale: 1 })) });
    } catch (e) {
      go({ name: 'describe', text });
      if (e instanceof EstimateError) setFlash(e.message);
      else reportError(e);
    }
  }

  const sessionKcal = totals(added).kcal;
  const title =
    screen.name === 'detail' && screen.editing ? 'Edit' : screen.name === 'quick' ? (screen.editing ? 'Edit' : 'Quick add') : screen.name === 'describe' ? 'Describe it' : screen.name === 'review' ? 'Check the estimate' : screen.name === 'custom' ? 'Add your own food' : 'Log food';

  return (
    <>
      <Sheet
        open={open && !scanning}
        onClose={onClose}
        title={title}
        className="sheet-tall food-sheet"
        onBack={screen.name !== 'home' && screen.name !== 'working' && !(screen.name === 'detail' && screen.editing) && !(screen.name === 'quick' && screen.editing) ? () => go({ name: 'home' }) : undefined}
      >
        <div ref={top} style={{ height: 0, marginTop: -16 }} aria-hidden="true" />

        {screen.name === 'home' && (
          <div className="segmented meal-pick" role="group" aria-label="Meal">
            {MEALS.map((m) => (
              <button key={m.id} type="button" aria-pressed={meal === m.id} onClick={() => (tap(), setMeal(m.id))}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {screen.name === 'home' && (
          <Home
            query={query}
            setQuery={setQuery}
            meal={meal}
            myFoods={food.myFoods}
            savedMeals={food.savedMeals}
            addedKeys={new Set(added.map((a) => a.food_key ?? ''))}
            onOpen={openFood}
            onQuick={quickLog}
            onScan={() => (tap(), setScanning(true))}
            onPhoto={() => (tap(), photoInput.current?.click())}
            onDescribe={(text) => go({ name: 'describe', text })}
            onQuickAdd={() => go({ name: 'quick' })}
            onCustom={(n) => go({ name: 'custom', foodName: n })}
            ai={food.ai !== false}
            onMeal={async (m) => {
              tap();
              const entries = await food.logMeal(m, date, meal).catch(() => null);
              if (entries) {
                success();
                setBatches((b) => [...b, entries]);
                setFlash(`${m.name} · ${totals(entries).kcal} kcal`);
              }
            }}
            offProxy={food.offProxy}
          />
        )}

        {screen.name === 'detail' && (
          <Detail
            key={screen.food.key + (screen.editing?.id ?? '')}
            food={screen.food}
            amount={screen.amount}
            unit={screen.unit}
            meal={meal}
            setMeal={setMeal}
            editing={screen.editing}
            favorite={!!food.myFoods.find((f) => f.key === screen.food.key)?.favorite}
            onFavorite={() => (tap(), food.toggleFavorite(screen.food))}
            onSave={async (amount, unit) => {
              if (screen.editing) {
                const next = { ...withAmount(screen.editing, amount, unit), meal };
                await food.update(next);
                success();
                onClose();
              } else {
                const e = entryFor(screen.food, amount, unit, meal, date);
                await logNow([e], `${screen.food.name} · ${e.kcal} kcal`);
                go({ name: 'home' });
              }
            }}
            onDelete={
              screen.editing
                ? async () => {
                    const removed = await food.remove([screen.editing!.id]);
                    onClose();
                    onDeleted?.(removed);
                  }
                : undefined
            }
          />
        )}

        {screen.name === 'quick' && (
          <QuickAdd
            editing={screen.editing}
            meal={meal}
            setMeal={setMeal}
            onSave={async (q) => {
              if (screen.editing) {
                await food.update({ ...screen.editing, name: q.name?.trim() || screen.editing.name, kcal: Math.round(q.kcal), protein_g: q.protein ?? null, carbs_g: q.carbs ?? null, fat_g: q.fat ?? null, meal });
                success();
                onClose();
              } else {
                const e = quickEntry(q, meal, date);
                await logNow([e], `${e.name} · ${e.kcal} kcal`);
                go({ name: 'home' });
              }
            }}
            onDelete={
              screen.editing
                ? async () => {
                    const removed = await food.remove([screen.editing!.id]);
                    onClose();
                    onDeleted?.(removed);
                  }
                : undefined
            }
          />
        )}

        {screen.name === 'describe' && <Describe initial={screen.text} onEstimate={onDescribe} />}

        {screen.name === 'working' && (
          <div className="working" aria-live="polite">
            {screen.photo && <img src={screen.photo} alt="" className="working-photo" />}
            <span className="spinner" />
            <span>{screen.label}</span>
          </div>
        )}

        {screen.name === 'review' && (
          <ReviewList
            items={screen.items}
            source={screen.source}
            note={screen.note}
            photo={screen.photo}
            meal={meal}
            onChange={(items) => setScreen({ ...screen, items })}
            onSearch={(q) => {
              setQuery(q);
              go({ name: 'home' });
            }}
            onAdd={async (items) => {
              const entries = items.map((it) => {
                const f = foodFromEstimate(it);
                const e = entryFor(f, it.scale, f.servings[0].label, meal, date, screen.source);
                return it.grams >= 5 ? e : { ...e, grams: null };
              });
              await logNow(entries, `${entries.length} item${entries.length === 1 ? '' : 's'} · ${totals(entries).kcal} kcal`);
              go({ name: 'home' });
            }}
          />
        )}

        {screen.name === 'custom' && (
          <CustomFood
            barcode={screen.barcode}
            initialName={screen.foodName}
            notFound={screen.notFound}
            onSave={async (f) => {
              await food.saveCustomFood(f);
              openFood(f);
            }}
          />
        )}

        {(added.length > 0 || flash) && !(screen.name === 'detail' && screen.editing) && (
          <div className="logger-foot" role="status">
            <span className="logger-foot-text">
              {flash ? (
                <>
                  <IconCheck size={16} strokeWidth={3} /> {flash}
                </>
              ) : (
                <>
                  {added.length} added · {fmt(sessionKcal)} kcal
                </>
              )}
            </span>
            {batches.length > 0 && (
              <button
                type="button"
                className="link-btn"
                onClick={async () => {
                  const last = batches[batches.length - 1];
                  await food.remove(last.map((b) => b.id));
                  setBatches((b) => b.slice(0, -1));
                  setFlash('Removed');
                }}
              >
                Undo
              </button>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </Sheet>

      {scanning && open && <BarcodeScanner onCode={onBarcode} onClose={() => setScanning(false)} />}

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPhoto(f);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- home: search + lists

function Home({
  query,
  setQuery,
  meal,
  myFoods,
  savedMeals,
  addedKeys,
  onOpen,
  onQuick,
  onScan,
  onPhoto,
  onDescribe,
  onQuickAdd,
  onCustom,
  onMeal,
  ai,
  offProxy,
}: {
  query: string;
  setQuery: (q: string) => void;
  meal: Meal;
  myFoods: MyFood[];
  savedMeals: SavedMeal[];
  addedKeys: Set<string>;
  onOpen: (f: Food) => void;
  onQuick: (f: Food) => void;
  onScan: () => void;
  onPhoto: () => void;
  onDescribe: (text?: string) => void;
  onQuickAdd: () => void;
  onCustom: (name?: string) => void;
  onMeal: (m: SavedMeal) => void;
  /** Photo and "describe it" estimates are available. */
  ai: boolean;
  offProxy: Parameters<typeof searchProducts>[1];
}) {
  const q = query.trim();
  const [products, setProducts] = useState<{ q: string; foods: Food[]; error?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  // Search Open Food Facts once she pauses typing (they ask apps not to search on every key).
  useEffect(() => {
    if (q.length < 3) {
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const foods = await searchProducts(q, offProxy);
        if (id === seq.current) setProducts({ q, foods });
      } catch {
        if (id === seq.current) setProducts({ q, foods: [], error: true });
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 550);
    return () => clearTimeout(t);
  }, [q, offProxy]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (f: Food) => words.every((w) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(w));
  const mine = q ? myFoods.filter((m) => matches(m.food)).slice(0, 8) : [];
  const basics = q ? searchBasics(q, 8).filter((b) => !mine.some((m) => m.key === b.key)) : [];
  const offFoods = products && products.q === q ? products.foods.filter((f) => !mine.some((m) => m.key === f.key)) : [];

  const favorites = myFoods.filter((f) => f.favorite);
  const recent = myFoods
    .filter((f) => !f.favorite && f.last_used)
    .sort((a, b) => Number(b.last_meal === meal) - Number(a.last_meal === meal) || (b.last_used ?? '').localeCompare(a.last_used ?? ''))
    .slice(0, 12);
  // Popular basics until her own list has filled out a bit (never repeating what's already in it).
  const starters = myFoods.length < 6 ? BASICS.filter((b) => STARTERS.includes(b.key) && !myFoods.some((m) => m.key === b.key)) : [];
  const lastOf = (key: string) => myFoods.find((f) => f.key === key) ?? null;

  return (
    <>
      <div className="food-search">
        <label className="pick-search">
          <IconSearch size={20} />
          <span className="sr-only">Search foods</span>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search foods and brands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button type="button" className="pick-clear" aria-label="Clear search" onClick={() => setQuery('')}>
              <IconX size={16} />
            </button>
          ) : (
            <button type="button" className="search-scan" aria-label="Scan a barcode" onClick={onScan}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M10 8v8M13 8v8M16 8v8" />
              </svg>
            </button>
          )}
        </label>
      </div>

      {!q && (
        <div className={`log-actions${ai ? '' : ' two'}`}>
          <button type="button" className="log-action" onClick={onScan}>
            <span className="log-action-icon scan" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M10 8v8M13 8v8M16 8v8" />
              </svg>
            </span>
            Scan
          </button>
          {ai && (
            <>
              <button type="button" className="log-action" onClick={onPhoto}>
                <span className="log-action-icon photo" aria-hidden="true">
                  <IconCamera size={22} />
                </span>
                Photo
              </button>
              <button type="button" className="log-action" onClick={() => onDescribe()}>
                <span className="log-action-icon describe" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
                    <path d="M13.5 6.5l4 4" />
                  </svg>
                </span>
                Describe
              </button>
            </>
          )}
          <button type="button" className="log-action" onClick={onQuickAdd}>
            <span className="log-action-icon quick" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H12z" />
              </svg>
            </span>
            Quick add
          </button>
        </div>
      )}

      {!q && favorites.length > 0 && (
        <Group label="Favourites">
          {favorites.map((m) => (
            <FoodLine key={m.id} food={m.food} last={m} added={addedKeys.has(m.key)} onOpen={onOpen} onQuick={onQuick} />
          ))}
        </Group>
      )}
      {!q && savedMeals.length > 0 && (
        <Group label="Saved meals">
          {savedMeals.map((m) => {
            const t = totals(m.items as FoodEntry[]);
            return (
              <div key={m.id} className="food-line">
                <span className="food-thumb" style={{ width: 40, height: 40, borderRadius: 12, fontSize: 20 }} aria-hidden="true">
                  🍱
                </span>
                <button type="button" className="food-line-main" onClick={() => onMeal(m)}>
                  <span className="row-title">{m.name}</span>
                  <span className="row-sub">
                    {m.items.length} items · {fmt(t.kcal)} kcal
                  </span>
                </button>
                <button type="button" className="add-btn" aria-label={`Log ${m.name}`} onClick={() => onMeal(m)}>
                  <IconPlus size={20} strokeWidth={2.6} />
                </button>
              </div>
            );
          })}
        </Group>
      )}
      {!q && recent.length > 0 && (
        <Group label="Recent">
          {recent.map((m) => (
            <FoodLine key={m.id} food={m.food} last={m} added={addedKeys.has(m.key)} onOpen={onOpen} onQuick={onQuick} />
          ))}
        </Group>
      )}
      {!q && starters.length > 0 && (
        <Group label="Popular to start with">
          {starters.map((f) => (
            <FoodLine key={f.key} food={f} last={null} added={addedKeys.has(f.key)} onOpen={onOpen} onQuick={onQuick} />
          ))}
        </Group>
      )}

      {q && mine.length > 0 && (
        <Group label="Yours">
          {mine.map((m) => (
            <FoodLine key={m.id} food={m.food} last={m} added={addedKeys.has(m.key)} onOpen={onOpen} onQuick={onQuick} />
          ))}
        </Group>
      )}
      {q && basics.length > 0 && (
        <Group label="Everyday foods">
          {basics.map((f) => (
            <FoodLine key={f.key} food={f} last={lastOf(f.key)} added={addedKeys.has(f.key)} onOpen={onOpen} onQuick={onQuick} />
          ))}
        </Group>
      )}
      {q.length >= 3 && (
        <Group label={loading ? 'Products · searching…' : 'Products'}>
          {offFoods.map((f) => (
            <FoodLine key={f.key} food={f} last={lastOf(f.key)} added={addedKeys.has(f.key)} onOpen={onOpen} onQuick={onQuick} />
          ))}
          {!loading && products?.q === q && !offFoods.length && (
            <p className="pick-empty">{products.error ? 'Couldn’t reach Open Food Facts just now.' : 'No packaged products found.'}</p>
          )}
          {loading && !offFoods.length && <div className="food-skel" aria-hidden="true"><span /><span /><span /></div>}
        </Group>
      )}
      {q && (
        <div className="not-found-actions">
          {ai && (
            <button type="button" className="pick-custom" onClick={() => onDescribe(q)}>
              <span className="act-icon" style={{ width: 40, height: 40, borderRadius: 13 }} aria-hidden="true">
                ✨
              </span>
              <span className="row-text">
                <span className="row-title">Estimate “{q}”</span>
                <span className="row-sub">Works out calories and macros from the description</span>
              </span>
            </button>
          )}
          <button type="button" className="pick-custom" onClick={() => onCustom(q)}>
            <span className="act-icon" style={{ width: 40, height: 40, borderRadius: 13 }} aria-hidden="true">
              <IconPlus size={20} />
            </span>
            <span className="row-text">
              <span className="row-title">Add “{q}” as your own food</span>
              <span className="row-sub">From the label, saved for next time</span>
            </span>
          </button>
        </div>
      )}
    </>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pick-group">
      <span className="pick-label">{label}</span>
      <div className="pick-list">{children}</div>
    </div>
  );
}

/** A food you can tap to adjust, or "+" to log straight away. */
function FoodLine({
  food,
  last,
  added,
  onOpen,
  onQuick,
}: {
  food: Food;
  last: MyFood | null;
  added: boolean;
  onOpen: (f: Food) => void;
  onQuick: (f: Food) => void;
}) {
  const { amount, unit } = defaultAmount(food, last);
  const grams = gramsFor(food, amount, unit);
  const kcal = scale(food.per100, grams).kcal;
  const portion = amountText({ amount, unit, grams });
  return (
    <div className="food-line">
      <FoodThumb food={food} />
      <button type="button" className="food-line-main" onClick={() => onOpen(food)}>
        <span className="row-title">{food.name}</span>
        <span className="row-sub">
          {food.brand ? `${food.brand} · ` : ''}
          {portion} · {fmt(kcal)} kcal
        </span>
      </button>
      <button
        type="button"
        className={`add-btn${added ? ' done' : ''}`}
        aria-label={`Log ${food.name}, ${portion}`}
        onClick={() => onQuick(food)}
      >
        {added ? <IconCheck size={18} strokeWidth={3} /> : <IconPlus size={20} strokeWidth={2.6} />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- detail: how much

function Detail({
  food,
  amount: a0,
  unit: u0,
  meal,
  setMeal,
  editing,
  favorite,
  onFavorite,
  onSave,
  onDelete,
}: {
  food: Food;
  amount: number;
  unit: string;
  meal: Meal;
  setMeal: (m: Meal) => void;
  editing?: FoodEntry;
  favorite: boolean;
  onFavorite: () => void;
  onSave: (amount: number, unit: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [amountText_, setAmountText] = useState(niceInput(a0));
  const [unit, setUnit] = useState(u0);
  const [busy, setBusy] = useState(false);
  const units = unitsFor(food);
  const amount = parseFloat(amountText_.replace(',', '.'));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 5000;
  const grams = valid ? gramsFor(food, amount, unit) : 0;
  const n = scale(food.per100, grams);
  const isWeight = unit === 'g' || unit === 'ml';
  const presets = isWeight ? [50, 100, 150, 200] : [0.5, 1, 1.5, 2];
  const step = isWeight ? 10 : 0.5;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSave(amount, unit);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="food-detail">
      <div className="food-detail-head">
        <FoodThumb food={food} size={56} />
        <div className="row-text">
          <span className="food-detail-name">{food.name}</span>
          <span className="row-sub">
            {[food.brand, food.source === 'off' ? 'Open Food Facts' : food.source === 'basic' ? 'Everyday food' : 'Your food'].filter(Boolean).join(' · ')}
          </span>
        </div>
        <button type="button" className={`star-btn${favorite ? ' on' : ''}`} aria-pressed={favorite} aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'} onClick={onFavorite}>
          <IconStar size={22} filled={favorite} />
        </button>
      </div>

      <div className="amount-row">
        <button type="button" className="dur-btn" aria-label="Less" onClick={() => (tap(), setAmountText(niceInput(Math.max(step, (valid ? amount : 0) - step))))}>
          <IconMinus size={20} />
        </button>
        <input
          className="amount-input"
          inputMode="decimal"
          aria-label="Amount"
          value={amountText_}
          onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
        />
        <button type="button" className="dur-btn" aria-label="More" onClick={() => (tap(), setAmountText(niceInput((valid ? amount : 0) + step)))}>
          <IconPlus size={20} />
        </button>
      </div>
      <label className="unit-select">
        <span className="sr-only">Unit</span>
        <select
          value={unit}
          onChange={(e) => {
            const next = e.target.value;
            // keep roughly the same amount of food when switching between servings and grams
            const g = valid ? gramsFor(food, amount, unit) : 0;
            const per = units.find((u) => u.unit === next)?.grams ?? 1;
            setUnit(next);
            if (g) setAmountText(niceInput(next === 'g' || next === 'ml' ? Math.round(g) : Math.max(0.25, Math.round((g / per) * 4) / 4)));
          }}
        >
          {units.map((u) => (
            <option key={u.unit} value={u.unit}>
              {u.unit === 'g' ? 'grams' : u.unit === 'ml' ? 'millilitres' : u.unit}
            </option>
          ))}
        </select>
      </label>
      <div className="chips" style={{ justifyContent: 'center' }}>
        {presets.map((p) => (
          <button key={p} type="button" className="chip-btn" aria-pressed={valid && amount === p} onClick={() => (tap(), setAmountText(niceInput(p)))}>
            {isWeight ? `${p} ${unit}` : `${niceNumber(p)}×`}
          </button>
        ))}
      </div>

      <div className="nutri-card" aria-live="polite">
        <div className="nutri-kcal">
          <strong>{fmt(n.kcal)}</strong>
          <span>kcal{!isWeight && grams ? ` · ${Math.round(grams)} ${food.base}` : ''}</span>
        </div>
        <div className="nutri-macros">
          <Macro label="Protein" v={n.protein} cls="m-p" />
          <Macro label="Carbs" v={n.carbs} cls="m-c" />
          <Macro label="Fat" v={n.fat} cls="m-f" />
        </div>
        {(n.fiber != null || n.sugar != null || n.salt != null) && (
          <p className="nutri-extra">
            {[n.fiber != null && `Fibre ${g1(n.fiber)} g`, n.sugar != null && `Sugar ${g1(n.sugar)} g`, n.satFat != null && `Sat fat ${g1(n.satFat)} g`, n.salt != null && `Salt ${n.salt} g`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {editing && (
        <div className="segmented meal-pick" role="group" aria-label="Meal">
          {MEALS.map((m) => (
            <button key={m.id} type="button" aria-pressed={meal === m.id} onClick={() => (tap(), setMeal(m.id))}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-primary btn-block" disabled={!valid || busy} onClick={save}>
        {editing ? 'Save' : `Add to ${mealLabel(meal)}`}
      </button>
      {onDelete && (
        <button type="button" className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }} onClick={() => onDelete()}>
          Delete
        </button>
      )}
    </div>
  );
}

const niceInput = (n: number) => String(Math.round(n * 100) / 100);

function Macro({ label, v, cls }: { label: string; v: number | null | undefined; cls: string }) {
  return (
    <div className="nutri-macro">
      <span className={`dot ${cls}`} aria-hidden="true" />
      <strong>{g1(v)} g</strong>
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------- quick add

function QuickAdd({
  editing,
  meal,
  setMeal,
  onSave,
  onDelete,
}: {
  editing?: FoodEntry;
  meal: Meal;
  setMeal: (m: Meal) => void;
  onSave: (q: { name?: string; kcal: number; protein?: number | null; carbs?: number | null; fat?: number | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [kcal, setKcal] = useState(editing ? String(Math.round(editing.kcal)) : '');
  const [name, setName] = useState(editing && editing.name !== 'Quick add' ? editing.name : '');
  const [p, setP] = useState(editing?.protein_g != null ? String(editing.protein_g) : '');
  const [c, setC] = useState(editing?.carbs_g != null ? String(editing.carbs_g) : '');
  const [f, setF] = useState(editing?.fat_g != null ? String(editing.fat_g) : '');
  const [busy, setBusy] = useState(false);
  const numOrNull = (s: string) => (s.trim() === '' ? null : Math.max(0, parseFloat(s.replace(',', '.')) || 0));
  const k = parseFloat(kcal);
  const macroKcal = 4 * (numOrNull(p) ?? 0) + 4 * (numOrNull(c) ?? 0) + 9 * (numOrNull(f) ?? 0);
  const valid = (k > 0 && k <= 10000) || (!kcal && macroKcal > 0);
  const digits = (v: string) => v.replace(/[^\d.,]/g, '').slice(0, 6);

  return (
    <form
      className="quick-add"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        try {
          await onSave({ name, kcal: k > 0 ? k : Math.round(macroKcal), protein: numOrNull(p), carbs: numOrNull(c), fat: numOrNull(f) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="dur-value quick-kcal">
        <span className="sr-only">Calories</span>
        <input
          inputMode="numeric"
          autoFocus={!editing}
          placeholder="0"
          value={kcal}
          onChange={(e) => setKcal(e.target.value.replace(/\D/g, '').slice(0, 5))}
          style={{ width: `${Math.max(1, kcal.length) + 0.6}ch` }}
        />
        <span>kcal</span>
      </label>
      <label className="field">
        Name (optional)
        <input className="input" maxLength={60} placeholder="e.g. Office birthday cake" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="quick-macros">
        {[
          ['Protein', p, setP, 'm-p'],
          ['Carbs', c, setC, 'm-c'],
          ['Fat', f, setF, 'm-f'],
        ].map(([label, v, set, cls]) => (
          <label key={label as string} className="field">
            <span>
              <i className={`dot ${cls}`} aria-hidden="true" /> {label as string} (g)
            </span>
            <input className="input" inputMode="decimal" placeholder="–" value={v as string} onChange={(e) => (set as (s: string) => void)(digits(e.target.value))} />
          </label>
        ))}
      </div>
      {!kcal && macroKcal > 0 && <p className="card-sub" style={{ margin: 0 }}>That’s about {Math.round(macroKcal)} kcal from the macros.</p>}
      {editing && (
        <div className="segmented meal-pick" role="group" aria-label="Meal">
          {MEALS.map((m) => (
            <button key={m.id} type="button" aria-pressed={meal === m.id} onClick={() => (tap(), setMeal(m.id))}>
              {m.label}
            </button>
          ))}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
        {editing ? 'Save' : `Add to ${mealLabel(meal)}`}
      </button>
      {onDelete && (
        <button type="button" className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }} onClick={() => onDelete()}>
          Delete
        </button>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- describe → estimate

function Describe({ initial, onEstimate }: { initial?: string; onEstimate: (text: string) => void }) {
  const [text, setText] = useState(initial ?? '');
  const ok = text.trim().length >= 3;
  return (
    <form
      className="describe"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onEstimate(text.trim());
      }}
    >
      <label className="field">
        What did you have?
        <textarea
          className="input"
          autoFocus
          maxLength={500}
          rows={4}
          placeholder="e.g. 2 scrambled eggs on sourdough with butter, and a flat white"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
        Amounts help (“a large bowl”, “2 slices”). You’ll see each item and can adjust it before it’s added.
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={!ok}>
        ✨ Estimate it
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- review an estimate

function ReviewList({
  items,
  source,
  note,
  photo,
  meal,
  onChange,
  onSearch,
  onAdd,
}: {
  items: Review;
  source: 'photo' | 'describe';
  note: string;
  photo?: string;
  meal: Meal;
  onChange: (items: Review) => void;
  onSearch: (q: string) => void;
  onAdd: (items: Review) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const chosen = items.filter((i) => i.on);
  const sum = chosen.reduce((a, i) => ({ kcal: a.kcal + i.kcal * i.scale, p: a.p + i.protein * i.scale, c: a.c + i.carbs * i.scale, f: a.f + i.fat * i.scale }), { kcal: 0, p: 0, c: 0, f: 0 });
  const set = (idx: number, patch: Partial<Review[number]>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  if (!items.length)
    return (
      <div className="working">
        {photo && <img src={photo} alt="" className="working-photo" />}
        <p style={{ margin: 0, textAlign: 'center' }}>{note || 'Couldn’t spot any food there.'} Try another photo, or search instead.</p>
      </div>
    );

  return (
    <div className="review">
      {photo && <img src={photo} alt="Your meal" className="review-photo" />}
      <div className="pick-list">
        {items.map((it, i) => (
          <div key={i} className={`review-item${it.on ? '' : ' off'}`}>
            <button type="button" className={`check${it.on ? ' on' : ''}`} aria-pressed={it.on} aria-label={`Include ${it.name}`} onClick={() => (tap(), set(i, { on: !it.on }))}>
              {it.on && <IconCheck size={16} strokeWidth={3} />}
            </button>
            <div className="row-text">
              <span className="row-title">{it.name}</span>
              <span className="row-sub">
                {it.portion}
                {it.grams ? ` · ${Math.round(it.grams * it.scale)} g` : ''}
                {it.confidence < 0.5 ? ' · rough guess' : ''}
              </span>
              <MacroLine p={it.protein * it.scale} c={it.carbs * it.scale} f={it.fat * it.scale} />
            </div>
            <div className="review-amount">
              <strong>{fmt(Math.round(it.kcal * it.scale))}</strong>
              <div className="mini-stepper">
                <button type="button" aria-label={`Less ${it.name}`} onClick={() => set(i, { scale: Math.max(0.25, it.scale - 0.25) })}>
                  −
                </button>
                <span>{niceNumber(it.scale)}×</span>
                <button type="button" aria-label={`More ${it.name}`} onClick={() => set(i, { scale: Math.min(4, it.scale + 0.25) })}>
                  +
                </button>
              </div>
              <button type="button" className="link-btn tiny" onClick={() => onSearch(it.name)}>
                Search
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="review-total">
        <span>
          <strong>{fmt(Math.round(sum.kcal))} kcal</strong>
        </span>
        <MacroLine p={sum.p} c={sum.c} f={sum.f} />
      </div>
      <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
        {source === 'photo' ? 'Estimated from your photo' : 'Estimated from your description'}: portions can be off, so nudge them with − / + if you know better.
        {note ? ` ${note}` : ''}
      </p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!chosen.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onAdd(chosen);
          } finally {
            setBusy(false);
          }
        }}
      >
        Add {chosen.length === 1 ? '1 item' : `${chosen.length} items`} to {mealLabel(meal)}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- her own food

function CustomFood({
  barcode,
  initialName,
  notFound,
  onSave,
}: {
  barcode?: string;
  initialName?: string;
  notFound?: boolean;
  onSave: (f: Food) => Promise<void>;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [brand, setBrand] = useState('');
  const [per, setPer] = useState<'serving' | '100g'>('serving');
  const [serving, setServing] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [busy, setBusy] = useState(false);
  const v = (s: string) => (s.trim() === '' ? null : parseFloat(s.replace(',', '.')));
  const sg = v(serving);
  const k = v(kcal);
  const valid = name.trim().length > 0 && k != null && k >= 0 && (per === '100g' || (sg != null && sg > 0));
  const d = (s: string) => s.replace(/[^\d.,]/g, '').slice(0, 6);

  return (
    <form
      className="custom-food"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        const factor = per === 'serving' ? 100 / sg! : 1;
        const round = (x: number | null) => (x == null ? null : Math.round(x * factor * 10) / 10);
        const food: Food = {
          key: barcode ? `custom:${barcode}` : `custom:${newId()}`,
          name: name.trim().slice(0, 120),
          brand: brand.trim() || undefined,
          source: 'custom',
          per100: { kcal: Math.round(k! * factor), protein: round(v(p)), carbs: round(v(c)), fat: round(v(f)) },
          base: 'g',
          servings: per === 'serving' ? [{ label: `1 serving (${sg} g)`, grams: sg! }] : [],
          defaultServing: per === 'serving' ? 0 : undefined,
          barcode,
        };
        try {
          await onSave(food);
        } finally {
          setBusy(false);
        }
      }}
    >
      {notFound && (
        <p className="note-card">
          That barcode isn’t in Open Food Facts yet. Copy the label once and it’s saved, so next time the scan finds it straight away.
        </p>
      )}
      <label className="field">
        Name
        <input className="input" maxLength={120} autoFocus={!initialName} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Protein yoghurt" />
      </label>
      <label className="field">
        Brand (optional)
        <input className="input" maxLength={80} value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <div className="segmented" role="group" aria-label="Nutrition per">
        <button type="button" aria-pressed={per === 'serving'} onClick={() => setPer('serving')}>
          Per serving
        </button>
        <button type="button" aria-pressed={per === '100g'} onClick={() => setPer('100g')}>
          Per 100 g
        </button>
      </div>
      {per === 'serving' && (
        <label className="field">
          Serving size (g or ml)
          <input className="input" inputMode="decimal" value={serving} onChange={(e) => setServing(d(e.target.value))} placeholder="e.g. 150" />
        </label>
      )}
      <div className="quick-macros four">
        {[
          ['Calories', kcal, setKcal, ''],
          ['Protein g', p, setP, 'm-p'],
          ['Carbs g', c, setC, 'm-c'],
          ['Fat g', f, setF, 'm-f'],
        ].map(([label, val, set, cls]) => (
          <label key={label as string} className="field">
            <span>
              {cls ? <i className={`dot ${cls}`} aria-hidden="true" /> : null} {label as string}
            </span>
            <input className="input" inputMode="decimal" value={val as string} onChange={(e) => (set as (s: string) => void)(d(e.target.value))} placeholder="–" />
          </label>
        ))}
      </div>
      {barcode && <p className="card-sub" style={{ margin: 0 }}>Barcode {barcode}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
        Save and log it
      </button>
    </form>
  );
}
