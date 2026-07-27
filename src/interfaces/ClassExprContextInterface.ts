/**
 * ClassExprContextInterface — shared context for per-subject class expression handlers
 * in the ClassExpressions dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export interface ClassExprContextInterface {
  'allClassIris': ReadonlySet<string>;
  'graph': SchemaGraphInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: string) => void;
  'schemaDeltas': Map<string, JsonSchemaDocumentObjectType>;
}
