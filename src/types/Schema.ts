import type { InferSchemaType } from './Infer.js';
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

/**
 * Derive the TypeScript wire type from a JSON Schema.
 *
 * Beyond the structural keywords (`type`, `properties`, `required`, etc.)
 * `InferType` also folds in OWL class-axiom brands and property restrictions:
 *
 *   • `disjointWith: X` → result type carries a brand that conflicts with
 *     X's brand, so values typed as both are rejected at compile time.
 *   • `not: { $ref: X }` → result type carries the complementOf brand.
 *   • `jt:restrictions` → property types are narrowed (literal value for
 *     `hasValue`, fixed-length tuple for `cardinality`, non-empty tuple for
 *     `minCardinality(1+)` / `someValuesFrom`, bounded tuple for
 *     `maxCardinality`, element-class refinement for `allValuesFrom`).
 *
 * @example
 * type User = InferType<typeof UserSchema>;
 */
export type InferType<TSchema, TReferences = Record<never, never>>
  = ApplyComplementBrandType<TSchema,
    ApplyDisjointBrandType<TSchema,
      ApplyRestrictionsToInferredType<TSchema,
        InferSchemaType<TSchema, TSchema, TReferences>
      >
    >
  >;

export type JsonSchemaType = boolean | Record<string, unknown>;
