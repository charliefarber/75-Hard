import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser, Challenge, DailyLog, Profile } from './types';
import { normaliseLog } from './types';
import type { EstimatedItem, FoodEntry, Meal, MyFood, SavedMeal } from './foodTypes';
import { thumbPath } from '../lib/photos';

/**
 * Everything the app needs from a backend. Two implementations:
 *  - SupabaseRepo: real accounts, synced across devices.
 *  - LocalRepo: no account, data stays on this device (used when Supabase
 *    isn't configured, or for "try it first").
 */
export interface Repo {
  readonly kind: 'supabase' | 'local';
  currentUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
  regenerateSyncToken(): Promise<Profile>;
  /** Everything stored for this account, for "Download my data" (sync token left out). */
  exportData(): Promise<DataExport>;
  /** Permanently delete the account and all its data, then sign out. */
  deleteAccount(): Promise<void>;

  getActiveChallenge(): Promise<Challenge | null>;
  listChallenges(): Promise<Challenge[]>;
  startChallenge(startDate: string, creditedDays?: number): Promise<Challenge>;
  endChallenge(id: string, status: 'reset' | 'completed', endedOn: string): Promise<void>;
  updateChallenge(id: string, patch: ChallengePatch): Promise<void>;

  getLogs(from: string, to: string): Promise<DailyLog[]>;
  /** Save a day. `fields` limits the write to what changed, so a stale screen can't clobber synced data. */
  saveLog(log: DailyLog, fields?: (keyof DailyLog)[]): Promise<void>;
  /** Save many whole days at once (used when ticking off days done before signing up). */
  saveLogs(logs: DailyLog[]): Promise<void>;

  /** Store a day's progress photo (already shrunk, see lib/photos.ts) and return its path. */
  uploadPhoto(date: string, full: Blob, thumb: Blob): Promise<string>;
  /** Short-lived links for showing photos, by path. `thumb` for the small gallery version. */
  photoUrls(paths: string[], thumb?: boolean): Promise<Record<string, string>>;
  deletePhoto(path: string): Promise<void>;

  // Food diary
  getFoodEntries(from: string, to: string): Promise<FoodEntry[]>;
  /** Insert or update (by id). */
  saveFoodEntries(entries: FoodEntry[]): Promise<void>;
  deleteFoodEntries(ids: string[]): Promise<void>;
  getMyFoods(): Promise<MyFood[]>;
  saveMyFoods(foods: MyFood[]): Promise<void>;
  deleteMyFood(id: string): Promise<void>;
  getSavedMeals(): Promise<SavedMeal[]>;
  saveSavedMeal(meal: SavedMeal): Promise<void>;
  deleteSavedMeal(id: string): Promise<void>;
  /** Calories and macros for a photo or a description of a meal (server function). */
  estimateMeal(req: EstimateRequest): Promise<{ items: EstimatedItem[]; note: string }>;
  /** Open Food Facts through the server function, for when the phone's own request is blocked. */
  offProxy(action: 'product' | 'search', params: Record<string, string>): Promise<unknown>;
}

export type EstimateRequest =
  | { action: 'photo'; meal: Meal; image: string; hint?: string }
  | { action: 'describe'; meal: Meal; text: string };

/** Why an estimate didn't work, for a helpful message. */
export class EstimateError extends Error {
  constructor(
    public code: 'not_configured' | 'daily_limit' | 'failed' | 'offline' | 'local',
    message: string,
  ) {
    super(message);
  }
}

export interface DataExport {
  exported_at: string;
  account: { email: string | null };
  profile: Omit<Profile, 'health_sync_token'>;
  challenges: Challenge[];
  daily_logs: DailyLog[];
  /** Progress photos are listed by day; the photos themselves can be saved from the app. */
  progress_photos: { date: string; file: string }[];
  food_diary: FoodEntry[];
  my_foods: MyFood[];
  saved_meals: SavedMeal[];
}

/** Profile fields the app may change (the database only allows these too; see 0009_security.sql). */
const PROFILE_EDITABLE = [
  'display_name',
  'water_goal_ml',
  'step_goal',
  'calorie_goal',
  'workout_minutes',
  'reading_goal_pages',
  'steps_required',
  'timezone',
  'birthday',
  'birthday_pass_year',
  'workout_goal_minutes',
  'height_cm',
  'sex',
  'weight_unit',
  'workout_favorites',
  'protein_goal_g',
  'carbs_goal_g',
  'fat_goal_g',
  'active_goal_kcal',
] as const;

