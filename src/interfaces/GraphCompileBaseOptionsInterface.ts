/**
 * GraphCompileBaseOptionsInterface — generic base for compile-context option bundles.
 *
 * Parameterised over the compiler context type TContext so plan-level and
 * graph-level compile options can share the common formatRegistry / graph /
 * lookupSchema fields without duplicating them.
 */

import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

export interface GraphCompileBaseOptionsInterface<TContext> {
  /** The compiler context providing validator/check builder methods. */
  'context': TContext;
  /** The format validator registry. */
  'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  'lookupSchema'?: LookupSchemaFunctionInterface;
}
