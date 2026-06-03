/**
 * GraphCompileOptions — shared compilation-context options for graph-level check helpers.
 *
 * Groups the four parameters that every graph-level check compiler receives,
 * reducing function arity and enabling cohesive parameter passing.
 */

import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { SchemaCompilerGraphContextInterface } from './SchemaCompilerGraphContext.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

export interface GraphCompileOptionsInterface {
  /** The compiler context providing node-check builder methods. */
  readonly 'context': SchemaCompilerGraphContextInterface;
  /** The format validator registry. */
  readonly 'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  readonly 'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  readonly 'lookupSchema'?: LookupSchemaFnType;
}
