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
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from './QuadFactory.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';
import { VocabProjection } from './VocabProjection.js';

const XSD_IRI_PREFIX = STANDARD_PREFIXES.xsd;

function resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndexInterface>): string {
  const targetEntry = index.get(targetNodeId);

  if (targetEntry === undefined) {
    return targetNodeId;
  }

  const rangeRels = targetEntry.byPredicate.get(RDFS.range) ?? [];

  if (rangeRels.length > 0) {
    return ProjectionIndex.relationTargetId(rangeRels[0]);
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

    if (ProjectionIndex.isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom) {
      return true;
    }
  }

  if (parts.fragment === null || parts.fragment === '') {
    return true;
  }

  return false;
}

class ShaclVocabProjection extends VocabProjection {
  private readonly index: Map<string, RelationIndexInterface>;

  constructor(index: Map<string, RelationIndexInterface>) {
    super();
    this.index = index;
  }

  combineUnionBranches(
    withoutTrigger: QuadObjectType,
    reqRestrictions: QuadObjectType[],
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const reqBnode = QuadFactory.nextBnode(issuer);

    for (const reqItem of reqRestrictions) {
      quads.push(QuadFactory.quad(reqBnode, SH.property, reqItem, { curie }));
    }

    const orBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
      withoutTrigger,
      QuadFactory.bnode(reqBnode)
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(orBnode);
  }

  emitConditionalElseBranch(
    ifRef: string,
    elseRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const orBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
      QuadFactory.iri(ifRef, { curie }),
      QuadFactory.iri(elseRef, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(orBnode);
  }

  emitConditionalThenBranch(
    ifRef: string,
    thenRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const complementBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(complementBnode, SH.not, QuadFactory.iri(ifRef, { curie }), { curie }));

    const orBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
      QuadFactory.bnode(complementBnode),
      QuadFactory.iri(thenRef, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(orBnode);
  }

  emitDependentSchemaBranch(
    subject: string,
    ifRef: string,
    thenRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const withoutPsBnode = QuadFactory.nextBnode(issuer);

    const psTypeObj = QuadFactory.iri(SH.PropertyShape, { curie });
    const ifPathObj = QuadFactory.iri(ifRef, { curie });
    const minCountOne = QuadFactory.literal(1, XSD.integer, { curie });

    quads.push(QuadFactory.quad(withoutPsBnode, RDF.type, psTypeObj, { curie }));
    quads.push(QuadFactory.quad(withoutPsBnode, SH.path, ifPathObj, { curie }));
    quads.push(QuadFactory.quad(withoutPsBnode, SH.minCount, minCountOne, { curie }));

    const withoutContainerBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutContainerBnode, SH.property, QuadFactory.bnode(withoutPsBnode), { curie }));

    const withoutWrapperBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutWrapperBnode, SH.not, QuadFactory.bnode(withoutContainerBnode), { curie }));

    const depShapeBnode = QuadFactory.nextBnode(issuer);
    const nodeShapeTypeObj = QuadFactory.iri(SH.NodeShape, { curie });

    quads.push(QuadFactory.quad(depShapeBnode, RDF.type, nodeShapeTypeObj, { curie }));

    const depEntry = this.index.get(thenRef);

    if (depEntry?.byPredicate.has(SH.closed) === true) {
      const trueLit = QuadFactory.literal(true, XSD.boolean, { curie });

      quads.push(QuadFactory.quad(depShapeBnode, SH.closed, trueLit, { curie }));
    }

    for (const [
      propSubject,
      propEntry
    ] of this.index) {
      if (!SchemaIri.isPropertySubject(propSubject)) {
        continue;
      }

      const domainRels = propEntry.byPredicate.get(RDFS.domain) ?? [];

      if (domainRels.length === 0 || ProjectionIndex.relationTargetId(domainRels[0]) !== thenRef) {
        continue;
      }

      const psBnode = QuadFactory.nextBnode(issuer);

      emitPropertyShape(psBnode, propSubject, propEntry, subject, subject, quads, curie, issuer);
      quads.push(QuadFactory.quad(depShapeBnode, SH.property, QuadFactory.bnode(psBnode), { curie }));
    }

    const orBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(orBnode, SH.or, QuadFactory.rdfList([
      QuadFactory.bnode(withoutWrapperBnode),
      QuadFactory.bnode(depShapeBnode)
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(orBnode);
  }

  emitNotTriggerBranch(
    triggerPropIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const withoutPsBnode = QuadFactory.nextBnode(issuer);

    const psTypeObj2 = QuadFactory.iri(SH.PropertyShape, { curie });
    const triggerPathObj = QuadFactory.iri(triggerPropIri, { curie });
    const minCountOne2 = QuadFactory.literal(1, XSD.integer, { curie });

    quads.push(QuadFactory.quad(withoutPsBnode, RDF.type, psTypeObj2, { curie }));
    quads.push(QuadFactory.quad(withoutPsBnode, SH.path, triggerPathObj, { curie }));
    quads.push(QuadFactory.quad(withoutPsBnode, SH.minCount, minCountOne2, { curie }));

    const innerBnode = QuadFactory.nextBnode(issuer);
    const complementBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(complementBnode, SH.not, QuadFactory.bnode(innerBnode), { curie }));

    const withoutContainerBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutContainerBnode, SH.property, QuadFactory.bnode(withoutPsBnode), { curie }));

    const withoutWrapperBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutWrapperBnode, SH.not, QuadFactory.bnode(withoutContainerBnode), { curie }));

    return QuadFactory.bnode(withoutWrapperBnode);
  }

  emitRequiredPropertyBranch(
    propIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const reqPsBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(reqPsBnode, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));
    quads.push(QuadFactory.quad(reqPsBnode, SH.path, QuadFactory.iri(propIri, { curie }), { curie }));
    quads.push(QuadFactory.quad(reqPsBnode, SH.minCount, QuadFactory.literal(1, XSD.integer, { curie }), { curie }));

    return QuadFactory.bnode(reqPsBnode);
  }

  wrapConditionalBranches(branches: QuadObjectType[]): QuadObjectType[] {
    return branches;
  }
}

