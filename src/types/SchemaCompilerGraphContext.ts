import type { CompiledValidatorType } from './Compiler.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { KeywordDefinitionType } from './GraphEngine.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { CheckFnType } from '../types/Validation.js';

export type SchemaCompilerGraphContextType = {
  readonly 'activeCustomKeywords': KeywordDefinitionType[];
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
  readonly 'compilingNodes': Set<SchemaGraphNodeType>;
  readonly 'lookupCompiled': ((schemaId: string) => CompiledValidatorType | undefined) | undefined;
};
