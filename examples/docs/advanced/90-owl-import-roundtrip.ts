/**
 * OWL Import round-trip — `fromTbox ∘ toTbox` contract.
 *
 * Demonstrates the full import pipeline:
 *   1. Export the bookstore TBox as JSON-LD (`jt.toTbox().jsonLd()`).
 *   2. Re-import it into a fresh registry (`jt.fromTbox()`).
 *   3. Verify the OWL class-axiom structure round-trips correctly.
 *   4. Validate a Bastian-orders-Neverending ABox instance against the
 *      imported `Book` schema (fields whose types survive the OWL round-trip).
 *
 * The round-trip preserves OWL 2 class axioms:
 *   - `rdfs:subClassOf`    → `allOf: [{ $ref }]`
 *   - `owl:complementOf`   → `not: { $ref }`
 *   - `owl:disjointWith`   → `disjointWith`
 *   - `owl:equivalentClass` → `$ref`
 *   - Property domain + range → `properties` with `type: 'string'` / `$ref`
 *
 * What the OWL round-trip does NOT preserve:
 *   XSD facets (minLength, minimum, pattern, format) — these are literal
 *   range annotations on the property, not OWL class axioms. Primitive
 *   schemas like `PersonName` (type: string, minLength: 1) emerge from
 *   fromTbox as `type: object` (OWL class with no scalar type). Use the
 *   original registry for full ABox validation; use the imported registry
 *   for structural/graph queries and OWL-level reasoning.
 */

import { JsonTology } from '../../../src/index.js';
import { bookstoreEntities } from '../bookstore/index.js';

// Step 1: export the canonical bookstore TBox as a JSON-LD string.
const tboxJsonLd = bookstoreEntities.toTbox().jsonLd();

// Step 2: re-import the TBox into a fresh registry using the instance method.
// `register: true` (the default) registers all produced schemas so the registry
// can resolve cross-schema $refs during validation.
const freshJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false
});

const result = freshJt.fromTbox(tboxJsonLd);

// → 0 after Phase 1: all eight dispatchers handle every bookstore axiom.
console.log(`Imported ${result.schemas.length} schemas from bookstore TBox`);
console.log(`Unsupported axioms: ${result.unsupported.length}`);

// Step 3: verify OWL class-axiom structure.

// 3a. subClassOf — RareBook → PrintBook
const rareBookSchema = result.schemas.find((schema) => {
  return schema.$id === 'urn:bookstore:RareBook';
}) as Record<string, unknown> | undefined;

const rareBookAllOf = rareBookSchema?.allOf as Array<Record<string, unknown>> | undefined;
const inheritsFromPrintBook = Array.isArray(rareBookAllOf)
  && rareBookAllOf.some((entry) => {
    return entry.$ref === 'urn:bookstore:PrintBook';
  });

console.assert(inheritsFromPrintBook, 'subClassOf preserved: RareBook → PrintBook');
// Prints: true
console.log('subClassOf (RareBook → PrintBook):', inheritsFromPrintBook);

// 3b. complementOf — OutOfPrintBook = ¬InPrintBook
const outOfPrintSchema = result.schemas.find((schema) => {
  return schema.$id === 'urn:bookstore:OutOfPrintBook';
}) as Record<string, unknown> | undefined;

const outOfPrintNot = outOfPrintSchema?.not as Record<string, unknown> | undefined;

console.assert(
  outOfPrintNot?.$ref === 'urn:bookstore:InPrintBook',
  'complementOf preserved: OutOfPrintBook ¬InPrintBook'
);
// Prints: true
console.log('complementOf (OutOfPrintBook ¬ InPrintBook):', outOfPrintNot?.$ref === 'urn:bookstore:InPrintBook');

// 3c. equivalentClass — AuthorName ≡ PersonName
const authorNameSchema = result.schemas.find((schema) => {
  return schema.$id === 'urn:bookstore:AuthorName';
}) as Record<string, unknown> | undefined;

console.assert(
  authorNameSchema?.$ref === 'urn:bookstore:PersonName',
  'equivalentClass preserved: AuthorName ≡ PersonName'
);
// Prints: true
console.log('equivalentClass (AuthorName ≡ PersonName):', authorNameSchema?.$ref === 'urn:bookstore:PersonName');

// Step 4: validate a Bastian ABox snippet against the imported Book schema.
//
// The imported Book schema preserves `inStock: boolean` (owl:DatatypeProperty
// with xsd:boolean range) and all `$ref`-typed object properties. Only scalar
// string/number fields without $ref ranges lose their facets.
const bookSchema = result.schemas.find((schema) => {
  return schema.$id === 'urn:bookstore:Book';
});

console.assert(bookSchema !== undefined, 'Book schema must be present after round-trip');

// Bastian's rare-book stub — uses only fields that survive the OWL round-trip.
// `inStock` is preserved as `type: boolean` (xsd:boolean DatatypeProperty range).
// The title/isbn fields have no facet constraints in the imported schema so they
// pass without structural constraints in the OWL-imported registry.
const neverendingStub = { 'inStock': true };

const errs = freshJt.validate(
  bookSchema as Record<string, unknown> & { '$id': string },
  neverendingStub
);

console.assert(errs.ok, `Book stub should validate against imported schema; errors: ${JSON.stringify(errs)}`);
// Prints: true
console.log('Bastian neverending stub validates against imported Book schema:', errs.ok);
