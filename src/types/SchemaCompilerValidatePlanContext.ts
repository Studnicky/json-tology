import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { KeywordDefinitionType } from './GraphEngine.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';

export type SchemaCompilerValidatePlanContextType = {
  readonly 'activeCustomKeywords': KeywordDefinitionType[];
  readonly 'appliesFormatAssertions': (sem: SchemaGraphSemanticsType) => boolean;
  readonly 'compileNodeCheck': (
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeOrBooleanCheck': (
    node: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeOrBooleanValidateWithErrors': (
    node: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFnType;
  readonly 'compileNodeValidateWithErrors': (
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFnType;
  readonly 'resolveImplicitDefault': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ) => unknown;
};
