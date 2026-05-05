/**
 * e2e-types.ts — Compile-time type system
 *
 * Demonstrates type inference, type-safe parse/is, branded IDs,
 * transforms, and schema composition — all from the FOAF domain.
 *
 * Run: npm run build && tsx examples/e2e-types.ts
 */

import {
  Compose, JsonTology, Value
} from '../src/index.js';
import type {
  EnumValuesType, InferType, LooseInputType
} from '../src/index.js';
import {
  allSchemas, DateTimeSchema, foafPersons, MboxSchema, PersonSchema
} from '../test/fixtures/foaf.js';

// ---------------------------------------------------------------------------
// Type inference from schemas
// ---------------------------------------------------------------------------

type Person = InferType<typeof PersonSchema>;
type Mbox = InferType<typeof MboxSchema>;
// ---------------------------------------------------------------------------
// Composition — derive schemas from existing ones
// ---------------------------------------------------------------------------

const PersonName = Compose.pick(
  PersonSchema,
  [
    'givenName',
    'familyName'
  ] as const,
  'http://xmlns.com/foaf/0.1/PersonName' as const
);

const PatchPerson = Compose.partial(
  PersonSchema,
  'http://xmlns.com/foaf/0.1/PatchPerson' as const
);

// ---------------------------------------------------------------------------
// Constructor-time type map
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'http://xmlns.com/foaf',
  'schemas': allSchemas
});

jt.register(PersonName).register(PatchPerson);

// ---------------------------------------------------------------------------
// Type-safe parse — return type is Person, not unknown
// ---------------------------------------------------------------------------

const alice = jt.instantiate(PersonSchema.$id, foafPersons[0]) as Person;

console.log('--- Type-safe parse ---');
const givenName = typeof alice.givenName === 'string' ? alice.givenName : 'Unknown';
const familyName = typeof alice.familyName === 'string' ? alice.familyName : 'Unknown';
const mboxStr = typeof alice.mbox === 'string' ? alice.mbox : 'Unknown';

console.log('Person:', givenName, familyName, '-', mboxStr);

// ---------------------------------------------------------------------------
// Type guard — narrows unknown to Person
// ---------------------------------------------------------------------------

const incoming: unknown = foafPersons[1];

console.log('\n--- Type guard: is() ---');
if (jt.is(PersonSchema.$id, incoming)) {
  const incomingPerson = incoming as Person;
  const knowsLen = Array.isArray(incomingPerson.knows) ? incomingPerson.knows.length : 0;

  console.log('Valid person:', incomingPerson.givenName, incomingPerson.familyName, 'knows', knowsLen, 'person(s)');
}

// ---------------------------------------------------------------------------
// Branded types — Mbox is branded, not a plain string
// ---------------------------------------------------------------------------

const mbox = jt.instantiate(MboxSchema.$id, 'alice@example.org') as Mbox;

console.log('\n--- Branded Mbox ---');
console.log('Mbox:', mbox);

// ---------------------------------------------------------------------------
// Transform roundtrip — parse yields Date, encode yields string
// ---------------------------------------------------------------------------

const date = jt.instantiate(DateTimeSchema.$id, '2026-03-15T12:00:00.000Z') as unknown;
const wire = jt.encode(DateTimeSchema, date);

console.log('\n--- Transform roundtrip ---');
if (date instanceof Date) {
  console.log('Parsed type:', date.constructor.name, '→', date.toISOString());
} else {
  console.log('Parsed type:', typeof date);
}
console.log('Encoded back:', wire);

// ---------------------------------------------------------------------------
// Composed schemas
// ---------------------------------------------------------------------------

const personName = jt.instantiate(PersonName.$id, {
  'familyName': 'Jones',
  'givenName': 'Bob'
});
const patch = jt.instantiate(PatchPerson.$id, { 'givenName': 'Robert' });

console.log('\n--- Composed schemas ---');
console.log('PersonName:', personName);
console.log('PatchPerson:', patch);

// ---------------------------------------------------------------------------
// Value operations
// ---------------------------------------------------------------------------

const hash = Value.hash(alice);
const diff = Value.diff(alice, {
  ...alice,
  'familyName': 'Smith-Jones'
});

console.log('\n--- Value operations ---');
console.log('Hash:', hash);
console.log('Diff ops:', diff.length, '— isEmpty:', diff.isEmpty);

// ---------------------------------------------------------------------------
// Constraint brands — compile-time narrowing from schema constraints
// ---------------------------------------------------------------------------

// Person.mbox has format: 'email' — inferred type carries a FormatBrand.
// Person.age has minimum: 0 — inferred type carries a MinimumBrand.
// These brands prevent accidental assignment of plain strings/numbers.

const RatingSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/Rating',
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;

// InferType infers the literal union 1 | 2 | 3 | 4 | 5 directly from bounds
type Rating = InferType<typeof RatingSchema>;

// EnumValuesType extracts enum members as a union
const StatusSchema = {
  'enum': [
    'active',
    'inactive',
    'pending'
  ]
} as const;

type Status = EnumValuesType<typeof StatusSchema>;
jt.register(StatusSchema);
// 'active' | 'inactive' | 'pending'

// LooseInputType strips brands to base primitives (for pre-validation input)
type LooseMbox = LooseInputType<Mbox>;
// string (brands removed — accepts any string before validation)

console.log('\n--- Constraint brands ---');
console.log('Rating type: literal union 1|2|3|4|5 (inferred from schema bounds)');
console.log('Status type: literal union from enum');
console.log('LooseMbox type: string (brands stripped)');

// Register and validate with integer range
const jt2 = jt.register(RatingSchema);
const rating = jt2.instantiate(RatingSchema.$id, 3);

console.log('Validated rating:', rating);

// Type assertions — these are compile-time only, no runtime effect
const _r: Rating = 3;
const _s: Status = 'active';
const _l: LooseMbox = 'any-string-before-validation';

void _r;
void _s;
void _l;
