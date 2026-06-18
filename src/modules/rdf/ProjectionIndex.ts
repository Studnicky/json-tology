/**
 * ProjectionIndex — shared relation indexing and structure type guards
 * for OwlProjection and ShaclProjection.
 *
 * Groups relations by source ID and predicate.
 * Subject IRI classification helpers live in `src/modules/graph/SchemaIri.ts`.
 */

import type { SchemaGraphRelationType } from '../../types/SchemaGraph.js';
import type { RelationStructureType } from '../../types/SchemaGraph.js';
import type { RelationIndexType } from '../../types/RelationIndexType.js';

import {
  OWL, RDF
} from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Relation index
// ---------------------------------------------------------------------------

export const ProjectionIndex = {
  build(allRelations: SchemaGraphRelationType[]): Map<string, RelationIndexType> {
    const index = new Map<string, RelationIndexType>();

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

  /**
   * Filter `relations` to only the `contains`-keyword restriction entries.
   *
   * A `contains` restriction uses `owl:someValuesFrom` as both its predicate and
   * its `structure.constraint` value. This excludes user-declared restrictions,
   * which use `rdfs:subClassOf` as the predicate, and any other restriction kinds.
   */
  filterContainsRestrictions(relations: readonly SchemaGraphRelationType[]): SchemaGraphRelationType[] {
    return relations.filter((rel: SchemaGraphRelationType): boolean => {
      return rel.predicate === OWL.someValuesFrom
      && ProjectionIndex.isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom;
    });
  },

  // ---------------------------------------------------------------------------
  // Structure type guards
  // ---------------------------------------------------------------------------

  isListStructure(structure: RelationStructureType | undefined): structure is Extract<RelationStructureType, { 'kind': 'list' }> {
    return structure?.kind === 'list';
  },

  isRestrictionStructure(structure: RelationStructureType | undefined): structure is Extract<RelationStructureType, { 'kind': 'restriction' }> {
    return structure?.kind === 'restriction';
  },

  relationTargetId(relation: SchemaGraphRelationType): string {
    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }
} as const;