const FOOD_ENTRY_COLUMNS = [
  'id', 'log_date', 'meal', 'name', 'brand', 'food_key', 'amount', 'unit', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g',
  'fiber_g', 'sugar_g', 'sat_fat_g', 'salt_g', 'source', 'food', 'created_at',
] as const;

/** Only the columns the table has, so a stray field can't break a save. */
function entryRow(e: FoodEntry, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  for (const k of FOOD_ENTRY_COLUMNS) if (e[k] !== undefined) row[k] = e[k];
  return row;
}

const num = (v: unknown) => (v == null ? null : Number(v));
function normaliseEntry(r: Record<string, unknown>): FoodEntry {
  return {
    ...(r as unknown as FoodEntry),
    amount: Number(r.amount),
    grams: num(r.grams),
    kcal: Number(r.kcal),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    fiber_g: num(r.fiber_g),
    sugar_g: num(r.sugar_g),
    sat_fat_g: num(r.sat_fat_g),
    salt_g: num(r.salt_g),
  };
}

function estimateMessage(code: EstimateError['code']): string {
  return code === 'not_configured'
    ? 'Photo and description logging needs a one-time setup first (see the setup note in Profile).'
    : code === 'daily_limit'
      ? 'That’s the most estimates for today. Search or quick add still work.'
      : code === 'offline'
        ? 'Couldn’t reach the estimate service. Check the connection and try again.'
        : code === 'local'
          ? 'Estimates need an account.'
          : 'Couldn’t estimate that one. Try again, or search for it instead.';
}

const PHOTO_BUCKET = 'progress-photos';
/** Signed photo links last an hour; the app re-signs before they run out. */
export const PHOTO_URL_SECONDS = 3600;

const photoList = (logs: DailyLog[]) =>
  logs.filter((l) => l.photo_path).map((l) => ({ date: l.log_date, file: l.photo_path!.split('/').pop()! }));

const ALL_DATES: [string, string] = ['1900-01-01', '2999-12-31'];

function withoutToken(p: Profile): Omit<Profile, 'health_sync_token'> {
  const { health_sync_token: _t, ...rest } = p;
  return rest;
}

// '*' so the app keeps working whichever optional columns (pet, birthday) exist yet.
const LOG_COLUMNS = '*';
const PROFILE_COLUMNS = '*';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

type DbError = { message: string; code?: string };

/**
 * Turn a Supabase error into something readable. A missing column means a migration
 * hasn't been run (or the API hasn't picked it up yet): say exactly which, and how to fix it.
 */
export function dbError(err: DbError): Error {
  const m =
    err.message.match(/Could not find the '(\w+)' column/) ??
    (err.code === '42703' ? err.message.match(/column (?:"?\w+"?\.)?"?(\w+)"? does not exist/) : null);
  if (m)
    return new Error(
      `The database is missing the “${m[1]}” column. In Supabase’s SQL Editor, run supabase/migrations/0005_catch_up.sql (safe to run again), then try once more.`,
    );
  return new Error(err.message);
}

function check<T>(res: { data: T; error: DbError | null }): T {
  if (res.error) throw dbError(res.error);
  return res.data;
}

function storageError(err: { message: string }): Error {
  if (/bucket not found/i.test(err.message))
    return new Error('Photo storage isn’t set up yet. In Supabase’s SQL Editor, run supabase/migrations/0011_workouts_weight_photos.sql, then try again.');
  if (/exceeded the maximum allowed size|payload too large/i.test(err.message)) return new Error('That photo is too big to upload.');
  return new Error(err.message);
}

