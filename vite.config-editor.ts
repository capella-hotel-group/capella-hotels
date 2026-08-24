import { defineConfig } from 'vite';
import {
  getAllEntries,
  manualChunks,
  versionBanner,
  cleanGeneratedOutputs,
  copyBlockAssets,
} from './vite.shared.ts';

// Universal Editor build: same entries/aliasing as the runtime build, built in
// 'editor' mode so blocks can branch on import.meta.env.MODE if UE-only behavior
// is ever needed, without duplicating the entry-discovery/alias/vendor-chunk rules.
export default defineConfig({
  mode: 'editor',
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: '.',
    emptyOutDir: false,
    minify: false,
    target: 'es2020',
    rollupOptions: {
      input: getAllEntries(),
      treeshake: false,
      preserveEntrySignatures: 'strict',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'scripts/vendor/[name]-[hash].js',
        manualChunks,
        banner: versionBanner(),
      },
    },
  },
  plugins: [cleanGeneratedOutputs(), copyBlockAssets()],
});
