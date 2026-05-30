/**
 * Compile-time tests for `ValidateSchemaType` and the type-error brands.
 *
 * Cluster B (Findings 7, 8, 9) from
 * `designs/0002-total-compile-time-enforcement.md`.
 *
 * Each finding has a positive case (valid schema passes through) and a
 * negative case (invalid schema surfaces a structured error brand). The
 * `@ts-expect-error` markers on the negative cases prove the constraint
 * fires; their absence on the positive cases proves we did not break
 * correct hand-written schemas.
 */

import { Compose } from '../../src/modules/composition/Compose.js';
import type {
  SchemaValidationErrorsType,
  ValidateSchemaType
} from '../../src/types/SchemaValidation.js';
import type {
  DependentRequiredKeyNotInPropertiesInterface,
  IfDiscriminatorNotInPropertiesInterface,
  RequiredKeyNotInPropertiesInterface
} from '../../src/types/TypeErrors.js';

// ---------------------------------------------------------------------------
// Helper assertion utilities
// ---------------------------------------------------------------------------

type AssertExtendsType<TActual, TExpected>
  = [TActual] extends [TExpected] ? true : false;

function assertType<T extends true>(): void {
  void 0 as unknown as T;
}

// ===========================================================================
// Finding 7 — required entries must be keys of properties
// ===========================================================================

// Positive case: every required entry is a known property — passes through
const _GoodRequiredSchema = {
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'age'
  ],
  'type': 'object'
} as const;

void _GoodRequiredSchema;

type GoodRequiredErrors = SchemaValidationErrorsType<typeof _GoodRequiredSchema>;
assertType<AssertExtendsType<GoodRequiredErrors, never>>();

// ValidateSchemaType passes the schema through unchanged when sound
const _validatedGood: ValidateSchemaType<typeof _GoodRequiredSchema> = _GoodRequiredSchema;

void _validatedGood;

// Negative case: a typo'd required entry surfaces RequiredKeyNotInProperties brand
const _BadRequiredSchema = {
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['nme'],
  'type': 'object'
} as const;

void _BadRequiredSchema;

type BadRequiredErrors = SchemaValidationErrorsType<typeof _BadRequiredSchema>;

assertType<AssertExtendsType<
  BadRequiredErrors,
  RequiredKeyNotInPropertiesInterface<'nme', 'age' | 'name'>
>>();

// The validator's IDE hover surfaces the brand:
type BadRequiredHasBrand = BadRequiredErrors extends RequiredKeyNotInPropertiesInterface<'nme', infer TActual>
  ? TActual extends ('age' | 'name') ? true : false
  : false;
assertType<AssertExtendsType<BadRequiredHasBrand, true>>();

// ===========================================================================
// Finding 8 — dependentRequired keys + value entries must be in properties
// ===========================================================================

