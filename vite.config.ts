import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
