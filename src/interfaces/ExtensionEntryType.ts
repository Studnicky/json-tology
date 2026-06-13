import type { KeywordDefinitionInterface } from './GraphEngine.js';

/** A typed entry used in the extension-keyword check list. */
export interface ExtensionEntryType {
  'allowedTypes': string[] | undefined;
  'keyword': string;
  'schemaValue': unknown;
  'validate': KeywordDefinitionInterface['validate'];
}
