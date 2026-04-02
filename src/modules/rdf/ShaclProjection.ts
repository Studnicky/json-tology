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

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import { propertyIri } from '../data/dataTypes.js';
import {
  bnode, iri, literal, nextBnode, quad, rdfList
} from './projection.js';
import {
  buildIndex, fragmentContains, isPropertySubject, isRestrictionStructure, lastSegment,
  relationTargetId, structuralParent
} from './projectionIndex.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';

function resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndexInterface>): string {
  const targetEntry = index.get(targetNodeId);

  if (targetEntry === undefined) {
    return targetNodeId;
  }

  const rangeRels = targetEntry.byPredicate.get('rdfs:range') ?? [];

  if (rangeRels.length > 0) {
    return relationTargetId(rangeRels[0]);
  }

  return targetNodeId;
}

// ---------------------------------------------------------------------------
// Serialization candidacy
// ---------------------------------------------------------------------------

function isSerializationCandidate(
  subject: string,
  entry: RelationIndexInterface,
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

    if (isRestrictionStructure(rel.structure)
      && rel.structure.constraint === 'owl:someValuesFrom') {
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

export function projectShaclGraph(graph: SchemaGraphInterface, curie?: CurieInterface): QuadInterface[] {
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

    emitNodeShape(subject, entry, index, propertyIndex, quads, curie);
  }

  return quads;
}

// ---------------------------------------------------------------------------
// NodeShape emission
// ---------------------------------------------------------------------------

function emitNodeShape(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  propertyIndex: Map<string, string[]>,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(quad(subject, 'rdf:type', iri('sh:NodeShape', curie), curie));

  // sh:name from rdfs:label
  const labelRels = entry.byPredicate.get('rdfs:label') ?? [];

  for (const rel of labelRels) {
    quads.push(quad(subject, 'sh:name', literal(relationTargetId(rel), 'xsd:string', curie), curie));
  }

  // sh:description from rdfs:comment
  const commentRels = entry.byPredicate.get('rdfs:comment') ?? [];

  for (const rel of commentRels) {
    quads.push(quad(subject, 'sh:description', literal(relationTargetId(rel), 'xsd:string', curie), curie));
  }

  // sh:deactivated from owl:deprecated
  if (entry.byPredicate.has('owl:deprecated')) {
    quads.push(quad(subject, 'sh:deactivated', literal(true, 'xsd:boolean', curie), curie));
  }

  // sh:closed
  if (entry.byPredicate.has('sh:closed')) {
    quads.push(quad(subject, 'sh:closed', literal(true, 'xsd:boolean', curie), curie));
  }

  // Array cardinality on node shapes (minItems/maxItems → sh:minCount/sh:maxCount)
  emitConstraintLiteral(subject, entry, 'sh:minCount', 'xsd:integer', quads, curie);
  emitConstraintLiteral(subject, entry, 'sh:maxCount', 'xsd:integer', quads, curie);

  // sh:property — regular properties
  const propSubjects = propertyIndex.get(subject) ?? [];

  for (const propSubject of propSubjects) {
    if (fragmentContains(propSubject, '/dependentSchemas/')) {
      continue;
    }

    const propEntry = index.get(propSubject);

    if (propEntry === undefined) {
      continue;
    }

    const psBnode = nextBnode();

    emitPropertyShape(psBnode, propSubject, propEntry, subject, undefined, quads, curie);
    quads.push(quad(subject, 'sh:property', bnode(psBnode), curie));
  }

  // sh:property — contains (sh:qualifiedValueShape)
  emitContainsPropertyShape(subject, entry, quads, curie);

  // sh:and entries
  const andItems: QuadObjectType[] = [];

  // rdfs:subClassOf → sh:and
  const subClassRels = entry.byPredicate.get('rdfs:subClassOf') ?? [];

  for (const rel of subClassRels) {
    andItems.push(iri(relationTargetId(rel), curie));
  }

  // dependentRequired → sh:or implications
  emitDependentRequiredAndItems(subject, entry, andItems, quads, curie);

  // dependentSchemas → sh:or implications
  emitDependentSchemaAndItems(subject, entry, index, andItems, quads, curie);

  // if/then/else → material conditional
  emitConditionalAndItems(entry, andItems, quads, curie);

  if (andItems.length > 0) {
    quads.push(quad(subject, 'sh:and', rdfList(andItems), curie));
  }

  // sh:or from owl:equivalentClass
  const equivRels = entry.byPredicate.get('owl:equivalentClass') ?? [];

  if (equivRels.length > 0) {
    const orItems = equivRels.map((rel) => {
      return iri(resolveTargetRef(relationTargetId(rel), index), curie);
    });

    quads.push(quad(subject, 'sh:or', rdfList(orItems), curie));
  }

  // sh:not from owl:complementOf
  const complementRels = entry.byPredicate.get('owl:complementOf') ?? [];

  if (complementRels.length > 0) {
    quads.push(quad(subject, 'sh:not', iri(resolveTargetRef(relationTargetId(complementRels[0]), index), curie), curie));
  }

  // sh:not from owl:disjointWith (fallback)
  const disjointRels = entry.byPredicate.get('owl:disjointWith') ?? [];

  if (complementRels.length === 0 && disjointRels.length > 0) {
    quads.push(quad(subject, 'sh:not', iri(resolveTargetRef(relationTargetId(disjointRels[0]), index), curie), curie));
  }

  // sh:in from owl:oneOf
  const oneOfRels = entry.byPredicate.get('owl:oneOf') ?? [];

  if (oneOfRels.length > 0) {
    const values = oneOfRels.map((rel) => {
      return literal(relationTargetId(rel), 'xsd:string', curie);
    });

    quads.push(quad(subject, 'sh:in', rdfList(values), curie));
  }
}

// ---------------------------------------------------------------------------
// PropertyShape emission
// ---------------------------------------------------------------------------

function emitPropertyShape(
  bnodeId: string,
  subject: string,
  entry: RelationIndexInterface,
  classId: string,
  overridePathClassId: string | undefined,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(quad(bnodeId, 'rdf:type', iri('sh:PropertyShape', curie), curie));

  // sh:path — use rdfs:domain for path class, unless overridden
  const domainRels = entry.byPredicate.get('rdfs:domain') ?? [];
  const pathClassId = overridePathClassId ?? (domainRels.length > 0 ? relationTargetId(domainRels[0]) : classId);
  const propName = lastSegment(subject);
  const canonicalId = propertyIri(pathClassId, propName);

  quads.push(quad(bnodeId, 'sh:path', iri(canonicalId, curie), curie));

  // sh:name from rdfs:label
  const labelRels = entry.byPredicate.get('rdfs:label') ?? [];

  for (const rel of labelRels) {
    quads.push(quad(bnodeId, 'sh:name', literal(relationTargetId(rel), 'xsd:string', curie), curie));
  }

  // sh:datatype
  const datatypeRels = entry.byPredicate.get('sh:datatype') ?? [];
  const rangeRels = entry.byPredicate.get('rdfs:range') ?? [];

  if (datatypeRels.length > 0 && rangeRels.length === 0) {
    quads.push(quad(bnodeId, 'sh:datatype', iri(relationTargetId(datatypeRels[0]), curie), curie));
  }

  // sh:minCount
  const minCountRels = entry.byPredicate.get('sh:minCount') ?? [];

  if (minCountRels.length > 0) {
    quads.push(quad(bnodeId, 'sh:minCount', literal(Number(relationTargetId(minCountRels[0])), 'xsd:integer', curie), curie));
  }

  // sh:maxCount
  const maxCountRels = entry.byPredicate.get('sh:maxCount') ?? [];

  if (maxCountRels.length > 0) {
    quads.push(quad(bnodeId, 'sh:maxCount', literal(Number(relationTargetId(maxCountRels[0])), 'xsd:integer', curie), curie));
  }

  // sh:node or sh:class from rdfs:range
  if (rangeRels.length > 0) {
    if (datatypeRels.length > 0 || rangeRels.length > 1) {
      quads.push(quad(bnodeId, 'sh:class', iri(relationTargetId(rangeRels[0]), curie), curie));
    } else {
      quads.push(quad(bnodeId, 'sh:node', iri(relationTargetId(rangeRels[0]), curie), curie));
    }
  }

  // sh:hasValue from owl:hasValue
  const hasValueRels = entry.byPredicate.get('owl:hasValue') ?? [];

  if (hasValueRels.length > 0) {
    quads.push(quad(bnodeId, 'sh:hasValue', literal(relationTargetId(hasValueRels[0]), 'xsd:string', curie), curie));
  }

  // sh:pattern from sh:pattern (overrides format pattern)
  const patternRels = entry.byPredicate.get('sh:pattern') ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty === true) {
      continue;
    }

    quads.push(quad(bnodeId, 'sh:pattern', literal(relationTargetId(rel), 'xsd:string', curie), curie));
  }

  // Numeric/string constraints
  emitConstraintLiteral(bnodeId, entry, 'sh:minLength', 'xsd:integer', quads, curie);
  emitConstraintLiteral(bnodeId, entry, 'sh:maxLength', 'xsd:integer', quads, curie);
  emitConstraintLiteral(bnodeId, entry, 'sh:minInclusive', 'xsd:decimal', quads, curie);
  emitConstraintLiteral(bnodeId, entry, 'sh:maxInclusive', 'xsd:decimal', quads, curie);
  emitConstraintLiteral(bnodeId, entry, 'sh:minExclusive', 'xsd:decimal', quads, curie);
  emitConstraintLiteral(bnodeId, entry, 'sh:maxExclusive', 'xsd:decimal', quads, curie);
  emitConstraintLiteral(bnodeId, entry, 'jt:multipleOf', 'xsd:decimal', quads, curie);

  // sh:description from rdfs:comment
  const commentRels = entry.byPredicate.get('rdfs:comment') ?? [];

  for (const rel of commentRels) {
    quads.push(quad(bnodeId, 'sh:description', literal(relationTargetId(rel), 'xsd:string', curie), curie));
  }

  // dash:readOnly / dash:writeOnly
  if (entry.byPredicate.has('dash:readOnly')) {
    quads.push(quad(bnodeId, 'dash:readOnly', literal(true, 'xsd:boolean', curie), curie));
  }

  if (entry.byPredicate.has('dash:writeOnly')) {
    quads.push(quad(bnodeId, 'dash:writeOnly', literal(true, 'xsd:boolean', curie), curie));
  }

  // dct:format
  const formatRels = entry.byPredicate.get('dct:format') ?? [];

  for (const rel of formatRels) {
    quads.push(quad(bnodeId, 'dct:format', literal(relationTargetId(rel), 'xsd:string', curie), curie));
  }
}

