#!/usr/bin/env node
/**
 * build-palette.mjs — regenerate docs/.vitepress/theme/palette.css from
 * two iridis CLI runs (one light, one dark), each WCAG 2.1 AAA-enforced.
 *
 * Why two runs? The single-config + `derive:variant` approach inverts
 * lightness, which collapses an off-white canvas into pure black on
 * the dark side — code blocks render as solid black bars. A separate
 * dark config gives us a warm dark canvas with chroma-bounded
 * neutrals and bright JST-teal accents, each pair AAA-enforced.
 *
 * Pipeline (per config):
 *   intake:any → expand:family → resolve:roles → enforce:wcagAAA
 *   → emit:cssVars
 *
 * The script aborts if iridis emits any 'Pair could not reach required
 * ratio' warning, so a green run is a green WCAG 2.1 AAA audit on both
 * schemes.
 *
 * Usage:
 *   node scripts/build-palette.mjs
 *   # or
 *   npm run build:palette
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
const CONFIG_LIGHT = resolve(REPO_ROOT, 'scripts/iridis-config-light.json');
const CONFIG_DARK = resolve(REPO_ROOT, 'scripts/iridis-config-dark.json');
const OUTPUT_LIGHT = resolve(REPO_ROOT, 'scripts/iridis-out/json-tology-palette-light.json');
const OUTPUT_DARK = resolve(REPO_ROOT, 'scripts/iridis-out/json-tology-palette-dark.json');
const PALETTE_CSS = resolve(REPO_ROOT, 'docs/.vitepress/theme/palette.css');

/**
 * Map iridis token name → VitePress variable name. Tokens absent from
 * this map are dropped from the emitted palette (e.g. --jt-on-accent
 * has no direct VitePress counterpart and is unused by the theme).
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

function runIridis(cliPath, configPath, label) {
  process.stdout.write(`Running iridis CLI (${label}): ${configPath}\n`);
  const result = spawnSync(
    'npx',
    [
      '-p',
      'tsx',
      'tsx',
      cliPath,
      configPath
    ],
    {
      'cwd': REPO_ROOT,
      'encoding': 'utf8'
    }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
    throw new Error(`iridis CLI exited with status ${result.status} for ${label}`);
  }
  const stderr = result.stderr ?? '';

  if (stderr.includes('Pair could not reach required ratio')) {
    process.stderr.write(stderr);
    throw new Error(`AAA enforcement failed for at least one pair in ${label} (see iridis warnings above).`);
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
}

function readBlocks(outputJson) {
  if (!existsSync(outputJson)) {
    throw new Error(`Expected iridis output at ${outputJson} not found.`);
  }

  return JSON.parse(readFileSync(outputJson, 'utf8'));
}

/**
 * Parse one iridis-emitted CSS block. Returns mapped `--vp-c-*` lines
 * plus the border value extracted for aliasing to --vp-c-border.
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

function buildCss(lightBlocks, darkBlocks) {
  const lightRoot = parseBlock(lightBlocks.rootBlock);
  const lightP3 = parseBlock(lightBlocks.wideGamut);
  const lightFc = parseBlock(lightBlocks.forcedColors);
  // dark "root" is actually the dark config's :root (not a media query) — it
  // serves as our .dark { } block since we set framing manually via vitepress.
  const darkRoot = parseBlock(darkBlocks.rootBlock);

  if (lightRoot.borderValue !== null) {
    lightRoot.declarations.push(`--vp-c-border: ${lightRoot.borderValue};`);
  }
  if (darkRoot.borderValue !== null) {
    darkRoot.declarations.push(`--vp-c-border: ${darkRoot.borderValue};`);
  }
  if (lightFc.borderValue !== null) {
    lightFc.declarations.push(`--vp-c-border: ${lightFc.borderValue};`);
  }

  const lightBody = renderDecls(lightRoot.declarations, '  ');
  const darkBody = renderDecls(darkRoot.declarations, '  ');
  const p3Body = renderDecls(lightP3.declarations, '    ');
  const fcBody = renderDecls(lightFc.declarations, '    ');

  return `/**
 * palette.css — generated by scripts/build-palette.mjs
 *
 * DO NOT EDIT BY HAND. Regenerate via:
 *   npm run build:palette
 *
 * Source seeds:
 *   light canvas: #fafaf7 (warm off-white, W3C-style)
 *   dark canvas:  #15191d (warm dark neutral, not pure black)
 *   JST accent:   #7FE7D8 / #24A5B5 / #08717A (the brand gradient)
 *
 * Compliance: every contrast pair declared in
 *   scripts/iridis-config-light.json
 *   scripts/iridis-config-dark.json
 * is enforced by @studnicky/iridis-cli's enforce:wcagAAA pipeline task
 * to satisfy WCAG 2.1 AAA before emit:cssVars writes the values below.
 *   - body text and links: 7:1 (1.4.6 Contrast Enhanced)
 *   - large text and UI:   4.5:1
 *
 * The chromaRange constraint on the role schema (≤0.02 OKLCH chroma)
 * keeps canvas, surface, text, and border roles neutral — only the
 * accent roles inherit chroma from the JST teal seeds. This matches
 * the W3C-style restrained aesthetic instead of pulling every surface
 * into the brand family.
 */

:root {
  /* JST gradient stops — decorative brand mark only, outside the AAA
     contrast budget. The readable text around the mark uses the
     iridis-emitted tokens below. */
  --jst-teal-light: #7FE7D8;
  --jst-teal-mid:   #24A5B5;
  --jst-teal-dark:  #08717A;
  --jst-circuit:    #BDF6F2;

${lightBody}

  --vp-c-brand-soft: rgba(23, 87, 93, 0.14);
  --vp-c-purple:     #5e2856;
}

.dark {
${darkBody}

  --vp-c-brand-soft: rgba(47, 137, 146, 0.16);
}

/* Wide-gamut P3 enhancement (iridis-emitted, light scheme). Same
   chromaticity, broader gamut on capable displays. */
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

mkdirSync(dirname(OUTPUT_LIGHT), { 'recursive': true });

runIridis(cliPath, CONFIG_LIGHT, 'light');
runIridis(cliPath, CONFIG_DARK, 'dark');

const lightBlocks = readBlocks(OUTPUT_LIGHT);
const darkBlocks = readBlocks(OUTPUT_DARK);
const css = buildCss(lightBlocks, darkBlocks);

writeFileSync(PALETTE_CSS, css);
process.stdout.write(`✓ Wrote ${PALETTE_CSS}\n`);
