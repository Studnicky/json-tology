import type { ProjectionEmitContextType } from './ProjectionEmitContext.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';
import type { QuadFactory } from '../modules/rdf/QuadFactory.js';

/** Arguments for emitQualifiedCardinalityRestriction. */
export type EmitQualifiedCardinalityRestrictionArgsType = {
  readonly 'cardinalityPredicate': string;
  readonly 'containsIriObject': ReturnType<typeof QuadFactory.iri>;
  readonly 'ctx': ProjectionEmitContextType;
  readonly 'onProp': string;
  readonly 'rels': readonly SchemaGraphRelationType[];
  readonly 'subject': string;
};
