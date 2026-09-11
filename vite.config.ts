import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: '127.0.0.1',
    // The repository also contains Python environments for the API and Vibe
    // sidecar. Watching their tens of thousands of files exhausts Linux's
    // inotify limit and can take down the dev server during browser tests.
    watch: {
      ignored: ['**/.venv/**', '**/.venv-vibe/**', '**/node_modules/**', '**/test-results/**', '**/playwright-report/**'],
    },
  },
  build: { target: 'es2020', sourcemap: false },
});
