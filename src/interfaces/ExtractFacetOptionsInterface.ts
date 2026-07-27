import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * ExtractFacetOptionsInterface — options for extracting a facet patch from one
 * blank-node descriptor in the Datatypes dispatcher.
 */
export interface ExtractFacetOptionsInterface {
  'bnodeId': StringValueEntity.Type;
  'graph': SchemaGraphInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
  'schemaType': 'boolean' | 'integer' | 'number' | 'string' | undefined;
}
