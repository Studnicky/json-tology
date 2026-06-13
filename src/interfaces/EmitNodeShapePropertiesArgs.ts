import type { ProjectionEmitContextInterface } from './ProjectionEmitContext.js';
import type { RelationIndexInterface } from './RelationIndex.js';

/** Arguments for emitNodeShapeProperties. */
export interface EmitNodeShapePropertiesArgsInterface {
  readonly 'ctx': ProjectionEmitContextInterface;
  readonly 'entry': RelationIndexInterface;
  readonly 'propertyIndex': Map<string, string[]>;
  readonly 'subject': string;
}
