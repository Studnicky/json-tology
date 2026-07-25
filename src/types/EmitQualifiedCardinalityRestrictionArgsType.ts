import type { ProjectionEmitContextType } from './ProjectionEmitContextType.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';
import type { QuadObjectType } from './Quad.js';

/** Arguments for emitQualifiedCardinalityRestriction. */
export type EmitQualifiedCardinalityRestrictionArgumentListType = {
  'cardinalityPredicate': string;
  'containsIriObject': QuadObjectType;
  'context': ProjectionEmitContextType;
  'onProp': string;
  'rels': SchemaGraphRelationType[];
  'subject': string;
};
