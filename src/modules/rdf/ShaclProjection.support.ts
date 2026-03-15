import type { SchemaGraphRelationInterface } from '../../interfaces/schema-graph.js';

export interface RelationIndex {
  'all': SchemaGraphRelationInterface[];
  'byPredicate': Map<string, SchemaGraphRelationInterface[]>;
  'types': string[];
}

export function buildRelationIndex(allRelations: SchemaGraphRelationInterface[]): Map<string, RelationIndex> {
  const index = new Map<string, RelationIndex>();

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

    const list = entry.byPredicate.get(relation.predicate);

    if (list === undefined) {
      entry.byPredicate.set(relation.predicate, [relation]);
    } else {
      list.push(relation);
    }

    if (relation.predicate === 'rdf:type') {
      entry.types.push(relationTargetId(relation));
    }
  }

  return index;
}

export function isDependentSchemaSubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  return subject.slice(hashIdx + 1).includes('/dependentSchemas/');
}

export function isPropertySubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  const fragment = subject.slice(hashIdx + 1);
  const parts = fragment.split('/');

  return parts.length >= 3 && parts.at(-2) === 'properties';
}

export function isSerializationCandidate(
  subject: string,
  entry: RelationIndex,
  propertyIndex: Map<string, string[]>
): boolean {
  if (isPropertySubject(subject)) {
    return false;
  }

  const hashIdx = subject.indexOf('#');

  if (hashIdx !== -1) {
    const fragment = subject.slice(hashIdx + 1);

    if (fragment.includes('/items') || fragment.includes('/contains')
      || fragment.includes('/prefixItems/') || fragment.includes('/patternProperties/')) {
      return false;
    }

    if (fragment.includes('/dependentSchemas/')) {
      return false;
    }

    if (fragment === '/if' || fragment === '/then' || fragment === '/else') {
      return false;
    }
  }

  if (entry.types.includes('owl:Class')) {
    return true;
  }

  const properties = propertyIndex.get(subject);

  if (properties !== undefined && properties.length > 0) {
    return true;
  }

  if (entry.byPredicate.has('rdfs:subClassOf') || entry.byPredicate.has('owl:equivalentClass')
    || entry.byPredicate.has('owl:complementOf') || entry.byPredicate.has('owl:disjointWith')
    || entry.byPredicate.has('owl:oneOf') || entry.byPredicate.has('rdfs:member')
    || entry.byPredicate.has('sh:pattern') || entry.byPredicate.has('jt:dependentRequired')) {
    return true;
  }

  for (const relation of entry.all) {
    if (relation.structure?.kind === 'conditional') {
      return true;
    }

    if (relation.structure?.kind === 'restriction'
      && (relation.structure as { 'constraint': string }).constraint === 'owl:someValuesFrom') {
      return true;
    }
  }

  if (hashIdx === -1 || subject.slice(hashIdx + 1) === '') {
    return true;
  }

  return false;
}

export function lastSubjectSegment(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const segments = subject.slice(hashIdx + 1).split('/');

  return segments.at(-1) ?? '';
}

export function relationTargetId(relation: SchemaGraphRelationInterface): string {
  return typeof relation.target === 'string' ? relation.target : relation.target.id;
}

export function resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndex>): string {
  const targetEntry = index.get(targetNodeId);

  if (targetEntry === undefined) {
    return targetNodeId;
  }

  const rangeRelations = targetEntry.byPredicate.get('rdfs:range') ?? [];

  if (rangeRelations.length > 0) {
    return relationTargetId(rangeRelations[0]);
  }

  return targetNodeId;
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
