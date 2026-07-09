/**
 * OWL codegen round-trip — what a generated module looks like.
 *
 * The `json-tology owl-gen` CLI and the `generateFromTbox` programmatic API
 * accept any OWL 2 TBox that `fromTbox` can read and emit a TypeScript source
 * file containing `as const` schema literals. Because those literals are
 * ordinary TypeScript constants, `InferType<typeof Schema>` extracts a
 * compile-time type just like a hand-authored schema.
 *
 * This file demonstrates the full round-trip in a single runnable script:
 *
 *   1. Define a small synthetic 2-class ontology inline as JSON-LD
 *      (foaf:Person and foaf:Group, Neverending-Story flavoured).
 *   2. Call `generateFromTbox` to produce the TypeScript source string.
 *   3. Assert the generated source contains expected export declarations.
 *   4. Use a locally-authored `InferType` annotation to show compile-time
 *      type derivation from the same schema shape.
 *
 * Browser-safe: no node:fs, node:path, or node:url. The source string is
 * inspected in-memory; no disk writes or dynamic imports are performed.
 */

import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
import { generateFromTbox } from '../../../src/owl-gen/index.js';
import { bookstoreEntities } from '../bookstore/index.js';

// ---------------------------------------------------------------------------
// Inline synthetic ontology — foaf-style, Neverending-Story characters
// ---------------------------------------------------------------------------

const syntheticTboxJsonLd = JSON.stringify({
  '@context': {
    'ex': 'https://neverending.example/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    // foaf:Person analogue — a character in the story
    {
      '@id': 'https://neverending.example/Person',
      '@type': 'owl:Class'
    },
    // foaf:name
    {
      '@id': 'https://neverending.example/name',
      '@type': 'owl:DatatypeProperty',
      'rdfs:domain': { '@id': 'https://neverending.example/Person' },
      'rdfs:range': { '@id': 'xsd:string' }
    },
    // foaf:Group analogue — a faction or realm in Fantastica
    {
      '@id': 'https://neverending.example/Group',
      '@type': 'owl:Class'
    },
    // foaf:member — Group has members who are Persons
    {
      '@id': 'https://neverending.example/member',
      '@type': 'owl:ObjectProperty',
      'rdfs:domain': { '@id': 'https://neverending.example/Group' },
      'rdfs:range': { '@id': 'https://neverending.example/Person' }
    }
  ]
});

// ---------------------------------------------------------------------------
// Step 1: generate TypeScript source from the inline TBox
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': syntheticTboxJsonLd,
  'name': 'neverending'
});

// ---------------------------------------------------------------------------
// Step 2: verify the generated source structure
// ---------------------------------------------------------------------------

console.assert(
  generatedSrc.includes('export const PersonSchema'),
  'Generated source must export PersonSchema'
);
console.assert(
  generatedSrc.includes('export const GroupSchema'),
  'Generated source must export GroupSchema'
);
console.assert(
  generatedSrc.includes('as const'),
  'Generated source must use as const literals'
);
console.assert(
  generatedSrc.includes('InferType'),
  'Generated source must re-export InferType-derived types'
);

console.log('generateFromTbox source check passed — all expected exports present.');
console.log('Generated source length:', generatedSrc.length);
console.log('Contains PersonSchema export:', generatedSrc.includes('export const PersonSchema'));
console.log('Contains GroupSchema export:', generatedSrc.includes('export const GroupSchema'));

// ---------------------------------------------------------------------------
// Step 3: validate a Neverending-Story fixture against the runtime-imported schema
// ---------------------------------------------------------------------------

// Use the runtime fromTbox path to validate (no disk I/O needed).
const jt = JsonTology.create({
  'baseIri': 'https://neverending.example/',
  'enableStrictGraph': false
});

const result = jt.fromTbox(syntheticTboxJsonLd);

const PersonSchema = result.schemas.find((schema) => {
  return schema.$id === 'https://neverending.example/Person';
});

console.assert(PersonSchema !== undefined, 'Person schema must be present after fromTbox');

if (PersonSchema !== undefined && typeof PersonSchema.$id === 'string') {
  const bastian = { 'name': 'Bastian Balthazar Bux' };
  const validationResult = jt.validate(
    PersonSchema as Record<string, unknown> & { '$id': string },
    bastian
  );

  console.assert(
    validationResult.ok,
    `Bastian fixture must validate; errors: ${JSON.stringify(validationResult)}`
  );
  console.log('Bastian validates against runtime-imported PersonSchema:', validationResult.ok);
}

// ---------------------------------------------------------------------------
// Step 4: compile-time type demonstration — InferType on a schema shape
// ---------------------------------------------------------------------------

// Because `generateFromTbox` emits `as const` literals, `InferType<…>` works
// correctly. We annotate with a locally-authored shape that mirrors the output;
// in a real consumer this comes directly from the generated module's exports.
type GeneratedPerson = InferType<{
  readonly '$id': 'https://neverending.example/Person';
  readonly 'properties': {
    readonly 'name': { readonly 'type': 'string' };
  };
  readonly 'type': 'object';
}>;

const cornelia: GeneratedPerson = { 'name': 'Cornelia Funke' };

console.assert(
  typeof cornelia.name === 'string',
  'Cornelia Funke fixture must satisfy GeneratedPerson compile-time type'
);
console.log('Cornelia Funke type-check passes:', typeof cornelia.name === 'string');

// ---------------------------------------------------------------------------
// Bonus: bookstore TBox — show what a larger codegen input looks like
// ---------------------------------------------------------------------------

const bookstoreTboxJsonLd = bookstoreEntities.toTbox().jsonLd();
const bookstoreImport = JsonTology.fromTbox(bookstoreTboxJsonLd);

console.assert(
  bookstoreImport.schemas.length > 0,
  'Bookstore TBox must produce at least one schema'
);
console.assert(
  bookstoreImport.unsupported.length === 0,
  `Bookstore TBox must have zero unsupported axioms; got: ${bookstoreImport.unsupported.length}`
);

console.log(`Bookstore TBox: ${bookstoreImport.schemas.length} schemas, ${bookstoreImport.unsupported.length} unsupported`);