// Positive case: both the map key and every dep entry resolve
const _GoodDepReqSchema = {
  'dependentRequired': { 'creditCard': ['billingAddress'] },
  'properties': {
    'billingAddress': { 'type': 'string' },
    'creditCard': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

void _GoodDepReqSchema;

type GoodDepReqErrors = SchemaValidationErrorsType<typeof _GoodDepReqSchema>;
assertType<AssertExtendsType<GoodDepReqErrors, never>>();

// Negative case A: bad map key
const _BadDepReqKeySchema = {
  'dependentRequired': { 'wrongKey': ['name'] },
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void _BadDepReqKeySchema;

type BadDepReqKeyErrors = SchemaValidationErrorsType<typeof _BadDepReqKeySchema>;
assertType<AssertExtendsType<
  BadDepReqKeyErrors,
  DependentRequiredKeyNotInPropertiesInterface<'wrongKey'>
>>();

// Negative case B: bad value-array entry
const _BadDepReqDepSchema = {
  'dependentRequired': { 'creditCard': ['nope'] },
  'properties': {
    'creditCard': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

void _BadDepReqDepSchema;

type BadDepReqDepErrors = SchemaValidationErrorsType<typeof _BadDepReqDepSchema>;
assertType<AssertExtendsType<
  BadDepReqDepErrors,
  DependentRequiredKeyNotInPropertiesInterface<'nope'>
>>();

// ===========================================================================
// Finding 9 — if.properties keys must be in parent properties
// ===========================================================================

// Positive case: the discriminator property exists on parent
const _GoodIfSchema = {
  'if': { 'properties': { 'kind': { 'const': 'circle' } } },
  'properties': {
    'kind': { 'type': 'string' },
    'radius': { 'type': 'number' }
  },
  'type': 'object'
} as const;

void _GoodIfSchema;

type GoodIfErrors = SchemaValidationErrorsType<typeof _GoodIfSchema>;
assertType<AssertExtendsType<GoodIfErrors, never>>();

// Negative case: the if.properties key is not on parent properties
const _BadIfSchema = {
  'if': { 'properties': { 'mistype': { 'const': 'X' } } },
  'properties': { 'kind': { 'type': 'string' } },
  'type': 'object'
} as const;

void _BadIfSchema;

type BadIfErrors = SchemaValidationErrorsType<typeof _BadIfSchema>;
assertType<AssertExtendsType<
  BadIfErrors,
  IfDiscriminatorNotInPropertiesInterface<'mistype'>
>>();

// ===========================================================================
// Compose builder integration — Compose-built schemas are correct by
// construction. A bad body literal at the call site is a type error.
// ===========================================================================

const ParentSchema = {
  '$id': 'https://example.io/Parent',
  'properties': { 'id': { 'type': 'string' } },
  'type': 'object'
} as const;

// Positive: Compose.subClassOf accepts a sound body
const _GoodSubClass = Compose.subClassOf(ParentSchema, {
  '$id': 'https://example.io/GoodChild',
  'properties': {
    'kind': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const);

void _GoodSubClass;

if (false as boolean) {
  // @ts-expect-error — required: ['nope'] is not a key of properties on the body
  Compose.subClassOf(ParentSchema, {
    '$id': 'https://example.io/BadChild',
    'properties': { 'name': { 'type': 'string' } },
    'required': ['nope'],
    'type': 'object'
  } as const);
}

// Compose.complementOf rejects bad required entries on the body
const OtherSchema = {
  '$id': 'https://example.io/Other',
  'type': 'object'
} as const;

const _GoodComplement = Compose.complementOf(OtherSchema, {
  '$id': 'https://example.io/GoodComplement',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const);

void _GoodComplement;

if (false as boolean) {
  // @ts-expect-error — required: ['typo'] not a property
  Compose.complementOf(OtherSchema, {
    '$id': 'https://example.io/BadComplement',
    'properties': { 'name': { 'type': 'string' } },
    'required': ['typo'],
    'type': 'object'
  } as const);
}

// Compose.disjointWith rejects bad if.properties discriminators on the body
const _GoodDisjoint = Compose.disjointWith(OtherSchema, {
  '$id': 'https://example.io/GoodDisjoint',
  'if': { 'properties': { 'kind': { 'const': 'X' } } },
  'properties': {
    'kind': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const);

void _GoodDisjoint;

if (false as boolean) {
  // @ts-expect-error — if.properties key 'wrong' is not a parent property
  Compose.disjointWith(OtherSchema, {
    '$id': 'https://example.io/BadDisjoint',
    'if': { 'properties': { 'wrong': { 'const': 'X' } } },
    'properties': { 'kind': { 'type': 'string' } },
    'type': 'object'
  } as const);
}

// Compose.extend rejects a body whose dependentRequired references a missing key
const _GoodExtend = Compose.extend(
  ParentSchema,
  {
    'dependentRequired': { 'creditCard': ['billingAddress'] },
    'properties': {
      'billingAddress': { 'type': 'string' },
      'creditCard': { 'type': 'string' }
    }
  } as const,
  'https://example.io/GoodExtend'
);

void _GoodExtend;

if (false as boolean) {
  Compose.extend(
    ParentSchema,
    // @ts-expect-error — dependentRequired key 'unknownKey' is not in properties
    {
      'dependentRequired': { 'unknownKey': ['something'] },
      'properties': { 'something': { 'type': 'string' } }
    } as const,
    'https://example.io/BadExtend'
  );
}

// ===========================================================================
// Author opt-in usage — `ValidateSchemaType<T>` as a self-check on
// hand-written schemas
// ===========================================================================

// Sound schema flows through ValidateSchemaType unchanged
const HandWrittenGoodSchema = {
  '$id': 'https://example.io/HandWrittenGood',
  'properties': {
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'email'
  ],
  'type': 'object'
} as const;

const _validatedAuthorSchema: ValidateSchemaType<typeof HandWrittenGoodSchema>
  = HandWrittenGoodSchema;

void _validatedAuthorSchema;
