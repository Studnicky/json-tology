import type { QuadInterface } from './QuadInterface.js';

/**
 * Groups quads by subject IRI then by predicate IRI.
 *
 * @remarks
 * Used by `buildNodeMap` and `buildRelations` for O(1) predicate lookup
 * within a given subject's quad set.
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface SubjectPredicateQuadsIndexInterface extends Map<string, Map<string, QuadInterface[]>> {}
