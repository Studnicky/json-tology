import type { QuadInterface } from './QuadInterface.js';
import type { PredicateIndexInterface } from './PredicateIndexInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for finding quads matching a schema property predicate. */
export interface FindPropertyQuadsArgumentListInterface {
  'index': PredicateIndexInterface | undefined;
  'predicateIri': StringValueEntity.Type;
  'propName': StringValueEntity.Type;
  'subjectQuads': QuadInterface[];
}
