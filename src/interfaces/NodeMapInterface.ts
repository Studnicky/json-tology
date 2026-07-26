import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';

/**
 * Maps subject IRIs to their corresponding stub `SchemaGraphNodeInterface`
 * objects for all recognised OWL-typed subjects.
 *
 * @remarks
 * Only subjects with a recognised OWL type assertion appear as entries.
 * Blank nodes and ontology-declaration-only subjects are indexed but not
 * exposed as primary nodes.
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface NodeMapInterface extends Map<string, SchemaGraphNodeInterface> {}