function emitConstraintLiteral(
  bnodeId: string,
  entry: RelationIndexInterface,
  predicate: string,
  datatype: string,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const rels = entry.byPredicate.get(predicate) ?? [];

  if (rels.length > 0) {
    quads.push(quad(bnodeId, predicate, literal(Number(relationTargetId(rels[0])), datatype, curie), curie));
  }
}

// ---------------------------------------------------------------------------
// Contains → sh:qualifiedValueShape
// ---------------------------------------------------------------------------

function emitContainsPropertyShape(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const containsRels = entry.all.filter((rel) => {
    return isRestrictionStructure(rel.structure)
    && rel.structure.constraint === 'owl:someValuesFrom';
  });

  if (containsRels.length === 0) {
    return;
  }

  const structure = containsRels[0].structure;

  if (!isRestrictionStructure(structure)) {
    return;
  }

  const containsTypeId = String(structure.value);

  const psBnode = nextBnode();

  // sh:qualifiedValueShape
  if (containsTypeId.startsWith('xsd:')) {
    const qvsBnode = nextBnode();

    quads.push(quad(qvsBnode, 'sh:datatype', iri(containsTypeId, curie), curie));
    quads.push(quad(psBnode, 'sh:qualifiedValueShape', bnode(qvsBnode), curie));
  } else {
    quads.push(quad(psBnode, 'sh:qualifiedValueShape', iri(containsTypeId, curie), curie));
  }

  // sh:qualifiedMinCount
  const minQualRels = entry.byPredicate.get('owl:minQualifiedCardinality') ?? [];

  if (minQualRels.length > 0) {
    quads.push(quad(psBnode, 'sh:qualifiedMinCount', literal(Number(relationTargetId(minQualRels[0])), 'xsd:integer', curie), curie));
  }

  // sh:qualifiedMaxCount
  const maxQualRels = entry.byPredicate.get('owl:maxQualifiedCardinality') ?? [];

  if (maxQualRels.length > 0) {
    quads.push(quad(psBnode, 'sh:qualifiedMaxCount', literal(Number(relationTargetId(maxQualRels[0])), 'xsd:integer', curie), curie));
  }

  quads.push(quad(subject, 'sh:property', bnode(psBnode), curie));
}

