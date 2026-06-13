import type { ProjectionEmitContextInterface } from './ProjectionEmitContext.js';
import type { SchemaGraphRelationInterface } from './SchemaGraph.js';
import type { QuadFactory } from '../modules/rdf/QuadFactory.js';

/** Arguments for emitQualifiedCardinalityRestriction. */
export interface EmitQualifiedCardinalityRestrictionArgsInterface {
  readonly 'cardinalityPredicate': string;
  readonly 'containsIriObject': ReturnType<typeof QuadFactory.iri>;
  readonly 'ctx': ProjectionEmitContextInterface;
  readonly 'onProp': string;
  readonly 'rels': readonly SchemaGraphRelationInterface[];
  readonly 'subject': string;
}
