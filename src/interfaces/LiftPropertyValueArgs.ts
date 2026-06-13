import type { QuadInterface } from './Quad.js';
import type { ResolvedRefInterface } from './ResolvedRef.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';
import type { LiftContextInterface } from './LiftContext.js';

/** Arguments for lifting a single property's matching quads. */
export interface LiftPropertyValueArgsInterface {
  readonly 'classId': string;
  readonly 'ctx': LiftContextInterface;
  readonly 'index': PredicateIndexType | undefined;
  readonly 'propEntry': ResolvedRefInterface;
  readonly 'propName': string;
  readonly 'subjectIri': string;
  readonly 'subjectQuads': QuadInterface[];
}
