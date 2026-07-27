import type { IdentifierIssuerInterface } from './IdentifierIssuerInterface.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { QuadEmitBaseInterface } from './QuadEmitBaseInterface.js';
import type { IriEntity } from '../entities/IriEntity.js';

/** Arguments for emitRestriction. */
export interface EmitRestrictionArgumentListInterface extends QuadEmitBaseInterface {
  /** The OWL restriction predicate IRI (e.g. `owl:minCardinality`, `owl:allValuesFrom`). */
  'constraint': IriEntity.Type;
  'constraintValue': QuadObjectType;
  'issuer'?: IdentifierIssuerInterface | undefined;
  'onProperty': IriEntity.Type;
}
