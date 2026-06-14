import type { KeywordDefinitionType } from './GraphEngine.js';

/** A typed entry used in the extension-keyword check list. */
export type ExtensionEntryType = {
  'allowedTypes': string[] | undefined;
  'keyword': string;
  'schemaValue': unknown;
  'validate': KeywordDefinitionType['validate'];
};
