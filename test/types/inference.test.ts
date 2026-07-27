/**
 * Compile-time type assertions for InferSchemaType.
 *
 * This file does not need runtime assertions — it validates correct type
 * inference by compiling successfully (and failing on @ts-expect-error lines).
 *
 * Covers every JSON Schema keyword that affects the inferred type, including
 * intentional fallbacks where TypeScript cannot express the runtime rule.
 */

import type { ContainsBrandType } from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';
import type { InferSchemaType } from '../../src/types/Infer.js';
import type { ReferenceNotFoundType } from '../../src/types/TypeErrors.js';


// ---------------------------------------------------------------------------
// Bidirectional assignability helper
// ---------------------------------------------------------------------------

type AssertEqual<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

// compile-time assertion — produces an error if T is not true
function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Primitives
// ---------------------------------------------------------------------------

const _StringSchema = { 'type': 'string' } as const;

void _StringSchema;
const _NumberSchema = { 'type': 'number' } as const;

void _NumberSchema;
const _IntegerSchema = { 'type': 'integer' } as const;

void _IntegerSchema;
const _BooleanSchema = { 'type': 'boolean' } as const;

void _BooleanSchema;
const _NullSchema = { 'type': 'null' } as const;

void _NullSchema;

const _s: InferType<typeof _StringSchema> = 'hello';
const _n: InferType<typeof _NumberSchema> = 42;
const _i: InferType<typeof _IntegerSchema> = 7;
const _b: InferType<typeof _BooleanSchema> = true;
const _nl: InferType<typeof _NullSchema> = null;

// @ts-expect-error — number is not string
const _bad1: InferType<typeof _StringSchema> = 42;
// @ts-expect-error — string is not number
const _bad2: InferType<typeof _NumberSchema> = 'hello';

assert<AssertEqual<InferType<typeof _StringSchema>, string>>();
assert<AssertEqual<InferType<typeof _NumberSchema>, number>>();
assert<AssertEqual<InferType<typeof _IntegerSchema>, number>>();
assert<AssertEqual<InferType<typeof _BooleanSchema>, boolean>>();
assert<AssertEqual<InferType<typeof _NullSchema>, null>>();

// ---------------------------------------------------------------------------
// 2. Const / Enum
// ---------------------------------------------------------------------------

const _ConstSchema = { 'const': 'circle' } as const;

void _ConstSchema;
const _EnumSchema = {
  'enum': [
    'asc',
    'desc'
  ]
} as const;

void _EnumSchema;
const _NumericEnumSchema = {
  'enum': [
    1,
    2,
    3
  ]
} as const;

void _NumericEnumSchema;

const _c: InferType<typeof _ConstSchema> = 'circle';
// @ts-expect-error — 'square' is not 'circle'
const _bad3: InferType<typeof _ConstSchema> = 'square';

const _e: InferType<typeof _EnumSchema> = 'asc';
const _e2: InferType<typeof _EnumSchema> = 'desc';
// @ts-expect-error — 'random' is not in enum
const _bad4: InferType<typeof _EnumSchema> = 'random';

assert<AssertEqual<InferType<typeof _ConstSchema>, 'circle'>>();
assert<AssertEqual<InferType<typeof _EnumSchema>, 'asc' | 'desc'>>();
assert<AssertEqual<InferType<typeof _NumericEnumSchema>, 1 | 2 | 3>>();

// ---------------------------------------------------------------------------
// 3. Arrays
// ---------------------------------------------------------------------------

const _StringArraySchema = {
  'items': { 'type': 'string' },
  'type': 'array'
} as const;

void _StringArraySchema;
const _PlainArraySchema = { 'type': 'array' } as const;

void _PlainArraySchema;

const _TupleSchema = {
  'prefixItems': [
    { 'type': 'string' },
    { 'type': 'number' }
  ],
  'type': 'array'
} as const;

void _TupleSchema;

const _NestedArraySchema = {
  'items': {
    'items': { 'type': 'number' },
    'type': 'array'
  },
  'type': 'array'
} as const;

void _NestedArraySchema;

const _arr: InferType<typeof _StringArraySchema> = [
  'a',
  'b'
];
const _bad5: InferType<typeof _StringArraySchema> = [
  // @ts-expect-error — number[] not assignable to string[]
  1,
  // @ts-expect-error — number[] not assignable to string[]
  2
];

