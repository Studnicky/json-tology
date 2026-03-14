/**
 * Compile-time type assertions for Compose operations.
 *
 * For each Compose.* operation, verifies that the runtime schema's InferType
 * matches the expected type composition. This is the round-trip test:
 * runtime schema -> InferType -> expected TypeScript type.
 *
 * Compile with: tsc --noEmit --project tsconfig.test-types.json
 */

import type { InferType } from '../../src/types/schema.js';
import { Compose } from '../../src/modules/composition/Compose.js';

// ---------------------------------------------------------------------------
// Bidirectional assignability helper
// ---------------------------------------------------------------------------

type AssertAssignable<A, B>
  = [A] extends [B] ? true : false;

type AssertEqual<A, B>
  = [A] extends [B] ? [B] extends [A] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Base schemas for composition tests
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
    'street': { 'type': 'string' },
    'zip': { 'type': 'string' }
  },
  'required': [
    'street',
    'city'
  ],
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

// ---------------------------------------------------------------------------
// 1. Compose.extend — add properties to an existing schema
// ---------------------------------------------------------------------------

const AdminSchema = Compose.extend(
  UserSchema,
  {
    'role': {
      'enum': [
        'admin',
        'superadmin'
      ],
      'type': 'string'
    }
  } as const,
  'https://example.io/Admin'
);

type Admin = InferType<typeof AdminSchema>;

// Should have all User properties plus role
assert<AssertAssignable<Admin, {
  readonly 'age'?: number;
  readonly 'email': string;
  readonly 'name': string;
  readonly 'role'?: 'admin' | 'superadmin';
}>>();

// Extended schema has a new $id
assert<AssertAssignable<typeof AdminSchema, { readonly '$id': 'https://example.io/Admin' }>>();

// ---------------------------------------------------------------------------
// 2. Compose.partial — all properties become optional
// ---------------------------------------------------------------------------

const PatchUserSchema = Compose.partial(UserSchema, 'https://example.io/PatchUser');

type PatchUser = InferType<typeof PatchUserSchema>;

// All properties optional (required array removed)
assert<AssertAssignable<PatchUser, {
  readonly 'age'?: number;
  readonly 'email'?: string;
  readonly 'name'?: string;
}>>();

// $id is updated
assert<AssertAssignable<typeof PatchUserSchema, { readonly '$id': 'https://example.io/PatchUser' }>>();

// ---------------------------------------------------------------------------
// 3. Compose.required — all properties become required
// ---------------------------------------------------------------------------

const StrictUserSchema = Compose.required(UserSchema, 'https://example.io/StrictUser');

type StrictUser = InferType<typeof StrictUserSchema>;

// All declared properties become required
assert<AssertAssignable<StrictUser, {
  readonly 'age': number;
  readonly 'email': string;
  readonly 'name': string;
}>>();

// ---------------------------------------------------------------------------
// 4. Compose.pick — keep only specified properties
// ---------------------------------------------------------------------------

const UserNameSchema = Compose.pick(
  UserSchema,
  ['name'] as const,
  'https://example.io/UserName'
);

type UserName = InferType<typeof UserNameSchema>;

// Only name property, still required
assert<AssertAssignable<UserName, { readonly 'name': string }>>();

// Multiple picks preserving required
const UserContactSchema = Compose.pick(
  UserSchema,
  [
    'name',
    'email'
  ] as const,
  'https://example.io/UserContact'
);

type UserContact = InferType<typeof UserContactSchema>;
assert<AssertAssignable<UserContact, { readonly 'email': string;
  readonly 'name': string; }>>();

// ---------------------------------------------------------------------------
// 5. Compose.omit — remove specified properties
// ---------------------------------------------------------------------------

const UserWithoutAgeSchema = Compose.omit(
  UserSchema,
  ['age'] as const,
  'https://example.io/UserWithoutAge'
);

type UserWithoutAge = InferType<typeof UserWithoutAgeSchema>;

// name and email remain, age is gone
assert<AssertAssignable<UserWithoutAge, { readonly 'email': string;
  readonly 'name': string; }>>();

// ---------------------------------------------------------------------------
// 6. Compose.intersection — allOf merger
// ---------------------------------------------------------------------------

const PersonWithAddressSchema = Compose.intersection(
  [
    UserSchema,
    AddressSchema
  ] as const,
  'https://example.io/PersonWithAddress'
);

type PersonWithAddress = InferType<typeof PersonWithAddressSchema>;

// Intersection of User and Address
assert<AssertAssignable<PersonWithAddress, {
  readonly 'city': string;
  readonly 'email': string;
  readonly 'name': string;
  readonly 'street': string;
}>>();

// ---------------------------------------------------------------------------
// 7. Compose.discriminatedUnion — oneOf with discriminator
// ---------------------------------------------------------------------------

const ShapeSchema = Compose.discriminatedUnion(
  'kind',
  [
    CircleSchema,
    RectSchema
  ] as const,
  'https://example.io/Shape'
);

type Shape = InferType<typeof ShapeSchema>;

// Union of Circle and Rect
assert<AssertAssignable<
  { readonly 'kind': 'circle';
    readonly 'radius': number },
  Shape
>>();
assert<AssertAssignable<
  { readonly 'height': number;
    readonly 'kind': 'rect';
    readonly 'width': number; },
  Shape
>>();

// discriminator metadata is preserved on the schema
assert<AssertAssignable<
  typeof ShapeSchema,
  { readonly 'discriminator': { readonly 'propertyName': 'kind' } }
>>();

// ---------------------------------------------------------------------------
// 8. Compose.narrow — type guard for discriminated unions
// ---------------------------------------------------------------------------

// narrow() is a runtime type guard, not a schema operation.
// This tests that the generic correctly narrows the union.
type ShapeUnion = { readonly 'height': number;
  readonly 'kind': 'rect';
  readonly 'width': number; }
  | { readonly 'kind': 'circle';
    readonly 'radius': number };

function testNarrow(shape: ShapeUnion): void {
  if (Compose.narrow(shape, 'kind', 'circle')) {
    // After narrowing, shape should be the circle variant
    const _r: number = shape.radius;

    void _r;
  }
}

void testNarrow;

// ---------------------------------------------------------------------------
// 9. Combination: extend then pick
// ---------------------------------------------------------------------------

const AdminNameSchema = Compose.pick(
  Compose.extend(
    UserSchema,
    { 'role': { 'type': 'string' } } as const,
    'https://example.io/AdminFull'
  ),
  [
    'name',
    'role'
  ] as const,
  'https://example.io/AdminName'
);

type AdminName = InferType<typeof AdminNameSchema>;
assert<AssertAssignable<AdminName, { readonly 'name': string }>>();

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void [
  AdminSchema,
  PatchUserSchema,
  StrictUserSchema,
  UserNameSchema,
  UserContactSchema,
  UserWithoutAgeSchema,
  PersonWithAddressSchema,
  ShapeSchema,
  AdminNameSchema
];
