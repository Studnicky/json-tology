/**
 * ShaclProjection — projects SchemaGraph relations into SHACL-vocabulary quads.
 *
 * Iterates graph.allRelations() and emits SHACL shapes:
 * sh:NodeShape for class nodes, sh:PropertyShape for properties,
 * sh:and/sh:or for composition, sh:qualifiedValueShape for contains.
 *
 * Groups properties by structural parent (pointer path), not rdfs:domain.
 * The output quads can be passed directly to JsonLdFormatter.quadsToJsonLd().
 */

import type { QuadInterface } from '../../interfaces/quad.js';
import type { QuadObjectType } from '../../types/quad.js';
import type { SchemaGraphRelationInterface } from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import { propertyIri } from '../data/DataTypes.js';
import {
  bnode, iri, literal, nextBnode, quad, rdfList
} from './Projection.js';

// ---------------------------------------------------------------------------
// Relation index
// ---------------------------------------------------------------------------

interface RelationIndex {
  'all': SchemaGraphRelationInterface[];
  'byPredicate': Map<string, SchemaGraphRelationInterface[]>;
  'types': string[];
}

function buildIndex(allRelations: SchemaGraphRelationInterface[]): Map<string, RelationIndex> {
  const index = new Map<string, RelationIndex>();

  for (const rel of allRelations) {
    const sourceId = rel.source.id;
    let entry = index.get(sourceId);

    if (entry === undefined) {
      entry = {
        'all': [],
        'byPredicate': new Map(),
        'types': []
      };
      index.set(sourceId, entry);
    }

    entry.all.push(rel);

    const list = entry.byPredicate.get(rel.predicate);

    if (list === undefined) {
      entry.byPredicate.set(rel.predicate, [rel]);
    } else {
      list.push(rel);
    }

    if (rel.predicate === 'rdf:type') {
      entry.types.push(relTargetId(rel));
    }
  }

  return index;
}

function relTargetId(rel: SchemaGraphRelationInterface): string {
  return typeof rel.target === 'string' ? rel.target : rel.target.id;
}

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

function isPropertySubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  const fragment = subject.slice(hashIdx + 1);
  const parts = fragment.split('/');

  return parts.length >= 3 && parts.at(-2) === 'properties';
}

function isDependentSchemaSubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  return subject.slice(hashIdx + 1).includes('/dependentSchemas/');
}

function lastSegment(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const segments = subject.slice(hashIdx + 1).split('/');

  return segments.at(-1) ?? '';
}

function structuralParent(subject: string): string {
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

function resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndex>): string {
  const targetEntry = index.get(targetNodeId);

  if (targetEntry === undefined) {
    return targetNodeId;
  }

  const rangeRels = targetEntry.byPredicate.get('rdfs:range') ?? [];

  if (rangeRels.length > 0) {
    return relTargetId(rangeRels[0]);
  }

  return targetNodeId;
}

// ---------------------------------------------------------------------------
// Serialization candidacy
// ---------------------------------------------------------------------------

