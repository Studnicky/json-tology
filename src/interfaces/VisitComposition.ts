/**
 * VisitCompositionInterface — static contract for VisitComposition.
 *
 * Captures the public static surface of VisitComposition as a named type so
 * that consumers can depend on the interface rather than the concrete class.
 */

import type { ValidationErrorType } from '../types/Validation.js';
import type { VisitFnType } from '../types/VisitFn.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type { SchemaGraphNodeInterface } from '../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { CompositionAccumulatorInterface } from '../interfaces/CompositionAccumulator.js';
import type { DynamicScopeEntryInterface } from '../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../interfaces/InternalExecutionResult.js';
import type { VisitContextInterface } from '../interfaces/VisitContext.js';

export interface VisitCompositionInterface {
  allOf(
    context: VisitContextInterface,
    allOf: SchemaGraphNodeInterface[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): InternalExecutionResultInterface | undefined;

  anyOf(
    context: VisitContextInterface,
    anyOf: SchemaGraphNodeInterface[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultInterface
  ): InternalExecutionResultInterface | undefined;

  ifThenElse(
    context: VisitContextInterface,
    ifNode: SchemaGraphNodeInterface,
    thenNode: SchemaGraphNodeInterface | undefined,
    elseNode: SchemaGraphNodeInterface | undefined,
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    pushErrors: (errors: ValidationErrorType[]) => void
  ): InternalExecutionResultInterface | undefined;

  not(
    context: VisitContextInterface,
    complementNode: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultInterface
  ): InternalExecutionResultInterface | undefined;

  oneOf(
    context: VisitContextInterface,
    oneOf: SchemaGraphNodeInterface[],
    graph: SchemaGraphInterface,
    acc: CompositionAccumulatorInterface,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType,
    invalid: (error: ValidationErrorType) => InternalExecutionResultInterface,
    discriminatorPropertyName: string | undefined,
    discriminatorMapping: Record<string, string> | undefined
  ): InternalExecutionResultInterface | undefined;
}
