/**
 * schema.org subset — registry-directory codegen round-trip.
 *
 * schema.org is a collaborative vocabulary for structured data on the Web.
 * This example demonstrates the registry-directory mode against the hand-authored
 * schema.org subset:
 *
 *   1. Call `generateRegistryDirectory` and inspect the returned entity files.
 *   2. Assert the expected entity paths appear in the result.
 *   3. Log entity file count, path names, and indexSource length.
 *
 * Notable: `schema:IsbnType` is declared as an `rdfs:Datatype` with an XSD pattern
 * facet (`^\d{13}$`). The generated `IsbnType.ts` entity file carries the full
 * `type: 'string', pattern: ...` schema — identical to the single-file mode output.
 *
 * Browser-safe: no node:fs, node:path, or node:url.
 */

import { generateRegistryDirectory } from '../../../src/owl-gen/index.js';
import { schemaOrgSubset } from '../ontologies/schema-org-subset.js';

// ---------------------------------------------------------------------------
// Step 1: generate the registry directory as data (no disk I/O)
// ---------------------------------------------------------------------------

const genResult = generateRegistryDirectory({
  'input': schemaOrgSubset,
  'name': 'schemaOrg',
  'sourceLabel': 'examples/docs/ontologies/schema-org-subset.jsonld'
});

// 4 classes (Thing, IsbnType, Person, Organization, Book) + 4 property stubs = 9 entity files
console.assert(
  genResult.entityFiles.length === 9,
  `Expected 9 entity files, got ${genResult.entityFiles.length}`
);
console.log(`generateRegistryDirectory: ${genResult.entityFiles.length} entity files`);

// ---------------------------------------------------------------------------
// Step 2: assert expected entity paths appear in the result
// ---------------------------------------------------------------------------

const expectedPaths = [
  'entities/Thing.ts',
  'entities/IsbnType.ts',
  'entities/Name.ts',
  'entities/Isbn.ts',
  'entities/Author.ts',
  'entities/Publisher.ts',
  'entities/Person.ts',
  'entities/Organization.ts',
  'entities/Book.ts'
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
console.assert(genResult.indexSource.includes('BookSchema'), 'indexSource must reference BookSchema');

// IsbnType entity file carries the XSD pattern facet from owl:withRestrictions
const isbnTypeFile = genResult.entityFiles.find((entityFile) => {
  return entityFile.path === 'entities/IsbnType.ts';
});

console.assert(isbnTypeFile !== undefined, 'entities/IsbnType.ts must be present');

if (isbnTypeFile !== undefined) {
  console.assert(
    isbnTypeFile.source.includes('pattern'),
    'IsbnType entity source must carry XSD pattern facet'
  );
  console.log('entities/IsbnType.ts source length:', isbnTypeFile.source.length);
  console.log('IsbnType.ts carries pattern (XSD facet preserved):', isbnTypeFile.source.includes('pattern'));
}

// Book carries allOf -> schema:Thing (subClassOf chain)
const bookFile = genResult.entityFiles.find((entityFile) => {
  return entityFile.path === 'entities/Book.ts';
});

console.assert(bookFile !== undefined, 'entities/Book.ts must be present');

if (bookFile !== undefined) {
  console.assert(
    bookFile.source.includes('allOf'),
    'Book entity source must carry allOf (subClassOf -> schema:Thing)'
  );
  console.log('Book.ts carries allOf (subClassOf preserved):', bookFile.source.includes('allOf'));
}
