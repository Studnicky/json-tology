/**
 * ApplyRestrictionsOptionsType — options for applying XSD facet restrictions to
 * a schema delta record in the Datatypes dispatcher.
 */

import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

export type ApplyRestrictionsOptionsType = {
  'delta': Record<string, unknown>;
  'graph': SchemaGraphInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
  'schemaType': 'boolean' | 'integer' | 'number' | 'string' | undefined;
  'subjectIri': string;
};
