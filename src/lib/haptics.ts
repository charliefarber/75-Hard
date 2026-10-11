import { Capacitor } from '@capacitor/core';

let mod: typeof import('@capacitor/haptics') | null = null;
if (Capacitor.isNativePlatform()) {
  import('@capacitor/haptics').then((m) => (mod = m)).catch(() => {});
}

/** Light tick on toggles and steppers (native app only). */
export function tap() {
  mod?.Haptics.impact({ style: mod.ImpactStyle.Light }).catch(() => {});
}

/** Celebration buzz when a day is completed. */
export function success() {
  mod?.Haptics.notification({ type: mod.NotificationType.Success }).catch(() => {});
}
