import type { ValidationErrorType } from '../types/Validation.js';
import type {
  KeywordDefinitionInterface
} from './GraphEngine.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type { DynamicScopeEntryInterface } from './DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from './InternalExecutionResult.js';
import type { RefTargetInterface } from './RefTarget.js';

export interface VisitContextInterface {
  'applyUnevaluatedItems': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    alreadyEvaluated: Set<number>
  ) => InternalExecutionResultInterface;
  'applyUnevaluatedProperties': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    alreadyEvaluated: Set<string>
  ) => InternalExecutionResultInterface;
  'coerceValue': (schemaTypes: string[], value: unknown, materializeContainers: boolean) => unknown;
  'createError': (path: string, keyword: string, message: string, params?: Record<string, unknown>) => ValidationErrorType;
  'customKeywords': KeywordDefinitionInterface[];
  'graphFor': (rootSchema: boolean | Record<string, unknown>) => SchemaGraphInterface;
  'matchesType': (schemaTypes: string[], value: unknown) => boolean;
  'resolveDynamicRef': (ref: string, currentGraph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryInterface[]) => RefTargetInterface;
  'resolveRef': (ref: string, currentGraph: SchemaGraphInterface) => RefTargetInterface;
  'synthesizeZeroValue': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ) => unknown;
  'validateArray': (
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[],
    sem: SchemaGraphSemanticsInterface
  ) => InternalExecutionResultInterface;
  'validateNumber': (path: string, value: number, sem: SchemaGraphSemanticsInterface) => ValidationErrorType[];
  'validateObject': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryInterface[]
  ) => InternalExecutionResultInterface;
  'validateString': (path: string, value: string, sem: SchemaGraphSemanticsInterface) => ValidationErrorType[];
}
