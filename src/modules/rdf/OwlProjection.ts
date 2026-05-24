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
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { XsdTypes } from './XsdTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from './QuadFactory.js';

import { ProjectionIndex } from './ProjectionIndex.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';
import { VocabProjection } from './VocabProjection.js';

function emitRestriction(
  onProperty: string,
  constraint: string,
  constraintValue: QuadObjectType,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
): string {
  const rBnode = QuadFactory.nextBnode(issuer);

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

  const segments = parts.fragment.split('/');
  const propName = segments.at(-1) ?? '';
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
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const unionMembers: QuadObjectType[] = [withoutTrigger];

    if (reqRestrictions.length === 1) {
      unionMembers.push(reqRestrictions[0]);
    } else {
      const interBnode = QuadFactory.nextBnode(issuer);

      quads.push(QuadFactory.quad(interBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
      const interListHead = QuadFactory.rdfList(reqRestrictions, quads, issuer);

      quads.push(QuadFactory.quad(interBnode, OWL.intersectionOf, interListHead, { curie }));
      unionMembers.push(QuadFactory.bnode(interBnode));
    }

    const unionBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList(unionMembers, quads, issuer), { curie }));

    return QuadFactory.bnode(unionBnode);
  }

  emitConditionalElseBranch(
    ifRef: string,
    elseRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const complementBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(complementBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(complementBnode, OWL.complementOf, QuadFactory.iri(ifRef, { curie }), { curie }));

    const branchBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(branchBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(branchBnode, OWL.intersectionOf, QuadFactory.rdfList([
      QuadFactory.bnode(complementBnode),
      QuadFactory.iri(elseRef, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(branchBnode);
  }

  emitConditionalThenBranch(
    ifRef: string,
    thenRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const branchBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(branchBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(branchBnode, OWL.intersectionOf, QuadFactory.rdfList([
      QuadFactory.iri(ifRef, { curie }),
      QuadFactory.iri(thenRef, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(branchBnode);
  }

  emitDependentSchemaBranch(
    _subject: string,
    ifRef: string,
    thenRef: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const minOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });
    const restrictionBnode = emitRestriction(ifRef, OWL.minCardinality, minOne, quads, curie, issuer);

    const withoutTriggerBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutTriggerBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutTriggerBnode, OWL.complementOf, QuadFactory.bnode(restrictionBnode), { curie }));

    const unionBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList([
      QuadFactory.bnode(withoutTriggerBnode),
      QuadFactory.iri(thenRef, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(unionBnode);
  }

  emitNotTriggerBranch(
    triggerPropIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const minOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });
    const restrictionBnode = emitRestriction(triggerPropIri, OWL.minCardinality, minOne, quads, curie, issuer);

    const withoutTriggerBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutTriggerBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutTriggerBnode, OWL.complementOf, QuadFactory.bnode(restrictionBnode), { curie }));

    return QuadFactory.bnode(withoutTriggerBnode);
  }

  emitRequiredPropertyBranch(
    propIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const minOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });
    const reqBnode = emitRestriction(propIri, OWL.minCardinality, minOne, quads, curie, issuer);

    return QuadFactory.bnode(reqBnode);
  }

  wrapConditionalBranches(
    branches: QuadObjectType[],
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType[] {
    const unionBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList(branches, quads, issuer), { curie }));

    return [QuadFactory.bnode(unionBnode)];
  }
}

const owlVocab = new OwlVocabProjection();

// ---------------------------------------------------------------------------
// Primitive schema detection and emission
// ---------------------------------------------------------------------------

const SHACL_TO_XSD_FACET: ReadonlyMap<string, string> = new Map([
  [
    SH.maxExclusive,
    'xsd:maxExclusive'
  ],
  [
    SH.maxInclusive,
    'xsd:maxInclusive'
  ],
  [
    SH.maxLength,
    'xsd:maxLength'
  ],
  [
    SH.minExclusive,
    'xsd:minExclusive'
  ],
  [
    SH.minInclusive,
    'xsd:minInclusive'
  ],
  [
    SH.minLength,
    'xsd:minLength'
  ],
  [
    SH.pattern,
    'xsd:pattern'
  ]
]);

const XSD_FACET_DATATYPE: ReadonlyMap<string, string> = new Map([
  [
    'xsd:maxExclusive',
    XSD.decimal
  ],
  [
    'xsd:maxInclusive',
    XSD.decimal
  ],
  [
    'xsd:maxLength',
    XSD.integer
  ],
  [
    'xsd:minExclusive',
    XSD.decimal
  ],
  [
    'xsd:minInclusive',
    XSD.decimal
  ],
  [
    'xsd:minLength',
    XSD.integer
  ],
  [
    'xsd:pattern',
    XSD.string
  ]
]);

function isPrimitiveEntry(entry: RelationIndexInterface): boolean {
  return entry.byPredicate.has(SH.datatype) && !entry.byPredicate.has(OWL.Restriction);
}

function restrictionConstraintValue(
  constraint: string,
  value: unknown,
  curie: CurieInterface | undefined
): QuadObjectType | undefined {
  const isCardinality = constraint === OWL.cardinality
    || constraint === OWL.minCardinality
    || constraint === OWL.maxCardinality
    || constraint === OWL.minQualifiedCardinality
    || constraint === OWL.maxQualifiedCardinality;

  if (isCardinality) {
    const n = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(n)) {
      return undefined;
    }

    return QuadFactory.literal(n, XSD.nonNegativeInteger, { curie });
  }

  if (constraint === OWL.hasValue) {
    if (typeof value === 'boolean') {
      return QuadFactory.literal(value, XSD.boolean, { curie });
    }
    if (typeof value === 'number') {
      return QuadFactory.literal(value, XSD.decimal, { curie });
    }
    if (typeof value === 'string') {
      return QuadFactory.literal(value, XSD.string, { curie });
    }

    return undefined;
  }

  if (typeof value !== 'string' || value === '') {
    return undefined;
  }

  return QuadFactory.iri(value, { curie });
}

function emitDatatypeQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
): void {
  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(RDFS.Datatype, { curie }), { curie }));

  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
  let xsdType: string | undefined;

  if (datatypeRels.length > 0) {
    xsdType = ProjectionIndex.relationTargetId(datatypeRels[0]);
    quads.push(QuadFactory.quad(subject, OWL.onDatatype, QuadFactory.iri(xsdType, { curie }), { curie }));
  }

  const facetBnodes: QuadObjectType[] = [];

  for (const [
    shaclPred,
    xsdFacet
  ] of SHACL_TO_XSD_FACET) {
    const rels = entry.byPredicate.get(shaclPred) ?? [];

    for (const rel of rels) {
      if (shaclPred === SH.pattern && rel.metadata?.fromFormat === true) {
        continue;
      }

      const bnode = QuadFactory.nextBnode(issuer);
      const rawValue = ProjectionIndex.relationTargetId(rel);
      const facetDatatype = XSD_FACET_DATATYPE.get(xsdFacet) ?? XSD.string;
      const isNumeric = facetDatatype === XSD.decimal || facetDatatype === XSD.integer;
      const litValue: number | string = isNumeric ? Number(rawValue) : rawValue;

      quads.push(QuadFactory.quad(bnode, xsdFacet, QuadFactory.literal(litValue, facetDatatype, { curie }), { curie }));
      facetBnodes.push(QuadFactory.bnode(bnode));
    }
  }

  if (facetBnodes.length > 0) {
    const listHead = QuadFactory.rdfList(facetBnodes, quads, issuer);

    quads.push(QuadFactory.quad(subject, OWL.withRestrictions, listHead, { curie }));
  }

  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const enumLiterals = oneOfRels.map((rel) => {
      const val = ProjectionIndex.relationTargetId(rel);

      return QuadFactory.literal(typedLiteralObject(val), RDF.JSON, { curie });
    });
    const equivBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(equivBnode), { curie }));
    quads.push(QuadFactory.quad(equivBnode, OWL.oneOf, QuadFactory.rdfList(enumLiterals, quads, issuer), { curie }));
  }

  const multipleOfRels = entry.byPredicate.get(JT.multipleOf) ?? [];

  if (multipleOfRels.length > 0) {
    const moVal = Number(ProjectionIndex.relationTargetId(multipleOfRels[0]));

    quads.push(QuadFactory.quad(subject, JT.multipleOf, QuadFactory.literal(moVal, XSD.decimal, { curie }), { curie }));
  }

  // H-2: read format from JT.format graph relation, not from source.schema.format
  const formatRels = entry.byPredicate.get(JT.format) ?? [];

  if (formatRels.length > 0) {
    const formatValue = ProjectionIndex.relationTargetId(formatRels[0]);
    const formatLiteral = QuadFactory.literal(formatValue, XSD.string, { curie });

    quads.push(QuadFactory.quad(subject, JT.format, formatLiteral, { curie }));
  }

  QuadFactory.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
  QuadFactory.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const OwlProjection = {
  graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined;
    'issuer'?: IdentifierIssuerInterface | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const issuer = options?.issuer ?? new IdentifierIssuer();
    const quads: QuadInterface[] = [];
    const allRelations = graph.allRelations();
    const index = ProjectionIndex.build(allRelations);

    for (const [
      sourceId,
      entry
    ] of index) {
      if (sourceId.startsWith('_:')) {
        continue;
      }

      if (entry.types.includes(OWL.Class)) {
        if (isPrimitiveEntry(entry)) {
          emitDatatypeQuads(sourceId, entry, quads, curie, issuer);
        } else {
          emitClassQuads(sourceId, entry, index, quads, curie, issuer);
        }
      }

      if (entry.types.includes(OWL.DatatypeProperty) || entry.types.includes(OWL.ObjectProperty)) {
        emitPropertyQuads(sourceId, entry, quads, curie, issuer);
      }
    }

    return quads;
  }
} as const;

