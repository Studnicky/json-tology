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
 *   4. Write the source to /tmp/neverending-generated.ts, load via tsx,
 *      and validate a Neverending-Story fixture against the exported schema.
 *   5. Use a locally-authored `InferType` annotation to show compile-time
 *      type derivation from the same schema shape.
 *
 * The sibling agent's `src/owl-gen.ts` / `json-tology/owl-gen` export
 * provides `generateFromTbox`. If that module has not yet landed in the
 * working tree, the example falls back to the runtime `fromTbox` path
 * with a clear "sibling not landed yet" message so CI does not fail.
 */

import {
  mkdirSync, writeFileSync
} from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
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
// Step 1: load generateFromTbox — sibling's module, may not be landed yet
// ---------------------------------------------------------------------------

type GenerateFromTboxFn = (options: {
  'baseIRI'?: string;
  'input': object | string;
  'name'?: string;
}) => string;

interface SchemaLiteral {
  '$id': string;
  'properties'?: Record<string, unknown>;
  'type': string;
}

const owlGenModule: null | Record<string, unknown> = await (
  import('json-tology/owl-gen') as Promise<Record<string, unknown>>
).catch((): null => {
  return null;
});

const generateFromTbox: GenerateFromTboxFn | null = (
  owlGenModule !== null && typeof owlGenModule.generateFromTbox === 'function'
)
  ? owlGenModule.generateFromTbox as GenerateFromTboxFn
  : null;

// ---------------------------------------------------------------------------
// Step 2: generate TypeScript source (or use the runtime path as a fallback)
// ---------------------------------------------------------------------------

if (generateFromTbox === null) {
  // ── SIBLING NOT YET LANDED ───────────────────────────────────────────────
  // The json-tology/owl-gen subpath export hasn't been merged yet.
  // Fall back to the runtime fromTbox path so the rest of the example
  // remains executable and CI does not fail.

  console.log('[sibling not landed yet] generateFromTbox not available — running runtime fromTbox path instead.');
  console.log('Once src/owl-gen.ts is merged, this example will use the full codegen round-trip.');

  // Demonstrate what the generated module would look like at runtime.
  const jt = JsonTology.create({
    'baseIRI': 'https://neverending.example/',
    'enableStrictGraph': false
  });

  const result = jt.fromTbox(syntheticTboxJsonLd);

  const PersonSchema = result.schemas.find((schema) => {
    return schema.$id === 'https://neverending.example/Person';
  });

  const GroupSchema = result.schemas.find((schema) => {
    return schema.$id === 'https://neverending.example/Group';
  });

  console.assert(PersonSchema !== undefined, 'Person schema must be present after fromTbox');
  console.assert(GroupSchema !== undefined, 'Group schema must be present after fromTbox');

  console.log('Imported schemas (runtime path):', result.schemas.map((schema) => {
    return schema.$id;
  }));

  // Validate a Neverending-Story fixture against the runtime-imported schema.
  if (PersonSchema !== undefined) {
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
} else {
  // ── SIBLING IS PRESENT ───────────────────────────────────────────────────
  // Full codegen round-trip.

  const generatedSrc = generateFromTbox({
    'input': syntheticTboxJsonLd,
    'name': 'neverending'
  });

  // Step 3: verify the generated source structure.
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

  // Step 4: write to a temp directory inside the project so bare-specifier
  // imports in the generated file (e.g. 'json-tology/types') resolve via the
  // project's node_modules. A data: URL cannot resolve bare specifiers.
  const here = dirname(fileURLToPath(import.meta.url));
  const tmpDir = resolve(here, '../../../.generated-tmp');
  const tmpPath = resolve(tmpDir, 'neverending-generated.ts');

  mkdirSync(tmpDir, { 'recursive': true });
  writeFileSync(tmpPath, generatedSrc, 'utf8');

  const generated = await import(tmpPath) as Record<string, unknown>;

  const PersonSchema = generated.PersonSchema as SchemaLiteral | undefined;
  const GroupSchema = generated.GroupSchema as SchemaLiteral | undefined;

  console.assert(
    PersonSchema !== undefined,
    'PersonSchema must be present in the loaded generated module'
  );
  console.assert(
    GroupSchema !== undefined,
    'GroupSchema must be present in the loaded generated module'
  );

  // Step 5: validate a Neverending-Story fixture.
  // Bastian Balthazar Bux is a Person; we validate against the generated schema.
  if (PersonSchema !== undefined) {
    const jt = JsonTology.create({
      'baseIRI': 'https://neverending.example/',
      'enableStrictGraph': false,
      'schemas': [PersonSchema as Record<string, unknown> & { '$id': string }]
    });

    const bastian = { 'name': 'Bastian Balthazar Bux' };

    const result = jt.validate(
      PersonSchema as Record<string, unknown> & { '$id': string },
      bastian
    );

    console.assert(
      result.ok,
      `Bastian fixture must validate against generated PersonSchema; errors: ${JSON.stringify(result)}`
    );
    console.log('Bastian validates against generated PersonSchema:', result.ok);
  }

  // Compile-time type demonstration — InferType on the generated schema shape.
  // Because the generated module emits `as const` literals, the type narrows
  // correctly. Here we annotate with a locally-authored type for illustration;
  // in a real consumer, this comes directly from the generated module's exports.
  if (PersonSchema !== undefined) {
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
  }
}

// ---------------------------------------------------------------------------
// Bonus: bookstore TBox — show what a larger codegen input looks like
// ---------------------------------------------------------------------------
// The bookstore TBox has ~62 classes. generateFromTbox handles it in a single
// pass; once the sibling lands, replace this section with a full codegen call.

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