export const ShaclProjection = {
  graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined;
    'issuer'?: IdentifierIssuerInterface | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const issuer = options?.issuer ?? new IdentifierIssuer();
    const quads: QuadInterface[] = [];
    const allRelations = graph.allRelations();
    const index = ProjectionIndex.build(allRelations);

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

    const shaclVocab = new ShaclVocabProjection(index);

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

      emitNodeShape(subject, entry, index, propertyIndex, shaclVocab, quads, curie, issuer);
    }

    return quads;
  }
} as const;

function emitNodeShape(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  propertyIndex: Map<string, string[]>,
  shaclVocab: ShaclVocabProjection,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
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

  QuadFactory.emitConstraintLiteral(subject, entry, SH.minCount, XSD.integer, quads, { curie });
  QuadFactory.emitConstraintLiteral(subject, entry, SH.maxCount, XSD.integer, quads, { curie });

  const propSubjects = propertyIndex.get(subject) ?? [];

  for (const propSubject of propSubjects) {
    if (SchemaIri.fragmentContains(propSubject, '/dependentSchemas/')) {
      continue;
    }

    const propEntry = index.get(propSubject);

    if (propEntry === undefined) {
      continue;
    }

    const psBnode = QuadFactory.nextBnode(issuer);

    emitPropertyShape(psBnode, propSubject, propEntry, subject, undefined, quads, curie, issuer);
    quads.push(QuadFactory.quad(subject, SH.property, QuadFactory.bnode(psBnode), { curie }));
  }

  emitContainsPropertyShape(subject, entry, quads, curie, issuer);

  const andItems: QuadObjectType[] = [];

  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

  for (const rel of subClassRels) {
    andItems.push(QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie }));
  }

  const depReqItems = shaclVocab.processDependentRequired(subject, entry, quads, curie, issuer);
  const depSchemaItems = shaclVocab.processDependentSchemas(subject, entry, quads, curie, issuer);
  const conditionalItems = shaclVocab.processConditionals(entry, quads, curie, issuer);

  andItems.push(...depReqItems, ...depSchemaItems, ...conditionalItems);

  if (andItems.length > 0) {
    quads.push(QuadFactory.quad(subject, SH.and, QuadFactory.rdfList(andItems, quads, issuer), { curie }));
  }

  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const orItems = equivRels.map((rel) => {
      return QuadFactory.iri(resolveTargetRef(ProjectionIndex.relationTargetId(rel), index), { curie });
    });

    quads.push(QuadFactory.quad(subject, SH.or, QuadFactory.rdfList(orItems, quads, issuer), { curie }));
  }

  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    const compRef = resolveTargetRef(ProjectionIndex.relationTargetId(complementRels[0]), index);

    quads.push(QuadFactory.quad(subject, SH.not, QuadFactory.iri(compRef, { curie }), { curie }));
  }

  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (complementRels.length === 0 && disjointRels.length > 0) {
    const disjRef = resolveTargetRef(ProjectionIndex.relationTargetId(disjointRels[0]), index);

    quads.push(QuadFactory.quad(subject, SH.not, QuadFactory.iri(disjRef, { curie }), { curie }));
  }

  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const values = oneOfRels.map((rel) => {
      return QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, { curie });
    });

    quads.push(QuadFactory.quad(subject, SH.in, QuadFactory.rdfList(values, quads, issuer), { curie }));
  }
}

