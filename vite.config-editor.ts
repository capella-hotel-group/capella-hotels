import path from 'node:path';
import { defineConfig } from 'vite';
import { versionBannerPlugin, getPackageVersion, manualChunks } from './vite.helpers.ts';
import { ROOT, SRC_DIR } from './config.ts';

const scriptsEntry = path.resolve(SRC_DIR, 'app', 'scripts.ts');
const aemEntry = path.resolve(SRC_DIR, 'app', 'aem.ts');

// Universal Editor build: builds only the UE integration script. It is emitted
// to scripts/editor-support.js (the fixed path the Universal Editor inject
// mechanism expects) and references the already-built scripts/scripts.js and
// scripts/aem.js as externals instead of re-bundling the whole app + block set.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: ROOT,
    emptyOutDir: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        'editor-support': path.resolve(SRC_DIR, 'app', 'editor', 'editor-support.ts'),
      },
      external: [scriptsEntry, aemEntry],
      output: {
        paths: {
          [scriptsEntry]: '/scripts/scripts.js',
          [aemEntry]: '/scripts/aem.js',
        },
        entryFileNames: 'scripts/[name].js',
        manualChunks,
        chunkFileNames: 'chunks/[name].js',
        format: 'es',
      },
      preserveEntrySignatures: 'exports-only',
    },
  },
  plugins: [versionBannerPlugin(getPackageVersion())],
});
