/**
 * RefsInterface — static contract for Refs.
 *
 * Captures the public static surface of Refs as a named type so that
 * consumers can depend on the interface rather than the concrete class.
 */

import type { VisitFnType } from '../types/VisitFn.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { DynamicScopeEntryInterface } from '../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../interfaces/InternalExecutionResult.js';
import type { VisitContextInterface } from '../interfaces/VisitContext.js';

export interface RefsInterface {
  resolveDynamicRef(
    context: VisitContextInterface,
    dynamicRef: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultInterface;

  resolveRef(
    context: VisitContextInterface,
    ref: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultInterface;
}
