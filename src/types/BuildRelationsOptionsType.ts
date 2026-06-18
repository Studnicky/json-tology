import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type {
  SubjectIndexType, SubjectPredicateQuadsIndexType
} from '../types/QuadBackedSchemaGraph.js';

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
export type BuildRelationsOptionsType = {
  readonly 'curie': CurieInterface;
  readonly 'nodeMap': Map<string, SchemaGraphNodeType>;
  readonly 'predicateIndex': SubjectPredicateQuadsIndexType;
  readonly 'stubMap': Map<string, SchemaGraphNodeType>;
  readonly 'subjectIndex': SubjectIndexType;
};
