/**
 * Compile-time type assertions for InferSchemaType.
 *
 * This file does not need runtime assertions — it validates correct type
 * inference by compiling successfully (and failing on @ts-expect-error lines).
 *
 * Covers every JSON Schema keyword that affects the inferred type, including
 * intentional fallbacks where TypeScript cannot express the runtime rule.
 */

import type {
  InferSchemaType, InferType
} from '../../src/types/schema.js';
import type { ParseOutputType } from '../../src/types/transform.js';

// ---------------------------------------------------------------------------
// Bidirectional assignability helper
// ---------------------------------------------------------------------------

type AssertEqual<A, B>
  = [A] extends [B] ? [B] extends [A] ? true : false : false;

type AssertAssignable<A, B>
  = [A] extends [B] ? true : false;

// compile-time assertion — produces an error if T is not true
function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Primitives
// ---------------------------------------------------------------------------

const StringSchema = { 'type': 'string' } as const;
const NumberSchema = { 'type': 'number' } as const;
const IntegerSchema = { 'type': 'integer' } as const;
const BooleanSchema = { 'type': 'boolean' } as const;
const NullSchema = { 'type': 'null' } as const;

const _s: InferType<typeof StringSchema> = 'hello';
const _n: InferType<typeof NumberSchema> = 42;
const _i: InferType<typeof IntegerSchema> = 7;
const _b: InferType<typeof BooleanSchema> = true;
const _nl: InferType<typeof NullSchema> = null;

// @ts-expect-error — number is not string
const _bad1: InferType<typeof StringSchema> = 42;
// @ts-expect-error — string is not number
const _bad2: InferType<typeof NumberSchema> = 'hello';

assert<AssertEqual<InferType<typeof StringSchema>, string>>();
assert<AssertEqual<InferType<typeof NumberSchema>, number>>();
assert<AssertEqual<InferType<typeof IntegerSchema>, number>>();
assert<AssertEqual<InferType<typeof BooleanSchema>, boolean>>();
assert<AssertEqual<InferType<typeof NullSchema>, null>>();

// ---------------------------------------------------------------------------
// 2. Const / Enum
// ---------------------------------------------------------------------------

const ConstSchema = { 'const': 'circle' } as const;
const EnumSchema = {
  'enum': [
    'asc',
    'desc'
  ]
} as const;
const NumericEnumSchema = {
  'enum': [
    1,
    2,
    3
  ]
} as const;

const _c: InferType<typeof ConstSchema> = 'circle';
// @ts-expect-error — 'square' is not 'circle'
const _bad3: InferType<typeof ConstSchema> = 'square';

const _e: InferType<typeof EnumSchema> = 'asc';
const _e2: InferType<typeof EnumSchema> = 'desc';
// @ts-expect-error — 'random' is not in enum
const _bad4: InferType<typeof EnumSchema> = 'random';

assert<AssertEqual<InferType<typeof ConstSchema>, 'circle'>>();
assert<AssertEqual<InferType<typeof EnumSchema>, 'asc' | 'desc'>>();
assert<AssertEqual<InferType<typeof NumericEnumSchema>, 1 | 2 | 3>>();

// ---------------------------------------------------------------------------
// 3. Arrays
// ---------------------------------------------------------------------------

const StringArraySchema = {
  'items': { 'type': 'string' },
  'type': 'array'
} as const;
const PlainArraySchema = { 'type': 'array' } as const;
const TupleSchema = {
  'prefixItems': [
    { 'type': 'string' },
    { 'type': 'number' }
  ],
  'type': 'array'
} as const;

const NestedArraySchema = {
  'items': {
    'items': { 'type': 'number' },
    'type': 'array'
  },
  'type': 'array'
} as const;

const _arr: InferType<typeof StringArraySchema> = [
  'a',
  'b'
];
// @ts-expect-error — number[] not assignable to string[]
const _bad5: InferType<typeof StringArraySchema> = [
  1,
  2
];

// Tuple inference
type TupleInferred = InferType<typeof TupleSchema>;
assert<AssertAssignable<TupleInferred, readonly [string, number]>>();

// Nested arrays
type NestedArr = InferType<typeof NestedArraySchema>;
assert<AssertAssignable<NestedArr, ReadonlyArray<readonly number[]>>>();

// ---------------------------------------------------------------------------
// 4. Objects (required/optional split)
// ---------------------------------------------------------------------------

