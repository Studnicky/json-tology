import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';
import type { QuadObjectType } from './Quad.js';

/** Arguments for emitQualifiedCardinalityRestriction. */
export type EmitQualifiedCardinalityRestrictionArgsType = {
  'cardinalityPredicate': string;
  'containsIriObject': QuadObjectType;
  'ctx': ProjectionEmitContextType;
  'onProp': string;
  'rels': SchemaGraphRelationType[];
  'subject': string;
};
