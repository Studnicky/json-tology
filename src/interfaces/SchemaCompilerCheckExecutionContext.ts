import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { KeywordDefinitionInterface } from './GraphEngine.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { CheckFnType } from '../types/Validation.js';

export interface SchemaCompilerCheckExecutionContextInterface {
  readonly 'activeCustomKeywords': KeywordDefinitionInterface[];
  readonly 'compileNodeArrayCheck': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
  readonly 'compileNodeCheck': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeObjectCheck': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
  readonly 'compileNodeOrBooleanCheck': (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNumberCheck': (
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ) => CheckFnType | undefined;
  readonly 'compileRefCheck': (
    ref: string,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
  readonly 'compileStringCheck': (
    minLength: number | undefined,
    maxLength: number | undefined,
    pattern: string | undefined,
    format: string | undefined,
    formatRegistry: FormatRegistryInterface,
    sem: ReturnType<SchemaGraphInterface['semantics']>
  ) => CheckFnType | undefined;
  readonly 'compileTypeCheck': (types: string[]) => CheckFnType;
  readonly 'tryCompileNodeFlatObjectCheck': (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
}
