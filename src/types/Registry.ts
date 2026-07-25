import type { DuplicateSchemaIdType } from './TypeErrors.js';
import type { ParseOutputType } from './Transform.js';
import type { DefaultCreatorInterface } from '../interfaces/DefaultCreatorInterface.js';
import type { InvariantType } from './Invariant.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistryInterface.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { KeywordDefinitionType } from './GraphEngine.js';
import type { LoggerInterface } from '../interfaces/LoggerInterface.js';
import type { VocabularyPluginInterface } from '../interfaces/VocabularyPluginInterface.js';

/** Build a cross-schema references map: `{ [$id]: SchemaType }` for $ref resolution.
 *
 *  Constructed as a single mapped type over the tuple's element union rather
 *  than by head/tail recursion. Recursion depth is O(1) in the number of
 *  schemas, so the map scales to large ontologies/registries without tripping
 *  TypeScript's instantiation-depth ceiling (TS2589) when forced. Values are
 *  the raw schema types — `$ref` resolution infers them on demand, so traversal
 *  cost is bounded by ref-chain depth, not registry size. */
export type SchemaReferencesMapType<T extends readonly unknown[]>
  = {
    [K in T[number] as K extends { readonly '$id': infer Id extends string } ? Id : never]: K
  };

/** Extract `{ [$id]: ParseOutputType<T> }` from a single schema.
 *  Uses ParseOutputType so that transformed schemas map to the decoded type
 *  (matching parse() behavior), while plain schemas map to the wire shape.
 *
 *  @typeParam TReferences - Cross-schema references map for $ref resolution. */
export type SchemaEntryType<T, TReferences = Record<never, never>>
  = T extends { readonly '$id': infer Id extends string }
    ? Record<Id, ParseOutputType<T, TReferences>>
    : Record<never, never>;

/** Build a type map from a readonly tuple of schemas.
 *  Automatically threads cross-schema references so $ref between schemas resolves.
 *
 *  The `TRefs` parameter captures the references map computed from the full
 *  initial tuple and is threaded through recursion unchanged. Without this,
 *  the recursive step would recompute references from `Rest` only, so entries
 *  built later in the tuple would lose access to schemas earlier in the tuple
 *  (and vice versa, since `Rest` shrinks on each step). The result was that a
 *  `$ref` between two registered schemas resolved to `unknown` instead of the
 *  referenced schema's inferred shape. */
export type SchemaMapFromTupleType<
  T extends readonly unknown[],
  TRefs = SchemaReferencesMapType<T>
>
  = {
    [K in T[number] as K extends { readonly '$id': infer Id extends string } ? Id : never]:
    ParseOutputType<K, TRefs>
  };

/** Per-position `$id` projection of a schema tuple. Mapped over the tuple's
 *  index keys (depth O(1)); `never` at positions without a string `$id`. */
type SchemaIdsTupleType<T extends readonly unknown[]>
  = { [I in keyof T]: T[I] extends { readonly '$id': infer Id extends string } ? Id : never };

/** Distributive `$id` projection of a single schema element. Written as a naked
 *  type parameter so the conditional distributes over a union *and* collapses to
 *  `never` for the `never` member — the property that makes {@link IdsUnionType}
 *  correct for empty sub-tuples. */
type IdOfType<TElement>
  = TElement extends { readonly '$id': infer Id extends string } ? Id : never;

/** Union of `$id`s present in a sub-tuple. Distributes over the element union via
 *  {@link IdOfType}, so depth is O(1) regardless of sub-tuple length.
 *
 *  For an empty tuple `T[number]` is `never`; distributing `IdOfType` over the
 *  empty union yields `never`. A non-distributive
 *  `T[number] extends … ? Id : never` would instead vacuously match (`never`
 *  satisfies every constraint) and resolve `Id` to its `string` upper bound,
 *  contaminating any downstream `IdsUnionType<[]> & TSeen` with `TSeen`. */
type IdsUnionType<T extends readonly unknown[]>
  = IdOfType<T[number]>;

/** Duplicate `$id`s within a SMALL chunk (≤ 8): the N×N position scan is bounded
 *  to the chunk size, so this is cheap. Both directions of `extends` must hold
 *  so the wide `string` type never falsely matches a string literal. */
type ChunkDuplicateIdsType<TIds extends readonly unknown[]>
  = {
    [I in keyof TIds]: {
      [J in keyof TIds]: J extends I ? never
        : [TIds[J]] extends [TIds[I]] ? [TIds[I]] extends [TIds[J]] ? TIds[I] : never : never
    }[number]
  }[number];

/** Collect every `$id` that appears at more than one position, by folding the
 *  tuple eight elements per recursion frame.
 *
 *  Recursion depth is ⌈N/8⌉ rather than N, so detection scales to large
 *  ontology registries without tripping TypeScript's instantiation ceiling
 *  (TS2589). Each frame contributes, as a union: ids duplicated *within* the
 *  current 8-element chunk, plus ids shared *between* the chunk and the ids
 *  already seen (`IdsUnionType<chunk> & TSeen`); recursion then continues over
 *  the remainder with the seen-set widened. Duplicate ids accumulate as a plain
 *  union — no nested conditional dispatch. */
