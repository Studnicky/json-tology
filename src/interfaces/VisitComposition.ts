/**
 * VisitCompositionInterface — static contract for VisitComposition.
 *
 * Captures the public static surface of VisitComposition as a named type so
 * that consumers can depend on the interface rather than the concrete class.
 */

import type { ValidationErrorType } from '../types/Validation.js';
import type { VisitFnType } from '../types/VisitFn.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type { SchemaGraphNodeType } from '../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { CompositionAccumulatorType } from '../types/CompositionAccumulator.js';
import type { DynamicScopeEntryType } from '../types/DynamicScopeEntry.js';
import type { InternalExecutionResultType } from '../types/InternalExecutionResult.js';
import type { VisitContextType } from '../types/VisitContext.js';

export interface VisitCompositionInterface {
  allOf(
    context: VisitContextType,
    allOf: SchemaGraphNodeType[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorType,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): InternalExecutionResultType | undefined;

  anyOf(
    context: VisitContextType,
    anyOf: SchemaGraphNodeType[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorType,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultType
  ): InternalExecutionResultType | undefined;

  ifThenElse(
    context: VisitContextType,
    ifNode: SchemaGraphNodeType,
    thenNode: SchemaGraphNodeType | undefined,
    elseNode: SchemaGraphNodeType | undefined,
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorType,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): InternalExecutionResultType | undefined;

  not(
    context: VisitContextType,
    complementNode: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultType
  ): InternalExecutionResultType | undefined;

  oneOf(
    context: VisitContextType,
    oneOf: SchemaGraphNodeType[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorType,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultType,
    discriminatorPropertyName: string | undefined,
    discriminatorMapping: Record<string, string> | undefined
  ): InternalExecutionResultType | undefined;
}
