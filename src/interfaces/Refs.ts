/**
 * RefsInterface — static contract for Refs.
 *
 * Captures the public static surface of Refs as a named type so that
 * consumers can depend on the interface rather than the concrete class.
 */

import type { VisitFnType } from '../types/VisitFn.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { DynamicScopeEntryType } from '../types/DynamicScopeEntry.js';
import type { InternalExecutionResultType } from '../types/InternalExecutionResult.js';
import type { VisitContextType } from '../types/VisitContext.js';

export interface RefsInterface {
  resolveDynamicRef(
    context: VisitContextType,
    dynamicRef: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultType;

  resolveRef(
    context: VisitContextType,
    ref: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultType;
}