function isSerializationCandidate(
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

  const props = propertyIndex.get(subject);

  if (props !== undefined && props.length > 0) {
    return true;
  }

  if (entry.byPredicate.has('rdfs:subClassOf') || entry.byPredicate.has('owl:equivalentClass')
    || entry.byPredicate.has('owl:complementOf') || entry.byPredicate.has('owl:disjointWith')
    || entry.byPredicate.has('owl:oneOf') || entry.byPredicate.has('rdfs:member')
    || entry.byPredicate.has('sh:pattern') || entry.byPredicate.has('jt:dependentRequired')) {
    return true;
  }

  // Check for conditional structured relations
  for (const rel of entry.all) {
    if (rel.structure?.kind === 'conditional') {
      return true;
    }

    if (rel.structure?.kind === 'restriction'
      && (rel.structure as { 'constraint': string }).constraint === 'owl:someValuesFrom') {
      return true;
    }
  }

  if (hashIdx === -1 || subject.slice(hashIdx + 1) === '') {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function projectShaclGraph(graph: SchemaGraphInterface): QuadInterface[] {
  const quads: QuadInterface[] = [];
  const allRelations = graph.allRelations();
  const index = buildIndex(allRelations);

  // Build property index: structural parent → property subjects
  const propertyIndex = new Map<string, string[]>();

  for (const [subject] of index) {
    if (subject.startsWith('_:') || !isPropertySubject(subject)) {
      continue;
    }

    const parentId = structuralParent(subject);
    const list = propertyIndex.get(parentId) ?? [];

    list.push(subject);
    propertyIndex.set(parentId, list);
  }

  // Emit shapes for candidate subjects
  for (const [
    subject,
    entry
  ] of index) {
    if (subject.startsWith('_:')) {
      continue;
    }

    if (!isSerializationCandidate(subject, entry, propertyIndex)) {
      continue;
    }

    emitNodeShape(subject, entry, index, propertyIndex, quads);
  }

  return quads;
}

// ---------------------------------------------------------------------------
// NodeShape emission
// ---------------------------------------------------------------------------

function emitNodeShape(
  subject: string,
  entry: RelationIndex,
  index: Map<string, RelationIndex>,
  propertyIndex: Map<string, string[]>,
  quads: QuadInterface[]
): void {
  quads.push(quad(subject, 'rdf:type', iri('sh:NodeShape')));

  // sh:name from rdfs:label
  const labelRels = entry.byPredicate.get('rdfs:label') ?? [];

  for (const rel of labelRels) {
    quads.push(quad(subject, 'sh:name', literal(relTargetId(rel), 'xsd:string')));
  }

  // sh:description from rdfs:comment
  const commentRels = entry.byPredicate.get('rdfs:comment') ?? [];

  for (const rel of commentRels) {
    quads.push(quad(subject, 'sh:description', literal(relTargetId(rel), 'xsd:string')));
  }

  // sh:deactivated from owl:deprecated
  if (entry.byPredicate.has('owl:deprecated')) {
    quads.push(quad(subject, 'sh:deactivated', literal(true, 'xsd:boolean')));
  }

  // sh:closed
  if (entry.byPredicate.has('sh:closed')) {
    quads.push(quad(subject, 'sh:closed', literal(true, 'xsd:boolean')));
  }

  // Array cardinality on node shapes (minItems/maxItems → sh:minCount/sh:maxCount)
  emitConstraintLiteral(subject, entry, 'sh:minCount', 'xsd:integer', quads);
  emitConstraintLiteral(subject, entry, 'sh:maxCount', 'xsd:integer', quads);

  // sh:property — regular properties
  const propSubjects = propertyIndex.get(subject) ?? [];

  for (const propSubject of propSubjects) {
    if (isDependentSchemaSubject(propSubject)) {
      continue;
    }

    const propEntry = index.get(propSubject);

    if (propEntry === undefined) {
      continue;
    }

    const psBnode = nextBnode();

    emitPropertyShape(psBnode, propSubject, propEntry, subject, undefined, quads);
    quads.push(quad(subject, 'sh:property', bnode(psBnode)));
  }

  // sh:property — contains (sh:qualifiedValueShape)
  emitContainsPropertyShape(subject, entry, index, quads);

  // sh:and entries
  const andItems: QuadObjectType[] = [];

  // rdfs:subClassOf → sh:and
  const subClassRels = entry.byPredicate.get('rdfs:subClassOf') ?? [];

  for (const rel of subClassRels) {
    andItems.push(iri(relTargetId(rel)));
  }

  // dependentRequired → sh:or implications
  emitDependentRequiredAndItems(subject, entry, andItems, quads);

  // dependentSchemas → sh:or implications
  emitDependentSchemaAndItems(subject, entry, index, propertyIndex, andItems, quads);

  // if/then/else → material conditional
  emitConditionalAndItems(subject, entry, index, andItems, quads);

  if (andItems.length > 0) {
    quads.push(quad(subject, 'sh:and', rdfList(andItems)));
  }

  // sh:or from owl:equivalentClass
  const equivRels = entry.byPredicate.get('owl:equivalentClass') ?? [];

  if (equivRels.length > 0) {
    const orItems = equivRels.map((r) => {
      return iri(resolveTargetRef(relTargetId(r), index));
    });

    quads.push(quad(subject, 'sh:or', rdfList(orItems)));
  }

  // sh:not from owl:complementOf
  const complementRels = entry.byPredicate.get('owl:complementOf') ?? [];

  if (complementRels.length > 0) {
    quads.push(quad(subject, 'sh:not', iri(resolveTargetRef(relTargetId(complementRels[0]), index))));
  }

  // sh:not from owl:disjointWith (fallback)
  const disjointRels = entry.byPredicate.get('owl:disjointWith') ?? [];

  if (complementRels.length === 0 && disjointRels.length > 0) {
    quads.push(quad(subject, 'sh:not', iri(resolveTargetRef(relTargetId(disjointRels[0]), index))));
  }

  // sh:in from owl:oneOf
  const oneOfRels = entry.byPredicate.get('owl:oneOf') ?? [];

  if (oneOfRels.length > 0) {
    const values = oneOfRels.map((r) => {
      return literal(relTargetId(r), 'xsd:string');
    });

    quads.push(quad(subject, 'sh:in', rdfList(values)));
  }
}

// ---------------------------------------------------------------------------
// PropertyShape emission
// ---------------------------------------------------------------------------

function emitPropertyShape(
  bnodeId: string,
  subject: string,
  entry: RelationIndex,
  classId: string,
  overridePathClassId: string | undefined,
  quads: QuadInterface[]
): void {
  quads.push(quad(bnodeId, 'rdf:type', iri('sh:PropertyShape')));

  // sh:path — use rdfs:domain for path class, unless overridden
  const domainRels = entry.byPredicate.get('rdfs:domain') ?? [];
  const pathClassId = overridePathClassId ?? (domainRels.length > 0 ? relTargetId(domainRels[0]) : classId);
  const propName = lastSegment(subject);
  const canonicalId = propertyIri(pathClassId, propName);

  quads.push(quad(bnodeId, 'sh:path', iri(canonicalId)));

  // sh:name from rdfs:label
  const labelRels = entry.byPredicate.get('rdfs:label') ?? [];

  for (const rel of labelRels) {
    quads.push(quad(bnodeId, 'sh:name', literal(relTargetId(rel), 'xsd:string')));
  }

  // sh:datatype
  const datatypeRels = entry.byPredicate.get('sh:datatype') ?? [];
  const rangeRels = entry.byPredicate.get('rdfs:range') ?? [];

  if (datatypeRels.length > 0 && rangeRels.length === 0) {
    quads.push(quad(bnodeId, 'sh:datatype', iri(relTargetId(datatypeRels[0]))));
  }

  // sh:minCount
  const minCountRels = entry.byPredicate.get('sh:minCount') ?? [];

  if (minCountRels.length > 0) {
    quads.push(quad(bnodeId, 'sh:minCount', literal(Number(relTargetId(minCountRels[0])), 'xsd:integer')));
  }

  // sh:maxCount
  const maxCountRels = entry.byPredicate.get('sh:maxCount') ?? [];

  if (maxCountRels.length > 0) {
    quads.push(quad(bnodeId, 'sh:maxCount', literal(Number(relTargetId(maxCountRels[0])), 'xsd:integer')));
  }

  // sh:node or sh:class from rdfs:range
  if (rangeRels.length > 0) {
    if (datatypeRels.length > 0 || rangeRels.length > 1) {
      quads.push(quad(bnodeId, 'sh:class', iri(relTargetId(rangeRels[0]))));
    } else {
      quads.push(quad(bnodeId, 'sh:node', iri(relTargetId(rangeRels[0]))));
    }
  }

  // sh:hasValue from owl:hasValue
  const hasValueRels = entry.byPredicate.get('owl:hasValue') ?? [];

  if (hasValueRels.length > 0) {
    quads.push(quad(bnodeId, 'sh:hasValue', literal(relTargetId(hasValueRels[0]), 'xsd:string')));
  }

  // sh:pattern from sh:pattern (overrides format pattern)
  const patternRels = entry.byPredicate.get('sh:pattern') ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty === true) {
      continue;
    }

    quads.push(quad(bnodeId, 'sh:pattern', literal(relTargetId(rel), 'xsd:string')));
  }

  // Numeric/string constraints
  emitConstraintLiteral(bnodeId, entry, 'sh:minLength', 'xsd:integer', quads);
  emitConstraintLiteral(bnodeId, entry, 'sh:maxLength', 'xsd:integer', quads);
  emitConstraintLiteral(bnodeId, entry, 'sh:minInclusive', 'xsd:decimal', quads);
  emitConstraintLiteral(bnodeId, entry, 'sh:maxInclusive', 'xsd:decimal', quads);
  emitConstraintLiteral(bnodeId, entry, 'sh:minExclusive', 'xsd:decimal', quads);
  emitConstraintLiteral(bnodeId, entry, 'sh:maxExclusive', 'xsd:decimal', quads);
  emitConstraintLiteral(bnodeId, entry, 'jt:multipleOf', 'xsd:decimal', quads);

  // sh:description from rdfs:comment
  const commentRels = entry.byPredicate.get('rdfs:comment') ?? [];

  for (const rel of commentRels) {
    quads.push(quad(bnodeId, 'sh:description', literal(relTargetId(rel), 'xsd:string')));
  }

  // dash:readOnly / dash:writeOnly
  if (entry.byPredicate.has('dash:readOnly')) {
    quads.push(quad(bnodeId, 'dash:readOnly', literal(true, 'xsd:boolean')));
  }

  if (entry.byPredicate.has('dash:writeOnly')) {
    quads.push(quad(bnodeId, 'dash:writeOnly', literal(true, 'xsd:boolean')));
  }

  // dct:format
  const formatRels = entry.byPredicate.get('dct:format') ?? [];

  for (const rel of formatRels) {
    quads.push(quad(bnodeId, 'dct:format', literal(relTargetId(rel), 'xsd:string')));
  }
}

