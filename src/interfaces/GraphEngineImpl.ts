import type { ValidationErrorType } from '../types/Validation.js';
import type {
  GraphEngineOptionsInterface, GraphExecutionResultInterface,
  KeywordDefinitionInterface
} from './GraphEngine.js';
import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { JSONSchema7Definition } from 'json-schema';

export interface GraphEngineInterface {
  check(value: unknown, options?: { 'pointer'?: string }): boolean;
  errors(value: unknown, options?: { 'pointer'?: string }): ValidationErrorType[];
  execute(
    value: unknown,
    options?: { 'overrides'?: Partial<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'lookupSchema'>>
      'pointer'?: string; }
  ): GraphExecutionResultInterface;
  readonly 'formatRegistry': FormatRegistryInterface;
  hasRegisteredCustomKeywords(): boolean;
  keywords(): KeywordDefinitionInterface[];
  readonly 'rootSchema': JSONSchema7Definition;
  rootSchemaId(): string | undefined;
  schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined;
}
