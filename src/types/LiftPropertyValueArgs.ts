import type { QuadInterface } from '../interfaces/Quad.js';
import type { RefTargetType } from './RefTarget.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';
import type { LiftContextType } from './LiftContext.js';

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
