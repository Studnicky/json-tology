import type { KeywordDefinitionType } from './GraphEngine.js';

export type CustomKeywordEntryType = {
  readonly 'allowedTypes': string[] | undefined;
  readonly 'keyword': string;
  readonly 'schemaValue': unknown;
  readonly 'validate': KeywordDefinitionType['validate'];
};
