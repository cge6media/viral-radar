import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// Base path: GitHub Pages serves at /<repo>/ — set VITE_BASE=/viral-radar/ in CI; '/' locally.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    {
      // copy the pipeline's latest.json into the build so the static site ships with data
      name: 'copy-data',
      closeBundle() {
        const outDir = path.resolve(__dirname, 'dist/data');
        for (const name of ['latest.json', 'videos.json']) {
          const src = path.resolve(__dirname, '../data', name);
          if (existsSync(src)) {
            mkdirSync(outDir, { recursive: true });
            copyFileSync(src, path.join(outDir, name));
          }
        }
      },
    },
  ],
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
