import type {
  KeywordDefinitionType
} from '../types/GraphEngine.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { JsonSchemaDocumentType } from '../types/Schema.js';

export interface GraphEngineInterface {
  readonly 'formatRegistry': FormatRegistryInterface;
  graphLookup(): ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  hasRegisteredCustomKeywords(): boolean;
  keywords(): KeywordDefinitionType[];
  readonly 'rootSchema': JsonSchemaDocumentType;
  rootSchemaId(): string | undefined;
  schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined;
}