function emitConstraintLiteral(
  bnodeId: string,
  entry: RelationIndex,
  predicate: string,
  datatype: string,
  quads: QuadInterface[]
): void {
  const rels = entry.byPredicate.get(predicate) ?? [];

  if (rels.length > 0) {
    quads.push(quad(bnodeId, predicate, literal(Number(relTargetId(rels[0])), datatype)));
  }
}

// ---------------------------------------------------------------------------
// Contains → sh:qualifiedValueShape
// ---------------------------------------------------------------------------

function emitContainsPropertyShape(
  subject: string,
  entry: RelationIndex,
  _index: Map<string, RelationIndex>,
  quads: QuadInterface[]
): void {
  const containsRels = entry.all.filter((r) => {
    return r.structure?.kind === 'restriction'
    && (r.structure as { 'constraint': string }).constraint === 'owl:someValuesFrom';
  });

  if (containsRels.length === 0) {
    return;
  }

  const structure = containsRels[0].structure as { 'value': unknown };
  const containsTypeId = String(structure.value);

  const psBnode = nextBnode();

  // sh:qualifiedValueShape
  if (containsTypeId.startsWith('xsd:')) {
    const qvsBnode = nextBnode();

    quads.push(quad(qvsBnode, 'sh:datatype', iri(containsTypeId)));
    quads.push(quad(psBnode, 'sh:qualifiedValueShape', bnode(qvsBnode)));
  } else {
    quads.push(quad(psBnode, 'sh:qualifiedValueShape', iri(containsTypeId)));
  }

  // sh:qualifiedMinCount
  const minQualRels = entry.byPredicate.get('owl:minQualifiedCardinality') ?? [];

  if (minQualRels.length > 0) {
    quads.push(quad(psBnode, 'sh:qualifiedMinCount', literal(Number(relTargetId(minQualRels[0])), 'xsd:integer')));
  }

  // sh:qualifiedMaxCount
  const maxQualRels = entry.byPredicate.get('owl:maxQualifiedCardinality') ?? [];

  if (maxQualRels.length > 0) {
    quads.push(quad(psBnode, 'sh:qualifiedMaxCount', literal(Number(relTargetId(maxQualRels[0])), 'xsd:integer')));
  }

  quads.push(quad(subject, 'sh:property', bnode(psBnode)));
}

