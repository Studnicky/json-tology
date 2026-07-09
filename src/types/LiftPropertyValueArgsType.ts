import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { RefTargetType } from './RefTargetType.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';
import type { LiftContextType } from './LiftContextType.js';

/** Arguments for lifting a single property's matching quads. */
export type LiftPropertyValueArgsType = {
  'classId': string;
  'ctx': LiftContextType;
  'index': PredicateIndexType | undefined;
  'propEntry': RefTargetType;
  'propName': string;
  'subjectIri': string;
  'subjectQuads': QuadInterface[];
};
