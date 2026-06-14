import type { ValidationErrorType } from '../types/Validation.js';
import type {
  GraphEngineOptionsType, GraphExecutionResultType,
  KeywordDefinitionType
} from '../types/GraphEngine.js';
import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { JsonSchemaDocumentType } from '../types/Schema.js';

export interface GraphEngineInterface {
  check(value: unknown, options?: { 'pointer'?: string }): boolean;
  errors(value: unknown, options?: { 'pointer'?: string }): ValidationErrorType[];
  execute(
    value: unknown,
    options?: { 'overrides'?: Partial<Omit<GraphEngineOptionsType, 'formatRegistry' | 'lookupSchema'>>
      'pointer'?: string; }
  ): GraphExecutionResultType;
  readonly 'formatRegistry': FormatRegistryInterface;
  graphLookup(): ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  hasRegisteredCustomKeywords(): boolean;
  keywords(): KeywordDefinitionType[];
  readonly 'rootSchema': JsonSchemaDocumentType;
  rootSchemaId(): string | undefined;
  schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined;
}