// ---------------------------------------------------------------------------
// DependentRequired → sh:or implication
// ---------------------------------------------------------------------------

function emitDependentRequiredAndItems(
  subject: string,
  entry: RelationIndex,
  andItems: QuadObjectType[],
  quads: QuadInterface[]
): void {
  const depReqRels = entry.byPredicate.get('jt:dependentRequired') ?? [];

  for (const rel of depReqRels) {
    const meta = rel.metadata ?? {};
    const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
    const required = Array.isArray(meta.required) ? meta.required as string[] : [];

    const triggerPropIri = propertyIri(subject, trigger);

    // sh:not branch: sh:not { sh:property [sh:path triggerProp, sh:minCount 1] }
    const notPsBnode = nextBnode();

    quads.push(quad(notPsBnode, 'rdf:type', iri('sh:PropertyShape')));
    quads.push(quad(notPsBnode, 'sh:path', iri(triggerPropIri)));
    quads.push(quad(notPsBnode, 'sh:minCount', literal(1, 'xsd:integer')));

    const notBnode = nextBnode();

    quads.push(quad(notBnode, 'sh:not', bnode(nextBnode()))); // placeholder
    // Actually, sh:not needs a node with sh:property
    // Let me restructure this

    // Build: { sh:not: { sh:property: [{ sh:path, sh:minCount }] } }
    const notContainerBnode = nextBnode();

    quads.push(quad(notContainerBnode, 'sh:property', bnode(notPsBnode)));

    const notWrapperBnode = nextBnode();

    quads.push(quad(notWrapperBnode, 'sh:not', bnode(notContainerBnode)));

    // Required branch: { sh:property: [{ sh:path, sh:minCount }...] }
    const reqBnode = nextBnode();

    for (const reqProp of required) {
      const reqPsBnode = nextBnode();

      quads.push(quad(reqPsBnode, 'rdf:type', iri('sh:PropertyShape')));
      quads.push(quad(reqPsBnode, 'sh:path', iri(propertyIri(subject, reqProp))));
      quads.push(quad(reqPsBnode, 'sh:minCount', literal(1, 'xsd:integer')));
      quads.push(quad(reqBnode, 'sh:property', bnode(reqPsBnode)));
    }

    // sh:or: [notWrapper, reqBnode]
    const orBnode = nextBnode();

    quads.push(quad(orBnode, 'sh:or', rdfList([
      bnode(notWrapperBnode),
      bnode(reqBnode)
    ])));

    andItems.push(bnode(orBnode));
  }
}

