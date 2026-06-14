/**
 * AxiomContextType — shared mutable state threaded through axiom-arm helpers in
 * the ClassAxioms dispatcher.
 */

import type { InvariantType } from './Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export type AxiomContextType = {
  readonly 'allClassIris': ReadonlySet<string>;
  readonly 'invariants': Array<{ 'invariant': InvariantType;
    'schemaId': string }>;
  readonly 'resolveIri': (target: string | { 'id': string }) => string;
  readonly 'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
};