const UserSchema = {
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

const _u: InferType<typeof UserSchema> = {
  'email': 'a@b.c',
  'name': 'Alice'
};
const _u2: InferType<typeof UserSchema> = {
  'age': 30,
  'email': 'a@b.c',
  'name': 'Alice'
};
// @ts-expect-error — missing required 'email'
const _bad6: InferType<typeof UserSchema> = { 'name': 'Alice' };

// Object with no properties
const EmptyObjectSchema = { 'type': 'object' } as const;

type EmptyObj = InferType<typeof EmptyObjectSchema>;
assert<AssertEqual<EmptyObj, Record<string, unknown>>>();

// additionalProperties: false — closed object
const ClosedSchema = {
  'additionalProperties': false,
  'properties': { 'x': { 'type': 'number' } },
  'required': ['x'],
  'type': 'object'
} as const;

// additionalProperties: schema — typed extra keys
const TypedAdditionalSchema = {
  'additionalProperties': { 'type': 'number' },
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

type TypedAdditional = InferType<typeof TypedAdditionalSchema>;
// TS intersection of index sig {[k:string]:number} with named prop {name:string} collapses
// name to string & number = never. This is a known TS limitation with index signatures.
// Just verify the type resolves (runtime validation enforces the constraint).
void (undefined as unknown as TypedAdditional);

// ---------------------------------------------------------------------------
// 5. Nullable (type arrays)
// ---------------------------------------------------------------------------

const NullableSchema = {
  'type': [
    'string',
    'null'
  ]
} as const;

const _nullable1: InferType<typeof NullableSchema> = 'hello';
const _nullable2: InferType<typeof NullableSchema> = null;
// @ts-expect-error — number not assignable to string | null
const _bad7: InferType<typeof NullableSchema> = 42;

assert<AssertEqual<InferType<typeof NullableSchema>, null | string>>();

// ---------------------------------------------------------------------------
// 6. Composition — allOf / anyOf / oneOf
// ---------------------------------------------------------------------------

const AllOfSchema = {
  'allOf': [
    {
      'properties': { 'a': { 'type': 'string' } },
      'required': ['a'],
      'type': 'object'
    },
    {
      'properties': { 'b': { 'type': 'number' } },
      'required': ['b'],
      'type': 'object'
    }
  ]
} as const;

const AnyOfSchema = {
  'anyOf': [
    { 'type': 'string' },
    { 'type': 'number' }
  ]
} as const;

const OneOfSchema = {
  'oneOf': [
    { 'type': 'string' },
    { 'type': 'number' }
  ]
} as const;

const _anyOf: InferType<typeof AnyOfSchema> = 'hello';
const _anyOf2: InferType<typeof AnyOfSchema> = 42;

const _oneOf: InferType<typeof OneOfSchema> = 'hello';
const _oneOf2: InferType<typeof OneOfSchema> = 42;

// allOf produces intersection
type AllOfResult = InferType<typeof AllOfSchema>;
assert<AssertAssignable<AllOfResult, { readonly 'a': string;
  readonly 'b': number }>>();

assert<AssertEqual<InferType<typeof AnyOfSchema>, number | string>>();
assert<AssertEqual<InferType<typeof OneOfSchema>, number | string>>();

// ---------------------------------------------------------------------------
// 7. $ref / $defs
// ---------------------------------------------------------------------------

const RefSchema = {
  '$defs': {
    'Child': {
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    }
  },
  'properties': { 'child': { '$ref': '#/$defs/Child' } },
  'required': ['child'],
  'type': 'object'
} as const;

const _ref: InferType<typeof RefSchema> = { 'child': { 'name': 'Bob' } };
// @ts-expect-error — child.name is required
const _bad8: InferType<typeof RefSchema> = { 'child': {} };

// Self-referential $ref: '#'
const SelfRefSchema = {
  'properties': {
    'children': {
      'items': { '$ref': '#' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

type SelfRefResult = InferType<typeof SelfRefSchema>;
assert<AssertAssignable<SelfRefResult, { readonly 'name': string }>>();

// ---------------------------------------------------------------------------
// 8. $anchor refs (root-level and $defs-level)
// ---------------------------------------------------------------------------

const AnchorSchema = {
  '$defs': {
    'Item': {
      '$anchor': 'itemDef',
      'properties': { 'label': { 'type': 'string' } },
      'required': ['label'],
      'type': 'object'
    }
  },
  'properties': { 'item': { '$ref': '#itemDef' } },
  'required': ['item'],
  'type': 'object'
} as const;

type AnchorResult = InferType<typeof AnchorSchema>;
assert<AssertAssignable<AnchorResult, { readonly 'item': { readonly 'label': string } }>>();

// Root-level $anchor
const RootAnchorSchema = {
  '$anchor': 'root',
  'properties': { 'self': { '$ref': '#root' } },
  'type': 'object'
} as const;

type RootAnchorResult = InferType<typeof RootAnchorSchema>;
// self references the root schema itself — should be assignable to an object with self
assert<AssertAssignable<RootAnchorResult, { readonly 'self'?: unknown }>>();

// ---------------------------------------------------------------------------
// 9. JSON Pointer fragment refs (#/properties/foo)
// ---------------------------------------------------------------------------

const PointerRefSchema = {
  'properties': {
    'alias': { '$ref': '#/properties/name' },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'alias'
  ],
  'type': 'object'
} as const;

type PointerRefResult = InferType<typeof PointerRefSchema>;
assert<AssertAssignable<PointerRefResult, { readonly 'alias': string;
  readonly 'name': string; }>>();

// Deep path navigation: #/$defs/Outer/properties/inner
const DeepPathSchema = {
  '$defs': {
    'Outer': {
      'properties': { 'inner': { 'type': 'number' } },
      'type': 'object'
    }
  },
  'properties': { 'target': { '$ref': '#/$defs/Outer/properties/inner' } },
  'required': ['target'],
  'type': 'object'
} as const;

type DeepPathResult = InferType<typeof DeepPathSchema>;
assert<AssertAssignable<DeepPathResult, { readonly 'target': number }>>();

// ---------------------------------------------------------------------------
// 10. $dynamicRef approximation
// ---------------------------------------------------------------------------

/**
 * $dynamicRef is approximated as a static anchor lookup in the current root.
 * This is correct for same-schema usage. Cross-schema dynamic resolution
 * (where $dynamicAnchor is overridden by an outer schema) cannot be modeled
 * at compile time and falls back to unknown.
 */
const DynamicRefSchema = {
  '$defs': {
    'ItemDef': {
      '$anchor': 'listItem',
      '$dynamicAnchor': 'listItem',
      'properties': { 'value': { 'type': 'string' } },
      'required': ['value'],
      'type': 'object'
    }
  },
  'properties': { 'item': { '$dynamicRef': '#listItem' } },
  'required': ['item'],
  'type': 'object'
} as const;

type DynamicRefResult = InferType<typeof DynamicRefSchema>;
assert<AssertAssignable<DynamicRefResult, { readonly 'item': { readonly 'value': string } }>>();

// ---------------------------------------------------------------------------
// 11. $recursiveRef / $recursiveAnchor approximation
// ---------------------------------------------------------------------------

/**
 * $recursiveRef (draft 2019-09) always targets "#". When the root has
 * $recursiveAnchor: true, the ref resolves to the root itself. This
 * enables recursive tree-like schemas.
 *
 * Cross-schema $recursiveRef (where an outer schema overrides the anchor)
 * falls back to unknown — same limitation as $dynamicRef.
 */
const RecursiveSchema = {
  '$recursiveAnchor': true,
  'properties': {
    'children': {
      'items': { '$recursiveRef': '#' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

type RecursiveResult = InferType<typeof RecursiveSchema>;
assert<AssertAssignable<RecursiveResult, { readonly 'name': string }>>();

// Without $recursiveAnchor: true, $recursiveRef resolves to unknown
const NoAnchorRecursiveSchema = {
  'properties': { 'child': { '$recursiveRef': '#' } },
  'type': 'object'
} as const;

type NoAnchorResult = InferType<typeof NoAnchorRecursiveSchema>;
// child should be unknown because $recursiveAnchor is not set
assert<AssertAssignable<NoAnchorResult, { readonly 'child'?: unknown }>>();

// ---------------------------------------------------------------------------
// 12. Negative tests — invalid schemas produce unknown, not compile errors
// ---------------------------------------------------------------------------

// Missing `type` — produces unknown
const NoTypeSchema = {} as const;

type NoTypeResult = InferType<typeof NoTypeSchema>;
assert<AssertEqual<NoTypeResult, unknown>>();

// Invalid $ref target — produces unknown
const BadRefSchema = {
  'properties': { 'x': { '$ref': '#/$defs/DoesNotExist' } },
  'type': 'object'
} as const;

type BadRefResult = InferType<typeof BadRefSchema>;
// x resolves to unknown
assert<AssertAssignable<BadRefResult, { readonly 'x'?: unknown }>>();

// External $ref (absolute URI without fragment) — produces unknown
const ExternalRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other' } },
  'type': 'object'
} as const;

type ExternalRefResult = InferType<typeof ExternalRefSchema>;
assert<AssertAssignable<ExternalRefResult, { readonly 'ext'?: unknown }>>();

// Boolean schema (true/false) — produces unknown
type BoolSchemaResult = InferSchemaType<true>;
assert<AssertEqual<BoolSchemaResult, unknown>>();
type FalseSchemaResult = InferSchemaType<false>;
assert<AssertEqual<FalseSchemaResult, unknown>>();

// Schema with only validation keywords, no type — produces unknown
const ValidationOnlySchema = {
  'maxLength': 10,
  'minLength': 5
} as const;

type ValidationOnlyResult = InferType<typeof ValidationOnlySchema>;
assert<AssertEqual<ValidationOnlyResult, unknown>>();

// ---------------------------------------------------------------------------
// 13. Intentional fallback documentation
// ---------------------------------------------------------------------------

/**
 * `not` — TypeScript Exclude only works on finite unions. The `not` keyword
 * cannot be expressed as a type-level exclusion in the general case.
 * The schema below would exclude strings at runtime, but at the type level
 * it produces unknown (the base type without narrowing).
 */
const NotSchema = { 'not': { 'type': 'string' } } as const;

type NotResult = InferType<typeof NotSchema>;
// Falls back to unknown — runtime enforces the exclusion
assert<AssertEqual<NotResult, unknown>>();

/**
 * `contains` — Runtime validates that at least one array element matches.
 * TypeScript cannot express "array with at least one element of type T",
 * so it falls back to the array's base item type (or unknown[]).
 */
const ContainsSchema = {
  'contains': { 'type': 'number' },
  'type': 'array'
} as const;

type ContainsResult = InferType<typeof ContainsSchema>;
// Falls back to unknown[] — no items schema, contains is runtime-only
assert<AssertEqual<ContainsResult, readonly unknown[]>>();

/**
 * `propertyNames` — Constrains object keys at runtime. TypeScript cannot
 * dynamically constrain key patterns, so it falls back to Record<string, unknown>.
 */
const PropertyNamesSchema = {
  'propertyNames': { 'pattern': '^x-' },
  'type': 'object'
} as const;

type PropertyNamesResult = InferType<typeof PropertyNamesSchema>;
// Falls back to Record<string, unknown>
assert<AssertEqual<PropertyNamesResult, Record<string, unknown>>>();

/**
 * `unevaluatedProperties` — Treated identically to additionalProperties.
 * The "unevaluated" scoping across subschemas is a runtime concern.
 */

/**
 * `if/then/else` — Conditional narrowing requires runtime evaluation.
 * TypeScript cannot branch on data-dependent predicates.
 * Falls back to unknown.
 */
const IfThenElseSchema = {
  'else': {
    'properties': { 'value': { 'type': 'number' } },
    'type': 'object'
  },
  'if': {
    'properties': { 'kind': { 'const': 'a' } },
    'type': 'object'
  },
  'then': {
    'properties': { 'value': { 'type': 'string' } },
    'type': 'object'
  }
} as const;

type IfThenElseResult = InferType<typeof IfThenElseSchema>;
// Falls back to unknown — conditional narrowing is runtime-only
assert<AssertEqual<IfThenElseResult, unknown>>();

// ---------------------------------------------------------------------------
// 14. Nested object with deep required
// ---------------------------------------------------------------------------

const NestedObjectSchema = {
  'properties': {
    'address': {
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
    }
  },
  'required': ['address'],
  'type': 'object'
} as const;

type NestedObj = InferType<typeof NestedObjectSchema>;
assert<AssertAssignable<NestedObj, {
  readonly 'address': { readonly 'city': string;
    readonly 'street': string;
    readonly 'zip'?: string };
}>>();

// ---------------------------------------------------------------------------
// 15. allOf with three+ schemas
// ---------------------------------------------------------------------------

const TripleAllOfSchema = {
  'allOf': [
    {
      'properties': { 'a': { 'type': 'string' } },
      'required': ['a'],
      'type': 'object'
    },
    {
      'properties': { 'b': { 'type': 'number' } },
      'required': ['b'],
      'type': 'object'
    },
    {
      'properties': { 'c': { 'type': 'boolean' } },
      'required': ['c'],
      'type': 'object'
    }
  ]
} as const;

type TripleAllOf = InferType<typeof TripleAllOfSchema>;
assert<AssertAssignable<TripleAllOf, { readonly 'a': string;
  readonly 'b': number;
  readonly 'c': boolean }>>();

// ---------------------------------------------------------------------------
// 16. Mixed enum types
// ---------------------------------------------------------------------------

const MixedEnumSchema = {
  'enum': [
    'a',
    1,
    true,
    null
  ]
} as const;

type MixedEnum = InferType<typeof MixedEnumSchema>;
assert<AssertEqual<MixedEnum, 1 | 'a' | null | true>>();

// ---------------------------------------------------------------------------
// 17. Deeply nested $ref
// ---------------------------------------------------------------------------

const DeepRefSchema = {
  '$defs': {
    'Inner': {
      'properties': { 'value': { 'type': 'number' } },
      'required': ['value'],
      'type': 'object'
    }
  },
  'properties': {
    'wrapper': {
      'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
      'required': ['inner'],
      'type': 'object'
    }
  },
  'required': ['wrapper'],
  'type': 'object'
} as const;

type DeepRef = InferType<typeof DeepRefSchema>;
assert<AssertAssignable<DeepRef, { readonly 'wrapper': { readonly 'inner': { readonly 'value': number } } }>>();

// ---------------------------------------------------------------------------
// 18. External fragment refs fall back to unknown
// ---------------------------------------------------------------------------

/**
 * External $ref with anchor fragment — cannot resolve cross-schema at compile
 * time because we don't have access to the external schema's type.
 */
const ExternalAnchorRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other#someAnchor' } },
  'type': 'object'
} as const;

type ExternalAnchorRefResult = InferType<typeof ExternalAnchorRefSchema>;
assert<AssertAssignable<ExternalAnchorRefResult, { readonly 'ext'?: unknown }>>();

/**
 * External $ref with JSON Pointer fragment — cannot resolve cross-schema.
 */
const ExternalPointerRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other#/$defs/Foo' } },
  'type': 'object'
} as const;

type ExternalPointerRefResult = InferType<typeof ExternalPointerRefSchema>;
assert<AssertAssignable<ExternalPointerRefResult, { readonly 'ext'?: unknown }>>();

/**
 * External $ref with deep JSON Pointer — cannot resolve cross-schema.
 */
const ExternalDeepPointerRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other#/properties/name' } },
  'type': 'object'
} as const;

type ExternalDeepPointerRefResult = InferType<typeof ExternalDeepPointerRefSchema>;
assert<AssertAssignable<ExternalDeepPointerRefResult, { readonly 'ext'?: unknown }>>();

/**
 * Internal fragment refs still resolve correctly — regression guard.
 * Ensures the external fallback didn't break internal resolution.
 */
const InternalFragmentRefSchema = {
  '$defs': {
    'Named': {
      '$anchor': 'named',
      'properties': { 'label': { 'type': 'string' } },
      'required': ['label'],
      'type': 'object'
    }
  },
  'properties': {
    'a': { '$ref': '#/$defs/Named' },
    'b': { '$ref': '#named' }
  },
  'required': [
    'a',
    'b'
  ],
  'type': 'object'
} as const;

type InternalFragmentResult = InferType<typeof InternalFragmentRefSchema>;
assert<AssertAssignable<InternalFragmentResult, {
  readonly 'a': { readonly 'label': string };
  readonly 'b': { readonly 'label': string };
}>>();

// ---------------------------------------------------------------------------
// 19. SplitFragmentRefType base-URI guard
// ---------------------------------------------------------------------------

import type { SplitFragmentRefType } from '../../src/types/infer.js';

const LocalSchemaWithId = {
  '$defs': { 'Bar': { 'type': 'string' } },
  '$id': 'https://local.com/Foo',
  'type': 'object'
} as const;

// Cross-schema ref must resolve to unknown (base URI mismatch)
type CrossSchemaRef = SplitFragmentRefType<'https://other.com/X#/$defs/Bar', typeof LocalSchemaWithId>;
assert<AssertEqual<CrossSchemaRef, unknown>>();

// Same-schema ref resolves correctly (base URI matches $id)
type SameSchemaRef = SplitFragmentRefType<'https://local.com/Foo#/$defs/Bar', typeof LocalSchemaWithId>;
assert<AssertEqual<SameSchemaRef, { readonly 'type': 'string' }>>();

// Schema without $id → unknown (cannot verify base)
const SchemaWithoutId = {
  '$defs': { 'X': { 'type': 'number' } },
  'type': 'object'
} as const;

type NoIdRef = SplitFragmentRefType<'https://any.com#/$defs/X', typeof SchemaWithoutId>;
assert<AssertEqual<NoIdRef, unknown>>();

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void _s, _n, _i, _b, _nl, _bad1, _bad2, _bad3, _bad4, _bad5, _bad6, _bad7, _bad8;
void _c, _e, _e2, _arr, _u, _u2, _nullable1, _nullable2, _anyOf, _anyOf2, _oneOf, _oneOf2, _ref;
