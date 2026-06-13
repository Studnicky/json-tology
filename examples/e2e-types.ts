/**
 * e2e-types.ts — Compile-time type system
 *
 * Demonstrates type inference, type-safe parse/is, branded IDs,
 * transforms, and schema composition — all from the FOAF domain.
 *
 * Run: npm run build && tsx examples/e2e-types.ts
 */

import {
  Compose, Hash, JsonTology, Transform, Value
} from '../src/index.js';
import type {
  EnumValuesType, InferType, UnbrandType
} from '../src/types/index.js';
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

jt.set(PersonName).set(PatchPerson);

// ---------------------------------------------------------------------------
// Type-safe parse — return type is Person, not unknown
// ---------------------------------------------------------------------------

const alice: Person = jt.instantiate(PersonSchema.$id, foafPersons[0]);

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
  const incomingPerson = incoming;
  const knowsLen = Array.isArray(incomingPerson.knows) ? incomingPerson.knows.length : 0;

  console.log('Valid person:', incomingPerson.givenName, incomingPerson.familyName, 'knows', knowsLen, 'person(s)');
}

// ---------------------------------------------------------------------------
// Branded types — Mbox is branded, not a plain string
// ---------------------------------------------------------------------------

// MboxSchema is not a top-level registry schema, so instantiate by passing the
// schema object (it auto-registers) rather than a schema-ID string.
const mbox = jt.instantiate(MboxSchema, 'alice@example.org');

console.log('\n--- Branded Mbox ---');
console.log('Mbox:', mbox);

// ---------------------------------------------------------------------------
// Transform roundtrip — decode normalizes to canonical ISO string, encode reverses
// ---------------------------------------------------------------------------

// Attach decode/encode so the schema is a TransformedType — decode normalizes the
// wire value to canonical ISO string form, encode yields the wire string.
// Registered via the schema object.
const DateTimeTransform = Transform.create(DateTimeSchema, {
  'decode': (isoString: string) => {
    // Normalize: parse and re-emit as canonical ISO string
    return new Date(isoString).toISOString();
  },
  'encode': (canonical: string) => {
    // Encode reversal: return canonical ISO string to wire
    return canonical;
  }
});

jt.set(DateTimeTransform);

const canonical = jt.instantiate(DateTimeTransform, '2026-03-15T12:00:00.000Z');
const wire = jt.encode(DateTimeTransform, canonical);

console.log('\n--- Transform roundtrip ---');
console.log('Parsed type:', typeof canonical);
console.log('Canonical:', canonical);
console.log('Encoded back:', wire);

// ---------------------------------------------------------------------------
// Composed schemas
// ---------------------------------------------------------------------------

// PersonName and PatchPerson are derived schemas registered at runtime, so
// they are not part of the registry's compile-time schema-ID union — pass the
// schema objects.
const personName = jt.instantiate(PersonName, {
  'familyName': 'Jones',
  'givenName': 'Bob'
});
const patch = jt.instantiate(PatchPerson, { 'givenName': 'Robert' });

console.log('\n--- Composed schemas ---');
console.log('PersonName:', personName);
console.log('PatchPerson:', patch);

// ---------------------------------------------------------------------------
// Value operations
// ---------------------------------------------------------------------------

const hash = Hash.value(alice);
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
  '$id': 'http://xmlns.com/foaf/0.1/Status',
  'enum': [
    'active',
    'inactive',
    'pending'
  ]
} as const;

type Status = EnumValuesType<typeof StatusSchema>;
jt.set(StatusSchema);
// 'active' | 'inactive' | 'pending'

console.log('\n--- Constraint brands ---');
console.log('Rating type: literal union 1|2|3|4|5 (inferred from schema bounds)');
console.log('Status type: literal union from enum');

// Register and validate with integer range
const jt2 = jt.set(RatingSchema);
const rating = jt2.instantiate(RatingSchema.$id, 3);

console.log('Validated rating:', rating);

// Type assertions — these are compile-time only, no runtime effect
const _r: Rating = 3;
const _s: Status = 'active';
// UnbrandType strips constraint brands to recover the wire value type
const _l: UnbrandType<Mbox> = 'any-string-before-validation';

void _r;
void _s;
void _l;
