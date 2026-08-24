import { readdirSync, existsSync, readFileSync, unlinkSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Plugin } from 'vite';

const ROOT = process.cwd();
const SRC_BLOCKS = join(ROOT, 'src/blocks');
const SRC_STYLES = join(ROOT, 'src/styles');
const APP_ENTRIES: Record<string, string> = {
  'scripts/scripts': 'src/app/scripts.ts',
  'scripts/aem': 'src/app/aem.ts',
  'scripts/delayed': 'src/app/delayed.ts',
};

/**
 * Finds every block entry file whose name matches its parent block directory
 * (src/blocks/<name>/<name>.ts), so new blocks are picked up with zero config edits.
 */
export function discoverBlockEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  if (!existsSync(SRC_BLOCKS)) return entries;
  readdirSync(SRC_BLOCKS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((dir) => {
      const entryFile = join(SRC_BLOCKS, dir.name, `${dir.name}.ts`);
      if (existsSync(entryFile)) {
        entries[`blocks/${dir.name}/${dir.name}`] = `src/blocks/${dir.name}/${dir.name}.ts`;
      }
    });
  return entries;
}

export function getAllEntries(): Record<string, string> {
  return { ...APP_ENTRIES, ...discoverBlockEntries() };
}

/**
 * Groups third-party dependencies into named vendor chunks instead of duplicating
 * them across every block bundle that imports them.
 */
export function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes(`${'node_modules'}/three`)) return 'three-core';
  return 'aem-core';
}

export function versionBanner(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  return `/*! ${pkg.name} v${pkg.version} - built ${new Date().toISOString()} */`;
}

/**
 * Removes previously generated entry outputs before each build so stale bundles
 * for renamed/removed blocks don't linger in the delivered tree.
 */
export function cleanGeneratedOutputs(): Plugin {
  return {
    name: 'clean-generated-outputs',
    buildStart() {
      Object.keys(getAllEntries()).forEach((name) => {
        const outFile = join(ROOT, `${name}.js`);
        if (existsSync(outFile)) unlinkSync(outFile);
      });
    },
  };
}

/**
 * Copies each block's non-bundled static assets (CSS, index.html) and the shared
 * styles/*.css files from src/ to their delivered root-level paths.
 */
export function copyBlockAssets(): Plugin {
  return {
    name: 'copy-block-assets',
    writeBundle() {
      if (existsSync(SRC_BLOCKS)) {
        readdirSync(SRC_BLOCKS, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .forEach((dir) => {
            const srcDir = join(SRC_BLOCKS, dir.name);
            const outDir = join(ROOT, 'blocks', dir.name);
            mkdirSync(outDir, { recursive: true });
            readdirSync(srcDir, { withFileTypes: true })
              .filter((f) => f.isFile() && /\.(css|html)$/.test(f.name))
              .forEach((f) => copyFileSync(join(srcDir, f.name), join(outDir, f.name)));
          });
      }
      if (existsSync(SRC_STYLES)) {
        const outDir = join(ROOT, 'styles');
        mkdirSync(outDir, { recursive: true });
        readdirSync(SRC_STYLES, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith('.css'))
          .forEach((f) => copyFileSync(join(SRC_STYLES, f.name), join(outDir, basename(f.name))));
      }
    },
  };
}
