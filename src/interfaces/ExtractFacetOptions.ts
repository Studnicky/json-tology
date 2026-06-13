/**
 * ExtractFacetOptions — options for extracting a facet patch from one
 * blank-node descriptor in the Datatypes dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface ExtractFacetOptions {
  'bnodeId': string;
  'graph': SchemaGraphInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
  'schemaType': 'boolean' | 'integer' | 'number' | 'string' | undefined;
}
