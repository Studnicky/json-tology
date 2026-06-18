import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/** @internal — CLI build output options shape; not part of the public package surface. */
export type BuildOutputOptionsType = {
  readonly 'baseIRI': string;
  readonly 'graphs': readonly SchemaGraphInterface[];
  readonly 'output': string;
  readonly 'outputFile': string | undefined;
};
