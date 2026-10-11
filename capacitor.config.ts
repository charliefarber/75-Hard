import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.charliefarber.seventyfivehard',
  appName: '75 Hard',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0E5A33',
  },
};

export default config;
