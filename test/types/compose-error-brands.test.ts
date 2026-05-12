/**
 * Compile-time identity assertions for Compose error brands.
 *
 * For each named error brand returned by Compose builders, verifies that:
 * 1. The brand is never-based (constraint brands are intersected with never).
 * 2. A call that triggers the error condition is rejected at compile time.
 * 3. A call that does NOT trigger the error condition compiles.
 *
 * All scenarios are compile-time only — no runtime assertions.
 */

import {
  describe, it
} from 'node:test';

import { Compose } from '../../src/modules/composition/Compose.js';
import type {
  DiscriminatorMissingType,
  IntersectionIdCollisionType,
  SelfEquivalentType,
  SelfSubClassType
} from '../../src/types/TypeErrors.js';

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ParentSchema = {
  '$id': 'https://example.io/Parent',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const SiblingSchema = {
  '$id': 'https://example.io/Sibling',
  'properties': { 'age': { 'type': 'number' } },
  'type': 'object'
} as const;

const WithKindConstSchema = {
  '$id': 'https://example.io/WithKind',
  'properties': { 'kind': { 'const': 'widget' } },
  'required': ['kind'],
  'type': 'object'
} as const;

const MissingKindSchema = {
  '$id': 'https://example.io/NoKind',
  'properties': { 'value': { 'type': 'number' } },
  'required': ['value'],
  'type': 'object'
} as const;

const NonConstKindSchema = {
  '$id': 'https://example.io/NonConstKind',
  'properties': { 'kind': { 'type': 'string' } },
  'required': ['kind'],
  'type': 'object'
} as const;

const OptionalKindSchema = {
  '$id': 'https://example.io/OptionalKind',
  'properties': { 'kind': { 'const': 'gadget' } },
  'required': [],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Brand A1: SelfSubClassType — body.$id collides with parent.$id
//
// SelfSubClassType is never & TypeErrorBrand & { collidingId }.
// Being intersected with never makes it never (bottom type).
// ---------------------------------------------------------------------------

// Brand is never-based: [SelfSubClassType<'x'>] extends [never] is true
assert<[SelfSubClassType<'x'>] extends [never] ? true : false>();

// Positive: distinct $id compiles
const _SubGood = Compose.subClassOf(ParentSchema, {
  '$id': 'https://example.io/Child',
  'type': 'object'
} as const);

void _SubGood;

// Negative: body.$id matches parent.$id
if (false as boolean) {
  // @ts-expect-error — body.$id collides with parent.$id (SelfSubClassType brand)
  Compose.subClassOf(ParentSchema, {
    '$id': 'https://example.io/Parent',
    'type': 'object'
  } as const);
}

// Negative: body.$id collides with one parent in an array tuple
if (false as boolean) {
  // @ts-expect-error — body.$id collides with SiblingSchema.$id in the parent tuple
  Compose.subClassOf([
    ParentSchema,
    SiblingSchema
  ] as const, {
    '$id': 'https://example.io/Sibling',
    'type': 'object'
  } as const);
}

// ---------------------------------------------------------------------------
// Brand A2: SelfEquivalentType — options.$id collides with source.$id
//
// SelfEquivalentType is never & TypeErrorBrand & { collidingId }.
// ---------------------------------------------------------------------------

// Brand is never-based
assert<[SelfEquivalentType<'x'>] extends [never] ? true : false>();

// Positive: distinct $id compiles
const _EquivGood = Compose.equivalent(ParentSchema, {
  '$id': 'https://example.io/ParentAlias',
  'description': 'alias'
} as const);

void _EquivGood;

// Negative: options.$id matches source.$id
if (false as boolean) {
  Compose.equivalent(ParentSchema, {
    // @ts-expect-error — options.$id matches source.$id (SelfEquivalentType brand)
    '$id': 'https://example.io/Parent',
    'description': 'self-alias'
  } as const);
}

// ---------------------------------------------------------------------------
// Brand A3: IntersectionIdCollisionType — newId collides with input $ids
//
// IntersectionIdCollisionType is never & TypeErrorBrand & { collidingId }.
// ---------------------------------------------------------------------------

// Brand is never-based
assert<[IntersectionIdCollisionType<'x'>] extends [never] ? true : false>();

// Positive: fresh $id compiles
const _InterGood = Compose.intersection([
  ParentSchema,
  SiblingSchema
] as const, 'https://example.io/ParentAndSibling');

void _InterGood;

// Negative: newId collides with ParentSchema.$id
if (false as boolean) {
  Compose.intersection(
    [
      ParentSchema,
      SiblingSchema
    ] as const,
    // @ts-expect-error — newId collides with ParentSchema.$id (IntersectionIdCollisionType brand)
    'https://example.io/Parent'
  );
}

// Negative: newId collides with SiblingSchema.$id
if (false as boolean) {
  Compose.intersection(
    [
      ParentSchema,
      SiblingSchema
    ] as const,
    // @ts-expect-error — newId collides with SiblingSchema.$id (IntersectionIdCollisionType brand)
    'https://example.io/Sibling'
  );
}

// ---------------------------------------------------------------------------
// Brand A4: DiscriminatorMissingType — variant lacks const+required discriminator
//
// DiscriminatorMissingType is never & TypeErrorBrand & { discriminator, variant }.
// ---------------------------------------------------------------------------

// Brand is never-based
assert<[DiscriminatorMissingType<'kind', unknown>] extends [never] ? true : false>();

// Positive: variant with const + required discriminator compiles
const _UnionGood = Compose.discriminatedUnion(
  'kind',
  [WithKindConstSchema] as const,
  'https://example.io/KindUnion'
);

void _UnionGood;

// Negative: variant missing the discriminator property entirely
if (false as boolean) {
  Compose.discriminatedUnion('kind', [
    WithKindConstSchema,
    // @ts-expect-error — MissingKindSchema has no 'kind' property (DiscriminatorMissingType brand)
    MissingKindSchema
  ] as const, 'https://example.io/BadUnion1');
}

// Negative: discriminator property exists but is not a const
if (false as boolean) {
  Compose.discriminatedUnion('kind', [
    WithKindConstSchema,
    // @ts-expect-error — NonConstKindSchema's 'kind' is type:string, not const (DiscriminatorMissingType brand)
    NonConstKindSchema
  ] as const, 'https://example.io/BadUnion2');
}

// Negative: const declared but discriminator not in required
if (false as boolean) {
  Compose.discriminatedUnion('kind', [
    WithKindConstSchema,
    // @ts-expect-error — OptionalKindSchema does not list 'kind' in required (DiscriminatorMissingType brand)
    OptionalKindSchema
  ] as const, 'https://example.io/BadUnion3');
}

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void [
  ParentSchema,
  SiblingSchema,
  WithKindConstSchema,
  MissingKindSchema,
  NonConstKindSchema,
  OptionalKindSchema
];

void describe('compose error brands (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
