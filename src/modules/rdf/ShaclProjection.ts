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
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from './QuadFactory.js';
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

function isSerializationCandidate(
  subject: string,
  entry: RelationIndexInterface,
  propertyIndex: Map<string, string[]>
): boolean {
  if (SchemaIri.isPropertySubject(subject)) {
    return false;
  }

  const parts = SchemaIri.splitSubject(subject);

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

export function projectShaclGraph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined }): QuadInterface[] {
  const { curie } = options ?? {};
  const quads: QuadInterface[] = [];
  const allRelations = graph.allRelations();
  const index = buildIndex(allRelations);

  const propertyIndex = new Map<string, string[]>();

  for (const [subject] of index) {
    if (subject.startsWith('_:') || !SchemaIri.isPropertySubject(subject)) {
      continue;
    }

    const parentId = SchemaIri.structuralParent(subject);
    const list = propertyIndex.get(parentId) ?? [];

    list.push(subject);
    propertyIndex.set(parentId, list);
  }

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

function emitNodeShape(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  propertyIndex: Map<string, string[]>,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(SH.NodeShape, { curie }), { curie }));

  QuadFactory.emitLiterals(subject, entry, RDFS.label, SH.name, quads, { curie });
  QuadFactory.emitLiterals(subject, entry, RDFS.comment, SH.description, quads, { curie });

  if (entry.byPredicate.has(OWL.deprecated)) {
    quads.push(QuadFactory.quad(subject, SH.deactivated, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  if (entry.byPredicate.has(SH.closed)) {
    quads.push(QuadFactory.quad(subject, SH.closed, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  emitConstraintLiteral(subject, entry, SH.minCount, XSD.integer, quads, curie);
  emitConstraintLiteral(subject, entry, SH.maxCount, XSD.integer, quads, curie);

  const propSubjects = propertyIndex.get(subject) ?? [];

  for (const propSubject of propSubjects) {
    if (SchemaIri.fragmentContains(propSubject, '/dependentSchemas/')) {
      continue;
    }

    const propEntry = index.get(propSubject);

    if (propEntry === undefined) {
      continue;
    }

    const psBnode = QuadFactory.nextBnode();

    emitPropertyShape(psBnode, propSubject, propEntry, subject, undefined, quads, curie);
    quads.push(QuadFactory.quad(subject, SH.property, QuadFactory.bnode(psBnode), { curie }));
  }

  emitContainsPropertyShape(subject, entry, quads, curie);

  const andItems: QuadObjectType[] = [];

  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

  for (const rel of subClassRels) {
    andItems.push(QuadFactory.iri(relationTargetId(rel), { curie }));
  }

  emitDependentRequiredAndItems(subject, entry, andItems, quads, curie);
  emitDependentSchemaAndItems(subject, entry, index, andItems, quads, curie);
  emitConditionalAndItems(entry, andItems, quads, curie);

  if (andItems.length > 0) {
    quads.push(QuadFactory.quad(subject, SH.and, QuadFactory.rdfList(andItems), { curie }));
  }

  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const orItems = equivRels.map((rel) => {
      return QuadFactory.iri(resolveTargetRef(relationTargetId(rel), index), { curie });
    });

    quads.push(QuadFactory.quad(subject, SH.or, QuadFactory.rdfList(orItems), { curie }));
  }

  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    const compRef = resolveTargetRef(relationTargetId(complementRels[0]), index);

    quads.push(QuadFactory.quad(subject, SH.not, QuadFactory.iri(compRef, { curie }), { curie }));
  }

  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (complementRels.length === 0 && disjointRels.length > 0) {
    const disjRef = resolveTargetRef(relationTargetId(disjointRels[0]), index);

    quads.push(QuadFactory.quad(subject, SH.not, QuadFactory.iri(disjRef, { curie }), { curie }));
  }

  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const values = oneOfRels.map((rel) => {
      return QuadFactory.literal(relationTargetId(rel), XSD.string, { curie });
    });

    quads.push(QuadFactory.quad(subject, SH.in, QuadFactory.rdfList(values), { curie }));
  }
}

function emitPropertyShape(
  bnodeId: string,
  subject: string,
  entry: RelationIndexInterface,
  classId: string,
  overridePathClassId: string | undefined,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  quads.push(QuadFactory.quad(bnodeId, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));

  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const pathClassId = overridePathClassId ?? (domainRels.length > 0 ? relationTargetId(domainRels[0]) : classId);
  const propName = SchemaIri.lastSegment(subject);
  const canonicalId = SchemaIri.propertyIri(pathClassId, propName);

  quads.push(QuadFactory.quad(bnodeId, SH.path, QuadFactory.iri(canonicalId, { curie }), { curie }));

  QuadFactory.emitLiterals(bnodeId, entry, RDFS.label, SH.name, quads, { curie });

  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];

  if (datatypeRels.length > 0 && rangeRels.length === 0) {
    const dtIri = QuadFactory.iri(relationTargetId(datatypeRels[0]), { curie });

    quads.push(QuadFactory.quad(bnodeId, SH.datatype, dtIri, { curie }));
  }

  const minCountRels = entry.byPredicate.get(SH.minCount) ?? [];

  if (minCountRels.length > 0) {
    const minVal = Number(relationTargetId(minCountRels[0]));

    quads.push(QuadFactory.quad(bnodeId, SH.minCount, QuadFactory.literal(minVal, XSD.integer, { curie }), { curie }));
  }

  const maxCountRels = entry.byPredicate.get(SH.maxCount) ?? [];

  if (maxCountRels.length > 0) {
    const maxVal = Number(relationTargetId(maxCountRels[0]));

    quads.push(QuadFactory.quad(bnodeId, SH.maxCount, QuadFactory.literal(maxVal, XSD.integer, { curie }), { curie }));
  }

  if (rangeRels.length > 0) {
    if (datatypeRels.length > 0 || rangeRels.length > 1) {
      const rangeIri = QuadFactory.iri(relationTargetId(rangeRels[0]), { curie });

      quads.push(QuadFactory.quad(bnodeId, SH.class, rangeIri, { curie }));
    } else {
      const rangeIri = QuadFactory.iri(relationTargetId(rangeRels[0]), { curie });

      quads.push(QuadFactory.quad(bnodeId, SH.node, rangeIri, { curie }));
    }
  }

  const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

  if (hasValueRels.length > 0) {
    const hasValLit = QuadFactory.literal(relationTargetId(hasValueRels[0]), XSD.string, { curie });

    quads.push(QuadFactory.quad(bnodeId, SH.hasValue, hasValLit, { curie }));
  }

  const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty === true) {
      continue;
    }

    const patternLit = QuadFactory.literal(relationTargetId(rel), XSD.string, { curie });

    quads.push(QuadFactory.quad(bnodeId, SH.pattern, patternLit, { curie }));
  }

  emitConstraintLiteral(bnodeId, entry, SH.minLength, XSD.integer, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.maxLength, XSD.integer, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.minInclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.maxInclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.minExclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, SH.maxExclusive, XSD.decimal, quads, curie);
  emitConstraintLiteral(bnodeId, entry, JT.multipleOf, XSD.decimal, quads, curie);

  QuadFactory.emitLiterals(bnodeId, entry, RDFS.comment, SH.description, quads, { curie });

  if (entry.byPredicate.has(DASH.readOnly)) {
    quads.push(QuadFactory.quad(bnodeId, DASH.readOnly, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    quads.push(QuadFactory.quad(bnodeId, DASH.writeOnly, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  QuadFactory.emitLiterals(bnodeId, entry, DCT.format, DCT.format, quads, { curie });
}

function emitConstraintLiteral(
  bnodeId: string,
  entry: RelationIndexInterface,
  predicate: string,
  datatype: string,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const rels = entry.byPredicate.get(predicate) ?? [];

  if (rels.length > 0) {
    const numLit = QuadFactory.literal(Number(relationTargetId(rels[0])), datatype, { curie });

    quads.push(QuadFactory.quad(bnodeId, predicate, numLit, { curie }));
  }
}

function emitContainsPropertyShape(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
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

  const psBnode = QuadFactory.nextBnode();

  if (containsTypeId.startsWith(XSD_PREFIX)) {
    const qvsBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(qvsBnode, SH.datatype, QuadFactory.iri(containsTypeId, { curie }), { curie }));
    quads.push(QuadFactory.quad(psBnode, SH.qualifiedValueShape, QuadFactory.bnode(qvsBnode), { curie }));
  } else {
    const containsIri = QuadFactory.iri(containsTypeId, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedValueShape, containsIri, { curie }));
  }

  const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];

  if (minQualRels.length > 0) {
    const minQualVal = Number(relationTargetId(minQualRels[0]));

    const minQLit = QuadFactory.literal(minQualVal, XSD.integer, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedMinCount, minQLit, { curie }));
  }

  const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

  if (maxQualRels.length > 0) {
    const maxQualVal = Number(relationTargetId(maxQualRels[0]));

    const maxQLit = QuadFactory.literal(maxQualVal, XSD.integer, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedMaxCount, maxQLit, { curie }));
  }

  quads.push(QuadFactory.quad(subject, SH.property, QuadFactory.bnode(psBnode), { curie }));
}

