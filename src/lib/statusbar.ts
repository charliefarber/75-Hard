import { Capacitor } from '@capacitor/core';

/** Light text over the green screens, dark text over the off-white ones (native app only). */
export function setStatusBar(over: 'green' | 'light') {
  if (!Capacitor.isNativePlatform()) return;
  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: over === 'green' ? Style.Dark : Style.Light }))
    .catch(() => {});
}
