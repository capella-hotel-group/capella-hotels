import { createHash } from 'node:crypto';
import { readdirSync, existsSync, readFileSync, unlinkSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { ROOT, SRC_DIR, BLOCKS_DIR } from './config.ts';

const APP_ENTRIES: Record<string, string> = {
  'scripts/scripts': 'src/app/scripts.ts',
  'scripts/aem': 'src/app/aem.ts',
  'scripts/delayed': 'src/app/delayed.ts',
};

const STYLE_ENTRIES: Record<string, string> = {
  'styles/styles': 'src/styles/styles.css',
  'styles/lazy-styles': 'src/styles/lazy-styles.css',
  'styles/fonts': 'src/styles/fonts.css',
};

/** Stable (non-hashed) chunk names, so head.html can modulepreload them directly. */
const STABLE_CHUNKS = ['aem-core', 'env', 'dompurify'];

/**
 * Finds every block entry file whose name matches its parent block directory
 * (src/blocks/<name>/<name>.ts), so new blocks are picked up with zero config edits.
 * Also registers the block's CSS (if present) as a sibling Rollup entry, so it runs
 * through the real CSS build pipeline (minification + version banner) instead of
 * being copied verbatim.
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
      const cssFile = join(BLOCKS_DIR, dir.name, `${dir.name}.css`);
      if (existsSync(cssFile)) {
        entries[`blocks/${dir.name}/${dir.name}--style`] = `src/blocks/${dir.name}/${dir.name}.css`;
      }
    });
  return entries;
}

export function getAllEntries(): Record<string, string> {
  return { ...APP_ENTRIES, ...STYLE_ENTRIES, ...discoverBlockEntries() };
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
  if (id.includes(join(SRC_DIR, 'utils', 'env.ts')) || id.includes(join(SRC_DIR, 'configs', 'env.ts'))) return 'env';
  if (id.includes(join('node_modules', 'dompurify'))) return 'dompurify';
  if (!id.includes('node_modules')) return undefined;
  return 'aem-core';
}

/** Stable paths for known infrastructure chunks; hashed for everything else. */
export function chunkFileNames(chunkInfo: { name: string }): string {
  if (STABLE_CHUNKS.includes(chunkInfo.name)) return 'chunks/[name].js';
  return 'chunks/[name]-[hash].js';
}

/**
 * Routes CSS output to the paths the AEM EDS runtime expects: a block's CSS
 * lands next to its JS (`blocks/<name>/<name>.css`), global style entries keep
 * their declared `styles/` path, anything else falls back to `styles/[name]`.
 */
export function assetFileNames(assetInfo: { name?: string; originalFileNames?: string[] }): string {
  const name = assetInfo.name ?? '';
  if (!name.endsWith('.css')) return 'assets/[name]-[hash][extname]';
  const originalFile = (assetInfo.originalFileNames ?? [])[0] ?? '';
  const blockMatch = originalFile.match(/src\/blocks\/([^/]+)\//);
  if (blockMatch) return `blocks/${blockMatch[1]}/${blockMatch[1]}.css`;
  if (name.startsWith('styles/')) return name;
  return 'styles/[name][extname]';
}

function shortHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/**
 * Prepends a `/*! v{version} | h{hash} *\/` banner to every built JS chunk and
 * CSS asset, hashed off that file's own content so the banner (and the
 * resulting git diff) only changes when the file's actual output changes.
 *
 * Banners are injected in `generateBundle` by mutating the bundle object's
 * `code`/`source` directly, not via `renderChunk` or `output.banner`: on this
 * Rolldown-backed Vite version, both of those hooks fire correctly but their
 * returned/produced content is silently discarded before the final chunk is
 * written to disk. Mutating the `generateBundle` bundle - the same object Vite
 * writes verbatim afterwards - is the one place that reliably survives.
 */
export function versionBannerPlugin(version: string): Plugin {
  return {
    name: 'version-banner',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      Object.values(bundle).forEach((file) => {
        if (file.type === 'chunk') {
          const banner = `/*! v${version} | h${shortHash(file.code)} */`;
          file.code = `${banner}\n${file.code}`;
        } else if (typeof file.source === 'string' && file.fileName.endsWith('.css')) {
          const banner = `/*! v${version} | h${shortHash(file.source)} */`;
          file.source = `${banner}\n${file.source}`;
        }
      });
    },
  };
}

/**
 * Removes previously generated entry outputs before each build so stale bundles
 * for renamed/removed blocks (or their CSS) don't linger in the delivered tree.
 */
export function cleanGeneratedOutputs(): Plugin {
  return {
    name: 'clean-generated-outputs',
    buildStart() {
      const staleFiles = [
        ...Object.keys(APP_ENTRIES).map((name) => `${name}.js`),
        ...Object.keys(STYLE_ENTRIES).map((name) => `${name}.css`),
      ];
      if (existsSync(BLOCKS_DIR)) {
        readdirSync(BLOCKS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .forEach((dir) => {
            staleFiles.push(`blocks/${dir.name}/${dir.name}.js`, `blocks/${dir.name}/${dir.name}.css`);
          });
      }
      staleFiles.forEach((name) => {
        const outFile = join(ROOT, name);
        if (existsSync(outFile)) unlinkSync(outFile);
      });
      // Vendor/shared chunks are always regenerated with a fresh content hash,
      // so stale ones from a previous build must be cleared every time.
      const chunksDir = join(ROOT, 'chunks');
      if (existsSync(chunksDir)) rmSync(chunksDir, { recursive: true, force: true });
    },
  };
}

/**
 * Copies each block's non-bundled static assets (e.g. `index.html` demo/authoring
 * content) from src/ to their delivered root-level path. CSS is handled by the
 * real Rollup/CSS build pipeline instead (see `discoverBlockEntries`), except when
 * a block's source CSS has no actual rules (only comments/whitespace) — Rollup
 * emits no asset for those, so the AEM runtime's per-block CSS fetch would 404;
 * fall back to copying the source file verbatim in that case.
 */
export function copyBlockHtml(): Plugin {
  return {
    name: 'copy-block-html',
    writeBundle() {
      if (!existsSync(BLOCKS_DIR)) return;
      readdirSync(BLOCKS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .forEach((dir) => {
          const srcDir = join(BLOCKS_DIR, dir.name);
          const outDir = join(ROOT, 'blocks', dir.name);

          const htmlFile = join(srcDir, 'index.html');
          if (existsSync(htmlFile)) {
            mkdirSync(outDir, { recursive: true });
            copyFileSync(htmlFile, join(outDir, 'index.html'));
          }

          const cssFile = join(srcDir, `${dir.name}.css`);
          const outCssFile = join(outDir, `${dir.name}.css`);
          if (existsSync(cssFile) && !existsSync(outCssFile)) {
            mkdirSync(outDir, { recursive: true });
            copyFileSync(cssFile, outCssFile);
          }
        });
    },
  };
}
