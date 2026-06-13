/**
 * AxiomContext — shared mutable state threaded through axiom-arm helpers in
 * the ClassAxioms dispatcher.
 */

import type { InvariantInterface } from './Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export interface AxiomContext {
  readonly 'allClassIris': ReadonlySet<string>;
  readonly 'invariants': Array<{ 'invariant': InvariantInterface;
    'schemaId': string }>;
  readonly 'resolveIri': (target: string | { 'id': string }) => string;
  readonly 'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
}
