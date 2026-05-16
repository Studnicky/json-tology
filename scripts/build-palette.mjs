#!/usr/bin/env node
/**
 * build-palette.mjs — regenerate docs/.vitepress/theme/palette.css from
 * the iridis CLI's WCAG 2.1 AAA-enforced output.
 *
 * Pipeline:
 *   1. Run @studnicky/iridis-cli over scripts/iridis-config.json
 *   2. Read the emitted scripts/iridis-out/json-tology-palette.json
 *   3. Translate iridis token names (--jt-*) into VitePress brand/text/
 *      surface variables (--vp-c-*)
 *   4. Write the final palette.css with header, light/dark/P3/forced-
 *      colors blocks, and the decorative .jt-brand gradient
 *
 * Compliance proof: iridis's `enforce:wcagAAA` task calls
 * ensureContrast.apply(fg, bg, required, 'wcag21') on every contrast
 * pair declared in scripts/iridis-config.json. The script aborts if
 * iridis emits any "pair could not reach required ratio" warning, so
 * a green run is a green WCAG 2.1 AAA audit.
 *
 * Usage:
 *   node scripts/build-palette.mjs
 *   # or
 *   npm run build:palette
 *
 * Iridis CLI path discovery (first match wins):
 *   1. IRIDIS_CLI_PATH env var
 *   2. ../iridis/packages/cli/src/main.ts (sibling checkout)
 *   3. ./node_modules/@studnicky/iridis-cli/src/main.ts (npm install)
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync
} from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';

const __HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__HERE, '..');
const CONFIG_PATH = resolve(REPO_ROOT, 'scripts/iridis-config.json');
const OUTPUT_JSON = resolve(REPO_ROOT, 'scripts/iridis-out/json-tology-palette.json');
const PALETTE_CSS = resolve(REPO_ROOT, 'docs/.vitepress/theme/palette.css');

/**
 * Map iridis token name → VitePress variable name. Tokens absent from
 * this map are dropped from the emitted palette (e.g. --jt-on-accent
 * has no direct VitePress counterpart and is unused by the theme).
 *
 * The --vp-c-border alias is added by the script after extracting the
 * --vp-c-divider value from each block; iridis emits a single 'border'
 * token that doubles for both.
 */
const TOKEN_MAP = {
  '--jt-accent': '--vp-c-brand-1',
  '--jt-accent-hover': '--vp-c-brand-2',
  '--jt-accent-ui': '--vp-c-brand-3',
  '--jt-border': '--vp-c-divider',
  '--jt-canvas': '--vp-c-bg',
  '--jt-surface': '--vp-c-bg-alt',
  '--jt-surface-soft': '--vp-c-bg-soft',
  '--jt-text': '--vp-c-text-1',
  '--jt-text-muted': '--vp-c-text-2',
  '--jt-text-subtle': '--vp-c-text-3'
};

