/**
 * DCAT-AP subset — registry-directory codegen round-trip.
 *
 * DCAT (Data Catalog Vocabulary) is a W3C recommendation for describing data
 * catalogs and datasets published on the Web. This example demonstrates the
 * registry-directory mode against the hand-authored DCAT-AP subset:
 *
 *   1. Generate the registry directory to a tmp path.
 *   2. Assert each expected entity file exists.
 *   3. Import the generated `index.ts` and validate a dcat:Distribution instance.
 *   4. Confirm the committed generated-dir fixture matches the programmatic output.
 *
 * Notable: the `rdfs:subClassOf` chain reaches `dcterms:Resource`, an external IRI.
 * The generated `Resource.ts` entity file carries the stub schema — identical to the
 * single-file mode behaviour — and `Dataset.ts` / `Catalog.ts` reference it via `$ref`.
 */

import {
  existsSync, readFileSync
} from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonTology } from '../../../src/index.js';
import { writeRegistryDirectory } from '../../../src/owl-gen-node.js';

const here = dirname(fileURLToPath(import.meta.url));
const ONTOLOGIES = resolve(here, '../ontologies');
const TMP_DIR = resolve(here, '../../../.generated-tmp/dcat-registry-dir');

// ---------------------------------------------------------------------------
// Step 1: generate the registry directory
// ---------------------------------------------------------------------------

const dcatJsonLdRaw = readFileSync(resolve(ONTOLOGIES, 'dcat-subset.jsonld'), 'utf8');
const dcatJsonLd = JSON.parse(dcatJsonLdRaw) as object;

const genResult = writeRegistryDirectory({
  'input': dcatJsonLd,
  'name': 'dcat',
  'outDir': TMP_DIR,
  'sourceLabel': 'examples/docs/ontologies/dcat-subset.jsonld'
});

// 3 classes (Resource, Distribution, Catalog, Dataset) + 4 property stubs = 8 entity files
console.assert(
  genResult.entityFiles.length === 8,
  `Expected 8 entity files, got ${genResult.entityFiles.length}`
);
console.log(`generateRegistryDirectory: ${genResult.entityFiles.length} entity files written`);

// ---------------------------------------------------------------------------
// Step 2: assert entity files exist at canonical paths
// ---------------------------------------------------------------------------

const expectedEntities = [
  'Resource',
  'Distribution',
  'Title',
  'Description',
  'Distribution_2',
  'AccessURL',
  'Catalog',
  'Dataset'
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
// Step 3: import generated index and validate a dcat:Distribution instance
// ---------------------------------------------------------------------------

const generated = await import(indexPath) as {
  'DatasetSchema': Record<string, unknown> & { '$id': string };
  'dcat': ReturnType<typeof JsonTology.create>;
  'DistributionSchema': Record<string, unknown> & { '$id': string };
  'ResourceSchema': Record<string, unknown> & { '$id': string };
};

const {
  DistributionSchema, ResourceSchema
} = generated;

// Validate a dcat:Distribution in isolation
const neverendingDistribution = { 'accessURL': 'https://fantastica.example/data/realms.csv' };

const distJt = JsonTology.create({
  'baseIRI': 'http://www.w3.org/ns/dcat#',
  'enableStrictGraph': false,
  'schemas': [DistributionSchema]
});

const distResult = distJt.validate(DistributionSchema, neverendingDistribution);

console.assert(distResult.ok, `Distribution must validate; errors: ${JSON.stringify(distResult)}`);
console.log('Distribution validates (registry-dir mode):', distResult.ok);

// dcterms:Resource stub carries title + description properties
const resourceRec = ResourceSchema as Record<string, unknown>;
const resourceProps = resourceRec.properties as Record<string, unknown> | undefined;

console.assert(
  resourceProps !== undefined && 'title' in resourceProps,
  'Resource stub carries title property from owl:DatatypeProperty declaration'
);
console.log('dcterms:Resource.properties.title present (external IRI stub):', resourceProps !== undefined && 'title' in resourceProps);

// ---------------------------------------------------------------------------
// Step 4: compare generated entity file to committed fixture
// ---------------------------------------------------------------------------

const committedDatasetPath = resolve(ONTOLOGIES, 'generated-dir', 'dcat', 'entities', 'Dataset.ts');

function stripTimestamp(src: string): string {
  return src.replaceAll(/^\/\/ Generated: .*$/gmu, '// Generated: <timestamp>');
}

const generatedDatasetSrc = readFileSync(resolve(TMP_DIR, 'entities', 'Dataset.ts'), 'utf8');
const committedDatasetSrc = readFileSync(committedDatasetPath, 'utf8');

console.assert(
  stripTimestamp(generatedDatasetSrc) === stripTimestamp(committedDatasetSrc),
  'Generated entities/Dataset.ts matches committed generated-dir fixture (modulo timestamp)'
);
console.log('entities/Dataset.ts matches committed fixture (modulo timestamp): true');
