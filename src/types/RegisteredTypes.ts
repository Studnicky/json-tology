/**
 * Registry-derived type helpers.
 *
 * A `JsonTology` instance created via `JsonTology.create({ schemas })` carries
 * its references map as the `TRefs` type parameter, so `typeof jt` already
 * holds every registered schema keyed by `$id`. These helpers read the
 * resolved type back out of that instance type — consumers name a registered
 * schema by `$id` instead of hand-rolling `SchemaReferencesMapType<typeof
 * tuple>`. Cross-schema `$ref`s resolve against the registry's own references.
 */

import type { JsonTology } from '../JsonTology.js';
import type {
  CanonicalShapeType,
  MaterializedSchemaType
} from './Infer.js';
import type { ParseOutputType } from './Transform.js';

/**
 * The references map (`{ [$id]: schema }`) carried by a `JsonTology` instance
 * type. `RegistryReferencesType<typeof jt>` recovers the map that
 * `JsonTology.create({ schemas })` accumulated, with no tuple to reconstruct.
 *
 * @typeParam TJt - A `JsonTology<...>` instance type (usually `typeof jt`).
 */
export type RegistryReferencesType<TJt>
  = TJt extends JsonTology<infer TRefs> ? TRefs : never;

/**
 * The canonical (brand-free, decoded) shape of a registered schema, selected
 * by `$id` from a `JsonTology` instance type. Equivalent to the value `decode`
 * produces — cross-schema `$ref`s resolved through the registry's references,
 * no references map passed by hand.
 *
 * @example
 * ```ts
 * const jt = JsonTology.create({ schemas: [ChannelSchema, ChatMessageSchema] });
 * type ChatMessage = RegisteredCanonicalType<typeof jt, 'urn:slack:ChatMessage'>;
 * //   channel / sender resolve to their schema shapes, not RefNotFound
 * ```
 *
 * @typeParam TJt - A `JsonTology<...>` instance type (usually `typeof jt`).
 * @typeParam K - A registered schema `$id`.
 */
export type RegisteredCanonicalType<TJt, K extends keyof RegistryReferencesType<TJt> & string>
  = CanonicalShapeType<RegistryReferencesType<TJt>[K], RegistryReferencesType<TJt>>;

/**
 * The materialized shape of a registered schema, selected by `$id` — required
 * and defaulted properties are non-optional. Matches `materialize()` output.
 *
 * @typeParam TJt - A `JsonTology<...>` instance type (usually `typeof jt`).
 * @typeParam K - A registered schema `$id`.
 */
export type RegisteredMaterializedType<TJt, K extends keyof RegistryReferencesType<TJt> & string>
  = MaterializedSchemaType<
    RegistryReferencesType<TJt>[K],
    RegistryReferencesType<TJt>[K],
    RegistryReferencesType<TJt>
  >;

/**
 * The parse / wire output type of a registered schema, selected by `$id` —
 * matches the return type of `instantiate()`, `parse()`, and `dump()`.
 *
 * @typeParam TJt - A `JsonTology<...>` instance type (usually `typeof jt`).
 * @typeParam K - A registered schema `$id`.
 */
export type RegisteredOutputType<TJt, K extends keyof RegistryReferencesType<TJt> & string>
  = ParseOutputType<RegistryReferencesType<TJt>[K], RegistryReferencesType<TJt>>;
