/**
 * ProjectionIndex — shared relation indexing and structure type guards
 * for OwlProjection and ShaclProjection.
 *
 * Groups relations by source ID and predicate.
 * Subject IRI classification helpers live in `src/modules/graph/SchemaIri.ts`.
 */

import type { SchemaGraphRelationInterface } from '../../interfaces/SchemaGraph.js';
import type { RelationStructure } from '../../types/SchemaGraph.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';

import { RDF } from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Relation index
// ---------------------------------------------------------------------------

export const ProjectionIndex = {
  build(allRelations: SchemaGraphRelationInterface[]): Map<string, RelationIndexInterface> {
    const index = new Map<string, RelationIndexInterface>();

    for (const relation of allRelations) {
      const sourceId = relation.source.id;
      let entry = index.get(sourceId);

      if (entry === undefined) {
        entry = {
          'all': [],
          'byPredicate': new Map(),
          'types': []
        };
        index.set(sourceId, entry);
      }

      entry.all.push(relation);

      const predicateGroup = entry.byPredicate.get(relation.predicate);

      if (predicateGroup === undefined) {
        entry.byPredicate.set(relation.predicate, [relation]);
      } else {
        predicateGroup.push(relation);
      }

      if (relation.predicate === RDF.type) {
        entry.types.push(ProjectionIndex.relationTargetId(relation));
      }
    }

    return index;
  },

  // ---------------------------------------------------------------------------
  // Target ID resolution
  // ---------------------------------------------------------------------------

  isListStructure(structure: RelationStructure | undefined): structure is Extract<RelationStructure, { 'kind': 'list' }> {
    return structure?.kind === 'list';
  },

  // ---------------------------------------------------------------------------
  // Structure type guards
  // ---------------------------------------------------------------------------

  isRestrictionStructure(structure: RelationStructure | undefined): structure is Extract<RelationStructure, { 'kind': 'restriction' }> {
    return structure?.kind === 'restriction';
  },

  relationTargetId(relation: SchemaGraphRelationInterface): string {
    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }
} as const;