// ---------------------------------------------------------------------------
// Class node emission
// ---------------------------------------------------------------------------

function emitClassQuads(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
): void {
  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));

  QuadFactory.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
  QuadFactory.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });

  const deprecated = entry.byPredicate.get(OWL.deprecated);

  if (deprecated !== undefined) {
    quads.push(QuadFactory.quad(subject, OWL.deprecated, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  // H-1: RDFS.subClassOf relations with restriction structure → restriction bnodes.
  // Plain subClassOf relations → direct IRI triples.
  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

  for (const rel of subClassRels) {
    if (ProjectionIndex.isRestrictionStructure(rel.structure)) {
      const restriction = rel.structure;
      const {
        constraint, onProperty, value
      } = restriction;
      const constraintValue = restrictionConstraintValue(constraint, value, curie);

      if (constraintValue !== undefined) {
        const rBnode = emitRestriction(onProperty, constraint, constraintValue, quads, curie, issuer);

        quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
      }
    } else {
      const target = QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, target, { curie }));
    }
  }

  const restrictionRels = entry.byPredicate.get(OWL.Restriction) ?? [];

  for (const rel of restrictionRels) {
    const meta = rel.metadata ?? {};
    const onProperty = typeof meta.onProperty === 'string' ? meta.onProperty : '';
    const minCard = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;

    const minCardLit = QuadFactory.literal(minCard, XSD.nonNegativeInteger, { curie });
    const rBnode = emitRestriction(onProperty, OWL.minCardinality, minCardLit, quads, curie, issuer);

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }

  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const eqBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(eqBnode), { curie }));
    quads.push(QuadFactory.quad(eqBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(eqBnode, OWL.unionOf, QuadFactory.rdfList(equivRels.map((rel) => {
      return QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });
    }), quads, issuer), { curie }));
  }

  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    const complementTarget = QuadFactory.iri(ProjectionIndex.relationTargetId(complementRels[0]), { curie });

    quads.push(QuadFactory.quad(subject, OWL.complementOf, complementTarget, { curie }));
  }

  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (disjointRels.length > 0) {
    const disjointTarget = QuadFactory.iri(ProjectionIndex.relationTargetId(disjointRels[0]), { curie });

    quads.push(QuadFactory.quad(subject, OWL.disjointWith, disjointTarget, { curie }));
  }

  const disjointUnionRels = entry.byPredicate.get(OWL.disjointUnionOf) ?? [];

  if (disjointUnionRels.length > 0) {
    quads.push(QuadFactory.quad(subject, OWL.disjointUnionOf, QuadFactory.rdfList(disjointUnionRels.map((rel) => {
      return QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });
    }), quads, issuer), { curie }));
  }

  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const typedLiterals = oneOfRels.map((rel) => {
      const val = ProjectionIndex.relationTargetId(rel);

      return QuadFactory.literal(typedLiteralObject(val), RDF.JSON, { curie });
    });

    quads.push(QuadFactory.quad(subject, OWL.oneOf, QuadFactory.rdfList(typedLiterals, quads, issuer), { curie }));
  }

  if (oneOfRels.length === 0) {
    const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

    if (hasValueRels.length > 0) {
      const val = ProjectionIndex.relationTargetId(hasValueRels[0]);
      const valueLit = QuadFactory.literal(typedLiteralObject(val), RDF.JSON, { curie });
      const valueList = QuadFactory.rdfList([valueLit], quads, issuer);

      quads.push(QuadFactory.quad(subject, OWL.oneOf, valueList, { curie }));
    }
  }

  const conditionalItems = owlVocab.processConditionals(entry, quads, curie, issuer);
  const depSchemaItems = owlVocab.processDependentSchemas(subject, entry, quads, curie, issuer);
  const depReqItems = owlVocab.processDependentRequired(subject, entry, quads, curie, issuer);

  for (const item of [
    ...conditionalItems,
    ...depSchemaItems,
    ...depReqItems
  ]) {
    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, item, { curie }));
  }

  emitContainsQuads(subject, entry, quads, curie, issuer);
  emitPrefixItemQuads(subject, entry, quads, curie, issuer);
  emitArrayItemQuads(subject, index, quads, curie, issuer);
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
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
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
  const domainId = domainRels.length > 0 ? ProjectionIndex.relationTargetId(domainRels[0]) : '';

  quads.push(QuadFactory.quad(canonicalId, RDFS.domain, QuadFactory.iri(domainId, { curie }), { curie }));

  const hasMaxCount = entry.byPredicate.has(SH.maxCount);
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];
  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];

  if (!hasMaxCount) {
    const listIri = QuadFactory.iri(RDF.List, { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, listIri, { curie }));
  } else if (rangeRels.length > 0) {
    const rangeTarget = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, rangeTarget, { curie }));
  } else if (datatypeRels.length > 0) {
    const dtTarget = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, dtTarget, { curie }));
  }

  const unionStructured = entry.all.filter((rel) => {
    return rel.predicate === OWL.unionOf && rel.structure?.kind === 'list';
  });

  for (const rel of unionStructured) {
    const structure = rel.structure;

    if (!ProjectionIndex.isListStructure(structure)) {
      continue;
    }
    quads.push(QuadFactory.quad(canonicalId, OWL.unionOf, QuadFactory.rdfList(structure.members.map((member) => {
      return QuadFactory.iri(member, { curie });
    }), quads, issuer), { curie }));
  }

  const inverseRels = entry.byPredicate.get(OWL.inverseOf) ?? [];

  if (inverseRels.length > 0) {
    const inverseTarget = QuadFactory.iri(ProjectionIndex.relationTargetId(inverseRels[0]), { curie });

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
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
): void {
  // Only pick up `contains` keyword restrictions (predicate = OWL.someValuesFrom),
  // not user-declared restrictions which use RDFS.subClassOf predicate.
  const containsRels = entry.all.filter((rel) => {
    return rel.predicate === OWL.someValuesFrom
      && ProjectionIndex.isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom;
  });

  for (const rel of containsRels) {
    const structure = rel.structure;

    if (!ProjectionIndex.isRestrictionStructure(structure)) {
      continue;
    }
    const containsTypeRef = String(structure.value);
    const containsIri = QuadFactory.iri(containsTypeRef, { curie });
    const rBnode = emitRestriction(structure.onProperty, OWL.someValuesFrom, containsIri, quads, curie, issuer);

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));

    const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];
    const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

    const containsIriObject = QuadFactory.iri(containsTypeRef, { curie });

    if (minQualRels.length > 0) {
      const minVal = Number(ProjectionIndex.relationTargetId(minQualRels[0]));
      const minLit = QuadFactory.literal(minVal, XSD.nonNegativeInteger, { curie });
      const onProp = structure.onProperty;
      const minRBnode = emitRestriction(onProp, OWL.minQualifiedCardinality, minLit, quads, curie, issuer);

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(minRBnode), { curie }));
      quads.push(QuadFactory.quad(minRBnode, OWL.onDataRange, containsIriObject, { curie }));
    }

    if (maxQualRels.length > 0) {
      const maxVal = Number(ProjectionIndex.relationTargetId(maxQualRels[0]));
      const maxLit = QuadFactory.literal(maxVal, XSD.nonNegativeInteger, { curie });
      const onProp = structure.onProperty;
      const maxRBnode = emitRestriction(onProp, OWL.maxQualifiedCardinality, maxLit, quads, curie, issuer);

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(maxRBnode), { curie }));
      quads.push(QuadFactory.quad(maxRBnode, OWL.onDataRange, containsIriObject, { curie }));
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
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
): void {
  const memberRels = entry.byPredicate.get(RDFS.member) ?? [];

  for (const [
    i,
    memberRel
  ] of memberRels.entries()) {
    const typeRef = ProjectionIndex.relationTargetId(memberRel);
    const rBnode = emitRestriction(`rdf:_${i + 1}`, OWL.allValuesFrom, QuadFactory.iri(typeRef, { curie }), quads, curie, issuer);

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
  curie: CurieInterface | undefined,
  issuer?: IdentifierIssuerInterface
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
      itemTypeId = ProjectionIndex.relationTargetId(propRangeRels[0]);
    }

    if (itemTypeId === null) {
      const itemsSubject = `${propSubject}/items`;
      const itemsEntry = index.get(itemsSubject);

      if (itemsEntry !== undefined) {
        const rangeRels = itemsEntry.byPredicate.get(RDFS.range) ?? [];
        const dtRels = itemsEntry.byPredicate.get(SH.datatype) ?? [];

        if (rangeRels.length > 0) {
          itemTypeId = ProjectionIndex.relationTargetId(rangeRels[0]);
        } else if (dtRels.length > 0) {
          itemTypeId = ProjectionIndex.relationTargetId(dtRels[0]);
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
    const rBnode = emitRestriction(canonicalId, OWL.allValuesFrom, itemTypeIri, quads, curie, issuer);

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
    const rdfType = !hasDatatype && !hasRange ? OWL.ObjectProperty : OWL.DatatypeProperty;

    const propIri = SchemaIri.propertyIri(subject, pattern);

    quads.push(QuadFactory.quad(propIri, RDF.type, QuadFactory.iri(rdfType, { curie }), { curie }));
    quads.push(QuadFactory.quad(propIri, RDFS.domain, QuadFactory.iri(subject, { curie }), { curie }));
    quads.push(QuadFactory.quad(propIri, SH.pattern, QuadFactory.literal(pattern, XSD.string, { curie }), { curie }));

    if (hasDatatype) {
      const dtRange = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRels[0]), { curie });

      quads.push(QuadFactory.quad(propIri, RDFS.range, dtRange, { curie }));
    }

    if (hasRange) {
      const rangeTarget = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRels[0]), { curie });

      quads.push(QuadFactory.quad(propIri, RDFS.range, rangeTarget, { curie }));
    }

    if (patternEntry !== undefined) {
      QuadFactory.emitLiterals(propIri, patternEntry, RDFS.comment, RDFS.comment, quads, { curie });
    }
  }
}
