import type { SchemaLoadResultType } from '../types/loader.js';

export interface SchemaLoaderInterface {
  loadDirectory(
    dirPath: string,
    options?: {
      'filePattern'?: RegExp;
      'stopOnError'?: boolean;
    }
  ): [schemas: Array<Record<string, unknown>>, result: SchemaLoadResultType];
  loadSchema(filePath: string): null | Record<string, unknown>;
}
