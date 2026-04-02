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
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { XSD_PREFIX } from '../../constants/PREFIXES.js';
import {
  fragmentContains, isPropertySubject, lastSegment,
  propertyIri, splitSubject, structuralParent
} from '../graph/SchemaIri.js';
import {
  bnode, emitLiterals, iri, literal, nextBnode, quad, rdfList
} from './QuadFactory.js';
import {
  buildIndex, isRestrictionStructure,
  relationTargetId
} from './ProjectionIndex.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';

function resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndexInterface>): string {
  const targetEntry = index.get(targetNodeId);

  if (targetEntry === undefined) {
    return targetNodeId;
  }

  const rangeRels = targetEntry.byPredicate.get(RDFS.range) ?? [];

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

  const parts = splitSubject(subject);

  if (parts.fragment !== null) {
    if (parts.fragment.includes('/items') || parts.fragment.includes('/contains')
      || parts.fragment.includes('/prefixItems/') || parts.fragment.includes('/patternProperties/')) {
      return false;
    }

    if (parts.fragment.includes('/dependentSchemas/')) {
      return false;
    }

    if (parts.fragment === '/if' || parts.fragment === '/then' || parts.fragment === '/else') {
      return false;
    }
  }

  if (entry.types.includes(OWL.Class)) {
    return true;
  }

  const props = propertyIndex.get(subject);

  if (props !== undefined && props.length > 0) {
    return true;
  }

  if (entry.byPredicate.has(RDFS.subClassOf) || entry.byPredicate.has(OWL.equivalentClass)
    || entry.byPredicate.has(OWL.complementOf) || entry.byPredicate.has(OWL.disjointWith)
    || entry.byPredicate.has(OWL.oneOf) || entry.byPredicate.has(RDFS.member)
    || entry.byPredicate.has(SH.pattern) || entry.byPredicate.has(JT.dependentRequired)) {
    return true;
  }

  // Check for conditional structured relations
  for (const rel of entry.all) {
    if (rel.structure?.kind === 'conditional') {
      return true;
    }

    if (isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom) {
      return true;
    }
  }

  if (parts.fragment === null || parts.fragment === '') {
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
  quads.push(quad(subject, RDF.type, iri(SH.NodeShape, curie), curie));

  // sh:name from rdfs:label
  emitLiterals(subject, entry, RDFS.label, SH.name, quads, curie);

  // sh:description from rdfs:comment
  emitLiterals(subject, entry, RDFS.comment, SH.description, quads, curie);

  // sh:deactivated from owl:deprecated
  if (entry.byPredicate.has(OWL.deprecated)) {
    quads.push(quad(subject, SH.deactivated, literal(true, XSD.boolean, curie), curie));
  }

  // sh:closed
  if (entry.byPredicate.has(SH.closed)) {
    quads.push(quad(subject, SH.closed, literal(true, XSD.boolean, curie), curie));
  }

  // Array cardinality on node shapes (minItems/maxItems → sh:minCount/sh:maxCount)
  emitConstraintLiteral(subject, entry, SH.minCount, XSD.integer, quads, curie);
  emitConstraintLiteral(subject, entry, SH.maxCount, XSD.integer, quads, curie);

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
    quads.push(quad(subject, SH.property, bnode(psBnode), curie));
  }

  // sh:property — contains (sh:qualifiedValueShape)
  emitContainsPropertyShape(subject, entry, quads, curie);

  // sh:and entries
  const andItems: QuadObjectType[] = [];

  // rdfs:subClassOf → sh:and
  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

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
    quads.push(quad(subject, SH.and, rdfList(andItems), curie));
  }

  // sh:or from owl:equivalentClass
  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const orItems = equivRels.map((rel) => {
      return iri(resolveTargetRef(relationTargetId(rel), index), curie);
    });

    quads.push(quad(subject, SH.or, rdfList(orItems), curie));
  }

  // sh:not from owl:complementOf
  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    quads.push(quad(subject, SH.not, iri(resolveTargetRef(relationTargetId(complementRels[0]), index), curie), curie));
  }

  // sh:not from owl:disjointWith (fallback)
  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (complementRels.length === 0 && disjointRels.length > 0) {
    quads.push(quad(subject, SH.not, iri(resolveTargetRef(relationTargetId(disjointRels[0]), index), curie), curie));
  }

  // sh:in from owl:oneOf
  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const values = oneOfRels.map((rel) => {
      return literal(relationTargetId(rel), XSD.string, curie);
    });

    quads.push(quad(subject, SH.in, rdfList(values), curie));
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
  quads.push(quad(bnodeId, RDF.type, iri(SH.PropertyShape, curie), curie));

  // sh:path — use rdfs:domain for path class, unless overridden
  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const pathClassId = overridePathClassId ?? (domainRels.length > 0 ? relationTargetId(domainRels[0]) : classId);
  const propName = lastSegment(subject);
  const canonicalId = propertyIri(pathClassId, propName);

  quads.push(quad(bnodeId, SH.path, iri(canonicalId, curie), curie));

  // sh:name from rdfs:label
  emitLiterals(bnodeId, entry, RDFS.label, SH.name, quads, curie);

  // sh:datatype
  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];

  if (datatypeRels.length > 0 && rangeRels.length === 0) {
    quads.push(quad(bnodeId, SH.datatype, iri(relationTargetId(datatypeRels[0]), curie), curie));
  }

  // sh:minCount
  const minCountRels = entry.byPredicate.get(SH.minCount) ?? [];

  if (minCountRels.length > 0) {
    const minVal = Number(relationTargetId(minCountRels[0]));

    quads.push(quad(bnodeId, SH.minCount, literal(minVal, XSD.integer, curie), curie));
  }

  // sh:maxCount
  const maxCountRels = entry.byPredicate.get(SH.maxCount) ?? [];

  if (maxCountRels.length > 0) {
    const maxVal = Number(relationTargetId(maxCountRels[0]));

    quads.push(quad(bnodeId, SH.maxCount, literal(maxVal, XSD.integer, curie), curie));
  }

  // sh:node or sh:class from rdfs:range
  if (rangeRels.length > 0) {
    if (datatypeRels.length > 0 || rangeRels.length > 1) {
      quads.push(quad(bnodeId, SH.class, iri(relationTargetId(rangeRels[0]), curie), curie));
    } else {
      quads.push(quad(bnodeId, SH.node, iri(relationTargetId(rangeRels[0]), curie), curie));
    }
  }

  // sh:hasValue from owl:hasValue
  const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

  if (hasValueRels.length > 0) {
    quads.push(quad(bnodeId, SH.hasValue, literal(relationTargetId(hasValueRels[0]), XSD.string, curie), curie));
  }

  // sh:pattern from sh:pattern (overrides format pattern)
  const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty === true) {
      continue;
    }

    quads.push(quad(bnodeId, SH.pattern, literal(relationTargetId(rel), XSD.string, curie), curie));
  }

  // Numeric/string constraints
  emitConstraintLiteral(bnodeId, entry, SH.minLength, XSD.integer, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.maxLength, XSD.integer, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.minInclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.maxInclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.minExclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.maxExclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, JT.multipleOf, XSD.decimal, quads, curie);

  // sh:description from rdfs:comment
  emitLiterals(bnodeId, entry, RDFS.comment, SH.description, quads, curie);

  // dash:readOnly / dash:writeOnly
  if (entry.byPredicate.has(DASH.readOnly)) {
    quads.push(quad(bnodeId, DASH.readOnly, literal(true, XSD.boolean, curie), curie));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    quads.push(quad(bnodeId, DASH.writeOnly, literal(true, XSD.boolean, curie), curie));
  }

  // dct:format
  emitLiterals(bnodeId, entry, DCT.format, DCT.format, quads, curie);
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
    && rel.structure.constraint === OWL.someValuesFrom;
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
  if (containsTypeId.startsWith(XSD_PREFIX)) {
    const qvsBnode = nextBnode();

    quads.push(quad(qvsBnode, SH.datatype, iri(containsTypeId, curie), curie));
    quads.push(quad(psBnode, SH.qualifiedValueShape, bnode(qvsBnode), curie));
  } else {
    quads.push(quad(psBnode, SH.qualifiedValueShape, iri(containsTypeId, curie), curie));
  }

  // sh:qualifiedMinCount
  const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];

  if (minQualRels.length > 0) {
    const minQualVal = Number(relationTargetId(minQualRels[0]));

    quads.push(quad(psBnode, SH.qualifiedMinCount, literal(minQualVal, XSD.integer, curie), curie));
  }

  // sh:qualifiedMaxCount
  const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

  if (maxQualRels.length > 0) {
    const maxQualVal = Number(relationTargetId(maxQualRels[0]));

    quads.push(quad(psBnode, SH.qualifiedMaxCount, literal(maxQualVal, XSD.integer, curie), curie));
  }

  quads.push(quad(subject, SH.property, bnode(psBnode), curie));
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
  const depReqRels = entry.byPredicate.get(JT.dependentRequired) ?? [];

  for (const rel of depReqRels) {
    const meta = rel.metadata ?? {};
    const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
    const required = Array.isArray(meta.required) ? meta.required as string[] : [];

    const triggerPropIri = propertyIri(subject, trigger);

    // sh:not branch: sh:not { sh:property [sh:path triggerProp, sh:minCount 1] }
    const withoutPsBnode = nextBnode();

    quads.push(quad(withoutPsBnode, RDF.type, iri(SH.PropertyShape, curie), curie));
    quads.push(quad(withoutPsBnode, SH.path, iri(triggerPropIri, curie), curie));
    quads.push(quad(withoutPsBnode, SH.minCount, literal(1, XSD.integer, curie), curie));

    const complementBnode = nextBnode();

    // placeholder — sh:not needs a node with sh:property
    quads.push(quad(complementBnode, SH.not, bnode(nextBnode()), curie));

    // Build: { sh:not: { sh:property: [{ sh:path, sh:minCount }] } }
    const withoutContainerBnode = nextBnode();

    quads.push(quad(withoutContainerBnode, SH.property, bnode(withoutPsBnode), curie));

    const withoutWrapperBnode = nextBnode();

    quads.push(quad(withoutWrapperBnode, SH.not, bnode(withoutContainerBnode), curie));

    // Required branch: { sh:property: [{ sh:path, sh:minCount }...] }
    const reqBnode = nextBnode();

    for (const reqProp of required) {
      const reqPsBnode = nextBnode();

      quads.push(quad(reqPsBnode, RDF.type, iri(SH.PropertyShape, curie), curie));
      quads.push(quad(reqPsBnode, SH.path, iri(propertyIri(subject, reqProp), curie), curie));
      quads.push(quad(reqPsBnode, SH.minCount, literal(1, XSD.integer, curie), curie));
      quads.push(quad(reqBnode, SH.property, bnode(reqPsBnode), curie));
    }

    // sh:or: [notWrapper, reqBnode]
    const orBnode = nextBnode();

    quads.push(quad(orBnode, SH.or, rdfList([
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

    // sh:not branch
    const withoutPsBnode = nextBnode();

    quads.push(quad(withoutPsBnode, RDF.type, iri(SH.PropertyShape, curie), curie));
    quads.push(quad(withoutPsBnode, SH.path, iri(ifRef, curie), curie));
    quads.push(quad(withoutPsBnode, SH.minCount, literal(1, XSD.integer, curie), curie));

    const withoutContainerBnode = nextBnode();

    quads.push(quad(withoutContainerBnode, SH.property, bnode(withoutPsBnode), curie));

    const withoutWrapperBnode = nextBnode();

    quads.push(quad(withoutWrapperBnode, SH.not, bnode(withoutContainerBnode), curie));

    // Dependent NodeShape
    const depShapeBnode = nextBnode();

    quads.push(quad(depShapeBnode, RDF.type, iri(SH.NodeShape, curie), curie));

    // sh:closed on dependent schema
    const depEntry = index.get(thenRef);

    if (depEntry?.byPredicate.has(SH.closed) === true) {
      quads.push(quad(depShapeBnode, SH.closed, literal(true, XSD.boolean, curie), curie));
    }

    // Properties belonging to dependent schema (by rdfs:domain match)
    for (const [
      propSubject,
      propEntry
    ] of index) {
      if (!isPropertySubject(propSubject)) {
        continue;
      }

      const domainRels = propEntry.byPredicate.get(RDFS.domain) ?? [];

      if (domainRels.length === 0 || relationTargetId(domainRels[0]) !== thenRef) {
        continue;
      }

      const psBnode = nextBnode();

      emitPropertyShape(psBnode, propSubject, propEntry, subject, subject, quads, curie);
      quads.push(quad(depShapeBnode, SH.property, bnode(psBnode), curie));
    }

    // sh:or: [notWrapper, depShape]
    const orBnode = nextBnode();

    quads.push(quad(orBnode, SH.or, rdfList([
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

      quads.push(quad(complementBnode, SH.not, iri(ifRef, curie), curie));

      const orBnode = nextBnode();

      quads.push(quad(orBnode, SH.or, rdfList([
        bnode(complementBnode),
        iri(thenRef, curie)
      ], curie), curie));
      andItems.push(bnode(orBnode));
    }

    // else branch: sh:or [ if, else ]
    if (elseRef !== undefined) {
      const orBnode = nextBnode();

      quads.push(quad(orBnode, SH.or, rdfList([
        iri(ifRef, curie),
        iri(elseRef, curie)
      ], curie), curie));
      andItems.push(bnode(orBnode));
    }
  }
}
