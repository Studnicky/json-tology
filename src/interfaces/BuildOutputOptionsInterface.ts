import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** @internal — CLI build output options shape; not part of the public package surface. */
export interface BuildOutputOptionsInterface {
  'baseIri': StringValueEntity.Type;
  'graphs': SchemaGraphInterface[];
  'output': StringValueEntity.Type;
  'outputFile': string | undefined;
}
