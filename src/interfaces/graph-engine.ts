import type { FormatRegistryInterface } from './format-registry.js';
import type { SchemaGraphInterface } from './schema-graph-impl.js';
import type { ValidationErrorType } from '../types/validation.js';
import type { SchemaGraphNodeInterface } from './schema-graph.js';

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
  'applyDefaults'?: boolean;
  'coerce'?: boolean;
  'collectErrors'?: boolean;
  'formatRegistry'?: FormatRegistryInterface;
  'ignoreAdditionalProperties'?: boolean;
  'keywords'?: KeywordDefinitionInterface[];
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: boolean;
  'removeAdditional'?: boolean;
  'stripUnknownProperties'?: boolean;
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
