import type { DatatypeIndexInterface } from './DatatypeIndexInterface.js';
import type { NodeShapeIndexInterface } from './NodeShapeIndexInterface.js';
import type { SubjectPredicateIndexInterface } from './SubjectPredicateIndexInterface.js';
import type { TypeIndexInterface } from './TypeIndexInterface.js';

/**
 * Shared validation context threaded through every evaluator. `resolveShape`
 * returns the parsed view for any shape id (named NodeShape or anonymous
 * blank-node member shape), and `visited` guards `sh:node`/`sh:and`/`sh:or`/
 * `sh:not` recursion against cyclic data so a self-referential graph cannot
 * overflow the stack.
 */
export interface ValidationContextInterface {
  'dataIndex': SubjectPredicateIndexInterface;
  'datatypeBySubjectPredicate': DatatypeIndexInterface;
  'dataTypeIndex': TypeIndexInterface;
  'resolveShape': (shapeId: string) => NodeShapeIndexInterface | undefined;
  'shapeIndex': SubjectPredicateIndexInterface;
  'visited': Set<string>;
}
