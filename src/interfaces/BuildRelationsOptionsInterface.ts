import type { SubjectPredicateQuadsIndexInterface } from './SubjectPredicateQuadsIndexInterface.js';
import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SubjectIndexInterface } from './SubjectIndexInterface.js';

/**
 * Options for {@link buildRelations}.
 *
 * @remarks
 * Bundles the parameters needed to build schema graph relations, satisfying
 * the 3-parameter limit.
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface BuildRelationsOptionsInterface {
  'curie': CurieInterface;
  'nodeMap': Map<string, SchemaGraphNodeInterface>;
  'predicateIndex': SubjectPredicateQuadsIndexInterface;
  'stubMap': Map<string, SchemaGraphNodeInterface>;
  'subjectIndex': SubjectIndexInterface;
}
