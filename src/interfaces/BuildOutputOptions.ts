import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

/** @internal — CLI build output options shape; not part of the public package surface. */
export interface BuildOutputOptionsInterface {
  readonly 'baseIRI': string;
  readonly 'graphs': readonly SchemaGraphInterface[];
  readonly 'output': string;
  readonly 'outputFile': string | undefined;
}
