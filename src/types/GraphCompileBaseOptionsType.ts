/**
 * GraphCompileBaseOptionsType — generic base for compile-context option bundles.
 *
 * Parameterised over the compiler context type TContext so plan-level and
 * graph-level compile options can share the common formatRegistry / graph /
 * lookupSchema fields without duplicating them.
 */

import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFunctionType } from '../types/LookupSchemaFunctionType.js';

export type GraphCompileBaseOptionsType<TContext> = Record<never, never> & {
  /** The compiler context providing validator/check builder methods. */
  'context': TContext;
  /** The format validator registry. */
  'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  'lookupSchema'?: LookupSchemaFunctionType;
};
