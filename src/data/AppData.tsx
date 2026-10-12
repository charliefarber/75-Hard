import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, parseISO } from 'date-fns';
import { createRepo, type ChallengePatch, type Repo } from './repo';
import type { AuthUser, Challenge, DailyLog, Profile } from './types';
import { emptyLog } from './types';
import { toISODate, todayISO } from '../lib/challenge';
import { healthAvailable, readHealthDays, requestHealthAccess } from '../health/health';
import { logsDiffer, mergeHealthDay } from '../health/merge';

type Status = 'loading' | 'signedOut' | 'needsChallenge' | 'ready';

const HEALTH_FLAG = 'seventyfive:health-connected';

interface HealthState {
  available: boolean;
  connected: boolean;
  syncing: boolean;
  lastSync: Date | null;
}

interface AppData {
  repo: Repo;
  status: Status;
  user: AuthUser | null;
  profile: Profile | null;
  challenge: Challenge | null;
  history: Challenge[];
  logs: Record<string, DailyLog>;
  today: string;
  health: HealthState;
  error: string | null;
  clearError(): void;
  logFor(date: string): DailyLog;
  updateLog(date: string, fn: (log: DailyLog) => DailyLog): void;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  regenerateSyncToken(): Promise<void>;
  startChallenge(startDate: string, opts?: { tickOffPast?: boolean }): Promise<void>;
  /** Move the start date (days re-number from the new date). */
  changeStartDate(startDate: string): Promise<void>;
  applyBirthdayPass(date: string, year: number): Promise<void>;
  undoBirthdayPass(date: string): Promise<void>;
  restartChallenge(): Promise<void>;
  updateChallenge(patch: ChallengePatch): Promise<void>;
  connectHealth(): Promise<void>;
  syncHealth(): Promise<void>;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

/** A day with every task ticked off, used for days done before signing up. */
function completeLog(date: string, p: Profile): DailyLog {
  return {
    ...emptyLog(date),
    workouts: [
      { done: true, minutes: p.workout_minutes, type: '', outdoor: false, source: 'manual' },
      { done: true, minutes: p.workout_minutes, type: '', outdoor: false, source: 'manual' },
    ],
    water_ml: p.water_goal_ml,
    pages_read: p.reading_goal_pages,
    followed_diet: true,
    no_cheat_meal: true,
    no_alcohol: true,
  };
}

export function useApp(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

const readFlag = () => {
  try {
    return localStorage.getItem(HEALTH_FLAG) === '1';
  } catch {
    return false;
  }
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createRepo(), []);
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [history, setHistory] = useState<Challenge[]>([]);
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [today, setToday] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>({ available: false, connected: readFlag(), syncing: false, lastSync: null });

  const logsRef = useRef(logs);
  logsRef.current = logs;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const userIdRef = useRef<string | null>(null);
  const dirty = useRef(new Map<string, Set<keyof DailyLog>>());

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  // ---- loading -------------------------------------------------------------

  const loadLogs = useCallback(
    async (c: Challenge | null) => {
      const now = todayISO();
      const twoWeeksAgo = toISODate(addDays(parseISO(now), -14));
      const from = c && c.start_date < twoWeeksAgo ? c.start_date : twoWeeksAgo;
      const rows = await repo.getLogs(from, now);
      setLogs((prev) => {
        const next = { ...prev };
        for (const r of rows) if (!pending.current.has(r.log_date)) next[r.log_date] = r;
        return next;
      });
    },
    [repo],
  );

  // Only the most recent load may write state, so overlapping loads (page load +
  // auth event) can never leave the app on the wrong screen.
  const loadSeq = useRef(0);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeq.current;
    const stale = () => seq !== loadSeq.current;
    const u = await repo.currentUser();
    if (stale()) return;
    userIdRef.current = u?.id ?? null;
    setUser(u);
    if (!u) {
      setStatus('signedOut');
      return;
    }
    let p = await repo.getProfile();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && p.timezone !== tz) p = await repo.updateProfile({ timezone: tz }).catch(() => p);
    const all = await repo.listChallenges();
    const c = all.find((x) => x.status === 'active') ?? null;
    if (stale()) return;
    setProfile(p);
    setChallenge(c);
    setHistory(all);
    setStatus(c ? 'ready' : 'needsChallenge');
    // Logs failing to load shouldn't bounce her back to set-up.
    await loadLogs(c).catch(fail);
  }, [repo, loadLogs, fail]);

  useEffect(() => {
    loadAll().catch((e) => {
      fail(e);
      setStatus('signedOut');
    });
    const off = repo.onAuthChange((u) => {
      const id = u?.id ?? null;
      if (id === userIdRef.current) return;
      userIdRef.current = id;
      // Supabase asks that no other Supabase calls run inside its auth callback,
      // so hand the reload off to the next tick.
      setTimeout(() => {
        setUser(u);
        if (u) loadAll().catch(fail);
        else {
          loadSeq.current++;
          setStatus('signedOut');
          setProfile(null);
          setChallenge(null);
          setLogs({});
        }
      }, 0);
    });
    healthAvailable().then((available) => setHealth((h) => ({ ...h, available })));
    return off;
  }, [repo, loadAll, fail]);

  // ---- saving --------------------------------------------------------------

  const flush = useCallback(
    (date: string) => {
      const t = pending.current.get(date);
      if (t) clearTimeout(t);
      pending.current.delete(date);
      const fields = dirty.current.get(date);
      dirty.current.delete(date);
      const log = logsRef.current[date];
      if (log && fields?.size) repo.saveLog(log, [...fields]).catch(fail);
    },
    [repo, fail],
  );

  const flushAll = useCallback(() => {
    [...pending.current.keys()].forEach(flush);
  }, [flush]);

  const logFor = useCallback((date: string) => logs[date] ?? emptyLog(date), [logs]);

  const updateLog = useCallback(
    (date: string, fn: (log: DailyLog) => DailyLog) => {
      const before = logsRef.current[date] ?? emptyLog(date);
      const after = fn(before);
      const changed = dirty.current.get(date) ?? new Set<keyof DailyLog>();
      (Object.keys(after) as (keyof DailyLog)[]).forEach((k) => {
        if (JSON.stringify(after[k]) !== JSON.stringify(before[k])) changed.add(k);
      });
      dirty.current.set(date, changed);
      logsRef.current = { ...logsRef.current, [date]: after };
      setLogs((prev) => ({ ...prev, [date]: after }));
      const t = pending.current.get(date);
      if (t) clearTimeout(t);
      pending.current.set(date, setTimeout(() => flush(date), 600));
    },
    [flush],
  );

  // ---- health --------------------------------------------------------------

  const syncHealth = useCallback(async () => {
    const p = profileRef.current;
    if (!p || !(await healthAvailable())) return;
    setHealth((h) => ({ ...h, syncing: true }));
    try {
      const now = todayISO();
      const from = toISODate(addDays(parseISO(now), -6));
      const days = await readHealthDays(from, now);
      for (const d of days) {
        const current = logsRef.current[d.date] ?? emptyLog(d.date);
        const merged = mergeHealthDay(current, d, p);
        if (logsDiffer(current, merged)) updateLog(d.date, () => merged);
      }
      setHealth((h) => ({ ...h, syncing: false, lastSync: new Date() }));
    } catch (e) {
      setHealth((h) => ({ ...h, syncing: false }));
      fail(e);
    }
  }, [updateLog, fail]);

  const connectHealth = useCallback(async () => {
    try {
      await requestHealthAccess();
      try {
        localStorage.setItem(HEALTH_FLAG, '1');
      } catch {
        /* ignore */
      }
      setHealth((h) => ({ ...h, connected: true }));
      await syncHealth();
    } catch (e) {
      fail(e);
    }
  }, [syncHealth, fail]);

  const refresh = useCallback(async () => {
    setToday(todayISO());
    if (status !== 'ready') return;
    await loadLogs(challenge).catch(fail);
    if (health.connected) await syncHealth();
  }, [status, challenge, health.connected, loadLogs, syncHealth, fail]);

  // Re-sync whenever the app comes back to the foreground; save before it goes away.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushAll();
      else refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flushAll);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flushAll);
    };
  }, [flushAll, refresh]);

  useEffect(() => {
    if (status === 'ready' && health.connected && health.available) syncHealth();
  }, [status, health.connected, health.available, syncHealth]);

  // ---- profile & challenges --------------------------------------------------

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      setProfile((p) => (p ? { ...p, ...patch } : p));
      try {
        setProfile(await repo.updateProfile(patch));
      } catch (e) {
        fail(e);
      }
    },
    [repo, fail],
  );

  const regenerateSyncToken = useCallback(async () => {
    try {
      setProfile(await repo.regenerateSyncToken());
    } catch (e) {
      fail(e);
    }
  }, [repo, fail]);

  const startChallenge = useCallback(
    async (startDate: string, opts: { tickOffPast?: boolean } = {}) => {
      try {
        const c = await repo.startChallenge(startDate, 0);
        const p = profileRef.current;
        if (opts.tickOffPast && p) {
          // Days already done before signing up: tick every task off (each day can still be edited).
          const now = todayISO();
          const filled: DailyLog[] = [];
          for (let d = startDate; d < now; d = toISODate(addDays(parseISO(d), 1))) {
            const existing = logsRef.current[d];
            if (existing && Object.keys(existing).length && existing.water_ml > 0) continue;
            filled.push(completeLog(d, p));
          }
          await repo.saveLogs(filled);
          setLogs((prev) => ({ ...prev, ...Object.fromEntries(filled.map((l) => [l.log_date, l])) }));
        }
        setChallenge(c);
        setHistory((h) => (h.some((x) => x.id === c.id) ? h : [...h, c]));
        setStatus('ready');
        await loadLogs(c).catch(fail);
      } catch (e) {
        fail(e);
      }
    },
    [repo, loadLogs, fail],
  );

  const changeStartDate = useCallback(
    async (startDate: string) => {
      if (!challenge) return;
      const before = challenge;
      setChallenge({ ...challenge, start_date: startDate, credited_days: 0 });
      try {
        await repo.updateChallenge(challenge.id, { start_date: startDate, credited_days: 0 });
        await loadLogs({ ...challenge, start_date: startDate });
      } catch (e) {
        setChallenge(before);
        fail(e);
      }
    },
    [repo, challenge, loadLogs, fail],
  );

  const applyBirthdayPass = useCallback(
    async (date: string, year: number) => {
      updateLog(date, (l) => ({ ...l, birthday_pass: true }));
      setProfile((p) => (p ? { ...p, birthday_pass_year: year } : p));
      try {
        setProfile(await repo.updateProfile({ birthday_pass_year: year }));
      } catch (e) {
        fail(e);
      }
    },
    [repo, updateLog, fail],
  );

  const undoBirthdayPass = useCallback(
    async (date: string) => {
      updateLog(date, (l) => ({ ...l, birthday_pass: false }));
      setProfile((p) => (p ? { ...p, birthday_pass_year: null } : p));
      try {
        setProfile(await repo.updateProfile({ birthday_pass_year: null }));
      } catch (e) {
        fail(e);
      }
    },
    [repo, updateLog, fail],
  );

  const restartChallenge = useCallback(async () => {
    if (!challenge) return;
    try {
      const now = todayISO();
      await repo.endChallenge(challenge.id, 'reset', now);
      let c = await repo.startChallenge(now);
      const keep = { pet_name: challenge.pet_name ?? 'Mochi', pet_style: challenge.pet_style ?? 'girl' };
      if (keep.pet_name !== 'Mochi' || keep.pet_style !== 'girl') {
        await repo.updateChallenge(c.id, keep).catch(() => {});
        c = { ...c, ...keep };
      }
      setHistory((h) => [...h.map((x) => (x.id === challenge.id ? { ...x, status: 'reset' as const, ended_on: now } : x)), c]);
      setChallenge(c);
    } catch (e) {
      fail(e);
    }
  }, [repo, challenge, fail]);

  const updateChallenge = useCallback(
    async (patch: ChallengePatch) => {
      if (!challenge) return;
      const before = challenge;
      setChallenge({ ...challenge, ...patch });
      try {
        await repo.updateChallenge(challenge.id, patch);
      } catch (e) {
        setChallenge(before);
        fail(e);
      }
    },
    [repo, challenge, fail],
  );

  const signOut = useCallback(async () => {
    flushAll();
    await repo.signOut();
  }, [repo, flushAll]);

  const value: AppData = {
    repo,
    status,
    user,
    profile,
    challenge,
    history,
    logs,
    today,
    health,
    error,
    clearError: () => setError(null),
    logFor,
    updateLog,
    updateProfile,
    regenerateSyncToken,
    startChallenge,
    restartChallenge,
    changeStartDate,
    applyBirthdayPass,
    undoBirthdayPass,
    updateChallenge,
    connectHealth,
    syncHealth,
    refresh,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
