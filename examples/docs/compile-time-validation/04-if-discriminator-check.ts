/**
 * Compile-time schema validation: if.properties discriminator presence
 *
 * Every property key in `if.properties` must appear in the parent schema's
 * `properties`. Discriminator keys absent from `properties` surface an
 * `IfDiscriminatorNotInPropertiesType` brand error.
 *
 * This example shows the valid case — a book schema that conditionally
 * requires `isbn` when `kind` is 'physical'. Both `kind` and `isbn` are
 * declared in `properties`.
 *
 * Note: `then` cannot appear in an object literal (unicorn/no-thenable).
 * Use `Reflect.set` to attach the JSON Schema `then` keyword.
 */

import type { ValidateSchemaType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const thenBranch = { 'required': ['isbn'] } as const;

const BookKindSchemaBase = {
  '$id': 'urn:docs-compile-time-04:BookKind',
  'if': {
    'properties': { 'kind': { 'const': 'physical' } },
    'required': ['kind']
  },
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'kind': {
      'enum': [
        'physical',
        'digital'
      ],
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'kind',
    'title'
  ],
  'type': 'object'
} as const;

// `then` keyword attached via Reflect.set — unicorn/no-thenable disallows it in literals.
Reflect.set(BookKindSchemaBase, 'then', thenBranch);

type BookKindSchema = typeof BookKindSchemaBase & { 'then': typeof thenBranch };

// `kind` is in properties — the if.properties discriminator compiles.
const _check: ValidateSchemaType<typeof BookKindSchemaBase> = BookKindSchemaBase;

void _check;

const jt = JsonTology.create({
  'baseIRI': 'urn:docs-compile-time-04',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  'schemas': [BookKindSchemaBase as BookKindSchema] as const
});

// Physical book must have isbn.
const errsPhysicalNoIsbn = jt.validate(BookKindSchemaBase.$id, {
  'kind': 'physical',
  'title': 'Die unendliche Geschichte'
});

console.assert(errsPhysicalNoIsbn.length > 0);

// Digital book — isbn not required.
const errsDigital = jt.validate(BookKindSchemaBase.$id, {
  'kind': 'digital',
  'title': 'Die unendliche Geschichte'
});

console.assert(errsDigital.length === 0);

// Log: if.properties discriminator compile-time check passed; runtime enforces conditional.
console.log('ValidateSchemaType<BookKindSchema> accepted — if.properties keys present in properties');
console.log(`physical book without isbn: ${errsPhysicalNoIsbn.length} error(s) (expected >0)`);
console.log(`  violation: ${errsPhysicalNoIsbn.items[0]?.message ?? '(none)'}`);
console.log(`digital book without isbn: ${errsDigital.length} error(s) (expected 0)`);
