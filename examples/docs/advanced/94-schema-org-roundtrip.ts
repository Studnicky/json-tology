/**
 * schema.org subset — real-ontology codegen round-trip.
 *
 * schema.org is a collaborative vocabulary for structured data on the Web,
 * used by search engines and data publishers. This example demonstrates a
 * round-trip against a hand-authored schema.org subset:
 *
 *   1. Import the schema-org-subset data and call `JsonTology.fromTbox`
 *      (runtime path).
 *   2. Generate TypeScript source via `generateFromTbox` and log salient facts.
 *   3. Validate a Bastian Balthazar Bux-flavoured schema:Book instance.
 *   4. Assert `InferType<typeof IsbnTypeSchema>` narrows to `string` at compile time.
 *
 * Notable round-trip behaviour: `schema:IsbnType` is declared as an `rdfs:Datatype`
 * with an `owl:withRestrictions` XSD pattern facet (`^\d{13}$`). This round-trips
 * losslessly — the generated `IsbnTypeSchema` carries `type: 'string', pattern: ...`
 * and `BookSchema.properties.isbn` is a `$ref` pointing to `IsbnTypeSchema`.
 *
 * Browser-safe: no node:fs, node:path, or node:url.
 */

import type {
  InferType, SchemaReferencesMapType
} from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
import { generateFromTbox } from '../../../src/owl-gen/index.js';
import { schemaOrgSubset } from '../ontologies/schema-org-subset.js';

// ---------------------------------------------------------------------------
// Step 1: runtime fromTbox — import the schema.org JSON-LD data directly
// ---------------------------------------------------------------------------

const result = JsonTology.fromTbox(schemaOrgSubset);

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

// Book -> Thing via rdfs:subClassOf
const bookSchema = result.schemas.find((schema) => {
  return schema.$id === 'https://schema.org/Book';
});

const bookRec = bookSchema as Record<string, unknown>;
const bookAllOf = bookRec.allOf as Array<Record<string, unknown>> | undefined;
const bookInheritsThing = Array.isArray(bookAllOf) && bookAllOf.some((entry) => {
  return entry.$ref === 'https://schema.org/Thing';
});

console.assert(bookInheritsThing, 'subClassOf preserved: schema:Book -> schema:Thing');

console.log(`fromTbox: ${result.schemas.length} schemas, ${result.unsupported.length} unsupported axioms`);
console.log('IsbnType pattern round-trips:', isbnTypeRec.pattern);
console.log('subClassOf (Book -> Thing):', bookInheritsThing);

// ---------------------------------------------------------------------------
// Step 2: codegen — generate source and log salient facts
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': schemaOrgSubset,
  'name': 'schemaOrg',
  'sourceLabel': 'examples/docs/ontologies/schema-org-subset.jsonld'
});

console.assert(generatedSrc.includes('export const BookSchema'), 'Generated source must export BookSchema');
console.assert(generatedSrc.includes('export const IsbnTypeSchema'), 'Generated source must export IsbnTypeSchema');
console.assert(generatedSrc.includes('^\\\\d{13}$'), 'Generated source must preserve ISBN pattern');

console.log('Generated source length:', generatedSrc.length);
console.log('Contains BookSchema export:', generatedSrc.includes('export const BookSchema'));
console.log('Contains IsbnTypeSchema export:', generatedSrc.includes('export const IsbnTypeSchema'));

// ---------------------------------------------------------------------------
// Step 3: validate schema.org instances against the runtime-imported schemas
// ---------------------------------------------------------------------------

const personSchema = result.schemas.find((schema) => {
  return schema.$id === 'https://schema.org/Person';
});
const organizationSchema = result.schemas.find((schema) => {
  return schema.$id === 'https://schema.org/Organization';
});

if (personSchema !== undefined && typeof personSchema.$id === 'string') {
  const personRec = personSchema as Record<string, unknown> & { '$id': string };
  const thingSchema = result.schemas.find((schema) => {
    return schema.$id === 'https://schema.org/Thing';
  });

  const thingRec = thingSchema as (Record<string, unknown> & { '$id': string }) | undefined;
  const personSchemas: Array<Record<string, unknown> & { '$id': string }> = thingRec === undefined
    ? [personRec]
    : [
      personRec,
      thingRec
    ];

  const personJt = JsonTology.create({
    'baseIri': 'https://schema.org',
    'enableStrictGraph': false,
    'schemas': personSchemas
  });

  const cornelia = { 'name': 'Cornelia Funke' };
  const corneliaResult = personJt.validate(personRec, cornelia);

  console.assert(corneliaResult.ok, `Cornelia Funke must validate as schema:Person; errors: ${JSON.stringify(corneliaResult)}`);
  console.log('Cornelia Funke validates as schema:Person:', corneliaResult.ok);
}

