import type { ValidationErrorType } from '../types/validation.js';
import type {
  GraphEngineOptionsInterface, GraphExecutionResultInterface,
  KeywordDefinitionInterface
} from './graph-engine.js';
import type { FormatRegistryInterface } from './format-registry.js';
import type { JSONSchema7Definition as JsonSchemaType } from 'json-schema';

export interface GraphEngineInterface {
  check(value: unknown, pointer?: string): boolean;
  errors(value: unknown, pointer?: string): ValidationErrorType[];
  execute(
    value: unknown,
    pointer?: string,
    overrides?: Partial<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'lookupSchema'>>
  ): GraphExecutionResultInterface;
  readonly 'formatRegistry': FormatRegistryInterface;
  hasCustomKeywords(): boolean;
  keywords(): KeywordDefinitionInterface[];
  readonly 'rootSchema': JsonSchemaType;
  rootSchemaId(): string | undefined;
  schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined;
}