export type ChallengePatch = Pick<Partial<Challenge>, 'pet_name' | 'treat_dates' | 'pet_style' | 'start_date' | 'credited_days'>;

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;
  private userId: string | null = null;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  private toUser(u: { id: string; email?: string | null } | null | undefined): AuthUser | null {
    this.userId = u?.id ?? null;
    return u ? { id: u.id, email: u.email ?? null } : null;
  }

  private uid(): string {
    if (!this.userId) throw new Error('Not signed in');
    return this.userId;
  }

  async currentUser() {
    const { data } = await this.sb.auth.getSession();
    return this.toUser(data.session?.user);
  }

  onAuthChange(cb: (user: AuthUser | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_evt, session) => cb(this.toUser(session?.user)));
    return () => data.subscription.unsubscribe();
  }

  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async sendPasswordReset(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw new Error(error.message);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async getProfile(): Promise<Profile> {
    const id = this.uid();
    const res = await this.sb.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
    const row = check(res) as Profile | null;
    if (row) return row;
    // Trigger normally creates it; this covers accounts made before the migration ran.
    const created = await this.sb.from('profiles').insert({ id }).select(PROFILE_COLUMNS).single();
    return check(created) as Profile;
  }

  async updateProfile(patch: Partial<Profile>) {
    const rest: Record<string, unknown> = {};
    for (const k of PROFILE_EDITABLE) if (k in patch) rest[k] = patch[k];
    const res = await this.sb.from('profiles').update(rest).eq('id', this.uid()).select(PROFILE_COLUMNS).single();
    return check(res) as Profile;
  }

  async regenerateSyncToken() {
    // Generated on the server; the app can't set the token itself.
    const { error } = await this.sb.rpc('regenerate_sync_token');
    if (error) throw dbError(error);
    return this.getProfile();
  }

  async exportData(): Promise<DataExport> {
    const [{ data: u }, profile, challenges, logs] = await Promise.all([
      this.sb.auth.getUser(),
      this.getProfile(),
      this.listChallenges(),
      this.getLogs(...ALL_DATES),
    ]);
    return {
      exported_at: new Date().toISOString(),
      account: { email: u.user?.email ?? null },
      profile: withoutToken(profile),
      challenges,
      daily_logs: logs.sort((a, b) => a.log_date.localeCompare(b.log_date)),
      progress_photos: photoList(logs),
      food_diary: (await this.getFoodEntries(...ALL_DATES)).sort((a, b) => a.log_date.localeCompare(b.log_date)),
      my_foods: await this.getMyFoods(),
      saved_meals: await this.getSavedMeals(),
    };
  }

  async deleteAccount() {
    // Photos first: they live in file storage, which deleting the account's rows doesn't reach.
    await this.deleteAllPhotos();
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) throw dbError(error);
    // The account is gone on the server, so just clear this device's session.
    await this.sb.auth.signOut({ scope: 'local' });
  }

  async getActiveChallenge() {
    const res = await this.sb
      .from('challenges')
      .select('*')
      .eq('user_id', this.uid())
      .eq('status', 'active')
      .maybeSingle();
    return check(res) as Challenge | null;
  }

  async listChallenges() {
    const res = await this.sb.from('challenges').select('*').eq('user_id', this.uid()).order('created_at', { ascending: true });
    return check(res) as Challenge[];
  }

  async startChallenge(startDate: string, creditedDays = 0) {
    const { data, error } = await this.sb
      .from('challenges')
      .insert({ start_date: startDate, credited_days: creditedDays, user_id: this.uid() })
      .select('*')
      .single();
    if (!error) return data as Challenge;
    // Already has one running (e.g. a tap that went through twice): carry on with it.
    if (error.code === '23505') {
      const existing = await this.getActiveChallenge();
      if (existing) return existing;
      console.error('[75] active challenge exists but is not readable');
      throw new Error('You already have a challenge running, but it couldn’t be loaded. Try signing out and back in.');
    }
    throw dbError(error);
  }

  async endChallenge(id: string, status: 'reset' | 'completed', endedOn: string) {
    check(await this.sb.from('challenges').update({ status, ended_on: endedOn }).eq('id', id));
  }

  async updateChallenge(id: string, patch: ChallengePatch) {
    const { error } = await this.sb.from('challenges').update(patch).eq('id', id);
    if (error) throw dbError(error);
  }

  async getLogs(from: string, to: string) {
    const res = await this.sb
      .from('daily_logs')
      .select(LOG_COLUMNS)
      .eq('user_id', this.uid())
      .gte('log_date', from)
      .lte('log_date', to);
    return (check(res) as DailyLog[]).map(normaliseLog);
  }

  async saveLog(log: DailyLog, fields?: (keyof DailyLog)[]) {
    const row: Record<string, unknown> = { user_id: this.uid(), log_date: log.log_date };
    for (const k of fields ?? (Object.keys(log) as (keyof DailyLog)[])) row[k] = log[k];
    check(await this.sb.from('daily_logs').upsert(row, { onConflict: 'user_id,log_date' }));
  }
  async saveLogs(logs: DailyLog[]) {
    if (!logs.length) return;
    const uid = this.uid();
    check(await this.sb.from('daily_logs').upsert(logs.map((l) => ({ ...l, user_id: uid })), { onConflict: 'user_id,log_date' }));
  }

  async getFoodEntries(from: string, to: string) {
    const out: FoodEntry[] = [];
    // Page through, in case a long export asks for thousands of rows.
    for (let page = 0; page < 50; page++) {
      const res = await this.sb
        .from('food_entries')
        .select('*')
        .eq('user_id', this.uid())
        .gte('log_date', from)
        .lte('log_date', to)
        .order('created_at', { ascending: true })
        .range(page * 1000, page * 1000 + 999);
      const rows = check(res) as Record<string, unknown>[];
      out.push(...rows.map(normaliseEntry));
      if (rows.length < 1000) break;
    }
    return out;
  }

  async saveFoodEntries(entries: FoodEntry[]) {
    if (!entries.length) return;
    const uid = this.uid();
    check(await this.sb.from('food_entries').upsert(entries.map((e) => entryRow(e, uid)), { onConflict: 'id' }));
  }

  async deleteFoodEntries(ids: string[]) {
    if (!ids.length) return;
    check(await this.sb.from('food_entries').delete().eq('user_id', this.uid()).in('id', ids));
  }

  async getMyFoods() {
    const res = await this.sb.from('my_foods').select('*').eq('user_id', this.uid()).order('last_used', { ascending: false, nullsFirst: false }).limit(500);
    return (check(res) as MyFood[]).map((f) => ({ ...f, last_amount: num(f.last_amount) }));
  }

  async saveMyFoods(foods: MyFood[]) {
    if (!foods.length) return;
    const uid = this.uid();
    const rows = foods.map(({ id, key, food, favorite, custom, uses, last_amount, last_unit, last_meal, last_used }) => ({
      id, user_id: uid, key, food, favorite, custom, uses, last_amount, last_unit, last_meal, last_used,
    }));
    check(await this.sb.from('my_foods').upsert(rows, { onConflict: 'user_id,key' }));
  }

  async deleteMyFood(id: string) {
    check(await this.sb.from('my_foods').delete().eq('user_id', this.uid()).eq('id', id));
  }

  async getSavedMeals() {
    const res = await this.sb.from('saved_meals').select('*').eq('user_id', this.uid()).order('last_used', { ascending: false, nullsFirst: false });
    return check(res) as SavedMeal[];
  }

  async saveSavedMeal(m: SavedMeal) {
    const { id, name, items, uses, last_used } = m;
    check(await this.sb.from('saved_meals').upsert({ id, user_id: this.uid(), name, items, uses, last_used }, { onConflict: 'id' }));
  }

  async deleteSavedMeal(id: string) {
    check(await this.sb.from('saved_meals').delete().eq('user_id', this.uid()).eq('id', id));
  }

  async estimateMeal(req: EstimateRequest) {
    const { data, error } = await this.sb.functions.invoke('food', { body: req });
    if (error) {
      let code: EstimateError['code'] = 'failed';
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.status === 'number') {
        const body = await ctx.json().catch(() => ({}));
        if (body?.error === 'not_configured') code = 'not_configured';
        else if (body?.error === 'daily_limit' || ctx.status === 429) code = 'daily_limit';
      } else code = 'offline';
      throw new EstimateError(code, estimateMessage(code));
    }
    return data as { items: EstimatedItem[]; note: string };
  }

  async offProxy(action: 'product' | 'search', params: Record<string, string>) {
    const { data, error } = await this.sb.functions.invoke('food', { body: { action, ...params } });
    if (error) throw new Error('Open Food Facts couldn’t be reached. Try again in a moment.');
    return data;
  }

  private photos() {
    return this.sb.storage.from(PHOTO_BUCKET);
  }

  async uploadPhoto(date: string, full: Blob, thumb: Blob) {
    // A new name each time, so a replaced photo never shows a stale cached copy.
    const path = `${this.uid()}/${date}-${Date.now().toString(36)}.jpg`;
    const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
    const a = await this.photos().upload(path, await full.arrayBuffer(), opts);
    if (a.error) throw storageError(a.error);
    const b = await this.photos().upload(thumbPath(path), await thumb.arrayBuffer(), opts);
    if (b.error) {
      await this.photos().remove([path]);
      throw storageError(b.error);
    }
    return path;
  }

  async photoUrls(paths: string[], thumb = false) {
    const out: Record<string, string> = {};
    if (!paths.length) return out;
    const keys = paths.map((p) => (thumb ? thumbPath(p) : p));
    const { data, error } = await this.photos().createSignedUrls(keys, PHOTO_URL_SECONDS);
    if (error) throw storageError(error);
    data.forEach((d, i) => {
      if (d.signedUrl) out[paths[i]] = d.signedUrl;
    });
    return out;
  }

  async deletePhoto(path: string) {
    const { error } = await this.photos().remove([path, thumbPath(path)]);
    if (error) throw storageError(error);
  }

  private async deleteAllPhotos() {
    const folder = this.uid();
    for (let round = 0; round < 50; round++) {
      const { data, error } = await this.photos().list(folder, { limit: 100 });
      if (error) {
        if (/bucket not found/i.test(error.message)) return; // photos were never set up
        throw storageError(error);
      }
      if (!data.length) return;
      const { error: e2 } = await this.photos().remove(data.map((o) => `${folder}/${o.name}`));
      if (e2) throw storageError(e2);
    }
    throw new Error('Couldn’t delete all your progress photos. Try again.');
  }
}

