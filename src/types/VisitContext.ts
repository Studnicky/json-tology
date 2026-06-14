import type { ValidationErrorType } from '../types/Validation.js';
import type {
  KeywordDefinitionType
} from './GraphEngine.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { EffectiveOptionsType } from '../types/EffectiveOptions.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntry.js';
import type { InternalExecutionResultType } from './InternalExecutionResult.js';
import type { RefTargetType } from './RefTarget.js';

export type VisitContextType = {
  'applyUnevaluatedItems': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    alreadyEvaluated: Set<number>,
    depth: number
  ) => InternalExecutionResultType;
  'applyUnevaluatedProperties': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    alreadyEvaluated: Set<string>,
    depth: number
  ) => InternalExecutionResultType;
  'coerceValue': (schemaTypes: string[], value: unknown, materializeContainers: boolean) => unknown;
  'createError': (path: string, keyword: string, message: string, params?: Record<string, unknown>) => ValidationErrorType;
  'customKeywords': KeywordDefinitionType[];
  'graphFor': (rootSchema: boolean | Record<string, unknown>) => SchemaGraphInterface;
  'matchesType': (schemaTypes: string[], value: unknown) => boolean;
  'resolveDynamicRef': (ref: string, currentGraph: SchemaGraphInterface, dynamicScope: DynamicScopeEntryType[]) => RefTargetType;
  'resolveRef': (ref: string, currentGraph: SchemaGraphInterface) => RefTargetType;
  'synthesizeZeroValue': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ) => unknown;
  'validateArray': (
    graph: SchemaGraphInterface,
    value: unknown[],
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    sem: SchemaGraphSemanticsType,
    depth: number
  ) => InternalExecutionResultType;
  'validateNumber': (path: string, value: number, sem: SchemaGraphSemanticsType) => ValidationErrorType[];
  'validateObject': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    value: Record<string, unknown>,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynamicScope: DynamicScopeEntryType[],
    depth: number
  ) => InternalExecutionResultType;
  'validateString': (path: string, value: string, sem: SchemaGraphSemanticsType) => ValidationErrorType[];
};
