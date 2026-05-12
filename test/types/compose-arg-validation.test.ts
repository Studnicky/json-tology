/**
 * Compile-time argument validation for `Compose.*` builders.
 *
 * Cluster A (Findings 1-6) of `designs/0002-total-compile-time-enforcement.md`.
 * Each section asserts both the positive case (valid call still compiles) and
 * the negative case (invalid call surfaces a type error via `@ts-expect-error`).
 *
 * Compile with: tsc --noEmit --project tsconfig.test-types.json
 */

import { Compose } from '../../src/modules/composition/Compose.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const UserSchema = {
  '$id': 'https://example.io/User',
  'properties': {
    'age': { 'type': 'number' },
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'email'
  ],
  'type': 'object'
} as const;

const AddressSchema = {
  '$id': 'https://example.io/Address',
  'properties': {
    'city': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': ['street'],
  'type': 'object'
} as const;

const CircleSchema = {
  '$id': 'https://example.io/Circle',
  'properties': {
    'kind': { 'const': 'circle' },
    'radius': { 'type': 'number' }
  },
  'required': [
    'kind',
    'radius'
  ],
  'type': 'object'
} as const;

const RectSchema = {
  '$id': 'https://example.io/Rect',
  'properties': {
    'height': { 'type': 'number' },
    'kind': { 'const': 'rect' },
    'width': { 'type': 'number' }
  },
  'required': [
    'kind',
    'width',
    'height'
  ],
  'type': 'object'
} as const;

// Variant missing the discriminator entirely.
const TriangleNoKindSchema = {
  '$id': 'https://example.io/Triangle',
  'properties': { 'sides': { 'type': 'number' } },
  'required': ['sides'],
  'type': 'object'
} as const;

// Variant where the discriminator key exists but is not a const.
const SquareNonConstKindSchema = {
  '$id': 'https://example.io/Square',
  'properties': {
    'kind': { 'type': 'string' },
    'side': { 'type': 'number' }
  },
  'required': [
    'kind',
    'side'
  ],
  'type': 'object'
} as const;

// Variant declaring const kind but not listing it in required.
const PentagonOptionalKindSchema = {
  '$id': 'https://example.io/Pentagon',
  'properties': {
    'edges': { 'type': 'number' },
    'kind': { 'const': 'pentagon' }
  },
  'required': ['edges'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Finding 1 — Compose.pick keys must be keys of properties
// ---------------------------------------------------------------------------

// Positive: a real key compiles
const _PickGood = Compose.pick(UserSchema, ['name'] as const, 'https://example.io/UserName');

void _PickGood;

// Negative: a key not in `properties` is rejected
if (false as boolean) {
  Compose.pick(
    UserSchema,
    // @ts-expect-error — 'nope' is not in keyof UserSchema['properties']
    ['nope'] as const,
    'https://example.io/UserBad'
  );
}

// Mixed good + bad still rejects
if (false as boolean) {
  Compose.pick(
    UserSchema,
    [
      'name',
      // @ts-expect-error — 'foo' is not a key (mixed-with-good still rejects)
      'foo'
    ] as const,
    'https://example.io/UserMixed'
  );
}

// ---------------------------------------------------------------------------
// Finding 2 — Compose.omit keys must be keys of properties
// ---------------------------------------------------------------------------

// Positive: omitting a real key compiles
const _OmitGood = Compose.omit(UserSchema, ['age'] as const, 'https://example.io/UserNoAge');

void _OmitGood;

// Negative
if (false as boolean) {
  Compose.omit(
    UserSchema,
    // @ts-expect-error — 'phone' is not a property of UserSchema
    ['phone'] as const,
    'https://example.io/UserNoPhone'
  );
}

// ---------------------------------------------------------------------------
// Finding 3 — Compose.subClassOf body $id must differ from parent $id
// ---------------------------------------------------------------------------

// Positive: distinct $ids compile
const _SubGood = Compose.subClassOf(UserSchema, {
  '$id': 'https://example.io/Admin',
  'type': 'object'
} as const);

void _SubGood;

// Positive: array parent with distinct body $id
const _SubMultiGood = Compose.subClassOf(
  [
    UserSchema,
    AddressSchema
  ] as const,
  {
    '$id': 'https://example.io/UserWithAddress',
    'type': 'object'
  } as const
);

void _SubMultiGood;

// Negative: body $id collides with single parent's $id
if (false as boolean) {
  // @ts-expect-error — body.$id matches parent.$id (self-subclass)
  Compose.subClassOf(UserSchema, {
    '$id': 'https://example.io/User',
    'type': 'object'
  } as const);
}

// Negative: body $id collides with one of an array of parents' $ids
if (false as boolean) {
  // @ts-expect-error — body.$id collides with AddressSchema.$id in the parent tuple
  Compose.subClassOf([
    UserSchema,
    AddressSchema
  ] as const, {
    '$id': 'https://example.io/Address',
    'type': 'object'
  } as const);
}

// ---------------------------------------------------------------------------
// Finding 4 — Compose.discriminatedUnion variants must declare const + required discriminator
// ---------------------------------------------------------------------------

// Positive: every variant has a `const kind` declared in required
const _UnionGood = Compose.discriminatedUnion(
  'kind',
  [
    CircleSchema,
    RectSchema
  ] as const,
  'https://example.io/Shape'
);

void _UnionGood;

// Negative: variant lacks the discriminator property entirely
if (false as boolean) {
  Compose.discriminatedUnion('kind', [
    CircleSchema,
    // @ts-expect-error — TriangleNoKindSchema has no 'kind' property
    TriangleNoKindSchema
  ] as const, 'https://example.io/BadShape1');
}

// Negative: discriminator exists but is not a const
if (false as boolean) {
  Compose.discriminatedUnion('kind', [
    CircleSchema,
    // @ts-expect-error — SquareNonConstKindSchema's 'kind' is type:string, not const
    SquareNonConstKindSchema
  ] as const, 'https://example.io/BadShape2');
}

// Negative: const declared but discriminator missing from required
if (false as boolean) {
  Compose.discriminatedUnion('kind', [
    CircleSchema,
    // @ts-expect-error — PentagonOptionalKindSchema does not list 'kind' in required
    PentagonOptionalKindSchema
  ] as const, 'https://example.io/BadShape3');
}

// ---------------------------------------------------------------------------
// Finding 5 — Compose.equivalent options.$id must differ from source.$id
// ---------------------------------------------------------------------------

// Positive: distinct $id compiles
const _EquivGood = Compose.equivalent(UserSchema, {
  '$id': 'https://example.io/PrimaryUser',
  'description': 'Primary user record alias.'
} as const);

void _EquivGood;

// Negative: identical $id is rejected
if (false as boolean) {
  Compose.equivalent(UserSchema, {
    // @ts-expect-error — options.$id matches source.$id (self-equivalent)
    '$id': 'https://example.io/User',
    'description': 'noop alias'
  } as const);
}

// ---------------------------------------------------------------------------
// Finding 6 — Compose.intersection newId must not collide with input $ids
// ---------------------------------------------------------------------------

// Positive: a fresh $id compiles
const _InterGood = Compose.intersection(
  [
    UserSchema,
    AddressSchema
  ] as const,
  'https://example.io/UserWithAddress'
);

void _InterGood;

// Negative: newId reuses an input schema's $id
if (false as boolean) {
  Compose.intersection(
    [
      UserSchema,
      AddressSchema
    ] as const,
    // @ts-expect-error — newId collides with UserSchema.$id
    'https://example.io/User'
  );
}

if (false as boolean) {
  Compose.intersection(
    [
      UserSchema,
      AddressSchema
    ] as const,
    // @ts-expect-error — newId collides with AddressSchema.$id
    'https://example.io/Address'
  );
}

// ---------------------------------------------------------------------------
// Suppress unused declarations
// ---------------------------------------------------------------------------

void [
  UserSchema,
  AddressSchema,
  CircleSchema,
  RectSchema,
  TriangleNoKindSchema,
  SquareNonConstKindSchema,
  PentagonOptionalKindSchema
];
