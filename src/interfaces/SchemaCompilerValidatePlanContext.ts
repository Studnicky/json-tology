import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';

export interface SchemaCompilerValidatePlanContextInterface {
  readonly 'activeCustomKeywords': KeywordDefinitionInterface[];
  readonly 'appliesFormatAssertions': (sem: SchemaGraphSemanticsInterface) => boolean;
  readonly 'compileNodeCheck': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeOrBooleanCheck': (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeOrBooleanValidateWithErrors': (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFnType;
  readonly 'compileNodeValidateWithErrors': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFnType;
  readonly 'resolveImplicitDefault': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ) => unknown;
}