// ---------------------------------------------------------------------------
// Local, on-device storage (no account).
// ---------------------------------------------------------------------------

const KEY = 'seventyfive:v1';

interface LocalState {
  user: AuthUser | null;
  profile: Profile;
  challenges: Challenge[];
  logs: Record<string, DailyLog>;
  food?: FoodEntry[];
  myFoods?: MyFood[];
  meals?: SavedMeal[];
}

const defaultProfile = (): Profile => ({
  id: 'local',
  display_name: '',
  water_goal_ml: 3785,
  step_goal: 10000,
  calorie_goal: 1800,
  workout_minutes: 45,
  workout_goal_minutes: 90,
  workout_favorites: [],
  reading_goal_pages: 10,
  steps_required: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  health_sync_token: '',
});

export class LocalRepo implements Repo {
  readonly kind = 'local' as const;
  private listeners = new Set<(u: AuthUser | null) => void>();

  private load(): LocalState {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalState;
        return { ...parsed, profile: { ...defaultProfile(), ...parsed.profile } };
      }
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
    return { user: null, profile: defaultProfile(), challenges: [], logs: {} };
  }

  private save(s: LocalState) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* private mode: keep going in memory */
    }
  }

  private mutate(fn: (s: LocalState) => void): LocalState {
    const s = this.load();
    fn(s);
    this.save(s);
    return s;
  }

  async currentUser() {
    return this.load().user;
  }

  onAuthChange(cb: (u: AuthUser | null) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(u: AuthUser | null) {
    this.listeners.forEach((l) => l(u));
  }

  async signUp(_email: string, _password: string, displayName: string) {
    const user = { id: 'local', email: null };
    this.mutate((s) => {
      s.user = user;
      s.profile.display_name = displayName;
    });
    this.emit(user);
    return { needsConfirmation: false };
  }

  async signIn() {
    const user = { id: 'local', email: null };
    this.mutate((s) => (s.user = user));
    this.emit(user);
  }

  async sendPasswordReset() {}

  async signOut() {
    this.mutate((s) => (s.user = null));
    this.emit(null);
  }

  async getProfile() {
    return this.load().profile;
  }

  async updateProfile(patch: Partial<Profile>) {
    return this.mutate((s) => (s.profile = { ...s.profile, ...patch, id: 'local' })).profile;
  }

  async regenerateSyncToken() {
    return this.load().profile;
  }

  async exportData(): Promise<DataExport> {
    const s = this.load();
    return {
      exported_at: new Date().toISOString(),
      account: { email: null },
      profile: withoutToken(s.profile),
      challenges: s.challenges,
      daily_logs: Object.values(s.logs).map(normaliseLog).sort((a, b) => a.log_date.localeCompare(b.log_date)),
      progress_photos: photoList(Object.values(s.logs)),
      food_diary: s.food ?? [],
      my_foods: s.myFoods ?? [],
      saved_meals: s.meals ?? [],
    };
  }

  async deleteAccount() {
    await photoStore('clear').catch(() => {});
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    this.emit(null);
  }

  async getActiveChallenge() {
    return this.load().challenges.find((c) => c.status === 'active') ?? null;
  }

  async listChallenges() {
    return this.load().challenges;
  }

  async startChallenge(startDate: string, creditedDays = 0) {
    const c: Challenge = {
      id: crypto.randomUUID(),
      start_date: startDate,
      credited_days: creditedDays,
      status: 'active',
      ended_on: null,
      created_at: new Date().toISOString(),
    };
    this.mutate((s) => s.challenges.push(c));
    return c;
  }

  async endChallenge(id: string, status: 'reset' | 'completed', endedOn: string) {
    this.mutate((s) => {
      const c = s.challenges.find((x) => x.id === id);
      if (c) Object.assign(c, { status, ended_on: endedOn });
    });
  }

  async updateChallenge(id: string, patch: ChallengePatch) {
    this.mutate((s) => {
      const c = s.challenges.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    });
  }

  async getLogs(from: string, to: string) {
    return Object.values(this.load().logs)
      .filter((l) => l.log_date >= from && l.log_date <= to)
      .map(normaliseLog);
  }

  async saveLog(log: DailyLog) {
    this.mutate((s) => (s.logs[log.log_date] = log));
  }

  async saveLogs(logs: DailyLog[]) {
    this.mutate((s) => logs.forEach((l) => (s.logs[l.log_date] = l)));
  }

  async getFoodEntries(from: string, to: string) {
    return (this.load().food ?? []).filter((e) => e.log_date >= from && e.log_date <= to);
  }

  async saveFoodEntries(entries: FoodEntry[]) {
    this.mutate((s) => {
      const list = s.food ?? [];
      for (const e of entries) {
        const i = list.findIndex((x) => x.id === e.id);
        if (i >= 0) list[i] = e;
        else list.push({ ...e, created_at: e.created_at ?? new Date().toISOString() });
      }
      s.food = list;
    });
  }

  async deleteFoodEntries(ids: string[]) {
    this.mutate((s) => (s.food = (s.food ?? []).filter((e) => !ids.includes(e.id))));
  }

  async getMyFoods() {
    return this.load().myFoods ?? [];
  }

  async saveMyFoods(foods: MyFood[]) {
    this.mutate((s) => {
      const list = s.myFoods ?? [];
      for (const f of foods) {
        const i = list.findIndex((x) => x.key === f.key);
        if (i >= 0) list[i] = f;
        else list.push(f);
      }
      s.myFoods = list;
    });
  }

  async deleteMyFood(id: string) {
    this.mutate((s) => (s.myFoods = (s.myFoods ?? []).filter((f) => f.id !== id)));
  }

  async getSavedMeals() {
    return this.load().meals ?? [];
  }

  async saveSavedMeal(m: SavedMeal) {
    this.mutate((s) => {
      const list = s.meals ?? [];
      const i = list.findIndex((x) => x.id === m.id);
      if (i >= 0) list[i] = m;
      else list.push(m);
      s.meals = list;
    });
  }

  async deleteSavedMeal(id: string) {
    this.mutate((s) => (s.meals = (s.meals ?? []).filter((m) => m.id !== id)));
  }

  async estimateMeal(): Promise<{ items: EstimatedItem[]; note: string }> {
    throw new EstimateError('local', estimateMessage('local'));
  }

  async offProxy(): Promise<unknown> {
    throw new Error('Open Food Facts couldn’t be reached.');
  }

  // Photos are too big for localStorage, so they go in the browser's IndexedDB.
  private urls = new Map<string, string>();

  async uploadPhoto(date: string, full: Blob, thumb: Blob) {
    const path = `local/${date}-${Date.now().toString(36)}.jpg`;
    await photoStore('put', path, full);
    await photoStore('put', thumbPath(path), thumb);
    return path;
  }

  async photoUrls(paths: string[], thumb = false) {
    const out: Record<string, string> = {};
    for (const p of paths) {
      const key = thumb ? thumbPath(p) : p;
      let url = this.urls.get(key);
      if (!url) {
        const blob = await photoStore('get', key);
        if (!(blob instanceof Blob)) continue;
        url = URL.createObjectURL(blob);
        this.urls.set(key, url);
      }
      out[p] = url;
    }
    return out;
  }

  async deletePhoto(path: string) {
    for (const key of [path, thumbPath(path)]) {
      await photoStore('delete', key);
      const url = this.urls.get(key);
      if (url) URL.revokeObjectURL(url);
      this.urls.delete(key);
    }
  }
}

function photoStore(op: 'get' | 'put' | 'delete' | 'clear', key?: string, value?: Blob): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Photos can’t be saved in this browser.'));
    const open = indexedDB.open('seventyfive-photos', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('photos');
    open.onerror = () => reject(open.error ?? new Error('Photos can’t be saved in this browser.'));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('photos', op === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('photos');
      const req =
        op === 'get' ? store.get(key!) : op === 'put' ? store.put(value!, key!) : op === 'delete' ? store.delete(key!) : store.clear();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    };
  });
}

export function createRepo(preferLocal = false): Repo {
  if (!preferLocal && supabaseConfigured) return new SupabaseRepo(supabaseUrl!, supabaseAnonKey!);
  return new LocalRepo();
}
