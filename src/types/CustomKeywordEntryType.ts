import type { KeywordDefinitionType } from './GraphEngine.js';

export type CustomKeywordEntryType = {
  'allowedTypes': string[] | undefined;
  'keyword': string;
  'schemaValue': unknown;
  'validate': KeywordDefinitionType['validate'];
};
