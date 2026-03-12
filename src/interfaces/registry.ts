import type { FormatRegistry } from '../schema/FormatRegistry.js';
import type { KeywordDefinition } from '../schema/GraphEngine.js';
import type { InferSchema } from '../types/infer.js';
import type { Logger } from './logger.js';

/** Logger for schema registry operations. */
export type RegistryLogger = Logger;

// ---------------------------------------------------------------------------
// Type-level helpers for compile-time schema map accumulation
// ---------------------------------------------------------------------------

/** Extract `{ [$id]: InferSchema<T> }` from a single schema. */
export type SchemaEntry<T> =
  T extends { readonly '$id': infer Id extends string }
    ? { [K in Id]: InferSchema<T> }
    : {};

/** Build a type map from a readonly tuple of schemas. */
export type SchemaMapFromTuple<T extends readonly unknown[]> =
  T extends readonly [infer First, ...infer Rest]
    ? SchemaEntry<First> & SchemaMapFromTuple<Rest>
    : {};

export interface RegistryOptions {
  /**
   * When true, the graph engine coerces primitive types during parsing and materialization
   * (e.g. 123 accepted where "123" is expected).
   */
  'coerce'?: boolean;
  /** Optional format registry to pass to the graph engine. */
  'formatRegistry'?: FormatRegistry;
  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinition[];
  'logger'?: RegistryLogger;
}
