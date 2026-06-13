/**
 * ApplyRestrictionsOptions — options for applying XSD facet restrictions to
 * a schema delta record in the Datatypes dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface ApplyRestrictionsOptions {
  readonly 'delta': Record<string, unknown>;
  readonly 'graph': SchemaGraphInterface;
  readonly 'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
  readonly 'schemaType': 'boolean' | 'integer' | 'number' | 'string' | undefined;
  readonly 'subjectIri': string;
}