// ---------------------------------------------------------------------------
// DependentRequired → sh:or implication
// ---------------------------------------------------------------------------

function emitDependentRequiredAndItems(
  subject: string,
  entry: RelationIndexInterface,
  andItems: QuadObjectType[],
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const depReqRels = entry.byPredicate.get('jt:dependentRequired') ?? [];

  for (const rel of depReqRels) {
    const meta = rel.metadata ?? {};
    const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
    const required = Array.isArray(meta.required) ? meta.required as string[] : [];

    const triggerPropIri = propertyIri(subject, trigger);

    // sh:not branch: sh:not { sh:property [sh:path triggerProp, sh:minCount 1] }
    const withoutPsBnode = nextBnode();

    quads.push(quad(withoutPsBnode, 'rdf:type', iri('sh:PropertyShape', curie), curie));
    quads.push(quad(withoutPsBnode, 'sh:path', iri(triggerPropIri, curie), curie));
    quads.push(quad(withoutPsBnode, 'sh:minCount', literal(1, 'xsd:integer', curie), curie));

    const complementBnode = nextBnode();

    // placeholder — sh:not needs a node with sh:property
    quads.push(quad(complementBnode, 'sh:not', bnode(nextBnode()), curie));

    // Build: { sh:not: { sh:property: [{ sh:path, sh:minCount }] } }
    const withoutContainerBnode = nextBnode();

    quads.push(quad(withoutContainerBnode, 'sh:property', bnode(withoutPsBnode), curie));

    const withoutWrapperBnode = nextBnode();

    quads.push(quad(withoutWrapperBnode, 'sh:not', bnode(withoutContainerBnode), curie));

    // Required branch: { sh:property: [{ sh:path, sh:minCount }...] }
    const reqBnode = nextBnode();

    for (const reqProp of required) {
      const reqPsBnode = nextBnode();

      quads.push(quad(reqPsBnode, 'rdf:type', iri('sh:PropertyShape', curie), curie));
      quads.push(quad(reqPsBnode, 'sh:path', iri(propertyIri(subject, reqProp), curie), curie));
      quads.push(quad(reqPsBnode, 'sh:minCount', literal(1, 'xsd:integer', curie), curie));
      quads.push(quad(reqBnode, 'sh:property', bnode(reqPsBnode), curie));
    }

    // sh:or: [notWrapper, reqBnode]
    const orBnode = nextBnode();

    quads.push(quad(orBnode, 'sh:or', rdfList([
      bnode(withoutWrapperBnode),
      bnode(reqBnode)
    ], curie), curie));

    andItems.push(bnode(orBnode));
  }
}

