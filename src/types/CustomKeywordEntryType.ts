import type { KeywordDefinitionType } from './GraphEngine.js';
import type { IdentityType } from './IdentityType.js';

export type CustomKeywordEntryType = IdentityType<{
  'allowedTypes': string[] | undefined;
  'keyword': string;
  'schemaValue': unknown;
  'validate': KeywordDefinitionType['validate'];
}>;
