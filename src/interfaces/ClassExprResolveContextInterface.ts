/**
 * ClassExprResolveContextInterface — shared resolution context for OWL class expression traversal.
 *
 * Carries the known class IRI set, recursion depth, and schema graph shared
 * by all class-expression resolver helpers in ClassExpressions.ts.
 */

import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';

export interface ClassExprResolveContextInterface {
  /** All known class IRIs in the import context, used for $ref resolution. */
  'allClassIris': ReadonlySet<string>;
  /** Current recursion depth — guards against infinite blank-node cycles. */
  'depth': NumberValueEntity.Type;
  /** The schema graph being traversed. */
  'graph': SchemaGraphInterface;
}
