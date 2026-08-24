import { createHash } from 'node:crypto';
import { readdirSync, existsSync, readFileSync, unlinkSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Plugin } from 'vite';
import { ROOT, SRC_DIR, BLOCKS_DIR, STYLES_DIR } from './config.ts';

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
  if (!existsSync(BLOCKS_DIR)) return entries;
  readdirSync(BLOCKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((dir) => {
      const entryFile = join(BLOCKS_DIR, dir.name, `${dir.name}.ts`);
      if (existsSync(entryFile)) {
        entries[`blocks/${dir.name}/${dir.name}`] = `src/blocks/${dir.name}/${dir.name}.ts`;
      }
    });
  return entries;
}

export function getAllEntries(): Record<string, string> {
  return { ...APP_ENTRIES, ...discoverBlockEntries() };
}

/** Reads `name`/`version` out of package.json, for the version-banner plugin. */
export function getPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  return pkg.version;
}

/**
 * Groups third-party dependencies and shared runtime helpers into named vendor
 * chunks instead of duplicating them across every block bundle that imports them.
 */
export function manualChunks(id: string): string | undefined {
  if (id.includes(join(SRC_DIR, 'app', 'aem.ts'))) return 'aem-core';
  if (id.endsWith('scripts/env.js')) return 'env';
  if (!id.includes('node_modules')) return undefined;
  return 'aem-core';
}

function shortHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/**
 * Prepends a `/*! v{version} | h{hash} *\/` banner to every built JS chunk and
 * CSS asset, hashed off that file's own content so the banner (and the resulting
 * git diff) only changes when the file's actual output changes.
 */
export function versionBannerPlugin(version: string): Plugin {
  return {
    name: 'version-banner',
    enforce: 'post',
    renderChunk(code) {
      const banner = `/*! v${version} | h${shortHash(code)} */`;
      return { code: `${banner}\n${code}`, map: null };
    },
    generateBundle(_opts, bundle) {
      Object.values(bundle).forEach((file) => {
        if (file.type === 'asset' && typeof file.source === 'string' && file.fileName.endsWith('.css')) {
          const banner = `/*! v${version} | h${shortHash(file.source)} */`;

          file.source = `${banner}\n${file.source}`;
        }
      });
    },
  };
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
      // Shared/vendor chunks are always regenerated with a fresh content hash,
      // so stale ones from a previous build must be cleared every time.
      const vendorDir = join(ROOT, 'scripts/vendor');
      if (existsSync(vendorDir)) rmSync(vendorDir, { recursive: true, force: true });
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
      if (existsSync(BLOCKS_DIR)) {
        readdirSync(BLOCKS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .forEach((dir) => {
            const srcDir = join(BLOCKS_DIR, dir.name);
            const outDir = join(ROOT, 'blocks', dir.name);
            mkdirSync(outDir, { recursive: true });
            readdirSync(srcDir, { withFileTypes: true })
              .filter((f) => f.isFile() && /\.(css|html)$/.test(f.name))
              .forEach((f) => copyFileSync(join(srcDir, f.name), join(outDir, f.name)));
          });
      }
      if (existsSync(STYLES_DIR)) {
        const outDir = join(ROOT, 'styles');
        mkdirSync(outDir, { recursive: true });
        readdirSync(STYLES_DIR, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith('.css'))
          .forEach((f) => copyFileSync(join(STYLES_DIR, f.name), join(outDir, basename(f.name))));
      }
    },
  };
}
