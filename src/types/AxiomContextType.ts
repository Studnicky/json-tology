/**
 * AxiomContextType — shared mutable state threaded through axiom-arm helpers in
 * the ClassAxioms dispatcher.
 */

import type { InvariantType } from './Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export type AxiomContextType = {
  'allClassIris': ReadonlySet<string>;
  'invariants': Array<{ 'invariant': InvariantType;
    'schemaId': string }>;
  'resolveIri': (target: string | { 'id': string }) => string;
  'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
};