function discoverIridisCli() {
  const candidates = [
    process.env['IRIDIS_CLI_PATH'],
    resolve(REPO_ROOT, '..', 'iridis/packages/cli/src/main.ts'),
    resolve(REPO_ROOT, 'node_modules/@studnicky/iridis-cli/src/main.ts')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('iridis CLI not found. Set IRIDIS_CLI_PATH or check out '
    + 'github.com/Studnicky/iridis next to this repo.');
}

function runIridis(cliPath) {
  process.stdout.write(`Running iridis CLI: ${cliPath}\n`);
  mkdirSync(dirname(OUTPUT_JSON), { 'recursive': true });
  const result = spawnSync(
    'npx',
    [
      '-p',
      'tsx',
      'tsx',
      cliPath,
      CONFIG_PATH
    ],
    {
      'cwd': REPO_ROOT,
      'encoding': 'utf8'
    }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
    throw new Error(`iridis CLI exited with status ${result.status}`);
  }
  const stderr = result.stderr ?? '';

  if (stderr.includes('Pair could not reach required ratio')) {
    process.stderr.write(stderr);
    throw new Error('AAA enforcement failed for at least one pair (see iridis warnings above).');
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
}

function readBlocks() {
  if (!existsSync(OUTPUT_JSON)) {
    throw new Error(`Expected iridis output at ${OUTPUT_JSON} not found.`);
  }

  return JSON.parse(readFileSync(OUTPUT_JSON, 'utf8'));
}

/**
 * Parse one iridis-emitted CSS block and return an array of mapped
 * `--vp-c-* : value;` declarations. Tokens absent from TOKEN_MAP are
 * dropped. Whitespace, `:root {`, `@media`, `@supports`, and closing
 * braces are stripped.
 *
 * Returns { declarations: string[], borderValue: string|null } where
 * borderValue is the divider value (used to alias --vp-c-border below).
 */
function parseBlock(block) {
  const declarations = [];
  let borderValue = null;
  const declRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;

  for (const match of block.matchAll(declRegex)) {
    const sourceToken = match[1];
    const value = match[2].trim();
    const mapped = TOKEN_MAP[sourceToken];

    if (mapped === undefined) {
      continue;
    }
    declarations.push(`${mapped}: ${value};`);
    if (mapped === '--vp-c-divider') {
      borderValue = value;
    }
  }

  return {
    borderValue,
    declarations
  };
}

function renderDecls(declarations, indent) {
  return declarations.map((line) => {
    return indent + line;
  }).join('\n');
}

function buildCss(blocks) {
  const root = parseBlock(blocks.rootBlock);
  const dark = parseBlock(blocks.darkScheme);
  const p3 = parseBlock(blocks.wideGamut);
  const fc = parseBlock(blocks.forcedColors);

  if (root.borderValue !== null) {
    root.declarations.push(`--vp-c-border: ${root.borderValue};`);
  }
  if (dark.borderValue !== null) {
    dark.declarations.push(`--vp-c-border: ${dark.borderValue};`);
  }
  if (fc.borderValue !== null) {
    fc.declarations.push(`--vp-c-border: ${fc.borderValue};`);
  }

  const rootBody = renderDecls(root.declarations, '  ');
  const darkBody = renderDecls(dark.declarations, '  ');
  const p3Body = renderDecls(p3.declarations, '    ');
  const fcBody = renderDecls(fc.declarations, '    ');

  return `/**
 * palette.css — generated by scripts/build-palette.mjs
 *
 * DO NOT EDIT BY HAND. Regenerate via:
 *   npm run build:palette
 *
 * Source seeds: docs/public/nodes/jst-node.svg gradient
 *   #7FE7D8 (light teal) → #24A5B5 (mid teal) → #08717A (dark teal)
 *   #BDF6F2 circuit accent
 *
 * Compliance: every contrast pair declared in scripts/iridis-config.json
 * is enforced by @studnicky/iridis-cli's enforce:wcagAAA pipeline task
 * to satisfy WCAG 2.1 AAA before emit:cssVars writes the values below.
 *   - body text and links: 7:1 (1.4.6 Contrast Enhanced)
 *   - large text and UI:   4.5:1
 *
 * Token name translation (iridis → VitePress) is performed by
 * scripts/build-palette.mjs (see TOKEN_MAP).
 */

:root {
  /* JST gradient stops — decorative brand mark only, outside the AAA
     contrast budget. The readable text around the mark uses the
     iridis-darkened tokens below. */
  --jst-teal-light: #7FE7D8;
  --jst-teal-mid:   #24A5B5;
  --jst-teal-dark:  #08717A;
  --jst-circuit:    #BDF6F2;

${rootBody}

  --vp-c-brand-soft: rgba(23, 87, 93, 0.14);
  --vp-c-purple:     #5e2856;
}

.dark {
${darkBody}

  --vp-c-brand-soft: rgba(47, 137, 146, 0.16);
}

/* Wide-gamut P3 enhancement (iridis-emitted). Same chromaticity, broader
   gamut on capable displays. */
@supports (color: color(display-p3 0 0 0)) {
  :root {
${p3Body}
  }
}

/* Forced-colors mode (Windows High Contrast). System tokens override
   the iridis palette. */
@media (forced-colors: active) {
  :root {
${fcBody}
  }
}

/* json-tology brand gradient — applied to literal 'json-tology' across
   docs via the jt-brand markdown-it plugin in
   docs/.vitepress/plugins/jt-brand.mjs. Excluded from code blocks.
   Decorative; the surrounding readable text uses the AAA palette. */
.jt-brand {
  background: linear-gradient(135deg, var(--jst-teal-dark) 0%, var(--jst-teal-mid) 50%, var(--jst-teal-dark) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  font-weight: 600;
}
`;
}

const cliPath = discoverIridisCli();

runIridis(cliPath);
const blocks = readBlocks();
const css = buildCss(blocks);

writeFileSync(PALETTE_CSS, css);
process.stdout.write(`✓ Wrote ${PALETTE_CSS}\n`);
