import type { CompiledValidatorInterface } from './Compiler.js';
import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { CheckFnType } from '../types/Validation.js';

export interface SchemaCompilerGraphContextInterface {
  readonly 'activeCustomKeywords': KeywordDefinitionInterface[];
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
  readonly 'compilingNodes': Set<SchemaGraphNodeInterface>;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
}
