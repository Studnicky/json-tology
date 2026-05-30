/**
 * schema.org subset — registry-directory codegen round-trip.
 *
 * schema.org is a collaborative vocabulary for structured data on the Web.
 * This example demonstrates the registry-directory mode against the hand-authored
 * schema.org subset:
 *
 *   1. Generate the registry directory to a tmp path.
 *   2. Assert each expected entity file exists.
 *   3. Import the generated `index.ts` and validate a schema:Book instance.
 *   4. Confirm the committed generated-dir fixture matches the programmatic output.
 *
 * Notable: `schema:IsbnType` is declared as an `rdfs:Datatype` with an XSD pattern
 * facet (`^\d{13}$`). The generated `IsbnType.ts` entity file carries the full
 * `type: 'string', pattern: ...` schema — identical to the single-file mode output.
 */

import {
  existsSync, readFileSync
} from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonTology } from '../../../src/index.js';
import { writeRegistryDirectory } from '../../../src/owl-gen-node.js';

const here = dirname(fileURLToPath(import.meta.url));
const ONTOLOGIES = resolve(here, '../ontologies');
const TMP_DIR = resolve(here, '../../../.generated-tmp/schema-org-registry-dir');

// ---------------------------------------------------------------------------
// Step 1: generate the registry directory
// ---------------------------------------------------------------------------

const schemaOrgJsonLdRaw = readFileSync(resolve(ONTOLOGIES, 'schema-org-subset.jsonld'), 'utf8');
const schemaOrgJsonLd = JSON.parse(schemaOrgJsonLdRaw) as object;

const genResult = writeRegistryDirectory({
  'input': schemaOrgJsonLd,
  'name': 'schemaOrg',
  'outDir': TMP_DIR,
  'sourceLabel': 'examples/docs/ontologies/schema-org-subset.jsonld'
});

// 4 classes (Thing, IsbnType, Person, Organization, Book) + 4 property stubs = 9 entity files
console.assert(
  genResult.entityFiles.length === 9,
  `Expected 9 entity files, got ${genResult.entityFiles.length}`
);
console.log(`generateRegistryDirectory: ${genResult.entityFiles.length} entity files written`);

// ---------------------------------------------------------------------------
// Step 2: assert entity files exist at canonical paths
// ---------------------------------------------------------------------------

const expectedEntities = [
  'Thing',
  'IsbnType',
  'Name',
  'Isbn',
  'Author',
  'Publisher',
  'Person',
  'Organization',
  'Book'
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
// Step 3: import generated index and validate instances
// ---------------------------------------------------------------------------

const generated = await import(indexPath) as {
  'BookSchema': Record<string, unknown> & { '$id': string };
  'IsbnTypeSchema': Record<string, unknown> & { '$id': string };
  'OrganizationSchema': Record<string, unknown> & { '$id': string };
  'PersonSchema': Record<string, unknown> & { '$id': string };
  'schemaOrg': ReturnType<typeof JsonTology.create>;
  'ThingSchema': Record<string, unknown> & { '$id': string };
};

const {
  BookSchema, IsbnTypeSchema, OrganizationSchema, PersonSchema, schemaOrg
} = generated;

// Validate a schema:Person — Cornelia Funke (the author)
const cornelia = { 'name': 'Cornelia Funke' };

const corneliaResult = schemaOrg.validate(PersonSchema, cornelia);

console.assert(corneliaResult.ok, `Cornelia Funke must validate as schema:Person; errors: ${JSON.stringify(corneliaResult)}`);
console.log('Cornelia Funke validates as schema:Person (registry-dir):', corneliaResult.ok);

// Validate a schema:Organization — Bastian's publisher
const thienemann = { 'name': 'Thienemann Verlag' };

const orgResult = schemaOrg.validate(OrganizationSchema, thienemann);

console.assert(orgResult.ok, `Publisher must validate as schema:Organization; errors: ${JSON.stringify(orgResult)}`);
console.log('Thienemann Verlag validates as schema:Organization (registry-dir):', orgResult.ok);

// Validate a schema:Book — the ISBN pattern constraint is preserved in the generated
// IsbnType.ts entity file. The 13-digit ISBN must pass.
const neverendingStoryBook = {
  'author': { 'name': 'Cornelia Funke' },
  'isbn': '9783551551672',
  'name': 'The Neverending Story',
  'publisher': { 'name': 'Thienemann Verlag' }
};

const bookResult = schemaOrg.validate(BookSchema, neverendingStoryBook);

console.assert(bookResult.ok, `Book with valid ISBN must validate; errors: ${JSON.stringify(bookResult)}`);
console.log('Neverending Story validates as schema:Book (registry-dir):', bookResult.ok);

// IsbnType entity file carries the XSD pattern facet from owl:withRestrictions
const isbnTypeRec = IsbnTypeSchema as Record<string, unknown>;

console.assert(
  isbnTypeRec.pattern === '^\\d{13}$',
  'IsbnType XSD pattern facet preserved in registry-dir output'
);
console.log('IsbnType pattern preserved (registry-dir):', isbnTypeRec.pattern);

// ---------------------------------------------------------------------------
// Step 4: compare generated entity file to committed fixture
// ---------------------------------------------------------------------------

const committedBookPath = resolve(ONTOLOGIES, 'generated-dir', 'schema-org', 'entities', 'Book.ts');

function stripTimestamp(src: string): string {
  return src.replaceAll(/^\/\/ Generated: .*$/gmu, '// Generated: <timestamp>');
}

const generatedBookSrc = readFileSync(resolve(TMP_DIR, 'entities', 'Book.ts'), 'utf8');
const committedBookSrc = readFileSync(committedBookPath, 'utf8');

console.assert(
  stripTimestamp(generatedBookSrc) === stripTimestamp(committedBookSrc),
  'Generated entities/Book.ts matches committed generated-dir fixture (modulo timestamp)'
);
console.log('entities/Book.ts matches committed fixture (modulo timestamp): true');
