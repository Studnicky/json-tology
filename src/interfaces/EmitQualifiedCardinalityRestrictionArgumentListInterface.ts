import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';
import type { ProjectionEmitContextInterface } from './ProjectionEmitContextInterface.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { IriEntity } from '../entities/IriEntity.js';

/** Arguments for emitQualifiedCardinalityRestriction. */
export interface EmitQualifiedCardinalityRestrictionArgumentListInterface {
  'cardinalityPredicate': IriEntity.Type;
  'containsIriObject': QuadObjectType;
  'context': ProjectionEmitContextInterface;
  'onProp': IriEntity.Type;
  'rels': SchemaGraphRelationInterface[];
  'subject': IriEntity.Type;
}
