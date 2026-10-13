/**
 * "Sync steps" for the web app: runs her iPhone Shortcut (which posts the week's steps to
 * sync_steps), then reloads once she's back. The Shortcut's name is remembered on this phone.
 */

const KEY = 'seventyfive:shortcut-name';
export const DEFAULT_SHORTCUT = 'Hard75';

export function shortcutName(): string {
  try {
    return localStorage.getItem(KEY)?.trim() || DEFAULT_SHORTCUT;
  } catch {
    return DEFAULT_SHORTCUT;
  }
}

export function setShortcutName(name: string) {
  try {
    const n = name.trim();
    if (!n || n === DEFAULT_SHORTCUT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, n.slice(0, 60));
  } catch {
    /* storage unavailable: the default name is used */
  }
}

export const shortcutUrl = (name: string) => `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;

/** iPhone / iPad (iPadOS reports itself as a Mac with touch). */
export function canRunShortcuts(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Open the Shortcuts app on her Shortcut. iOS switches apps; when she comes back the app reloads
 * (on becoming visible), and these timers catch a Shortcut that was still sending at that moment
 * (timers pause in the background and carry on when she returns).
 */
export function runShortcut(reload: () => void) {
  window.location.href = shortcutUrl(shortcutName());
  window.setTimeout(reload, 2500);
  window.setTimeout(reload, 7000);
}
