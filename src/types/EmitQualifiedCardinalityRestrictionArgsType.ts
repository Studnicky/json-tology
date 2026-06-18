import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';
import type { QuadObjectType } from './Quad.js';

/** Arguments for emitQualifiedCardinalityRestriction. */
export type EmitQualifiedCardinalityRestrictionArgsType = {
  readonly 'cardinalityPredicate': string;
  readonly 'containsIriObject': QuadObjectType;
  readonly 'ctx': ProjectionEmitContextType;
  readonly 'onProp': string;
  readonly 'rels': readonly SchemaGraphRelationType[];
  readonly 'subject': string;
};
