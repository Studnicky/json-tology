#!/usr/bin/env node
/**
 * ensure-built.mjs — wired into the `pretest:*` lifecycle hooks.
 *
 * Test tiers that depend on `dist/` (e2e/cli, smoke imports that resolve
 * `json-tology` to the package entry, ontology generated fixtures) need
 * `dist/index.js` and `dist/cli.js` present before they run. Running
 * `npm run build` unconditionally per-tier races against concurrent tiers
 * inside `npm run test:all` because `build` invokes `npm run clean` first
 * (`rm -rf dist`), leaving a transient window where `dist/index.js` is gone.
 *
 * This script builds only when the marker outputs are missing, so:
 *   - Cold runs (no dist/) build once.
 *   - Warm runs (dist/ already up-to-date) no-op.
 *   - Concurrent test tiers all hit the same already-built dist/.
 *
 * Exit codes:
 *   0 — dist/ present (no-op) or build succeeded.
 *   1 — build failed.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  dirname, join
} from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

const REQUIRED = [
  join(REPO_ROOT, 'dist', 'index.js'),
  join(REPO_ROOT, 'dist', 'cli.js')
];

const missing = REQUIRED.filter((path) => {
  return !existsSync(path);
});

if (missing.length === 0) {
  process.exit(0);
}

const result = spawnSync('npm', [
  'run',
  'build'
], {
  'cwd': REPO_ROOT,
  'stdio': 'inherit'
});

process.exit(result.status ?? 1);
