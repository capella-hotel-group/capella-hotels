import path from 'node:path';
import { defineConfig } from 'vite';
import { versionBannerPlugin, getPackageVersion, manualChunks, toPosix } from './vite.helpers.ts';
import { ROOT, SRC_DIR } from './config.ts';

const scriptsEntry = toPosix(path.resolve(SRC_DIR, 'app', 'scripts.ts'));
const aemEntry = toPosix(path.resolve(SRC_DIR, 'app', 'aem.ts'));

// Matched via a function so it works whether the bundler hands over ids with `/` or `\` (Windows).
const externalPaths: Record<string, string> = {
  // relative so the URL matches head.html's module on author (/content/<site>.resource/...);
  // an absolute path loads a second scripts.js instance and duplicates header/footer
  [scriptsEntry]: './scripts.js',
  [aemEntry]: './aem.js',
};

// Universal Editor build: builds only the UE integration script. It is emitted
// to scripts/editor-support.js (the fixed path the Universal Editor inject
// mechanism expects) and references the already-built scripts/scripts.js and
// scripts/aem.js as externals instead of re-bundling the whole app + block set.
export default defineConfig({
  resolve: {
    alias: {
      '@': toPosix(SRC_DIR),
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
      external: (id) => toPosix(id) in externalPaths,
      output: {
        paths: (id) => externalPaths[toPosix(id)] ?? id,
        entryFileNames: 'scripts/[name].js',
        manualChunks,
        chunkFileNames: 'chunks/editor/[name].js',
        format: 'es',
      },
      preserveEntrySignatures: 'exports-only',
    },
  },
  plugins: [versionBannerPlugin(getPackageVersion())],
});
