import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SubjectPredicateQuadsIndexType } from '../types/QuadBackedSchemaGraph.js';
import type { SubjectIndexType } from '../types/OwlImport.js';

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
  'curie': CurieInterface;
  'nodeMap': Map<string, SchemaGraphNodeType>;
  'predicateIndex': SubjectPredicateQuadsIndexType;
  'stubMap': Map<string, SchemaGraphNodeType>;
  'subjectIndex': SubjectIndexType;
};
