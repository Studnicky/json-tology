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
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: boolean;
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
