import path from 'node:path';

export const ROOT = process.cwd();
export const SRC_DIR = path.resolve(ROOT, 'src');
export const BLOCKS_DIR = path.resolve(SRC_DIR, 'blocks');
export const STYLES_DIR = path.resolve(SRC_DIR, 'styles');
