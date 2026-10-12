import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser, Challenge, DailyLog, Profile } from './types';
import { normaliseLog } from './types';

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
}

export interface DataExport {
  exported_at: string;
  account: { email: string | null };
  profile: Omit<Profile, 'health_sync_token'>;
  challenges: Challenge[];
  daily_logs: DailyLog[];
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
] as const;

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
    };
  }

  async deleteAccount() {
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
}

const defaultProfile = (): Profile => ({
  id: 'local',
  display_name: '',
  water_goal_ml: 3785,
  step_goal: 10000,
  calorie_goal: 1800,
  workout_minutes: 45,
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
    };
  }

  async deleteAccount() {
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
}

export function createRepo(preferLocal = false): Repo {
  if (!preferLocal && supabaseConfigured) return new SupabaseRepo(supabaseUrl!, supabaseAnonKey!);
  return new LocalRepo();
}
