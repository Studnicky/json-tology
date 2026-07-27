/**
 * ApplyRestrictionsOptionsInterface — options for applying XSD facet restrictions to
 * a schema delta record in the Datatypes dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

export interface ApplyRestrictionsOptionsInterface {
  'delta': Record<string, unknown>;
  'graph': SchemaGraphInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
  'schemaType': 'boolean' | 'integer' | 'number' | 'string' | undefined;
  'subjectIri': StringValueEntity.Type;
}
