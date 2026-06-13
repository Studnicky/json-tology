import type { InferSchemaType } from './Infer.js';
import type { JsonTologyReferencesInterface } from './SchemaReferences.js';
import type {
  ApplyRestrictionsType,
  ComplementOfBrandInterface,
  DisjointWithBrandInterface,
  ExtractRestrictionsType
} from './RestrictionInfer.js';

// ---------------------------------------------------------------------------
// Axiom-aware wrappers around InferSchemaType.
//
// `InferType` is the public facade. It runs the structural inference, then
// folds in the OWL-axiom brands (disjointWith, complementOf) and the
// jt:restrictions narrowing so a value that violates one of these constraints
// is rejected at compile time, not just at runtime.
// ---------------------------------------------------------------------------

type ApplyDisjointBrandType<TSchema, TInferred>
  = TSchema extends { readonly 'disjointWith': infer TDisjoint }
    ? TDisjoint extends string
      ? DisjointWithBrandInterface<TDisjoint> & TInferred
      : TDisjoint extends ReadonlyArray<infer TElem extends string>
        ? DisjointWithBrandInterface<TElem> & TInferred
        : TInferred
    : TInferred;

type ApplyComplementBrandType<TSchema, TInferred>
  = TSchema extends { readonly 'not': { readonly '$ref': infer TRef } }
    ? TRef extends string
      ? ComplementOfBrandInterface<TRef> & TInferred
      : TInferred
    : TInferred;

/**
 * If the schema (or any allOf entry) carries `jt:restrictions`, apply the
 * restriction-derived narrowing to the inferred property map.
 *
 * Restrictions can live on the top-level schema (when the result of
 * `Compose.subClassOf(restriction, body)` is the registered schema directly)
 * or on a body that the top-level schema wraps via `allOf`. We check both.
 */
type FindRestrictionsType<TSchema>
  = ExtractRestrictionsType<TSchema> extends readonly [unknown, ...unknown[]]
    ? ExtractRestrictionsType<TSchema>
    : TSchema extends { readonly 'allOf': infer TAllOf extends readonly unknown[] }
      ? FindRestrictionsInAllOfType<TAllOf>
      : readonly [];

type FindRestrictionsInAllOfType<TArr extends readonly unknown[]>
  = TArr extends readonly [infer Head, ...infer Tail]
    ? ExtractRestrictionsType<Head> extends readonly [unknown, ...unknown[]]
      ? ExtractRestrictionsType<Head>
      : FindRestrictionsInAllOfType<Tail>
    : readonly [];

type ApplyRestrictionsToInferredType<TSchema, TInferred>
  = FindRestrictionsType<TSchema> extends readonly [unknown, ...unknown[]]
    ? TInferred extends Record<string, unknown>
      ? ApplyRestrictionsType<TInferred, FindRestrictionsType<TSchema>>
      : TInferred
    : TInferred;

export type { InferSchemaType } from './Infer.js';

/**
 * Derive the TypeScript wire type from a JSON Schema, including OWL class-axiom brands and property restriction narrowing.
 *
 * @remarks
 * Beyond the structural keywords (`type`, `properties`, `required`, etc.)
 * `InferType` also folds in OWL class-axiom brands and property restrictions:
 *
 * - `disjointWith: X` → result type carries a brand that conflicts with
 *   X's brand, so values typed as both are rejected at compile time.
 * - `not: { $ref: X }` → result type carries the complementOf brand.
 * - `jt:restrictions` → property types are narrowed (literal value for
 *   `hasValue`, fixed-length tuple for `cardinality`, non-empty tuple for
 *   `minCardinality(1+)` / `someValuesFrom`, bounded tuple for
 *   `maxCardinality`, element-class refinement for `allValuesFrom`).
 *
 * @example
 * ```ts
 * type User = InferType<typeof UserSchema>;
 * ```
 *
 * @category Type Inference
 * @since 0.10.0
 * @see {@link InferSchemaType}
 * @group Type Inference
 *
 * @typeParam TSchema - The JSON Schema literal to derive the TypeScript type from.
 * @typeParam TReferences - Optional map of additional referenced schema literals for cross-schema inference.
 */
export type InferType<TSchema, TReferences = JsonTologyReferencesInterface>
  = ApplyComplementBrandType<TSchema,
    ApplyDisjointBrandType<TSchema,
      ApplyRestrictionsToInferredType<TSchema,
        InferSchemaType<TSchema, TSchema, TReferences>
      >
    >
  >;

