import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { KeywordDefinitionType } from './GraphEngine.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { ValidateWithErrorsFunctionType } from '../types/Validation.js';

export type SchemaCompilerValidatePlanContextType = {
  'activeCustomKeywords': KeywordDefinitionType[];
  'appliesFormatAssertions': (sem: SchemaGraphSemanticsType) => boolean;
  'compileNodeOrBooleanValidateWithErrors': (
    node: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFunctionType;
  'compileNodeValidateWithErrors': (
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFunctionType;
  'resolveImplicitDefault': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ) => unknown;
  'synthesizeZeroValue': (
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph: ((id: string) => SchemaGraphInterface | undefined) | undefined
  ) => unknown;
};
