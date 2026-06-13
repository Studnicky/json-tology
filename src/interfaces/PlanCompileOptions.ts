/**
 * PlanCompileOptions — shared compilation-context options for plan-level validate helpers.
 *
 * Groups the four parameters that every plan-level validator builder receives,
 * reducing function arity and enabling cohesive parameter passing.
 */

import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContext.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';
import type { SchemaGraphSemanticsInterface } from './SchemaGraph.js';

export interface PlanCompileOptionsInterface {
  /** The plan compilation context providing validator-builder methods. */
  readonly 'context': SchemaCompilerValidatePlanContextInterface;
  /** The format validator registry. */
  readonly 'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  readonly 'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  readonly 'lookupSchema'?: LookupSchemaFnType;
}

export interface PlanCompileWithSemanticsInterface {
  /** The plan compilation context providing validator-builder methods. */
  readonly 'context': SchemaCompilerValidatePlanContextInterface;
  /** The format validator registry. */
  readonly 'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  readonly 'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  /** The schema graph semantics used during plan compilation. */
  readonly 'sem': SchemaGraphSemanticsInterface;
}
