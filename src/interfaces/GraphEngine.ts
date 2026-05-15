import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { ValidationErrorType } from '../types/Validation.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';

export interface KeywordContextInterface {
  'parentData': unknown;
  'parentKey': number | string;
  'path': string;
  'rootData': unknown;
}

export interface KeywordDefinitionInterface {
  'keyword': string;
  'type'?: string | string[];
  'validate': (schema: unknown, data: unknown, context: KeywordContextInterface) => boolean | ValidationErrorType[];
}

export interface GraphEngineOptionsInterface {
  'allowAdditionalProperties'?: boolean;
  'applyDefaults'?: boolean;
  'castTypes'?: boolean;
  'collectErrors'?: boolean;
  'enforceSchemaProperties'?: boolean;
  'formatRegistry'?: FormatRegistryInterface;
  'keywords'?: KeywordDefinitionInterface[];
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: boolean;
  /**
   * Maximum recursion depth for schema traversal during validation.
   * Limits how deeply nested `$ref`, `allOf`, `oneOf`, and other composition
   * keywords can recurse. When exceeded, a `GraphError('RECURSION_LIMIT')` is thrown.
   *
   * Defaults to no limit (`Infinity`). Set a finite value to protect against
   * stack overflow from deeply nested or recursive schemas on deep data.
   */
  'maxSchemaDepth'?: number;
  'removeAdditionalProperties'?: boolean;
  'synthesizeDefaults'?: boolean;
}

export interface GraphExecutionResultInterface {
  'entryNode': SchemaGraphNodeInterface;
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'graph': SchemaGraphInterface;
  'valid': boolean;
  'value': unknown;
}