function emitDependentRequiredAndItems(
  subject: string,
  entry: RelationIndexInterface,
  andItems: QuadObjectType[],
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const depReqRels = entry.byPredicate.get(JT.dependentRequired) ?? [];

  for (const rel of depReqRels) {
    const meta = rel.metadata ?? {};
    const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
    const required = Array.isArray(meta.required) ? meta.required as string[] : [];

    const triggerPropIri = SchemaIri.propertyIri(subject, trigger);

    const withoutPsBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutPsBnode, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutPsBnode, SH.path, QuadFactory.iri(triggerPropIri, { curie }), { curie }));
    const minCountLit = QuadFactory.literal(1, XSD.integer, { curie });

    quads.push(QuadFactory.quad(withoutPsBnode, SH.minCount, minCountLit, { curie }));

    const complementBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(complementBnode, SH.not, QuadFactory.bnode(QuadFactory.nextBnode()), { curie }));

    const withoutContainerBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutContainerBnode, SH.property, QuadFactory.bnode(withoutPsBnode), { curie }));

    const withoutWrapperBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutWrapperBnode, SH.not, QuadFactory.bnode(withoutContainerBnode), { curie }));

    const reqBnode = QuadFactory.nextBnode();

    for (const reqProp of required) {
      const reqPsBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(reqPsBnode, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));
      const reqPathIri = QuadFactory.iri(SchemaIri.propertyIri(subject, reqProp), { curie });

      quads.push(QuadFactory.quad(reqPsBnode, SH.path, reqPathIri, { curie }));
      quads.push(QuadFactory.quad(reqPsBnode, SH.minCount, QuadFactory.literal(1, XSD.integer, { curie }), { curie }));
      quads.push(QuadFactory.quad(reqBnode, SH.property, QuadFactory.bnode(reqPsBnode), { curie }));
    }

    const orBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
      QuadFactory.bnode(withoutWrapperBnode),
      QuadFactory.bnode(reqBnode)
    ]), { curie }));

    andItems.push(QuadFactory.bnode(orBnode));
  }
}

