import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/** @internal — CLI build output options shape; not part of the public package surface. */
export type BuildOutputOptionsType = {
  'baseIri': string;
  'graphs': readonly SchemaGraphInterface[];
  'output': string;
  'outputFile': string | undefined;
};
