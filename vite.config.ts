import { defineConfig } from 'vite';
import {
  getAllEntries,
  manualChunks,
  chunkFileNames,
  assetFileNames,
  versionBannerPlugin,
  cleanGeneratedOutputs,
  copyBlockHtml,
  getPackageVersion,
} from './vite.helpers.ts';

// Runtime build: emits scripts/*.js, styles/*.css, and blocks/<name>/<name>.{js,css}
// at the repo root, matching the exact paths the AEM EDS runtime expects.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,    
    },
  },
  build: {
    outDir: '.',
    emptyOutDir: false,
    modulePreload: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 550,
    target: 'es2022',
    rollupOptions: {
      input: getAllEntries(),
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames,
        assetFileNames,
        manualChunks,
      },
    },
  },
  plugins: [cleanGeneratedOutputs(), copyBlockHtml(), versionBannerPlugin(getPackageVersion())],
});
