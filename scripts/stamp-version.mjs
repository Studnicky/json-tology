#!/usr/bin/env node
/**
 * stamp-version.mjs — rewrite every `docs/public/*.svg.template` into its
 * sibling `.svg` with the current `package.json#version` substituted for
 * the `{{VERSION}}` token.
 *
 * Pipeline:
 *   1. Read package.json#version.
 *   2. Find every `docs/public/**\/*.svg.template`.
 *   3. For each: replace `{{VERSION}}` and write to `<basename>.svg`.
 *
 * Usage:
 *   node scripts/stamp-version.mjs            # write stamped .svg files
 *   node scripts/stamp-version.mjs --check    # exit non-zero if any stamped
 *                                             # .svg is out of date
 *
 * Why a stamp step? Embedding the version in the OG card / README header
 * keeps the social-preview, the GitHub README, and the GitHub release page
 * showing the right release at all times. The template carries the
 * placeholder so the canonical source stays diffable; the stamped output is
 * regenerated at every build (and verified in CI via `--check`).
 */

import {
  promises as fs
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  dirname, join, relative
} from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const PUBLIC_ROOT = join(REPO_ROOT, 'docs', 'public');

const CHECK_MODE = process.argv.includes('--check');

const pkgRaw = await fs.readFile(join(REPO_ROOT, 'package.json'), 'utf8');
const VERSION = JSON.parse(pkgRaw).version;
const VERSION_TOKEN = /\{\{VERSION\}\}/g;

async function findTemplates(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { 'withFileTypes': true });

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...await findTemplates(full));
    } else if (entry.isFile() && entry.name.endsWith('.svg.template')) {
      out.push(full);
    }
  }

  return out;
}

const templates = await findTemplates(PUBLIC_ROOT);

let drift = 0;
let stamped = 0;

for (const template of templates) {
  const source = await fs.readFile(template, 'utf8');
  const stampedContent = source.replace(VERSION_TOKEN, VERSION);
  const target = template.replace(/\.svg\.template$/, '.svg');

  if (CHECK_MODE) {
    let current = '';

    try {
      current = await fs.readFile(target, 'utf8');
    } catch {
      // Missing target counts as drift.
    }
    if (current !== stampedContent) {
      console.error(`✗ ${relative(REPO_ROOT, target)} is out of date relative to ${relative(REPO_ROOT, template)} at version ${VERSION}`);
      drift += 1;
    } else {
      console.log(`✓ ${relative(REPO_ROOT, target)} matches`);
    }
  } else {
    await fs.writeFile(target, stampedContent);
    console.log(`✓ stamped ${relative(REPO_ROOT, target)} @ ${VERSION}`);
    stamped += 1;
  }
}

if (CHECK_MODE) {
  if (drift > 0) {
    console.error(`\n${drift} stamped SVG file(s) drifted from their templates. Run \`node scripts/stamp-version.mjs\` and commit the result.`);
    process.exit(1);
  }
  console.log(`\nAll ${templates.length} stamped SVG(s) are in sync with version ${VERSION}.`);
} else {
  console.log(`\nStamped ${stamped} SVG(s) at version ${VERSION}.`);
}
