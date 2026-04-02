/**
 * ProjectionIndex — shared relation indexing and subject helpers
 * for OwlProjection and ShaclProjection.
 *
 * Groups relations by source ID and predicate, and provides
 * classification helpers for subject IRIs.
 */

import type { SchemaGraphRelationInterface } from '../../interfaces/SchemaGraph.js';
import type { RelationStructure } from '../../types/SchemaGraph.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';

// ---------------------------------------------------------------------------
// Relation index
// ---------------------------------------------------------------------------

export function buildIndex(allRelations: SchemaGraphRelationInterface[]): Map<string, RelationIndexInterface> {
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

    if (relation.predicate === 'rdf:type') {
      entry.types.push(relationTargetId(relation));
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Target ID resolution
// ---------------------------------------------------------------------------

export function relationTargetId(relation: SchemaGraphRelationInterface): string {
  return typeof relation.target === 'string' ? relation.target : relation.target.id;
}

// ---------------------------------------------------------------------------
// Subject classification helpers
// ---------------------------------------------------------------------------

export function isPropertySubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  const fragment = subject.slice(hashIdx + 1);

  return fragment.includes('/properties/');
}

// ---------------------------------------------------------------------------
// Structure type guards
// ---------------------------------------------------------------------------

export function isRestrictionStructure(structure: RelationStructure | undefined): structure is Extract<RelationStructure, { 'kind': 'restriction' }> {
  return structure?.kind === 'restriction';
}

export function isListStructure(structure: RelationStructure | undefined): structure is Extract<RelationStructure, { 'kind': 'list' }> {
  return structure?.kind === 'list';
}

export function fragmentContains(subject: string, segment: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  return subject.slice(hashIdx + 1).includes(segment);
}

export function structuralParent(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const base = subject.slice(0, hashIdx);
  const fragment = subject.slice(hashIdx + 1);
  const propsIdx = fragment.lastIndexOf('/properties/');

  if (propsIdx === -1) {
    return base;
  }

  const parentPointer = fragment.slice(0, propsIdx);

  return parentPointer === '' ? base : `${base}#${parentPointer}`;
}

export function lastSegment(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const segments = subject.slice(hashIdx + 1).split('/');

  return segments.at(-1) ?? '';
}
