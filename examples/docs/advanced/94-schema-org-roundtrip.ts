/**
 * schema.org subset — real-ontology codegen round-trip.
 *
 * schema.org is a collaborative vocabulary for structured data on the Web,
 * used by search engines and data publishers. This example demonstrates a
 * round-trip against a hand-authored schema.org subset:
 *
 *   1. Import the schema-org-subset.jsonld fixture and call `JsonTology.fromTbox`
 *      (runtime path).
 *   2. Generate TypeScript source via `generateFromTbox` and compare to the committed
 *      `schema-org.generated.ts` fixture (modulo the auto-generated timestamp banner).
 *   3. Import the committed `schema-org.generated.ts` generated registry and validate
 *      a Bastian Balthazar Bux–flavoured schema:Book instance.
 *   4. Assert `InferType<typeof IsbnTypeSchema>` narrows to `string` at compile time.
 *
 * Notable round-trip behaviour: `schema:IsbnType` is declared as an `rdfs:Datatype`
 * with an `owl:withRestrictions` XSD pattern facet (`^\d{13}$`). This round-trips
 * losslessly — the generated `IsbnTypeSchema` carries `type: 'string', pattern: ...`
 * and `BookSchema.properties.isbn` is a `$ref` pointing to `IsbnTypeSchema`.
 */

import { readFileSync } from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
import { generateFromTbox } from '../../../src/owl-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
const ONTOLOGIES = resolve(here, '../ontologies');

// ---------------------------------------------------------------------------
// Step 1: runtime fromTbox — read the real schema.org JSON-LD fixture
// ---------------------------------------------------------------------------

const schemaOrgJsonLdRaw = readFileSync(resolve(ONTOLOGIES, 'schema-org-subset.jsonld'), 'utf8');
const schemaOrgJsonLd = JSON.parse(schemaOrgJsonLdRaw) as object;

const result = JsonTology.fromTbox(schemaOrgJsonLd);

// Classes: Thing, Person, Organization, Book, IsbnType (datatype), plus property stubs
console.assert(result.schemas.length >= 5, `Expected at least 5 schemas, got ${result.schemas.length}`);
console.assert(result.unsupported.length === 0, `Expected 0 unsupported axioms, got ${result.unsupported.length}`);

// XSD-facet-bearing datatype: IsbnType carries pattern ^\\d{13}$
const isbnTypeSchema = result.schemas.find((schema) => {
  return schema.$id === 'https://schema.org/IsbnType';
});

console.assert(isbnTypeSchema !== undefined, 'schema:IsbnType datatype schema must be present');

const isbnTypeRec = isbnTypeSchema as Record<string, unknown>;

console.assert(
  isbnTypeRec.pattern === '^\\d{13}$',
  'XSD pattern facet ^\\d{13}$ round-trips losslessly on IsbnType'
);
console.assert(
  isbnTypeRec.type === 'string',
  'IsbnType resolves to type: string'
);

// Book → Thing via rdfs:subClassOf
const bookSchema = result.schemas.find((schema) => {
  return schema.$id === 'https://schema.org/Book';
});

const bookRec = bookSchema as Record<string, unknown>;
const bookAllOf = bookRec.allOf as Array<Record<string, unknown>> | undefined;
const bookInheritsThing = Array.isArray(bookAllOf) && bookAllOf.some((entry) => {
  return entry.$ref === 'https://schema.org/Thing';
});

console.assert(bookInheritsThing, 'subClassOf preserved: schema:Book → schema:Thing');

console.log(`fromTbox: ${result.schemas.length} schemas, ${result.unsupported.length} unsupported axioms`);
console.log('IsbnType pattern round-trips:', isbnTypeRec.pattern);
console.log('subClassOf (Book → Thing):', bookInheritsThing);

// ---------------------------------------------------------------------------
// Step 2: codegen — compare generated source to committed fixture
//         (modulo the timestamp line)
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': schemaOrgJsonLd,
  'name': 'schemaOrg',
  'sourceLabel': 'examples/docs/ontologies/schema-org-subset.jsonld'
});

const committedSrc = readFileSync(
  resolve(ONTOLOGIES, 'generated', 'schema-org.generated.ts'),
  'utf8'
);

function stripTimestamp(src: string): string {
  return src.replaceAll(/^\/\/ Generated: .*$/gmu, '// Generated: <timestamp>');
}

console.assert(
  stripTimestamp(generatedSrc) === stripTimestamp(committedSrc),
  'Generated source matches committed schema-org.generated.ts fixture (modulo timestamp)'
);

console.log('Codegen output matches committed fixture (modulo timestamp): true');

