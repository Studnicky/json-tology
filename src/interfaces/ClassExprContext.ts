/**
 * ClassExprContext — shared context for per-subject class expression handlers
 * in the ClassExpressions dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export interface ClassExprContext {
  readonly 'allClassIris': ReadonlySet<string>;
  readonly 'graph': SchemaGraphInterface;
  readonly 'reportUnsupported': (axiomIri: string, subjectIri: string) => void;
  readonly 'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
}
