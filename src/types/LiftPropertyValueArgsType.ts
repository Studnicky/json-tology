import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { RefTargetType } from './RefTargetType.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';
import type { LiftContextType } from './LiftContextType.js';

/** Arguments for lifting a single property's matching quads. */
export type LiftPropertyValueArgsType = {
  readonly 'classId': string;
  readonly 'ctx': LiftContextType;
  readonly 'index': PredicateIndexType | undefined;
  readonly 'propEntry': RefTargetType;
  readonly 'propName': string;
  readonly 'subjectIri': string;
  readonly 'subjectQuads': QuadInterface[];
};
