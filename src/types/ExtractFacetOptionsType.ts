/**
 * ExtractFacetOptionsType — options for extracting a facet patch from one
 * blank-node descriptor in the Datatypes dispatcher.
 */

import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

export type ExtractFacetOptionsType = {
  'bnodeId': string;
  'graph': SchemaGraphInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
  'schemaType': 'boolean' | 'integer' | 'number' | 'string' | undefined;
};
