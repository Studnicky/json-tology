import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { ReferenceTargetType } from './ReferenceTargetType.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';
import type { LiftContextType } from './LiftContextType.js';

/** Arguments for lifting a single property's matching quads. */
export type LiftPropertyValueArgumentListType = {
  'classId': string;
  'context': LiftContextType;
  'index': PredicateIndexType | undefined;
  'propEntry': ReferenceTargetType;
  'propName': string;
  'subjectIri': string;
  'subjectQuads': QuadInterface[];
};