// ---------------------------------------------------------------------------
// Step 3: import committed generated registry and validate schema:Book instances
// ---------------------------------------------------------------------------

const generated = await import('../ontologies/generated/schema-org.generated.js') as {
  'BookSchema': Record<string, unknown> & { '$id': string };
  'IsbnTypeSchema': Record<string, unknown> & { '$id': string };
  'OrganizationSchema': Record<string, unknown> & { '$id': string };
  'PersonSchema': Record<string, unknown> & { '$id': string };
  'schemaOrg': ReturnType<typeof JsonTology.create>;
  'ThingSchema': Record<string, unknown> & { '$id': string };
};

const {
  BookSchema, 'IsbnTypeSchema': CommittedIsbnSchema, OrganizationSchema, PersonSchema, schemaOrg
} = generated;

// Validate a schema:Person — Cornelia Funke (the author)
const cornelia = { 'name': 'Cornelia Funke' };

const corneliaResult = schemaOrg.validate(PersonSchema, cornelia);

console.assert(corneliaResult.ok, `Cornelia Funke must validate as schema:Person; errors: ${JSON.stringify(corneliaResult)}`);
console.log('Cornelia Funke validates as schema:Person:', corneliaResult.ok);

// Validate a schema:Organization — Bastian's publisher
const thienemann = { 'name': 'Thienemann Verlag' };

const orgResult = schemaOrg.validate(OrganizationSchema, thienemann);

console.assert(orgResult.ok, `Publisher must validate as schema:Organization; errors: ${JSON.stringify(orgResult)}`);
console.log('Thienemann Verlag validates as schema:Organization:', orgResult.ok);

// Validate isbn through BookSchema — the isbn field references IsbnTypeSchema
// which carries the pattern constraint. A 13-digit ISBN must pass.
const bookWithValidIsbn = {
  'author': { 'name': 'Cornelia Funke' },
  'isbn': '9783551551672',
  'name': 'The Neverending Story',
  'publisher': { 'name': 'Thienemann Verlag' }
};

const bookResult = schemaOrg.validate(BookSchema, bookWithValidIsbn);

console.assert(bookResult.ok, `Book with valid ISBN must validate; errors: ${JSON.stringify(bookResult)}`);
console.log('Neverending Story book validates as schema:Book:', bookResult.ok);

// Validate the IsbnType pattern constraint directly
const isbnJt = JsonTology.create({
  'baseIRI': 'https://schema.org',
  'enableStrictGraph': false,
  'schemas': [CommittedIsbnSchema]
});

const validIsbnResult = isbnJt.validate(CommittedIsbnSchema, '9783551551672');

console.assert(validIsbnResult.ok, `Valid ISBN must pass pattern validation; errors: ${JSON.stringify(validIsbnResult)}`);
console.log('Valid ISBN-13 passes IsbnType pattern constraint:', validIsbnResult.ok);

const invalidIsbnResult = isbnJt.validate(CommittedIsbnSchema, 'not-a-isbn');

console.assert(!invalidIsbnResult.ok, 'Invalid ISBN must fail pattern validation');
console.log('Invalid ISBN string correctly rejected by IsbnType:', !invalidIsbnResult.ok);

// ---------------------------------------------------------------------------
// Step 4: compile-time type narrowing with InferType
// ---------------------------------------------------------------------------

// The generated IsbnTypeSchema is `{ type: 'string', pattern: '...', $id: '...' }`.
// InferType narrows it to `string` because JSON Schema `type: 'string'` resolves to
// TypeScript `string`.

type IsbnType = InferType<{
  readonly '$id': 'https://schema.org/IsbnType';
  readonly 'pattern': '^\\d{13}$';
  readonly 'type': 'string';
}>;

const isbnValue: IsbnType = '9783551551672';

console.assert(
  typeof isbnValue === 'string',
  'InferType<IsbnTypeSchema> narrows to string'
);
console.log('InferType<IsbnTypeSchema> narrows to string:', typeof isbnValue === 'string');

// Bastian Balthazar Bux as an author (Person) — compile-time shape
type SchemaPerson = InferType<{
  readonly '$id': 'https://schema.org/Person';
  readonly 'allOf': [{ readonly '$ref': 'https://schema.org/Thing' }];
  readonly 'properties': Record<string, never>;
  readonly 'required': [];
  readonly 'type': 'object';
}>;

const bastian: SchemaPerson = {};

console.assert(
  typeof bastian === 'object',
  'InferType<PersonSchema> narrows to object'
);
console.log('Bastian Balthazar Bux typed as SchemaPerson:', typeof bastian === 'object');