function emitPropertyShape(
  bnodeId: string,
  subject: string,
  entry: RelationIndexInterface,
  classId: string,
  overridePathClassId: string | undefined,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  _issuer?: IdentifierIssuerInterface
): void {
  const opts = { curie };

  quads.push(QuadFactory.quad(bnodeId, RDF.type, QuadFactory.iri(SH.PropertyShape, opts), opts));

  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const pathClassId = overridePathClassId
    ?? (domainRels.length > 0 ? ProjectionIndex.relationTargetId(domainRels[0]) : classId);
  const propName = SchemaIri.lastSegment(subject);
  const canonicalId = SchemaIri.propertyIri(pathClassId, propName);

  quads.push(QuadFactory.quad(bnodeId, SH.path, QuadFactory.iri(canonicalId, opts), opts));

  QuadFactory.emitLiterals(bnodeId, entry, RDFS.label, SH.name, quads, opts);

  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];

  if (datatypeRels.length > 0 && rangeRels.length === 0) {
    const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRels[0]), opts);

    quads.push(QuadFactory.quad(bnodeId, SH.datatype, datatypeIri, opts));
  }

  const minCountRels = entry.byPredicate.get(SH.minCount) ?? [];

  if (minCountRels.length > 0) {
    const minCount = QuadFactory.literal(Number(ProjectionIndex.relationTargetId(minCountRels[0])), XSD.integer, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.minCount, minCount, opts));
  }

  const maxCountRels = entry.byPredicate.get(SH.maxCount) ?? [];

  if (maxCountRels.length > 0) {
    const maxCount = QuadFactory.literal(Number(ProjectionIndex.relationTargetId(maxCountRels[0])), XSD.integer, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.maxCount, maxCount, opts));
  }

  if (rangeRels.length > 0) {
    const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRels[0]), opts);

    if (datatypeRels.length > 0 || rangeRels.length > 1) {
      quads.push(QuadFactory.quad(bnodeId, SH.class, rangeIri, opts));
    } else {
      quads.push(QuadFactory.quad(bnodeId, SH.node, rangeIri, opts));
    }
  }

  const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

  if (hasValueRels.length > 0) {
    const hasValueLit = QuadFactory.literal(ProjectionIndex.relationTargetId(hasValueRels[0]), XSD.string, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.hasValue, hasValueLit, opts));
  }

  const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty === true) {
      continue;
    }
    const patternLit = QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.pattern, patternLit, opts));
  }

  QuadFactory.emitConstraintLiteral(bnodeId, entry, SH.minLength, XSD.integer, quads, opts);
  QuadFactory.emitConstraintLiteral(bnodeId, entry, SH.maxLength, XSD.integer, quads, opts);
  QuadFactory.emitConstraintLiteral(bnodeId, entry, SH.minInclusive, XSD.decimal, quads, opts);
  QuadFactory.emitConstraintLiteral(bnodeId, entry, SH.maxInclusive, XSD.decimal, quads, opts);
  QuadFactory.emitConstraintLiteral(bnodeId, entry, SH.minExclusive, XSD.decimal, quads, opts);
  QuadFactory.emitConstraintLiteral(bnodeId, entry, SH.maxExclusive, XSD.decimal, quads, opts);
  QuadFactory.emitConstraintLiteral(bnodeId, entry, JT.multipleOf, XSD.decimal, quads, opts);

  QuadFactory.emitLiterals(bnodeId, entry, RDFS.comment, SH.description, quads, opts);

  if (entry.byPredicate.has(DASH.readOnly)) {
    quads.push(QuadFactory.quad(bnodeId, DASH.readOnly, QuadFactory.literal(true, XSD.boolean, opts), opts));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    quads.push(QuadFactory.quad(bnodeId, DASH.writeOnly, QuadFactory.literal(true, XSD.boolean, opts), opts));
  }

  QuadFactory.emitLiterals(bnodeId, entry, DCT.format, DCT.format, quads, opts);
}

function emitContainsPropertyShape(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
): void {
  const containsRels = entry.all.filter((rel) => {
    return ProjectionIndex.isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom;
  });

  if (containsRels.length === 0) {
    return;
  }

  const structure = containsRels[0].structure;

  if (!ProjectionIndex.isRestrictionStructure(structure)) {
    return;
  }

  const containsTypeId = String(structure.value);
  const psBnode = QuadFactory.nextBnode(issuer);

  const containsIri = QuadFactory.iri(containsTypeId, { curie });

  if (containsTypeId.startsWith(XSD_IRI_PREFIX)) {
    const qvsBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(qvsBnode, SH.datatype, containsIri, { curie }));
    quads.push(QuadFactory.quad(psBnode, SH.qualifiedValueShape, QuadFactory.bnode(qvsBnode), { curie }));
  } else {
    quads.push(QuadFactory.quad(psBnode, SH.qualifiedValueShape, containsIri, { curie }));
  }

  const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];

  if (minQualRels.length > 0) {
    const minVal = Number(ProjectionIndex.relationTargetId(minQualRels[0]));
    const minLit = QuadFactory.literal(minVal, XSD.integer, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedMinCount, minLit, { curie }));
  }

  const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

  if (maxQualRels.length > 0) {
    const maxVal = Number(ProjectionIndex.relationTargetId(maxQualRels[0]));
    const maxLit = QuadFactory.literal(maxVal, XSD.integer, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedMaxCount, maxLit, { curie }));
  }

  quads.push(QuadFactory.quad(subject, SH.property, QuadFactory.bnode(psBnode), { curie }));
}
