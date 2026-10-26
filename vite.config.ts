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
  toPosix,
} from './vite.helpers.ts';
import { SRC_DIR } from './config.ts';

// Runtime build: emits scripts/*.js, styles/*.css, and blocks/<name>/<name>.{js,css}
// at the repo root, matching the exact paths the AEM EDS runtime expects.
export default defineConfig({
  resolve: {
    alias: {
      '@': toPosix(SRC_DIR),
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
