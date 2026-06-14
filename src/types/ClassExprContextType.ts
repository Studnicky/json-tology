/**
 * ClassExprContextType — shared context for per-subject class expression handlers
 * in the ClassExpressions dispatcher.
 */

import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export type ClassExprContextType = {
  readonly 'allClassIris': ReadonlySet<string>;
  readonly 'graph': SchemaGraphInterface;
  readonly 'reportUnsupported': (axiomIri: string, subjectIri: string) => void;
  readonly 'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
};