/**
 * Loose JSON Schema value — either a boolean shorthand or an object schema.
 *
 * @remarks
 * Used as a permissive type at loader and registry boundaries where the schema
 * has not yet been narrowed to the full {@link JsonSchemaDocumentType} shape.
 * `true` accepts every instance; `false` rejects every instance; an object
 * carries the keyword map. Prefer {@link JsonSchemaDocumentObjectType} once
 * the value is known to be non-boolean.
 *
 * @example
 * ```ts
 * const schema: JsonSchemaType = { type: 'string', minLength: 1 };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link JsonSchemaDocumentType}
 * @group Schema Utilities
 */
export type JsonSchemaType = boolean | Record<string, unknown>;

/**
 * Primitive type names supported by JSON Schema's `type` keyword.
 *
 * @remarks
 * Matches the string values permitted by the `type` keyword in JSON Schema
 * Draft-2020-12 §6.1.1. The `integer` member is distinct from `number` — it
 * constrains the value to have no fractional part. Used as the element type of
 * the `type` field on {@link JsonSchemaDocumentObjectType}.
 *
 * @example
 * ```ts
 * const t: JsonSchemaTypeNameType = 'string';
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link JsonSchemaDocumentObjectType}
 * @group Schema Utilities
 */
export type JsonSchemaTypeNameType
  = | 'array'
  | 'boolean'
  | 'integer'
  | 'null'
  | 'number'
  | 'object'
  | 'string';

/**
 * Structural JSON Schema object — Draft-2020-12 core, validation,
 * format-annotation, content, and meta-data vocabularies, extended with
 * json-tology's OWL property characteristics, class axioms, and `jt:*`
 * directives.
 *
 * @remarks
 * Models the full Draft-2020-12 keyword set (`prefixItems`,
 * `unevaluatedProperties`, `unevaluatedItems`, `dependentSchemas`,
 * `dependentRequired`, `$dynamicAnchor`, `$dynamicRef`) plus
 * json-tology extensions: OWL 2 property characteristics (`functional`,
 * `inverseFunctional`, `transitive`, `symmetric`, `asymmetric`,
 * `reflexive`, `irreflexive`, `inverseOf`), class axioms
 * (`equivalentTo`, `disjointWith`), RDFS domain/range annotations, and
 * `jt:*` directives (`jt:computed`, `jt:frozen`, `jt:strict`,
 * `jt:config`, `jt:restrictions`). Draft-07 keywords removed in
 * 2020-12 (`definitions`, `dependencies`, `additionalItems`, the array
 * form of `items`, the boolean form of
 * `exclusiveMaximum`/`exclusiveMinimum`) are intentionally absent.
 *
 * Used as the constraint for public API generics
 * (`jt.materialize<TSchema>`, `Transform.create<TSchema>`,
 * `jt.instantiate<TSchema>`, etc.).
 *
 * Specs:
 *   https://json-schema.org/draft/2020-12/json-schema-core
 *   https://json-schema.org/draft/2020-12/json-schema-validation
 *
 * @example
 * ```ts
 * const schema: JsonSchemaDocumentObjectType = {
 *   $id: 'https://example.com/User',
 *   type: 'object',
 *   properties: { id: { type: 'string' } },
 *   required: ['id'],
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link JsonSchemaDocumentType}
 * @group Schema Utilities
 */
export interface JsonSchemaDocumentObjectType {
  readonly '$anchor'?: string;
  readonly '$comment'?: string;
  readonly '$defs'?: Readonly<Record<string, JsonSchemaDocumentType>>;
  readonly '$dynamicAnchor'?: string;
  readonly '$dynamicRef'?: string;
  readonly '$id'?: string;
  readonly '$recursiveAnchor'?: boolean;
  readonly '$recursiveRef'?: string;
  readonly '$ref'?: string;
  // ── Core: identifiers and references ────────────────────────────
  readonly '$schema'?: string;
  readonly '$vocabulary'?: Readonly<Record<string, boolean>>;

  readonly 'additionalProperties'?: JsonSchemaDocumentType;
  // ── Applicators: composition ────────────────────────────────────
  readonly 'allOf'?: readonly JsonSchemaDocumentType[];
  readonly 'anyOf'?: readonly JsonSchemaDocumentType[];
  readonly 'asymmetric'?: boolean;

  readonly 'const'?: unknown;
  readonly 'contains'?: JsonSchemaDocumentType;
  // ── Content ─────────────────────────────────────────────────────
  readonly 'contentEncoding'?: string;

  readonly 'contentMediaType'?: string;
  readonly 'contentSchema'?: JsonSchemaDocumentType;
  readonly 'default'?: unknown;
  readonly 'dependentRequired'?: Readonly<Record<string, readonly string[]>>;
  readonly 'dependentSchemas'?: Readonly<Record<string, JsonSchemaDocumentType>>;
  readonly 'deprecated'?: boolean;

