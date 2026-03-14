import type { FormatRegistry } from '../modules/format/FormatRegistry.js';
import type { KeywordDefinitionInterface } from './graph-engine.js';
import type { ParseOutputType } from '../types/transform.js';
import type { LoggerInterface } from './logger.js';


// ---------------------------------------------------------------------------
// Type-level helpers for compile-time schema map accumulation
// ---------------------------------------------------------------------------

/** Extract `{ [$id]: ParseOutputType<T> }` from a single schema.
 *  Uses ParseOutputType so that transformed schemas map to the decoded type
 *  (matching parse() behavior), while plain schemas map to the wire shape. */
export type SchemaEntryType<T>
  = T extends { readonly '$id': infer Id extends string }
    ? Record<Id, ParseOutputType<T>>
    : {};

/** Build a type map from a readonly tuple of schemas. */
export type SchemaMapFromTupleType<T extends readonly unknown[]>
  = T extends readonly [infer First, ...infer Rest]
    ? SchemaEntryType<First> & SchemaMapFromTupleType<Rest>
    : {};

export interface RegistryOptionsInterface {
  /**
   * When true, the graph engine coerces primitive types during parsing and materialization
   * (e.g. 123 accepted where "123" is expected).
   */
  'coerce'?: boolean;
  /** Optional format registry to pass to the graph engine. */
  'formatRegistry'?: FormatRegistry;
  /** Custom keyword definitions passed to the graph engine. */
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
  /** When true, validate that $schema references draft 2020-12. */
  'strict'?: boolean;
}
