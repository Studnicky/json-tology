import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { KeywordDefinitionType } from './GraphEngine.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { ValidateWithErrorsFnType } from '../types/Validation.js';

export type SchemaCompilerValidatePlanContextType = {
  readonly 'activeCustomKeywords': KeywordDefinitionType[];
  readonly 'appliesFormatAssertions': (sem: SchemaGraphSemanticsType) => boolean;
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
  readonly 'synthesizeZeroValue': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph: ((id: string) => SchemaGraphInterface | undefined) | undefined
  ) => unknown;
};
