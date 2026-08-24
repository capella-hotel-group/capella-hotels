import { defineConfig } from 'vite';
import {
  getAllEntries,
  manualChunks,
  versionBannerPlugin,
  cleanGeneratedOutputs,
  copyBlockAssets,
  getPackageVersion,
} from './vite.helpers.ts';

// Runtime build: emits scripts/*.js and blocks/<name>/<name>.js at the repo root,
// matching the exact paths the AEM EDS runtime (scripts.js / dynamic block import) expects.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: '.',
    emptyOutDir: false,
    minify: false,
    target: 'es2022',
    rollupOptions: {
      input: getAllEntries(),
      treeshake: false,
      preserveEntrySignatures: 'strict',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'scripts/vendor/[name]-[hash].js',
        manualChunks,
      },
    },
  },
  plugins: [cleanGeneratedOutputs(), copyBlockAssets(), versionBannerPlugin(getPackageVersion())],
});
