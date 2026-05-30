/**
 * DCAT-AP subset — registry-directory codegen round-trip.
 *
 * DCAT (Data Catalog Vocabulary) is a W3C recommendation for describing data
 * catalogs and datasets published on the Web. This example demonstrates the
 * registry-directory mode against the hand-authored DCAT-AP subset:
 *
 *   1. Call `generateRegistryDirectory` and inspect the returned entity files.
 *   2. Assert the expected entity paths appear in the result.
 *   3. Log entity file count, path names, and indexSource length.
 *
 * Notable: the `rdfs:subClassOf` chain reaches `dcterms:Resource`, an external IRI.
 * The generated `Resource.ts` entity file carries the stub schema — identical to the
 * single-file mode behaviour — and `Dataset.ts` / `Catalog.ts` reference it via `$ref`.
 *
 * Browser-safe: no node:fs, node:path, or node:url.
 */

import { generateRegistryDirectory } from '../../../src/owl-gen.js';
import { dcatSubset } from '../ontologies/dcat-subset.js';

// ---------------------------------------------------------------------------
// Step 1: generate the registry directory as data (no disk I/O)
// ---------------------------------------------------------------------------

const genResult = generateRegistryDirectory({
  'input': dcatSubset,
  'name': 'dcat',
  'sourceLabel': 'examples/docs/ontologies/dcat-subset.jsonld'
});

// 3 classes (Resource, Distribution, Catalog, Dataset) + 4 property stubs = 8 entity files
console.assert(
  genResult.entityFiles.length === 8,
  `Expected 8 entity files, got ${genResult.entityFiles.length}`
);
console.log(`generateRegistryDirectory: ${genResult.entityFiles.length} entity files`);

// ---------------------------------------------------------------------------
// Step 2: assert expected entity paths appear in the result
// ---------------------------------------------------------------------------

const expectedPaths = [
  'entities/Resource.ts',
  'entities/Distribution.ts',
  'entities/Title.ts',
  'entities/Description.ts',
  'entities/Distribution_2.ts',
  'entities/AccessURL.ts',
  'entities/Catalog.ts',
  'entities/Dataset.ts'
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
console.assert(genResult.indexSource.includes('DatasetSchema'), 'indexSource must reference DatasetSchema');

// dcterms:Resource stub carries title + description properties
const resourceFile = genResult.entityFiles.find((entityFile) => {
  return entityFile.path === 'entities/Resource.ts';
});

console.assert(resourceFile !== undefined, 'entities/Resource.ts must be present');

if (resourceFile !== undefined) {
  console.assert(
    resourceFile.source.includes('title'),
    'Resource entity source must carry title property from owl:DatatypeProperty declaration'
  );
  console.log('entities/Resource.ts source length:', resourceFile.source.length);
  console.log('Resource.ts carries title property:', resourceFile.source.includes('title'));
}

// Dataset carries allOf -> dcterms:Resource (subClassOf chain)
const datasetFile = genResult.entityFiles.find((entityFile) => {
  return entityFile.path === 'entities/Dataset.ts';
});

console.assert(datasetFile !== undefined, 'entities/Dataset.ts must be present');

if (datasetFile !== undefined) {
  console.assert(
    datasetFile.source.includes('allOf'),
    'Dataset entity source must carry allOf (subClassOf -> dcterms:Resource)'
  );
  console.log('Dataset.ts carries allOf (subClassOf preserved):', datasetFile.source.includes('allOf'));
}
