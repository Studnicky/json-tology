/**
 * FOAF subset — registry-directory codegen round-trip.
 *
 * Demonstrates `generateRegistryDirectory` producing a canonical directory layout
 * as data (no disk I/O):
 *   entities/<Name>.ts  — one file per OWL class (as source strings)
 *   index.ts source     — imports all entities, constructs the registry
 *
 * Steps:
 *   1. Call `generateRegistryDirectory` and inspect the returned entity files.
 *   2. Assert the expected entity paths appear in the result.
 *   3. Log entity file count, path names, and indexSource length.
 *
 * Entity files mirror the canonical bookstore layout (`entities/<Name>.ts`):
 * each file exports `<Name>Schema as const` and `type <Name> = InferType<...>`.
 * The index re-exports all schemas and types, and constructs the registry.
 *
 * Browser-safe: no node:fs, node:path, or node:url.
 */

import { generateRegistryDirectory } from '../../../src/owl-gen/index.js';
import { foafSubset } from '../ontologies/foaf-subset.js';

// ---------------------------------------------------------------------------
// Step 1: generate the registry directory as data (no disk I/O)
// ---------------------------------------------------------------------------

const genResult = generateRegistryDirectory({
  'input': foafSubset,
  'name': 'foaf',
  'sourceLabel': 'examples/docs/ontologies/foaf-subset.jsonld'
});

// Three classes + four property stubs = 7 entity files
console.assert(
  genResult.entityFiles.length === 7,
  `Expected 7 entity files, got ${genResult.entityFiles.length}`
);
console.log(`generateRegistryDirectory: ${genResult.entityFiles.length} entity files`);

// ---------------------------------------------------------------------------
// Step 2: assert expected entity paths appear in the result
// ---------------------------------------------------------------------------

const expectedPaths = [
  'entities/Agent.ts',
  'entities/Name.ts',
  'entities/Mbox.ts',
  'entities/Knows.ts',
  'entities/Member.ts',
  'entities/Group.ts',
  'entities/Person.ts'
];

for (const expectedPath of expectedPaths) {
  const found = genResult.entityFiles.some((entityFile) => {
    return entityFile.path === expectedPath;
  });

  console.assert(found, `Expected entity file path: ${expectedPath}`);
}

console.log('Entity paths:', genResult.entityFiles.map((entityFile) => {
  return entityFile.path;
}).join(', '));

// ---------------------------------------------------------------------------
// Step 3: log salient facts about the generated data
// ---------------------------------------------------------------------------

console.log('indexSource length:', genResult.indexSource.length);
console.assert(genResult.indexSource.includes('JsonTology'), 'indexSource must reference JsonTology');
console.assert(genResult.indexSource.includes('AgentSchema'), 'indexSource must reference AgentSchema');

// PersonSchema carries disjointWith — verify it is preserved in the generated source
const personFile = genResult.entityFiles.find((entityFile) => {
  return entityFile.path === 'entities/Person.ts';
});

console.assert(personFile !== undefined, 'entities/Person.ts must be present');

if (personFile !== undefined) {
  console.assert(
    personFile.source.includes('disjointWith'),
    'Person entity source must preserve disjointWith annotation'
  );
  console.log('entities/Person.ts source length:', personFile.source.length);
  console.log('disjointWith preserved in Person.ts:', personFile.source.includes('disjointWith'));
}
