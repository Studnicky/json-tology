/**
 * FOAF subset — registry-directory codegen round-trip.
 *
 * Demonstrates `generateRegistryDirectory` producing a canonical directory layout:
 *   entities/<Name>.ts  — one file per OWL class
 *   index.ts            — imports all entities, constructs the registry
 *
 * Steps:
 *   1. Generate the registry directory to a tmp path inside the project.
 *   2. Assert each expected entity file exists at its canonical path.
 *   3. Import the generated `index.ts` and validate a foaf:Agent instance.
 *   4. Confirm the committed generated-dir fixture matches the programmatic output.
 *
 * Entity files mirror the canonical bookstore layout (`entities/<Name>.ts`):
 * each file exports `<Name>Schema as const` and `type <Name> = InferType<...>`.
 * The index re-exports all schemas and types, and constructs the registry.
 */

import {
  existsSync, readFileSync
} from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonTology } from '../../../src/index.js';
import { generateRegistryDirectory } from '../../../src/owl-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
const ONTOLOGIES = resolve(here, '../ontologies');
const TMP_DIR = resolve(here, '../../../.generated-tmp/foaf-registry-dir');

// ---------------------------------------------------------------------------
// Step 1: generate the registry directory
// ---------------------------------------------------------------------------

const foafJsonLdRaw = readFileSync(resolve(ONTOLOGIES, 'foaf-subset.jsonld'), 'utf8');
const foafJsonLd = JSON.parse(foafJsonLdRaw) as object;

const genResult = generateRegistryDirectory({
  'input': foafJsonLd,
  'name': 'foaf',
  'outDir': TMP_DIR,
  'sourceLabel': 'examples/docs/ontologies/foaf-subset.jsonld'
});

// Three classes + four property stubs = 7 entity files
console.assert(
  genResult.entityFiles.length === 7,
  `Expected 7 entity files, got ${genResult.entityFiles.length}`
);
console.log(`generateRegistryDirectory: ${genResult.entityFiles.length} entity files written`);

// ---------------------------------------------------------------------------
// Step 2: assert entity files exist at canonical paths
// ---------------------------------------------------------------------------

const expectedEntities = [
  'Agent',
  'Name',
  'Mbox',
  'Knows',
  'Member',
  'Group',
  'Person'
];

for (const name of expectedEntities) {
  const entityPath = resolve(TMP_DIR, 'entities', `${name}.ts`);

  console.assert(
    existsSync(entityPath),
    `Expected entity file entities/${name}.ts to exist`
  );
}

const indexPath = resolve(TMP_DIR, 'index.ts');

console.assert(existsSync(indexPath), 'Expected index.ts to exist');
console.log('All expected entity files present:', expectedEntities.join(', '));

// ---------------------------------------------------------------------------
// Step 3: import generated index and validate a foaf:Agent instance
// ---------------------------------------------------------------------------

const generated = await import(indexPath) as {
  'AgentSchema': Record<string, unknown> & { '$id': string };
  'foaf': ReturnType<typeof JsonTology.create>;
  'PersonSchema': Record<string, unknown> & { '$id': string };
};

const {
  AgentSchema, foaf, 'PersonSchema': GeneratedPersonSchema
} = generated;

// Bastian Balthazar Bux as a foaf:Agent — name + mbox are owl:DatatypeProperty
// on foaf:Agent, so they appear as string properties on AgentSchema.
const bastian = {
  'mbox': 'bastian@fantastica.example',
  'name': 'Bastian Balthazar Bux'
};

const bastianResult = foaf.validate(AgentSchema, bastian);

console.assert(bastianResult.ok, `Bastian must validate as foaf:Agent; errors: ${JSON.stringify(bastianResult)}`);
console.log('Bastian Balthazar Bux validates as foaf:Agent (registry-dir):', bastianResult.ok);

// PersonSchema carries disjointWith — preserved through directory-mode codegen
const personRec = GeneratedPersonSchema as Record<string, unknown>;

console.assert(
  personRec.disjointWith === 'http://xmlns.com/foaf/0.1/Group',
  'PersonSchema.disjointWith preserved in registry-dir output'
);
console.log('PersonSchema.disjointWith preserved (registry-dir):', personRec.disjointWith);

// ---------------------------------------------------------------------------
// Step 4: compare generated entity file content to the committed fixture
// ---------------------------------------------------------------------------

const committedPersonPath = resolve(ONTOLOGIES, 'generated-dir', 'foaf', 'entities', 'Person.ts');

function stripTimestamp(src: string): string {
  return src.replaceAll(/^\/\/ Generated: .*$/gmu, '// Generated: <timestamp>');
}

const generatedPersonSrc = readFileSync(resolve(TMP_DIR, 'entities', 'Person.ts'), 'utf8');
const committedPersonSrc = readFileSync(committedPersonPath, 'utf8');

console.assert(
  stripTimestamp(generatedPersonSrc) === stripTimestamp(committedPersonSrc),
  'Generated entities/Person.ts matches committed generated-dir fixture (modulo timestamp)'
);
console.log('entities/Person.ts matches committed fixture (modulo timestamp): true');
