import type { SchemaGraphSemanticsInterface } from './SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { KeywordDefinitionInterface } from './KeywordDefinitionInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';

export interface SchemaCompilerValidatePlanContextInterface {
  'activeCustomKeywords': KeywordDefinitionInterface[];
  'appliesFormatAssertions': (sem: SchemaGraphSemanticsInterface) => boolean;
  'compileNodeOrBooleanValidateWithErrors': (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFunctionInterface;
  'compileNodeValidateWithErrors': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => ValidateWithErrorsFunctionInterface;
  'resolveImplicitDefault': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ) => unknown;
  'synthesizeZeroValue': (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph: ((id: string) => SchemaGraphInterface | undefined) | undefined
  ) => unknown;
}