// Tuple inference
type TupleInferred = InferType<typeof _TupleSchema>;
assert<AssertAssignable<TupleInferred, readonly [string, number]>>();

// Nested arrays
type NestedArr = InferType<typeof _NestedArraySchema>;
assert<AssertAssignable<NestedArr, ReadonlyArray<readonly number[]>>>();

// ---------------------------------------------------------------------------
// 4. Objects (required/optional split)
// ---------------------------------------------------------------------------

const _UserSchema = {
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

void _UserSchema;

const _u: InferType<typeof _UserSchema> = {
  'email': 'a@b.c',
  'name': 'Alice'
};
const _u2: InferType<typeof _UserSchema> = {
  'age': 30,
  'email': 'a@b.c',
  'name': 'Alice'
};
// @ts-expect-error — missing required 'email'
const _bad6: InferType<typeof _UserSchema> = { 'name': 'Alice' };

// Object with no properties
const _EmptyObjectSchema = { 'type': 'object' } as const;

void _EmptyObjectSchema;

type EmptyObj = InferType<typeof _EmptyObjectSchema>;
assert<AssertEqual<EmptyObj, Record<string, unknown>>>();

// additionalProperties: false — closed object
const _ClosedSchema = {
  'additionalProperties': false,
  'properties': { 'x': { 'type': 'number' } },
  'required': ['x'],
  'type': 'object'
} as const;

void _ClosedSchema;

// additionalProperties: schema — typed extra keys
const _TypedAdditionalSchema = {
  'additionalProperties': { 'type': 'number' },
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

void _TypedAdditionalSchema;

type TypedAdditional = InferType<typeof _TypedAdditionalSchema>;
// TS intersection of index sig {[k:string]:number} with named prop {name:string} collapses
// name to string & number = never. This is a known TS limitation with index signatures.
// Just verify the type resolves (runtime validation enforces the constraint).
void (undefined as unknown as TypedAdditional);

// ---------------------------------------------------------------------------
// 5. Nullable (type arrays)
// ---------------------------------------------------------------------------

const _NullableSchema = {
  'type': [
    'string',
    'null'
  ]
} as const;

void _NullableSchema;

const _nullable1: InferType<typeof _NullableSchema> = 'hello';
const _nullable2: InferType<typeof _NullableSchema> = null;
// @ts-expect-error — number not assignable to string | null
const _bad7: InferType<typeof _NullableSchema> = 42;

assert<AssertEqual<InferType<typeof _NullableSchema>, null | string>>();

// ---------------------------------------------------------------------------
// 6. Composition — allOf / anyOf / oneOf
// ---------------------------------------------------------------------------

const _AllOfSchema = {
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

void _AllOfSchema;

const _AnyOfSchema = {
  'anyOf': [
    { 'type': 'string' },
    { 'type': 'number' }
  ]
} as const;

void _AnyOfSchema;

const _OneOfSchema = {
  'oneOf': [
    { 'type': 'string' },
    { 'type': 'number' }
  ]
} as const;

void _OneOfSchema;

const _anyOf: InferType<typeof _AnyOfSchema> = 'hello';
const _anyOf2: InferType<typeof _AnyOfSchema> = 42;

const _oneOf: InferType<typeof _OneOfSchema> = 'hello';
const _oneOf2: InferType<typeof _OneOfSchema> = 42;

// allOf produces intersection
type AllOfResult = InferType<typeof _AllOfSchema>;
assert<AssertAssignable<AllOfResult, { readonly 'a': string;
  readonly 'b': number }>>();

assert<AssertEqual<InferType<typeof _AnyOfSchema>, number | string>>();
assert<AssertEqual<InferType<typeof _OneOfSchema>, number | string>>();

// ---------------------------------------------------------------------------
// 7. $ref / $defs
// ---------------------------------------------------------------------------

const _RefSchema = {
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

void _RefSchema;

const _ref: InferType<typeof _RefSchema> = { 'child': { 'name': 'Bob' } };
// @ts-expect-error — child.name is required
const _bad8: InferType<typeof _RefSchema> = { 'child': {} };

// Self-referential $ref: '#'
const _SelfRefSchema = {
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

void _SelfRefSchema;

type SelfRefResult = InferType<typeof _SelfRefSchema>;
assert<AssertAssignable<SelfRefResult, { readonly 'name': string }>>();

// ---------------------------------------------------------------------------
// 8. $anchor refs (root-level and $defs-level)
// ---------------------------------------------------------------------------

const _AnchorSchema = {
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

void _AnchorSchema;

type AnchorResult = InferType<typeof _AnchorSchema>;
assert<AssertAssignable<AnchorResult, { readonly 'item': { readonly 'label': string } }>>();

// Root-level $anchor
const _RootAnchorSchema = {
  '$anchor': 'root',
  'properties': { 'self': { '$ref': '#root' } },
  'type': 'object'
} as const;

void _RootAnchorSchema;

type RootAnchorResult = InferType<typeof _RootAnchorSchema>;
// self references the root schema itself — should be assignable to an object with self
assert<AssertAssignable<RootAnchorResult, { readonly 'self'?: unknown }>>();

// ---------------------------------------------------------------------------
// 9. JSON Pointer fragment refs (#/properties/foo)
// ---------------------------------------------------------------------------

const _PointerRefSchema = {
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

void _PointerRefSchema;

type PointerRefResult = InferType<typeof _PointerRefSchema>;
assert<AssertAssignable<PointerRefResult, { readonly 'alias': string;
  readonly 'name': string; }>>();

// Deep path navigation: #/$defs/Outer/properties/inner
const _DeepPathSchema = {
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

void _DeepPathSchema;

type DeepPathResult = InferType<typeof _DeepPathSchema>;
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
const _DynamicRefSchema = {
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

void _DynamicRefSchema;

type DynamicRefResult = InferType<typeof _DynamicRefSchema>;
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
const _RecursiveSchema = {
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

void _RecursiveSchema;

type RecursiveResult = InferType<typeof _RecursiveSchema>;
assert<AssertAssignable<RecursiveResult, { readonly 'name': string }>>();

// Without $recursiveAnchor: true, $recursiveRef resolves to unknown
const _NoAnchorRecursiveSchema = {
  'properties': { 'child': { '$recursiveRef': '#' } },
  'type': 'object'
} as const;

void _NoAnchorRecursiveSchema;

type NoAnchorResult = InferType<typeof _NoAnchorRecursiveSchema>;
// child should be unknown because $recursiveAnchor is not set
assert<AssertAssignable<NoAnchorResult, { readonly 'child'?: unknown }>>();

// ---------------------------------------------------------------------------
// 12. Negative tests — unresolvable refs and missing types
// ---------------------------------------------------------------------------
//
// Most unresolvable schemas produce `unknown`. Exception: a bare absolute-IRI
// $ref (no fragment) with no matching schema always yields
// ReferenceNotFoundType<TRef> — a compile-error brand — so cross-schema refs
// are never silently inferred as unknown.

// Missing `type` — produces unknown
const _NoTypeSchema = {} as const;

void _NoTypeSchema;

type NoTypeResult = InferType<typeof _NoTypeSchema>;
assert<AssertEqual<NoTypeResult, unknown>>();

// Invalid $ref target — produces unknown
const _BadRefSchema = {
  'properties': { 'x': { '$ref': '#/$defs/DoesNotExist' } },
  'type': 'object'
} as const;

void _BadRefSchema;

type BadRefResult = InferType<typeof _BadRefSchema>;
// x resolves to unknown
assert<AssertAssignable<BadRefResult, { readonly 'x'?: unknown }>>();

// External $ref (absolute URI without fragment) — produces RefNotFound compile error brand
const _ExternalRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other' } },
  'type': 'object'
} as const;

void _ExternalRefSchema;

type ExternalRefResult = InferType<typeof _ExternalRefSchema>;
assert<AssertAssignable<ExternalRefResult, { readonly 'ext'?: ReferenceNotFoundType<'https://example.com/Other'> }>>();

// Boolean schema (true/false) — produces unknown
type BoolSchemaResult = InferSchemaType<true>;
assert<AssertEqual<BoolSchemaResult, unknown>>();
type FalseSchemaResult = InferSchemaType<false>;
assert<AssertEqual<FalseSchemaResult, unknown>>();

// Schema with only validation keywords, no type — produces unknown
const _ValidationOnlySchema = {
  'maxLength': 10,
  'minLength': 5
} as const;

void _ValidationOnlySchema;

type ValidationOnlyResult = InferType<typeof _ValidationOnlySchema>;
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
const _NotSchema = { 'not': { 'type': 'string' } } as const;

void _NotSchema;

type NotResult = InferType<typeof _NotSchema>;
// Falls back to unknown — runtime enforces the exclusion
assert<AssertEqual<NotResult, unknown>>();

/**
 * `contains` — Runtime validates that at least one array element matches.
 * TypeScript cannot express "array with at least one element of type T",
 * so it falls back to the array's base item type (or unknown[]).
 */
const _ContainsSchema = {
  'contains': { 'type': 'number' },
  'type': 'array'
} as const;

void _ContainsSchema;

type ContainsResult = InferType<typeof _ContainsSchema>;
// `contains` narrows the element type to the contains schema (number) and adds
// the ContainsBrand carrying that element type — the runtime-only "at least one
// match" constraint is reflected as a compile-time brand.
assert<AssertEqual<ContainsResult, ContainsBrandType<number> & number[]>>();

/**
 * `propertyNames` — Constrains object keys at runtime. TypeScript cannot
 * dynamically constrain key patterns, so it falls back to Record<string, unknown>.
 */
const _PropertyNamesSchema = {
  'propertyNames': { 'pattern': '^x-' },
  'type': 'object'
} as const;

void _PropertyNamesSchema;

type PropertyNamesResult = InferType<typeof _PropertyNamesSchema>;
// Falls back to Record<string, unknown>
assert<AssertEqual<PropertyNamesResult, Record<string, unknown>>>();

/**
 * `unevaluatedProperties` — Treated identically to additionalProperties.
 * The "unevaluated" scoping across subschemas is a runtime concern.
 */

/**
 * `if/then/else` — We use a sound over-approximation rather than falling all
 * the way back to unknown. The inferred type is the union of the possible
 * branch outputs merged with the non-conditional base schema.
 */
// JSON Schema conditional — JSON.parse + explicit cast preserves the literal-typed interface
// for InferType. Converting to an object literal would widen typeof to a structural type
// and break the type assertion below.
interface IfThenElseType {
  readonly 'else': { readonly 'properties': { readonly 'kind': { readonly 'const': 'b' };
    readonly 'value': { readonly 'type': 'number' } };
  readonly 'required': readonly ['kind', 'value'];
  readonly 'type': 'object' };
  readonly 'if': { readonly 'properties': { readonly 'kind': { readonly 'const': 'a' } };
    readonly 'type': 'object' };
  readonly 'properties': { readonly 'shared': { readonly 'type': 'boolean' } };
  readonly 'required': readonly ['shared'];
  readonly 'then': { readonly 'properties': { readonly 'kind': { readonly 'const': 'a' };
    readonly 'value': { readonly 'type': 'string' } };
  readonly 'required': readonly ['kind', 'value'];
  readonly 'type': 'object' };
  readonly 'type': 'object';
}
const _iteIf = '{"properties":{"kind":{"const":"a"}},"type":"object"}';
const _iteThen = '{"properties":{"kind":{"const":"a"},"value":{"type":"string"}},"required":["kind","value"],"type":"object"}';
const _iteElse = '{"properties":{"kind":{"const":"b"},"value":{"type":"number"}},"required":["kind","value"],"type":"object"}';
const _IfThenElseSchema = JSON.parse(`{"properties":{"shared":{"type":"boolean"}},"required":["shared"],"type":"object","if":${_iteIf},"then":${_iteThen},"else":${_iteElse}}`) as IfThenElseType;

void _IfThenElseSchema;

type IfThenElseResult = InferType<typeof _IfThenElseSchema>;
assert<AssertAssignable<IfThenElseResult,
  | { readonly 'kind': 'a';
    readonly 'shared': boolean;
    readonly 'value': string; }
  | { readonly 'kind': 'b';
    readonly 'shared': boolean;
    readonly 'value': number }
>>();

// ---------------------------------------------------------------------------
// 14. Nested object with deep required
// ---------------------------------------------------------------------------

const _NestedObjectSchema = {
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

void _NestedObjectSchema;

type NestedObj = InferType<typeof _NestedObjectSchema>;
assert<AssertAssignable<NestedObj, {
  readonly 'address': { readonly 'city': string;
    readonly 'street': string;
    readonly 'zip'?: string };
}>>();

// ---------------------------------------------------------------------------
// 15. allOf with three+ schemas
// ---------------------------------------------------------------------------

const _TripleAllOfSchema = {
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

void _TripleAllOfSchema;

type TripleAllOf = InferType<typeof _TripleAllOfSchema>;
assert<AssertAssignable<TripleAllOf, { readonly 'a': string;
  readonly 'b': number;
  readonly 'c': boolean }>>();

// ---------------------------------------------------------------------------
// 16. Mixed enum types
// ---------------------------------------------------------------------------

const _MixedEnumSchema = {
  'enum': [
    'a',
    1,
    true,
    null
  ]
} as const;

void _MixedEnumSchema;

type MixedEnum = InferType<typeof _MixedEnumSchema>;
assert<AssertEqual<MixedEnum, 1 | 'a' | null | true>>();

// ---------------------------------------------------------------------------
// 17. Deeply nested $ref
// ---------------------------------------------------------------------------

const _DeepRefSchema = {
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

void _DeepRefSchema;

type DeepRef = InferType<typeof _DeepRefSchema>;
assert<AssertAssignable<DeepRef, { readonly 'wrapper': { readonly 'inner': { readonly 'value': number } } }>>();

// ---------------------------------------------------------------------------
// 18. External fragment refs fall back to unknown without references
// ---------------------------------------------------------------------------
//
// Note: bare absolute-IRI refs (no fragment) yield ReferenceNotFoundType<T>
// instead of unknown — see section 12. Fragment refs (schema#anchor,
// schema#/pointer) still fall back to unknown when no references map is
// provided because the base-URI resolver (ResolveReferenceBaseSchemaType) guards on
// HasReferencesType — the strictness change applies only to the bare-IRI arm.

/**
 * External $ref with anchor fragment — base-URI resolves to unknown (no
 * references map, base URI does not match root $id).
 */
const _ExternalAnchorRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other#someAnchor' } },
  'type': 'object'
} as const;

void _ExternalAnchorRefSchema;

type ExternalAnchorRefResult = InferType<typeof _ExternalAnchorRefSchema>;
assert<AssertAssignable<ExternalAnchorRefResult, { readonly 'ext'?: unknown }>>();

/**
 * External $ref with JSON Pointer fragment — cannot resolve cross-schema.
 */
const _ExternalPointerRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other#/$defs/Foo' } },
  'type': 'object'
} as const;

void _ExternalPointerRefSchema;

type ExternalPointerRefResult = InferType<typeof _ExternalPointerRefSchema>;
assert<AssertAssignable<ExternalPointerRefResult, { readonly 'ext'?: unknown }>>();

/**
 * External $ref with deep JSON Pointer — cannot resolve cross-schema.
 */
const _ExternalDeepPointerRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Other#/properties/name' } },
  'type': 'object'
} as const;

void _ExternalDeepPointerRefSchema;

type ExternalDeepPointerRefResult = InferType<typeof _ExternalDeepPointerRefSchema>;
assert<AssertAssignable<ExternalDeepPointerRefResult, { readonly 'ext'?: unknown }>>();

// With an explicit references map, external refs resolve at compile time
interface ReferenceMap {
  readonly 'https://example.com/Other': {
    readonly '$anchor': 'someAnchor';
    readonly '$defs': {
      readonly 'Foo': {
        readonly '$anchor': 'fooAnchor';
        readonly 'properties': { readonly 'name': { readonly 'type': 'string' } };
        readonly 'required': readonly ['name'];
        readonly 'type': 'object'
      }
    };
    readonly 'properties': {
      readonly 'child': { readonly '$ref': '#/$defs/Foo' };
      readonly 'name': { readonly 'type': 'string' }
    };
    readonly 'required': readonly ['name'];
    readonly 'type': 'object'
  };
}

type ExternalWholeDocResolved = InferSchemaType<typeof _ExternalRefSchema, typeof _ExternalRefSchema, ReferenceMap>;
assert<AssertAssignable<ExternalWholeDocResolved, {
  readonly 'ext'?: {
    readonly 'child'?: { readonly 'name': string };
    readonly 'name': string
  };
}>>();

type ExternalWholeDocResolvedViaAlias = InferType<typeof _ExternalRefSchema, ReferenceMap>;
assert<AssertAssignable<ExternalWholeDocResolvedViaAlias, {
  readonly 'ext'?: {
    readonly 'child'?: { readonly 'name': string };
    readonly 'name': string
  };
}>>();

type ExternalAnchorResolved
  = InferSchemaType<typeof _ExternalAnchorRefSchema, typeof _ExternalAnchorRefSchema, ReferenceMap>;
assert<AssertAssignable<ExternalAnchorResolved, {
  readonly 'ext'?: {
    readonly 'child'?: { readonly 'name': string };
    readonly 'name': string
  };
}>>();

type ExternalPointerResolved
  = InferSchemaType<typeof _ExternalPointerRefSchema, typeof _ExternalPointerRefSchema, ReferenceMap>;
assert<AssertAssignable<ExternalPointerResolved, { readonly 'ext'?: { readonly 'name': string } }>>();

type ExternalDeepPointerResolved
  = InferSchemaType<typeof _ExternalDeepPointerRefSchema, typeof _ExternalDeepPointerRefSchema, ReferenceMap>;
assert<AssertAssignable<ExternalDeepPointerResolved, { readonly 'ext'?: string }>>();

/**
 * Internal fragment refs still resolve correctly — regression guard.
 * Ensures the external fallback didn't break internal resolution.
 */
const _InternalFragmentRefSchema = {
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

void _InternalFragmentRefSchema;

type InternalFragmentResult = InferType<typeof _InternalFragmentRefSchema>;
assert<AssertAssignable<InternalFragmentResult, {
  readonly 'a': { readonly 'label': string };
  readonly 'b': { readonly 'label': string };
}>>();

// ---------------------------------------------------------------------------
// 19. SplitFragmentReferenceType base-URI guard
// ---------------------------------------------------------------------------

import type { SplitFragmentReferenceType } from '../../src/types/Infer.js';

const _LocalSchemaWithId = {
  '$defs': { 'Bar': { 'type': 'string' } },
  '$id': 'https://local.com/Foo',
  'type': 'object'
} as const;

void _LocalSchemaWithId;

// Unreachable base → ReferenceNotFoundType (uniform; no silent unknown). The
// base 'https://other.com/X' is not the root $id, is not embedded under $defs
// by $id, and no references map is present.
type CrossSchemaRef = SplitFragmentReferenceType<'https://other.com/X#/$defs/Bar', typeof _LocalSchemaWithId>;
assert<AssertEqual<CrossSchemaRef, ReferenceNotFoundType<'https://other.com/X'>>>();

// Same-schema ref resolves correctly (base URI matches $id)
type SameSchemaRef = SplitFragmentReferenceType<'https://local.com/Foo#/$defs/Bar', typeof _LocalSchemaWithId>;
assert<AssertEqual<SameSchemaRef, { readonly 'type': 'string' }>>();

// Schema without $id, unreachable base → ReferenceNotFoundType (uniform).
const _SchemaWithoutId = {
  '$defs': { 'X': { 'type': 'number' } },
  'type': 'object'
} as const;

void _SchemaWithoutId;

type NoIdRef = SplitFragmentReferenceType<'https://any.com#/$defs/X', typeof _SchemaWithoutId>;
assert<AssertEqual<NoIdRef, ReferenceNotFoundType<'https://any.com'>>>();

// ---------------------------------------------------------------------------
// Suppress unused variable warnings
// ---------------------------------------------------------------------------

void _s;
void _n;
void _i;
void _b;
void _nl;
void _bad1;
void _bad2;
void _bad3;
void _bad4;
void _bad5;
void _bad6;
void _bad7;
void _bad8;
void _c;
void _e;
void _e2;
void _arr;
void _u;
void _u2;
void _nullable1;
void _nullable2;
void _anyOf;
void _anyOf2;
void _oneOf;
void _oneOf2;
void _ref;
