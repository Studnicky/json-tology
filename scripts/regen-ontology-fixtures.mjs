#!/usr/bin/env node
/**
 * regen-ontology-fixtures.mjs
 *
 * Reads each OWL 2 JSON-LD file under `examples/docs/ontologies/` and writes
 * the generated TypeScript source to `examples/docs/ontologies/generated/<name>.generated.ts`.
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

// Import generateFromTbox from the built dist.
const { generateFromTbox } = await import(join(REPO_ROOT, 'dist', 'owl-gen.js'));

const ONTOLOGIES_DIR = join(REPO_ROOT, 'examples', 'docs', 'ontologies');
const GENERATED_DIR = join(ONTOLOGIES_DIR, 'generated');

mkdirSync(GENERATED_DIR, { 'recursive': true });

/** @type {Array<{ file: string; name: string; out: string }>} */
const fixtures = [
  {
    'file': join(ONTOLOGIES_DIR, 'foaf-subset.jsonld'),
    'name': 'foaf',
    'out': join(GENERATED_DIR, 'foaf.generated.ts')
  },
  {
    'file': join(ONTOLOGIES_DIR, 'dcat-subset.jsonld'),
    'name': 'dcat',
    'out': join(GENERATED_DIR, 'dcat.generated.ts')
  },
  {
    'file': join(ONTOLOGIES_DIR, 'schema-org-subset.jsonld'),
    'name': 'schemaOrg',
    'out': join(GENERATED_DIR, 'schema-org.generated.ts')
  }
];

for (const fixture of fixtures) {
  const raw = readFileSync(fixture.file, 'utf8');
  const input = JSON.parse(raw);
  const relPath = fixture.file.replace(`${REPO_ROOT}/`, '');

  const src = generateFromTbox({
    input,
    'name': fixture.name,
    'sourceLabel': relPath
  });

  writeFileSync(fixture.out, src, 'utf8');
  console.log(`wrote ${fixture.out.replace(`${REPO_ROOT}/`, '')}`);
}

console.log('done — 3 fixtures regenerated');
