/**
 * ClassExprResolveContext — shared resolution context for OWL class expression traversal.
 *
 * Carries the known class IRI set, recursion depth, and schema graph shared
 * by all class-expression resolver helpers in ClassExpressions.ts.
 */

import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

export type ClassExprResolveContextType = {
  /** All known class IRIs in the import context, used for $ref resolution. */
  'allClassIris': ReadonlySet<string>;
  /** Current recursion depth — guards against infinite blank-node cycles. */
  'depth': number;
  /** The schema graph being traversed. */
  'graph': SchemaGraphInterface;
};