  readonly 'description'?: string;
  // ── OWL 2 class axioms ──────────────────────────────────────────
  readonly 'disjointWith'?: string;
  readonly 'else'?: JsonSchemaDocumentType;
  readonly 'enum'?: readonly unknown[];

  readonly 'equivalentTo'?: string;
  readonly 'examples'?: readonly unknown[];
  readonly 'exclusiveMaximum'?: number;

  readonly 'exclusiveMinimum'?: number;
  // ── Format (annotation by default in 2020-12) ───────────────────
  readonly 'format'?: string;
  readonly 'functional'?: boolean;
  // ── Applicators: conditional ────────────────────────────────────
  readonly 'if'?: JsonSchemaDocumentType;
  // ── OWL 2 property characteristics ──────────────────────────────
  readonly 'inverseFunctional'?: boolean;

  readonly 'inverseOf'?: string;
  readonly 'irreflexive'?: boolean;
  readonly 'items'?: JsonSchemaDocumentType;

  // ── json-tology directives ──────────────────────────────────────
  readonly 'jt:computed'?: boolean;
  readonly 'jt:config'?: Record<string, unknown>;
  readonly 'jt:frozen'?: boolean;
  /**
   * OWL 2 §9.5 — composite key uniqueness constraints declared via `owl:hasKey`.
   *
   * @remarks
   * Each entry is an array of property IRIs that together form a composite key.
   * At most one unique instance per (P1, P2, …) combination is allowed.
   */
  readonly 'jt:hasKey'?: ReadonlyArray<readonly string[]>;
  readonly 'jt:restrictions'?: ReadonlyArray<Record<string, unknown>>;
  readonly 'jt:strict'?: boolean;

  readonly 'maxContains'?: number;
  readonly 'maximum'?: number;
  // ── Validation: arrays ──────────────────────────────────────────
  readonly 'maxItems'?: number;
  // ── Validation: strings ─────────────────────────────────────────
  readonly 'maxLength'?: number;

  // ── Validation: objects ─────────────────────────────────────────
  readonly 'maxProperties'?: number;

  readonly 'minContains'?: number;
  readonly 'minimum'?: number;
  readonly 'minItems'?: number;

  readonly 'minLength'?: number;
  readonly 'minProperties'?: number;
  // ── Validation: numbers ─────────────────────────────────────────
  readonly 'multipleOf'?: number;
  readonly 'not'?: JsonSchemaDocumentType;
  readonly 'oneOf'?: readonly JsonSchemaDocumentType[];
  readonly 'pattern'?: string;
  readonly 'patternProperties'?: Readonly<Record<string, JsonSchemaDocumentType>>;

  // ── Applicators: arrays ─────────────────────────────────────────
  readonly 'prefixItems'?: readonly JsonSchemaDocumentType[];
  // ── Applicators: objects ────────────────────────────────────────
  readonly 'properties'?: Readonly<Record<string, JsonSchemaDocumentType>>;
  readonly 'propertyNames'?: JsonSchemaDocumentType;
  readonly 'rdfs:domain'?: string;
  readonly 'rdfs:range'?: string;
  readonly 'readOnly'?: boolean;
  readonly 'reflexive'?: boolean;
  readonly 'required'?: readonly string[];

  readonly 'symmetric'?: boolean;
  readonly 'then'?: JsonSchemaDocumentType;
  // ── Meta-data ───────────────────────────────────────────────────
  readonly 'title'?: string;
  readonly 'transitive'?: boolean;

  // ── Validation: any instance ────────────────────────────────────
  readonly 'type'?: JsonSchemaTypeNameType | readonly JsonSchemaTypeNameType[];
  readonly 'unevaluatedItems'?: JsonSchemaDocumentType;
  readonly 'unevaluatedProperties'?: JsonSchemaDocumentType;
  readonly 'uniqueItems'?: boolean;
  readonly 'writeOnly'?: boolean;
}

/**
 * A JSON Schema document — either the structural object or one of the boolean shortcuts.
 *
 * @remarks
 * Either the structural object defined by {@link JsonSchemaDocumentObjectType}
 * or one of the boolean shortcuts (`true` accepts every instance, `false`
 * rejects every instance). Used as the public-API constraint for `TSchema`
 * generics in `JsonTology` methods.
 *
 * The `& { readonly '$id': string }` intersection used in named-schema
 * overloads narrows this to the registered-schema case automatically;
 * boolean shortcuts have no `$id` and drop out of the intersection.
 *
 * @example
 * ```ts
 * const always: JsonSchemaDocumentType = true;
 * const never: JsonSchemaDocumentType = false;
 * const obj: JsonSchemaDocumentType = { type: 'string' };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link JsonSchemaDocumentObjectType}
 * @group Schema Utilities
 */
export type JsonSchemaDocumentType = boolean | JsonSchemaDocumentObjectType;