if (organizationSchema !== undefined && typeof organizationSchema.$id === 'string') {
  const orgRec = organizationSchema as Record<string, unknown> & { '$id': string };
  const thingSchema = result.schemas.find((schema) => {
    return schema.$id === 'https://schema.org/Thing';
  });

  const thingRec = thingSchema as (Record<string, unknown> & { '$id': string }) | undefined;
  const orgSchemas: Array<Record<string, unknown> & { '$id': string }> = thingRec === undefined
    ? [orgRec]
    : [
      orgRec,
      thingRec
    ];

  const orgJt = JsonTology.create({
    'baseIri': 'https://schema.org',
    'enableStrictGraph': false,
    'schemas': orgSchemas
  });

  const thienemann = { 'name': 'Thienemann Verlag' };
  const orgResult = orgJt.validate(orgRec, thienemann);

  console.assert(orgResult.ok, `Publisher must validate as schema:Organization; errors: ${JSON.stringify(orgResult)}`);
  console.log('Thienemann Verlag validates as schema:Organization:', orgResult.ok);
}

// Validate the IsbnType pattern constraint directly using the runtime schema
if (isbnTypeSchema !== undefined && typeof isbnTypeSchema.$id === 'string') {
  const isbnRec = isbnTypeSchema as Record<string, unknown> & { '$id': string };
  const isbnJt = JsonTology.create({
    'baseIri': 'https://schema.org',
    'enableStrictGraph': false,
    'schemas': [isbnRec]
  });

  const validIsbnResult = isbnJt.validate(isbnRec, '9783551551672');

  console.assert(validIsbnResult.ok, `Valid ISBN must pass pattern validation; errors: ${JSON.stringify(validIsbnResult)}`);
  console.log('Valid ISBN-13 passes IsbnType pattern constraint:', validIsbnResult.ok);

  const invalidIsbnResult = isbnJt.validate(isbnRec, 'not-a-isbn');

  console.assert(!invalidIsbnResult.ok, 'Invalid ISBN must fail pattern validation');
  console.log('Invalid ISBN string correctly rejected by IsbnType:', !invalidIsbnResult.ok);
}

// ---------------------------------------------------------------------------
// Step 4: compile-time type narrowing with InferType
// ---------------------------------------------------------------------------

const IsbnTypeSchema = {
  '$id': 'https://schema.org/IsbnType',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

type IsbnType = InferType<typeof IsbnTypeSchema>;

// IsbnType carries a PatternBrandType brand; a plain string literal cannot
// satisfy the brand on its own — a branded value is produced by instantiate(),
// which validates the wire string and returns the narrowed branded type.
const isbnRegistry = JsonTology.create({
  'baseIri': 'https://schema.org/',
  'schemas': [IsbnTypeSchema]
});
const isbnValue: IsbnType = isbnRegistry.instantiate(IsbnTypeSchema.$id, '9783551551672');

console.assert(
  typeof isbnValue === 'string',
  'InferType<IsbnTypeSchema> narrows to string'
);
console.log('InferType<IsbnTypeSchema> narrows to string:', typeof isbnValue === 'string');

// The `allOf` member references schema:Thing; thread a references map carrying
// the Thing schema so the cross-schema `$ref` resolves to its inferred shape
// instead of `RefNotFound`.
type SchemaOrgRefs = SchemaReferencesMapType<readonly [{
  readonly '$id': 'https://schema.org/Thing';
  readonly 'properties': Record<string, never>;
  readonly 'required': [];
  readonly 'type': 'object';
}]>;

type SchemaPerson = InferType<{
  readonly '$id': 'https://schema.org/Person';
  readonly 'allOf': [{ readonly '$ref': 'https://schema.org/Thing' }];
  readonly 'properties': Record<string, never>;
  readonly 'required': [];
  readonly 'type': 'object';
}, SchemaOrgRefs>;

const bastian: SchemaPerson = {};

console.assert(
  typeof bastian === 'object',
  'InferType<PersonSchema> narrows to object'
);
console.log('Bastian Balthazar Bux typed as SchemaPerson:', typeof bastian === 'object');
