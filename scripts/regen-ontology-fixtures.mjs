#!/usr/bin/env node
/**
 * regen-ontology-fixtures.mjs
 *
 * Reads each OWL 2 JSON-LD file under `examples/docs/ontologies/` and writes:
 *   1. Single-file mode → `examples/docs/ontologies/generated/<name>.generated.ts`
 *   2. Registry-directory mode → `examples/docs/ontologies/generated-dir/<name>/`
 *
 * Run manually after upgrading the codegen output format to refresh committed fixtures:
 *
 *   node scripts/regen-ontology-fixtures.mjs
 *
 * This script is NOT wired into the CI gate — consumers see the committed output
 * without running the script themselves.
 */

import {
  mkdirSync, readFileSync, writeFileSync
} from 'node:fs';
import {
  dirname, join
} from 'node:path';
import { fileURLToPath } from 'node:url';

const __here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__here, '..');

// Import from the built dist.
const {
  generateFromTbox, generateRegistryDirectory
} = await import(join(REPO_ROOT, 'dist', 'owl-gen.js'));

const ONTOLOGIES_DIR = join(REPO_ROOT, 'examples', 'docs', 'ontologies');
const GENERATED_DIR = join(ONTOLOGIES_DIR, 'generated');
const GENERATED_DIR_DIR = join(ONTOLOGIES_DIR, 'generated-dir');

mkdirSync(GENERATED_DIR, { 'recursive': true });
mkdirSync(GENERATED_DIR_DIR, { 'recursive': true });

/** @type {Array<{ file: string; name: string; out: string; dirName: string }>} */
const fixtures = [
  {
    'dirName': 'foaf',
    'file': join(ONTOLOGIES_DIR, 'foaf-subset.jsonld'),
    'name': 'foaf',
    'out': join(GENERATED_DIR, 'foaf.generated.ts')
  },
  {
    'dirName': 'dcat',
    'file': join(ONTOLOGIES_DIR, 'dcat-subset.jsonld'),
    'name': 'dcat',
    'out': join(GENERATED_DIR, 'dcat.generated.ts')
  },
  {
    'dirName': 'schema-org',
    'file': join(ONTOLOGIES_DIR, 'schema-org-subset.jsonld'),
    'name': 'schemaOrg',
    'out': join(GENERATED_DIR, 'schema-org.generated.ts')
  }
];

let totalEntities = 0;
let totalDirs = 0;

for (const fixture of fixtures) {
  const raw = readFileSync(fixture.file, 'utf8');
  const input = JSON.parse(raw);
  const relPath = fixture.file.replace(`${REPO_ROOT}/`, '');

  // ── Single-file mode ──────────────────────────────────────────────────────
  const src = generateFromTbox({
    input,
    'name': fixture.name,
    'sourceLabel': relPath
  });

  writeFileSync(fixture.out, src, 'utf8');
  console.log(`[single] wrote ${fixture.out.replace(`${REPO_ROOT}/`, '')}`);

  // ── Registry-directory mode ───────────────────────────────────────────────
  const outDir = join(GENERATED_DIR_DIR, fixture.dirName);
  const dirResult = generateRegistryDirectory({
    input,
    'name': fixture.name,
    'outDir': outDir,
    'sourceLabel': relPath
  });

  console.log(`[dir]    wrote ${dirResult.entityFiles.length} entities + index.ts → ${outDir.replace(`${REPO_ROOT}/`, '')}/`);
  totalEntities += dirResult.entityFiles.length;
  totalDirs += 1;
}

console.log(`done — 3 single-file fixtures regenerated; ${totalDirs} registry directories (${totalEntities} total entity files)`);

