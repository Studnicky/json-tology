/**
 * ClassExprResolveContext — shared resolution context for OWL class expression traversal.
 *
 * Carries the known class IRI set, recursion depth, and schema graph shared
 * by all class-expression resolver helpers in ClassExpressions.ts.
 */

import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface ClassExprResolveContextInterface {
  /** All known class IRIs in the import context, used for $ref resolution. */
  readonly 'allClassIris': ReadonlySet<string>;
  /** Current recursion depth — guards against infinite blank-node cycles. */
  readonly 'depth': number;
  /** The schema graph being traversed. */
  readonly 'graph': SchemaGraphInterface;
}
