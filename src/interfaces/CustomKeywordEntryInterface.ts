import type { KeywordDefinitionInterface } from './KeywordDefinitionInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Compiled descriptor for one active custom keyword bound to a schema node.
 */
export interface CustomKeywordEntryInterface {
  'allowedTypes': string[] | undefined;
  'keyword': StringValueEntity.Type;
  'schemaValue': unknown;
  'validate': KeywordDefinitionInterface['validate'];
}