// ---------------------------------------------------------------------------
// DependentSchemas → sh:or implication
// ---------------------------------------------------------------------------

function emitDependentSchemaAndItems(
  subject: string,
  entry: RelationIndex,
  index: Map<string, RelationIndex>,
  _propertyIndex: Map<string, string[]>,
  andItems: QuadObjectType[],
  quads: QuadInterface[]
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      ifRef, thenRef
    } = rel.structure;

    if (!thenRef?.includes('/dependentSchemas/')) {
      continue;
    }

    const triggerPropIri = ifRef;

    // sh:not branch
    const notPsBnode = nextBnode();

    quads.push(quad(notPsBnode, 'rdf:type', iri('sh:PropertyShape')));
    quads.push(quad(notPsBnode, 'sh:path', iri(triggerPropIri)));
    quads.push(quad(notPsBnode, 'sh:minCount', literal(1, 'xsd:integer')));

    const notContainerBnode = nextBnode();

    quads.push(quad(notContainerBnode, 'sh:property', bnode(notPsBnode)));

    const notWrapperBnode = nextBnode();

    quads.push(quad(notWrapperBnode, 'sh:not', bnode(notContainerBnode)));

    // Dependent NodeShape
    const depShapeBnode = nextBnode();

    quads.push(quad(depShapeBnode, 'rdf:type', iri('sh:NodeShape')));

    // sh:closed on dependent schema
    const depEntry = index.get(thenRef);

    if (depEntry !== undefined && depEntry.byPredicate.has('sh:closed')) {
      quads.push(quad(depShapeBnode, 'sh:closed', literal(true, 'xsd:boolean')));
    }

    // Properties belonging to dependent schema (by rdfs:domain match)
    for (const [
      propSubject,
      propEntry
    ] of index) {
      if (!isPropertySubject(propSubject)) {
        continue;
      }

      const domainRels = propEntry.byPredicate.get('rdfs:domain') ?? [];

      if (domainRels.length === 0 || relTargetId(domainRels[0]) !== thenRef) {
        continue;
      }

      const psBnode = nextBnode();

      emitPropertyShape(psBnode, propSubject, propEntry, subject, subject, quads);
      quads.push(quad(depShapeBnode, 'sh:property', bnode(psBnode)));
    }

    // sh:or: [notWrapper, depShape]
    const orBnode = nextBnode();

    quads.push(quad(orBnode, 'sh:or', rdfList([
      bnode(notWrapperBnode),
      bnode(depShapeBnode)
    ])));

    andItems.push(bnode(orBnode));
  }
}

// ---------------------------------------------------------------------------
// if/then/else → material conditional
// ---------------------------------------------------------------------------

function emitConditionalAndItems(
  _subject: string,
  entry: RelationIndex,
  _index: Map<string, RelationIndex>,
  andItems: QuadObjectType[],
  quads: QuadInterface[]
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      elseRef, ifRef, thenRef
    } = rel.structure;

    // Skip dependentSchemas conditionals
    if (thenRef !== undefined && thenRef.includes('/dependentSchemas/')) {
      continue;
    }

    // then branch: sh:or [ sh:not(if), then ]
    if (thenRef !== undefined) {
      const notBnode = nextBnode();

      quads.push(quad(notBnode, 'sh:not', iri(ifRef)));

      const orBnode = nextBnode();

      quads.push(quad(orBnode, 'sh:or', rdfList([
        bnode(notBnode),
        iri(thenRef)
      ])));
      andItems.push(bnode(orBnode));
    }

    // else branch: sh:or [ if, else ]
    if (elseRef !== undefined) {
      const orBnode = nextBnode();

      quads.push(quad(orBnode, 'sh:or', rdfList([
        iri(ifRef),
        iri(elseRef)
      ])));
      andItems.push(bnode(orBnode));
    }
  }
}
