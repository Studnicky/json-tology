/**
 * AxiomContextInterface — shared mutable state threaded through axiom-arm helpers in
 * the ClassAxioms dispatcher.
 */

import type { InvariantType } from '../types/Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { IdReferenceEntity } from '../entities/IdReferenceEntity.js';

export interface AxiomContextInterface {
  'allClassIris': ReadonlySet<string>;
  'invariants': Array<{ 'invariant': InvariantType;
    'schemaId': string }>;
  'resolveIri': (target: IdReferenceEntity.Type | string) => string;
  'schemaDeltas': Map<string, JsonSchemaDocumentObjectType>;
}
