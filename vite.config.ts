import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the same build works on a static host and inside the iOS app.
  base: './',
  server: { host: true },
});
