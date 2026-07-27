import type { QuadInterface } from './QuadInterface.js';
import type { ReferenceTargetInterface } from './ReferenceTargetInterface.js';
import type { PredicateIndexInterface } from './PredicateIndexInterface.js';
import type { LiftContextInterface } from './LiftContextInterface.js';
import type { IriEntity } from '../entities/IriEntity.js';
import type { PropertyNameEntity } from '../entities/PropertyNameEntity.js';

/** Arguments for lifting a single property's matching quads. */
export interface LiftPropertyValueArgumentListInterface {
  'classId': IriEntity.Type;
  'context': LiftContextInterface;
  'index': PredicateIndexInterface | undefined;
  'propEntry': ReferenceTargetInterface;
  'propName': PropertyNameEntity.Type;
  'subjectIri': IriEntity.Type;
  'subjectQuads': QuadInterface[];
}
