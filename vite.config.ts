import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          // Launch (or restart) Electron only after main.ts has finished building.
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'fluent-ffmpeg', 'ffmpeg-static', 'chokidar', 'node:http', 'node:fs', 'node:fs/promises', 'node:path', 'node:crypto', 'node:url', 'node:child_process', 'node:os'],
              output: { format: 'cjs', entryFileNames: '[name].js' }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) { options.reload(); },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: { format: 'es', entryFileNames: 'preload.mjs' }
            }
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: { port: 5193, strictPort: true }
});
