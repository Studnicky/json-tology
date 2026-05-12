/**
 * OwlProjection — projects SchemaGraph relations into OWL-vocabulary quads.
 *
 * Iterates graph.allRelations() and emits complete OWL patterns:
 * owl:Class, owl:DatatypeProperty/ObjectProperty, owl:Restriction,
 * owl:unionOf/intersectionOf for conditionals, owl:someValuesFrom for
 * contains, etc.
 *
 * Property IRI canonicalization (pointer → Class#name) happens here.
 * The output quads can be passed directly to JsonLdFormatter.quadsToJsonLd().
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import {
  DASH, DCT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { GraphError } from '../../errors/GraphError.js';
import { XsdTypes } from './XsdTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from './QuadFactory.js';
import {
  buildIndex, isListStructure, isRestrictionStructure,
  relationTargetId
} from './ProjectionIndex.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';
import { VocabProjection } from './VocabProjection.js';

function emitRestriction(
  onProperty: string,
  constraint: string,
  constraintValue: QuadObjectType,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): string {
  const rBnode = QuadFactory.nextBnode();

  quads.push(QuadFactory.quad(rBnode, RDF.type, QuadFactory.iri(OWL.Restriction, { curie }), { curie }));
  quads.push(QuadFactory.quad(rBnode, OWL.onProperty, QuadFactory.iri(onProperty, { curie }), { curie }));
  quads.push(QuadFactory.quad(rBnode, constraint, constraintValue, { curie }));

  return rBnode;
}

function canonicalPropertyIri(subject: string): string {
  const parts = SchemaIri.splitSubject(subject);

  if (parts.fragment === null) {
    return subject;
  }

  const propName = SchemaIri.lastSegment(subject);
  const propsIdx = parts.fragment.lastIndexOf('/properties/');

  if (propsIdx === -1) {
    return SchemaIri.propertyIri(parts.base, propName);
  }

  const parentPointer = parts.fragment.slice(0, propsIdx);
  const parentId = parentPointer === '' ? parts.base : `${parts.base}#${parentPointer}`;

  return SchemaIri.propertyIri(parentId, propName);
}

// ---------------------------------------------------------------------------
// OWL vocabulary projection
// ---------------------------------------------------------------------------

class OwlVocabProjection extends VocabProjection {
  combineUnionBranches(
    withoutTrigger: QuadObjectType,
    reqRestrictions: QuadObjectType[],
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType {
    const unionMembers: QuadObjectType[] = [withoutTrigger];

    if (reqRestrictions.length === 1) {
      unionMembers.push(reqRestrictions[0]);
    } else {
      const interBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(interBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
      quads.push(QuadFactory.quad(interBnode, OWL.intersectionOf, QuadFactory.rdfList(reqRestrictions), { curie }));
      unionMembers.push(QuadFactory.bnode(interBnode));
    }

    const unionBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList(unionMembers), { curie }));

    return QuadFactory.bnode(unionBnode);
  }

  emitConditionalElseBranch(
    ifRef: string,
    elseRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType {
    const complementBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(complementBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(complementBnode, OWL.complementOf, QuadFactory.iri(ifRef, { curie }), { curie }));

    const branchBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(branchBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(branchBnode, OWL.intersectionOf, QuadFactory.rdfList([
      QuadFactory.bnode(complementBnode),
      QuadFactory.iri(elseRef, { curie })
    ]), { curie }));

    return QuadFactory.bnode(branchBnode);
  }

  emitConditionalThenBranch(
    ifRef: string,
    thenRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType {
    const branchBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(branchBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(branchBnode, OWL.intersectionOf, QuadFactory.rdfList([
      QuadFactory.iri(ifRef, { curie }),
      QuadFactory.iri(thenRef, { curie })
    ]), { curie }));

    return QuadFactory.bnode(branchBnode);
  }

  emitDependentSchemaBranch(
    _subject: string,
    ifRef: string,
    thenRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType {
    const minOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });
    const restrictionBnode = emitRestriction(ifRef, OWL.minCardinality, minOne, quads, curie);

    const withoutTriggerBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutTriggerBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutTriggerBnode, OWL.complementOf, QuadFactory.bnode(restrictionBnode), { curie }));

    const unionBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList([
      QuadFactory.bnode(withoutTriggerBnode),
      QuadFactory.iri(thenRef, { curie })
    ]), { curie }));

    return QuadFactory.bnode(unionBnode);
  }

  emitNotTriggerBranch(
    triggerPropIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType {
    const minOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });
    const restrictionBnode = emitRestriction(triggerPropIri, OWL.minCardinality, minOne, quads, curie);

    const withoutTriggerBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(withoutTriggerBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutTriggerBnode, OWL.complementOf, QuadFactory.bnode(restrictionBnode), { curie }));

    return QuadFactory.bnode(withoutTriggerBnode);
  }

  emitRequiredPropertyBranch(
    propIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType {
    const minOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });
    const reqBnode = emitRestriction(propIri, OWL.minCardinality, minOne, quads, curie);

    return QuadFactory.bnode(reqBnode);
  }

  wrapConditionalBranches(
    branches: QuadObjectType[],
    quads: QuadInterface[],
    curie: CurieInterface | undefined
  ): QuadObjectType[] {
    const unionBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList(branches), { curie }));

    return [QuadFactory.bnode(unionBnode)];
  }
}

const owlVocab = new OwlVocabProjection();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function projectOwlGraph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined }): QuadInterface[] {
  const { curie } = options ?? {};
  const quads: QuadInterface[] = [];
  const allRelations = graph.allRelations();
  const index = buildIndex(allRelations);

  for (const [
    sourceId,
    entry
  ] of index) {
    if (sourceId.startsWith('_:')) {
      continue;
    }

    if (entry.types.includes(OWL.Class)) {
      emitClassQuads(sourceId, entry, index, quads, curie);
    }

    if (entry.types.includes(OWL.DatatypeProperty) || entry.types.includes(OWL.ObjectProperty)) {
      emitPropertyQuads(sourceId, entry, quads, curie);
    }
  }

  emitUserRestrictions(graph, quads, curie);

  return quads;
}

// ---------------------------------------------------------------------------
// User-declared OWL restrictions (Compose.subClassOf with restriction parent)
// ---------------------------------------------------------------------------

interface RawRestrictionDescriptorType {
  readonly 'kind': string;
  readonly 'onProperty': string;
  readonly 'value': unknown;
}

function isRawRestrictionDescriptor(raw: object): raw is RawRestrictionDescriptorType {
  const rec = raw as Record<string, unknown>;

  return typeof rec.kind === 'string' && typeof rec.onProperty === 'string' && 'value' in rec;
}

const RESTRICTION_PREDICATE: Partial<Record<string, string>> = {
  'allValuesFrom': OWL.allValuesFrom,
  'cardinality': OWL.cardinality,
  'hasValue': OWL.hasValue,
  'maxCardinality': OWL.maxCardinality,
  'minCardinality': OWL.minCardinality,
  'someValuesFrom': OWL.someValuesFrom
};

const CARDINALITY_KINDS = new Set([
  'cardinality',
  'maxCardinality',
  'minCardinality'
]);

function emitUserRestrictions(
  graph: SchemaGraphInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const root = graph.rootSchema;

  if (typeof root === 'boolean') {
    return;
  }
  const schema = root;
  const restrictions = schema['jt:restrictions'];

  if (!Array.isArray(restrictions)) {
    return;
  }
  const classId = schema.$id;

  if (typeof classId !== 'string') {
    return;
  }

  for (const raw of restrictions) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }
    if (!isRawRestrictionDescriptor(raw as object)) {
      throw new GraphError('GRAPH_INVALID_RESTRICTION', 'Restriction entry missing required kind, onProperty, or value fields');
    }

    const desc: RawRestrictionDescriptorType = raw as RawRestrictionDescriptorType;
    const predicate: string | undefined = RESTRICTION_PREDICATE[desc.kind];

    if (predicate === undefined) {
      continue;
    }

    const value = restrictionObject(desc, curie);

    if (value === undefined) {
      continue;
    }

    const rBnode = emitRestriction(desc.onProperty, predicate, value, quads, curie);

    quads.push(QuadFactory.quad(classId, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }
}

function restrictionObject(
  desc: RawRestrictionDescriptorType,
  curie: CurieInterface | undefined
): QuadObjectType | undefined {
  if (CARDINALITY_KINDS.has(desc.kind)) {
    if (typeof desc.value !== 'number') {
      return undefined;
    }

    return QuadFactory.literal(desc.value, XSD.nonNegativeInteger, { curie });
  }

  if (desc.kind === 'hasValue') {
    if (typeof desc.value === 'boolean') {
      return QuadFactory.literal(desc.value, XSD.boolean, { curie });
    }
    if (typeof desc.value === 'number') {
      return QuadFactory.literal(desc.value, XSD.decimal, { curie });
    }
    if (typeof desc.value === 'string') {
      return QuadFactory.literal(desc.value, XSD.string, { curie });
    }

    return undefined;
  }

  // someValuesFrom / allValuesFrom — value is a class IRI
  if (typeof desc.value !== 'string') {
    return undefined;
  }

  return QuadFactory.iri(desc.value, { curie });
}

// ---------------------------------------------------------------------------
// Class node emission
// ---------------------------------------------------------------------------

function emitClassQuads(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));

  QuadFactory.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
  QuadFactory.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });

  const deprecated = entry.byPredicate.get(OWL.deprecated);

  if (deprecated !== undefined) {
    quads.push(QuadFactory.quad(subject, OWL.deprecated, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

  for (const rel of subClassRels) {
    const target = QuadFactory.iri(relationTargetId(rel), { curie });

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, target, { curie }));
  }

  const restrictionRels = entry.byPredicate.get(OWL.Restriction) ?? [];

  for (const rel of restrictionRels) {
    const meta = rel.metadata ?? {};
    const onProperty = typeof meta.onProperty === 'string' ? meta.onProperty : '';
    const minCard = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;

    const minCardLit = QuadFactory.literal(minCard, XSD.nonNegativeInteger, { curie });
    const rBnode = emitRestriction(onProperty, OWL.minCardinality, minCardLit, quads, curie);

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }

  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const eqBnode = QuadFactory.nextBnode();

    quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(eqBnode), { curie }));
    quads.push(QuadFactory.quad(eqBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(eqBnode, OWL.unionOf, QuadFactory.rdfList(equivRels.map((rel) => {
      return QuadFactory.iri(relationTargetId(rel), { curie });
    })), { curie }));
  }

  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    const complementTarget = QuadFactory.iri(relationTargetId(complementRels[0]), { curie });

    quads.push(QuadFactory.quad(subject, OWL.complementOf, complementTarget, { curie }));
  }

  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (disjointRels.length > 0) {
    const disjointTarget = QuadFactory.iri(relationTargetId(disjointRels[0]), { curie });

    quads.push(QuadFactory.quad(subject, OWL.disjointWith, disjointTarget, { curie }));
  }

  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const typedLiterals = oneOfRels.map((rel) => {
      const val = relationTargetId(rel);

      return QuadFactory.literal(typedLiteralObject(val), RDF.JSON, { curie });
    });

    quads.push(QuadFactory.quad(subject, OWL.oneOf, QuadFactory.rdfList(typedLiterals), { curie }));
  }

  if (oneOfRels.length === 0) {
    const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

    if (hasValueRels.length > 0) {
      const val = relationTargetId(hasValueRels[0]);

      const valueLit = QuadFactory.literal(typedLiteralObject(val), RDF.JSON, { curie });
      const valueList = QuadFactory.rdfList([valueLit]);

      quads.push(QuadFactory.quad(subject, OWL.oneOf, valueList, { curie }));
    }
  }

  const conditionalItems = owlVocab.processConditionals(entry, quads, curie);
  const depSchemaItems = owlVocab.processDependentSchemas(subject, entry, quads, curie);
  const depReqItems = owlVocab.processDependentRequired(subject, entry, quads, curie);

  for (const item of [
    ...conditionalItems,
    ...depSchemaItems,
    ...depReqItems
  ]) {
    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, item, { curie }));
  }

  emitContainsQuads(subject, entry, quads, curie);
  emitPrefixItemQuads(subject, entry, quads, curie);
  emitArrayItemQuads(subject, index, quads, curie);
  emitPatternPropertyQuads(subject, entry, index, quads, curie);
}

function typedLiteralObject(value: unknown): null | Record<string, unknown> {
  const jsType = typeof value;

  if (jsType === 'string' || jsType === 'boolean') {
    return {
      '@type': XsdTypes.resolveSingle(String(jsType)),
      '@value': value
    };
  }

  if (jsType === 'number') {
    const schemaType = Number.isInteger(value) ? 'integer' : 'number';

    return {
      '@type': XsdTypes.resolveSingle(schemaType),
      '@value': value
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Property node emission
// ---------------------------------------------------------------------------

function emitPropertyQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  if (SchemaIri.fragmentContains(subject, '/patternProperties/')) {
    return;
  }

  if (!SchemaIri.isPropertySubject(subject)) {
    return;
  }

  const canonicalId = canonicalPropertyIri(subject);

  if (entry.types.includes(OWL.ObjectProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.ObjectProperty, { curie }), { curie }));
  } else if (entry.types.includes(OWL.DatatypeProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.DatatypeProperty, { curie }), { curie }));
  }

  if (entry.byPredicate.has(OWL.TransitiveProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.TransitiveProperty, { curie }), { curie }));
  }

  if (entry.byPredicate.has(OWL.SymmetricProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.SymmetricProperty, { curie }), { curie }));
  }

  if (entry.byPredicate.has(OWL.AsymmetricProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.AsymmetricProperty, { curie }), { curie }));
  }

  if (entry.byPredicate.has(OWL.FunctionalProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.FunctionalProperty, { curie }), { curie }));
  }

  if (entry.byPredicate.has(OWL.InverseFunctionalProperty)) {
    const iri = QuadFactory.iri(OWL.InverseFunctionalProperty, { curie });

    quads.push(QuadFactory.quad(canonicalId, RDF.type, iri, { curie }));
  }

  if (entry.byPredicate.has(OWL.ReflexiveProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.ReflexiveProperty, { curie }), { curie }));
  }

  if (entry.byPredicate.has(OWL.IrreflexiveProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.IrreflexiveProperty, { curie }), { curie }));
  }

  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const domainId = domainRels.length > 0 ? relationTargetId(domainRels[0]) : '';

  quads.push(QuadFactory.quad(canonicalId, RDFS.domain, QuadFactory.iri(domainId, { curie }), { curie }));

  const hasMaxCount = entry.byPredicate.has(SH.maxCount);
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];
  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];

  if (!hasMaxCount) {
    const listIri = QuadFactory.iri(RDF.List, { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, listIri, { curie }));
  } else if (rangeRels.length > 0) {
    const rangeTarget = QuadFactory.iri(relationTargetId(rangeRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, rangeTarget, { curie }));
  } else if (datatypeRels.length > 0) {
    const dtTarget = QuadFactory.iri(relationTargetId(datatypeRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, dtTarget, { curie }));
  }

  const unionStructured = entry.all.filter((rel) => {
    return rel.predicate === OWL.unionOf && rel.structure?.kind === 'list';
  });

  for (const rel of unionStructured) {
    const structure = rel.structure;

    if (!isListStructure(structure)) {
      continue;
    }
    quads.push(QuadFactory.quad(canonicalId, OWL.unionOf, QuadFactory.rdfList(structure.members.map((member) => {
      return QuadFactory.iri(member, { curie });
    })), { curie }));
  }

  const inverseRels = entry.byPredicate.get(OWL.inverseOf) ?? [];

  if (inverseRels.length > 0) {
    const inverseTarget = QuadFactory.iri(relationTargetId(inverseRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, OWL.inverseOf, inverseTarget, { curie }));
  }

  QuadFactory.emitLiterals(canonicalId, entry, RDFS.comment, RDFS.comment, quads, { curie });

  if (entry.byPredicate.has(DASH.readOnly)) {
    const trueLit = QuadFactory.literal(true, XSD.boolean, { curie });

    quads.push(QuadFactory.quad(canonicalId, DASH.readOnly, trueLit, { curie }));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    const trueLit = QuadFactory.literal(true, XSD.boolean, { curie });

    quads.push(QuadFactory.quad(canonicalId, DASH.writeOnly, trueLit, { curie }));
  }

  QuadFactory.emitLiterals(canonicalId, entry, DCT.format, DCT.format, quads, { curie });
}


// ---------------------------------------------------------------------------
// Contains emission (owl:someValuesFrom)
// ---------------------------------------------------------------------------

function emitContainsQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const containsRels = entry.all.filter((rel) => {
    return isRestrictionStructure(rel.structure)
    && rel.structure.constraint === OWL.someValuesFrom;
  });

  for (const rel of containsRels) {
    const structure = rel.structure;

    if (!isRestrictionStructure(structure)) {
      continue;
    }
    const containsTypeRef = String(structure.value);

    const containsIri = QuadFactory.iri(containsTypeRef, { curie });
    const rBnode = emitRestriction(structure.onProperty, OWL.someValuesFrom, containsIri, quads, curie);

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));

    const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];
    const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

    if (minQualRels.length > 0) {
      const minVal = Number(relationTargetId(minQualRels[0]));
      const minLit = QuadFactory.literal(minVal, XSD.nonNegativeInteger, { curie });
      const minRBnode = emitRestriction(structure.onProperty, OWL.minQualifiedCardinality, minLit, quads, curie);

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(minRBnode), { curie }));
      quads.push(QuadFactory.quad(minRBnode, OWL.onDataRange, QuadFactory.iri(containsTypeRef, { curie }), { curie }));
    }

    if (maxQualRels.length > 0) {
      const maxVal = Number(relationTargetId(maxQualRels[0]));
      const maxLit = QuadFactory.literal(maxVal, XSD.nonNegativeInteger, { curie });
      const maxRBnode = emitRestriction(structure.onProperty, OWL.maxQualifiedCardinality, maxLit, quads, curie);

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(maxRBnode), { curie }));
      quads.push(QuadFactory.quad(maxRBnode, OWL.onDataRange, QuadFactory.iri(containsTypeRef, { curie }), { curie }));
    }
  }
}

// ---------------------------------------------------------------------------
// PrefixItems emission (rdf:_N restrictions)
// ---------------------------------------------------------------------------

function emitPrefixItemQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const memberRels = entry.byPredicate.get(RDFS.member) ?? [];

  for (const [
    i,
    memberRel
  ] of memberRels.entries()) {
    const typeRef = relationTargetId(memberRel);
    const rBnode = emitRestriction(`rdf:_${i + 1}`, OWL.allValuesFrom, QuadFactory.iri(typeRef, { curie }), quads, curie);

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }
}

// ---------------------------------------------------------------------------
// Array item restriction emission (owl:allValuesFrom)
// ---------------------------------------------------------------------------

function emitArrayItemQuads(
  subject: string,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  for (const [
    propSubject,
    propEntry
  ] of index) {
    if (!SchemaIri.isPropertySubject(propSubject) || SchemaIri.fragmentContains(propSubject, '/patternProperties/')) {
      continue;
    }

    if (!propEntry.types.includes(OWL.ObjectProperty)) {
      continue;
    }

    if (propEntry.byPredicate.has(SH.maxCount)) {
      continue;
    }

    if (SchemaIri.structuralParent(propSubject) !== subject) {
      continue;
    }

    let itemTypeId: null | string = null;

    const propRangeRels = propEntry.byPredicate.get(RDFS.range) ?? [];

    if (propRangeRels.length > 0) {
      itemTypeId = relationTargetId(propRangeRels[0]);
    }

    if (itemTypeId === null) {
      const itemsSubject = `${propSubject}/items`;
      const itemsEntry = index.get(itemsSubject);

      if (itemsEntry !== undefined) {
        const rangeRels = itemsEntry.byPredicate.get(RDFS.range) ?? [];
        const dtRels = itemsEntry.byPredicate.get(SH.datatype) ?? [];

        if (rangeRels.length > 0) {
          itemTypeId = relationTargetId(rangeRels[0]);
        } else if (dtRels.length > 0) {
          itemTypeId = relationTargetId(dtRels[0]);
        } else {
          itemTypeId = itemsSubject;
        }
      }
    }

    if (itemTypeId === null) {
      continue;
    }

    const canonicalId = canonicalPropertyIri(propSubject);
    const itemTypeIri = QuadFactory.iri(itemTypeId, { curie });
    const rBnode = emitRestriction(canonicalId, OWL.allValuesFrom, itemTypeIri, quads, curie);

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }
}

// ---------------------------------------------------------------------------
// Pattern property emission
// ---------------------------------------------------------------------------

function emitPatternPropertyQuads(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty !== true || typeof rel.metadata.pattern !== 'string') {
      continue;
    }

    const pattern = rel.metadata.pattern;
    const { base } = SchemaIri.splitSubject(subject);
    const patternSubject = `${base}#/patternProperties/${pattern}`;
    const patternEntry = index.get(patternSubject);

    const datatypeRels = patternEntry?.byPredicate.get(SH.datatype) ?? [];
    const rangeRels = patternEntry?.byPredicate.get(RDFS.range) ?? [];
    const hasDatatype = datatypeRels.length > 0;
    const hasRange = rangeRels.length > 0;
    const rdfType = (!hasDatatype && !hasRange) ? OWL.ObjectProperty : OWL.DatatypeProperty;

    const propIri = SchemaIri.propertyIri(subject, pattern);

    quads.push(QuadFactory.quad(propIri, RDF.type, QuadFactory.iri(rdfType, { curie }), { curie }));
    quads.push(QuadFactory.quad(propIri, RDFS.domain, QuadFactory.iri(subject, { curie }), { curie }));
    quads.push(QuadFactory.quad(propIri, SH.pattern, QuadFactory.literal(pattern, XSD.string, { curie }), { curie }));

    if (hasDatatype) {
      const dtRange = QuadFactory.iri(relationTargetId(datatypeRels[0]), { curie });

      quads.push(QuadFactory.quad(propIri, RDFS.range, dtRange, { curie }));
    }

    if (hasRange) {
      const rangeTarget = QuadFactory.iri(relationTargetId(rangeRels[0]), { curie });

      quads.push(QuadFactory.quad(propIri, RDFS.range, rangeTarget, { curie }));
    }

    if (patternEntry !== undefined) {
      QuadFactory.emitLiterals(propIri, patternEntry, RDFS.comment, RDFS.comment, quads, { curie });
    }
  }
}