// ---------------------------------------------------------------------------
// DependentSchemas → sh:or implication
// ---------------------------------------------------------------------------

function emitDependentSchemaAndItems(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  andItems: QuadObjectType[],
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      ifRef, thenRef
    } = rel.structure;

    if (thenRef?.includes('/dependentSchemas/') !== true) {
      continue;
    }

    const triggerPropIri = ifRef;

    // sh:not branch
    const withoutPsBnode = nextBnode();

    quads.push(quad(withoutPsBnode, 'rdf:type', iri('sh:PropertyShape', curie), curie));
    quads.push(quad(withoutPsBnode, 'sh:path', iri(triggerPropIri, curie), curie));
    quads.push(quad(withoutPsBnode, 'sh:minCount', literal(1, 'xsd:integer', curie), curie));

    const withoutContainerBnode = nextBnode();

    quads.push(quad(withoutContainerBnode, 'sh:property', bnode(withoutPsBnode), curie));

    const withoutWrapperBnode = nextBnode();

    quads.push(quad(withoutWrapperBnode, 'sh:not', bnode(withoutContainerBnode), curie));

    // Dependent NodeShape
    const depShapeBnode = nextBnode();

    quads.push(quad(depShapeBnode, 'rdf:type', iri('sh:NodeShape', curie), curie));

    // sh:closed on dependent schema
    const depEntry = index.get(thenRef);

    if (depEntry?.byPredicate.has('sh:closed') === true) {
      quads.push(quad(depShapeBnode, 'sh:closed', literal(true, 'xsd:boolean', curie), curie));
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

      if (domainRels.length === 0 || relationTargetId(domainRels[0]) !== thenRef) {
        continue;
      }

      const psBnode = nextBnode();

      emitPropertyShape(psBnode, propSubject, propEntry, subject, subject, quads, curie);
      quads.push(quad(depShapeBnode, 'sh:property', bnode(psBnode), curie));
    }

    // sh:or: [notWrapper, depShape]
    const orBnode = nextBnode();

    quads.push(quad(orBnode, 'sh:or', rdfList([
      bnode(withoutWrapperBnode),
      bnode(depShapeBnode)
    ], curie), curie));

    andItems.push(bnode(orBnode));
  }
}

// ---------------------------------------------------------------------------
// if/then/else → material conditional
// ---------------------------------------------------------------------------

function emitConditionalAndItems(
  entry: RelationIndexInterface,
  andItems: QuadObjectType[],
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      elseRef, ifRef, thenRef
    } = rel.structure;

    // Skip dependentSchemas conditionals
    if (thenRef?.includes('/dependentSchemas/') === true) {
      continue;
    }

    // then branch: sh:or [ sh:not(if), then ]
    if (thenRef !== undefined) {
      const complementBnode = nextBnode();

      quads.push(quad(complementBnode, 'sh:not', iri(ifRef, curie), curie));

      const orBnode = nextBnode();

      quads.push(quad(orBnode, 'sh:or', rdfList([
        bnode(complementBnode),
        iri(thenRef, curie)
      ], curie), curie));
      andItems.push(bnode(orBnode));
    }

    // else branch: sh:or [ if, else ]
    if (elseRef !== undefined) {
      const orBnode = nextBnode();

      quads.push(quad(orBnode, 'sh:or', rdfList([
        iri(ifRef, curie),
        iri(elseRef, curie)
      ], curie), curie));
      andItems.push(bnode(orBnode));
    }
  }
}
