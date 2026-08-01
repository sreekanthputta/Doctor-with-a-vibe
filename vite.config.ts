import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://127.0.0.1:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules/**', 'dist/**', 'dist-server/**', 'tests/e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