type DuplicateIdsType<T extends readonly unknown[], TSeen = never>
  = T extends readonly [
    infer A, infer B, infer C, infer D, infer E, infer F, infer G, infer H, ...infer Rest
  ]
    ? ChunkDuplicateIdsType<SchemaIdsTupleType<[A, B, C, D, E, F, G, H]>>
      | DuplicateIdsType<Rest, IdsUnionType<[A, B, C, D, E, F, G, H]> | TSeen>
      | (IdsUnionType<[A, B, C, D, E, F, G, H]> & TSeen)
    : ChunkDuplicateIdsType<SchemaIdsTupleType<T>> | (IdsUnionType<T> & TSeen);

/** True when a tuple contains two or more schemas with the same `$id`. */
type HasDuplicateIdsType<T extends readonly unknown[]>
  = [DuplicateIdsType<T>] extends [never] ? false : true;

/** Homomorphic projection: brand positions whose `$id` is a duplicate. */
type BrandedDuplicatesType<T extends readonly unknown[]>
  = { [I in keyof T]: T[I] extends { readonly '$id': infer Id extends string }
    ? Id extends DuplicateIdsType<T> ? DuplicateSchemaIdType<Id> : T[I]
    : T[I]
  };

/** Enforces unique `$id` values across a schema tuple at compile time.
 *
 *  Positions sharing a `$id` are branded with `DuplicateSchemaIdType<TId>`,
 *  making the tuple incompatible with the expected parameter type and surfacing
 *  the offending IRI in editor diagnostics. Detection uses the chunked fold in
 *  {@link DuplicateIdsType}, so it scales to large registries. Dispatch is a
 *  single indexed-access on the stringified `HasDuplicateIdsType` tag — no
 *  conditional chain. */
export type UniqueSchemaIdsType<T extends readonly unknown[]>
  = {
    'false': T;
    'true': BrandedDuplicatesType<T>;
  }[`${HasDuplicateIdsType<T>}`];

export type RegistryOptionsType = {
  'formatRegistry'?: FormatRegistryInterface;
  'keywords'?: KeywordDefinitionType[];
  'logger'?: LoggerInterface;
  'maxSchemaDepth'?: number;
} & {
  /**
   * Factory that builds the default-instance creator for `create()`. Injected
   * by the facade so the registry depends on {@link DefaultCreatorInterface}
   * rather than the higher `materialization` layer. When absent, `create()`
   * throws `SchemaError('SCHEMA_DEFAULT_CREATOR_MISSING')`.
   */
  'defaultCreatorFactory'?: (registry: SchemaRegistryInterface) => DefaultCreatorInterface;
  'enableDebug'?: boolean;
  'enableDefaults'?: boolean;
  /**
   * When true, the registry scans all registered schemas after each
   * `register()` call and raises an error or warning when two distinct
   * schema pointers produce structurally equivalent shapes. When
   * `enableStrictGraph` is also true (the default), duplicate shapes cause
   * `SchemaError('SCHEMA_DUPLICATE_SHAPE')` at registration time; otherwise
   * a `logger.warn` is emitted. Setting `enableStrictGraph` to `true`
   * forces this flag on regardless of the value passed here.
   *
   * @default true
   */
  'enableDuplicateDetection'?: boolean;
  /**
   * When true, registering a schema with inline primitive constraints
   * (e.g. `{ type: 'number', minimum: 0 }` embedded in a property instead
   * of a `$ref` to a named primitive) emits a `logger.warn`. When combined
   * with `enableStrictGraph` (the default), the same condition throws
   * `SchemaError('SCHEMA_STRUCTURE_INVALID')` at registration time.
   * Setting `enableStrictGraph` to `true` forces this flag on regardless
   * of the value passed here.
   *
   * @default true
   */
  'enableInlineWarnings'?: boolean;
  /**
   * Master graph-integrity gate. When true (the default), both
   * `enableInlineWarnings` and `enableDuplicateDetection` are forced on,
   * and any violation they detect is thrown as a `SchemaError` rather than
   * logged as a warning. Set to `false` to downgrade all graph-integrity
   * violations to `logger.warn` — the individual flags then control which
   * checks run at all. Consumers that need the historical permissive
   * behaviour should pass `enableStrictGraph: false` explicitly.
   *
   * @default true
   */
  'enableStrictGraph'?: boolean;
  'enableStrictTypes'?: boolean;
  'enableTypeCast'?: boolean;
  'invariants'?: Record<string, InvariantType[]>;
  'prefixes'?: Record<string, string>;
  'vocabularies'?: VocabularyPluginInterface[];
};
