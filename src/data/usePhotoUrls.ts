import { useEffect, useState } from 'react';
import { useApp } from './AppData';
import { PHOTO_URL_SECONDS } from './repo';

/** Signed photo links, kept until shortly before they expire so scrolling never re-asks. */
const cache = new Map<string, { url: string; until: number }>();
const key = (path: string, thumb: boolean) => `${thumb ? 't' : 'f'}:${path}`;

function fromCache(paths: string[], thumb: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const now = Date.now();
  for (const p of paths) {
    const c = cache.get(key(p, thumb));
    if (c && c.until > now) out[p] = c.url;
  }
  return out;
}

/** Links for showing progress photos, by storage path. Missing until they've loaded. */
export function usePhotoUrls(paths: (string | null | undefined)[], thumb = false): Record<string, string> {
  const { repo } = useApp();
  const list = paths.filter((p): p is string => !!p);
  const id = list.join('|');
  const [urls, setUrls] = useState(() => fromCache(list, thumb));

  useEffect(() => {
    const wanted = id ? id.split('|') : [];
    const soon = Date.now() + 120_000;
    const missing = wanted.filter((p) => (cache.get(key(p, thumb))?.until ?? 0) < soon);
    setUrls(fromCache(wanted, thumb));
    if (!missing.length) return;
    let live = true;
    // Sign in batches so a long gallery is a handful of requests, not one per photo.
    (async () => {
      for (let i = 0; i < missing.length; i += 50) {
        const got = await repo.photoUrls(missing.slice(i, i + 50), thumb).catch(() => ({}) as Record<string, string>);
        const until = Date.now() + (PHOTO_URL_SECONDS - 300) * 1000;
        for (const [p, url] of Object.entries(got)) cache.set(key(p, thumb), { url, until });
        if (live) setUrls(fromCache(wanted, thumb));
      }
    })();
    return () => {
      live = false;
    };
  }, [id, thumb, repo]);

  return urls;
}