function emitDependentSchemaAndItems(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  andItems: QuadObjectType[],
  quads: QuadInterface[],
  curie: CurieInterface | undefined
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

    const withoutPsBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutPsBnode, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutPsBnode, SH.path, QuadFactory.iri(ifRef, { curie }), { curie }));
    const minCountLit = QuadFactory.literal(1, XSD.integer, { curie });

    quads.push(QuadFactory.quad(withoutPsBnode, SH.minCount, minCountLit, { curie }));

    const withoutContainerBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutContainerBnode, SH.property, QuadFactory.bnode(withoutPsBnode), { curie }));

    const withoutWrapperBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutWrapperBnode, SH.not, QuadFactory.bnode(withoutContainerBnode), { curie }));

    const depShapeBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(depShapeBnode, RDF.type, QuadFactory.iri(SH.NodeShape, { curie }), { curie }));

    const depEntry = index.get(thenRef);

    if (depEntry?.byPredicate.has(SH.closed) === true) {
      const trueLit = QuadFactory.literal(true, XSD.boolean, { curie });

      quads.push(QuadFactory.quad(depShapeBnode, SH.closed, trueLit, { curie }));
    }

    for (const [
      propSubject,
      propEntry
    ] of index) {
      if (!SchemaIri.isPropertySubject(propSubject)) {
        continue;
      }

      const domainRels = propEntry.byPredicate.get(RDFS.domain) ?? [];

      if (domainRels.length === 0 || relationTargetId(domainRels[0]) !== thenRef) {
        continue;
      }

      const psBnode = QuadFactory.nextBnode();

      emitPropertyShape(psBnode, propSubject, propEntry, subject, subject, quads, curie);
      quads.push(QuadFactory.quad(depShapeBnode, SH.property, QuadFactory.bnode(psBnode), { curie }));
    }

    const orBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
      QuadFactory.bnode(withoutWrapperBnode),
      QuadFactory.bnode(depShapeBnode)
    ]), { curie }));

    andItems.push(QuadFactory.bnode(orBnode));
  }
}

function emitConditionalAndItems(
  entry: RelationIndexInterface,
  andItems: QuadObjectType[],
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      elseRef, ifRef, thenRef
    } = rel.structure;

    if (thenRef?.includes('/dependentSchemas/') === true) {
      continue;
    }

    if (thenRef !== undefined) {
      const complementBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(complementBnode, SH.not, QuadFactory.iri(ifRef, { curie }), { curie }));

      const orBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
        QuadFactory.bnode(complementBnode),
        QuadFactory.iri(thenRef, { curie })
      ]), { curie }));
      andItems.push(QuadFactory.bnode(orBnode));
    }

    if (elseRef !== undefined) {
      const orBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
        QuadFactory.iri(ifRef, { curie }),
        QuadFactory.iri(elseRef, { curie })
      ]), { curie }));
      andItems.push(QuadFactory.bnode(orBnode));
    }
  }
}
