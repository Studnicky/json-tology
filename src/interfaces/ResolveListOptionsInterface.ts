/**
 * ResolveListOptionsInterface — options for walking an RDF list and resolving each
 * member in the ClassExpressions dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { IriEntity } from '../entities/IriEntity.js';

export interface ResolveListOptionsInterface {
  /** All known class IRIs in the import context, used for $ref resolution. */
  'allClassIris': ReadonlySet<string>;
  /** Current recursion depth — guards against infinite blank-node cycles. */
  'depth': NumberValueEntity.Type;
  /** The schema graph being traversed. */
  'graph': SchemaGraphInterface;
  'listHead': IriEntity.Type;
}
