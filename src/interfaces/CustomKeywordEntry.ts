import type { KeywordDefinitionInterface } from './GraphEngine.js';

export interface CustomKeywordEntryInterface {
  readonly 'allowedTypes': string[] | undefined;
  readonly 'keyword': string;
  readonly 'schemaValue': unknown;
  readonly 'validate': KeywordDefinitionInterface['validate'];
}
