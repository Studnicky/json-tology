import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { KeywordDefinitionType } from './GraphEngine.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { CheckFnType } from '../types/Validation.js';

export type SchemaCompilerCheckExecutionContextType = {
  readonly 'activeCustomKeywords': KeywordDefinitionType[];
  readonly 'compileNodeArrayCheck': (
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
  readonly 'compileNodeCheck': (
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType;
  readonly 'compileNodeObjectCheck': (
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
  readonly 'compileNodeOrBooleanCheck': (
    node: SchemaGraphNodeType,
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
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ) => CheckFnType | undefined;
};
