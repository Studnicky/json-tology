/**
 * OwlProjection — projects SchemaGraph relations into OWL-vocabulary quads.
 *
 * Iterates graph.allRelations() and emits complete OWL patterns:
 * owl:Class, owl:DatatypeProperty/ObjectProperty, owl:Restriction,
 * owl:unionOf/intersectionOf for conditionals, owl:someValuesFrom for
 * contains, etc.
 *
 * Property IRI canonicalization (pointer → Class#name) happens here.
 * The output quads can be passed directly to JsonLdFormatter.fromQuads().
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphRelationType } from '../../types/SchemaGraph.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import type { ProjectionEmitContextType } from '../../types/ProjectionEmitContext.js';
import type { EmitQualifiedCardinalityRestrictionArgsType } from '../../types/EmitQualifiedCardinalityRestrictionArgs.js';
import type { EmitRestrictionArgsType } from '../../types/EmitRestrictionArgs.js';
import type { OptionalQuadObjectType } from '../../types/OptionalQuadObjectType.js';
import type { TypedLiteralObjectType } from '../../types/TypedLiteralObjectType.js';
import type { ResolveArrayPropertyCanonicalIdArgsType } from '../../types/ResolveArrayPropertyCanonicalIdArgs.js';
import type { EmitPatternPropertyEntryArgsType } from '../../types/EmitPatternPropertyEntryArgs.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { OWL_CARDINALITY_PREDICATE_IRIS } from '../../constants/ONTOLOGY_PREDICATES.js';
import {
  SHACL_TO_XSD_FACET,
  XSD_FACET_DATATYPE
} from '../../constants/XSD_FACETS.js';
import { XsdTypes } from './XsdTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from './QuadFactory.js';

import { ProjectionIndex } from './ProjectionIndex.js';
import type { RelationIndexType } from '../../types/RelationIndex.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';
import { VocabProjection } from './VocabProjection.js';
import {
  propertySubjectIri,
  resolvePropertySchema,
  resolveRestrictionOnProperty
} from './ProjectionHelpers.js';

function emitRestriction(args: EmitRestrictionArgsType): string {
  const {
    constraint, constraintValue, curie, issuer, onProperty, quads
  } = args;
  const rBnode = QuadFactory.nextBnode(issuer);

  quads.push(QuadFactory.quad(rBnode, RDF.type, QuadFactory.iri(OWL.Restriction, { curie }), { curie }));
  quads.push(QuadFactory.quad(rBnode, OWL.onProperty, QuadFactory.iri(onProperty, { curie }), { curie }));
  quads.push(QuadFactory.quad(rBnode, constraint, constraintValue, { curie }));

  return rBnode;
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
    const restrictionBnode = emitRestriction({
      'constraint': OWL.minCardinality,
      'constraintValue': minOne,
      curie,
      issuer,
      'onProperty': ifRef,
      quads
    });

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
    const restrictionBnode = emitRestriction({
      'constraint': OWL.minCardinality,
      'constraintValue': minOne,
      curie,
      issuer,
      'onProperty': triggerPropIri,
      quads
    });

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
    const reqBnode = emitRestriction({
      'constraint': OWL.minCardinality,
      'constraintValue': minOne,
      curie,
      issuer,
      'onProperty': propIri,
      quads
    });

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
//
// SHACL_TO_XSD_FACET and XSD_FACET_DATATYPE are imported from the canonical
// bidirectional facet table in src/constants/XSD_FACETS.ts.
// ---------------------------------------------------------------------------

function isPrimitiveEntry(entry: RelationIndexType): boolean {
  return entry.byPredicate.has(SH.datatype) && !entry.byPredicate.has(OWL.Restriction);
}

// OWL_CARDINALITY_PREDICATE_IRIS imported from ONTOLOGY_PREDICATES

function cardinalityConstraintValue(value: unknown, curie: CurieInterface | undefined): OptionalQuadObjectType {
  const n = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(n)) {
    return undefined;
  }

  return QuadFactory.literal(n, XSD.nonNegativeInteger, { curie });
}

function hasValueConstraintValue(value: unknown, curie: CurieInterface | undefined): OptionalQuadObjectType {
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

function restrictionConstraintValue(
  constraint: string,
  value: unknown,
  curie: CurieInterface | undefined
): OptionalQuadObjectType {
  if (OWL_CARDINALITY_PREDICATE_IRIS.has(constraint)) {
    return cardinalityConstraintValue(value, curie);
  }

  if (constraint === OWL.hasValue) {
    return hasValueConstraintValue(value, curie);
  }

  if (typeof value !== 'string' || value === '') {
    return undefined;
  }

  return QuadFactory.iri(value, { curie });
}

function emitDatatypeQuads(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, quads
  } = ctx;

  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(RDFS.Datatype, { curie }), { curie }));

  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
  let xsdType: string | undefined;

  if (datatypeRels.length > 0) {
    xsdType = ProjectionIndex.relationTargetId(datatypeRels[0]);
    quads.push(QuadFactory.quad(subject, OWL.onDatatype, QuadFactory.iri(xsdType, { curie }), { curie }));
  }

  emitDatatypeFacetBnodes(subject, entry, ctx);
  emitDatatypeEnumeration(subject, entry, ctx);
  emitDatatypeMetadata(subject, entry, ctx);
}

function emitDatatypeFacetBnodes(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const facetBnodes: QuadObjectType[] = [];

  for (const [
    shaclPred,
    xsdFacet
  ] of SHACL_TO_XSD_FACET) {
    for (const rel of entry.byPredicate.get(shaclPred) ?? []) {
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
    quads.push(QuadFactory.quad(
      subject,
      OWL.withRestrictions,
      QuadFactory.rdfList(facetBnodes, quads, issuer),
      { curie }
    ));
  }
}

function emitDatatypeEnumeration(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const enumLiterals = oneOfRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.literal> => {
      return QuadFactory.literal(typedLiteralObject(ProjectionIndex.relationTargetId(rel)), RDF.JSON, { curie });
    });
    const equivBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(equivBnode), { curie }));
    quads.push(QuadFactory.quad(equivBnode, OWL.oneOf, QuadFactory.rdfList(enumLiterals, quads, issuer), { curie }));
  }
}

function emitDatatypeMetadata(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, quads
  } = ctx;
  const multipleOfRels = entry.byPredicate.get(JT.multipleOf) ?? [];

  if (multipleOfRels.length > 0) {
    quads.push(QuadFactory.quad(
      subject,
      JT.multipleOf,
      QuadFactory.literal(Number(ProjectionIndex.relationTargetId(multipleOfRels[0])), XSD.decimal, { curie }),
      { curie }
    ));
  }

  // H-2: read format from JT.format graph relation, not from source.schema.format
  const formatRels = entry.byPredicate.get(JT.format) ?? [];

  if (formatRels.length > 0) {
    quads.push(QuadFactory.quad(
      subject,
      JT.format,
      QuadFactory.literal(ProjectionIndex.relationTargetId(formatRels[0]), XSD.string, { curie }),
      { curie }
    ));
  }

  QuadFactory.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
  QuadFactory.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });
}

// ---------------------------------------------------------------------------
// Shared emit context
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Projects SchemaGraph relations into OWL-vocabulary RDF quads.
 *
 * @remarks
 * Iterates `graph.allRelations()` and emits complete OWL patterns:
 * `owl:Class`, `owl:DatatypeProperty`/`owl:ObjectProperty`, `owl:Restriction`,
 * `owl:unionOf`/`owl:intersectionOf` for conditionals, `owl:someValuesFrom` for
 * contains constraints, etc. Property IRI canonicalization (pointer → Class#name)
 * happens here. The output quads can be passed directly to `JsonLdFormatter.fromQuads()`.
 *
 * @example
 * ```ts
 * const quads = OwlProjection.graph(graph, { curie, predicateResolver });
 * ```
 *
 * @defaultValue Uses a fresh `IdentifierIssuer` when no `issuer` option is provided.
 * @category RDF
 * @since 0.1.0
 * @see {@link ShaclProjection}
 * @group OwlProjection
 */
export const OwlProjection = {
  graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined;
    'issuer'?: IdentifierIssuerInterface | undefined;
    'predicateResolver'?: PredicateResolverFnType | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const { predicateResolver } = options ?? {};
    const issuer = options?.issuer ?? new IdentifierIssuer();
    const quads: QuadInterface[] = [];
    const allRelations = graph.allRelations();
    const index = ProjectionIndex.build(allRelations);
    const ctx: ProjectionEmitContextType = {
      curie,
      graph,
      index,
      issuer,
      predicateResolver,
      quads
    };

    for (const [
      sourceId,
      entry
    ] of index) {
      if (sourceId.startsWith('_:')) {
        continue;
      }

      if (entry.types.includes(OWL.Class)) {
        if (isPrimitiveEntry(entry)) {
          emitDatatypeQuads(sourceId, entry, ctx);
        } else {
          emitClassQuads(sourceId, entry, ctx);
        }
      }

      if (entry.types.includes(OWL.DatatypeProperty) || entry.types.includes(OWL.ObjectProperty)) {
        emitPropertyQuads(sourceId, entry, ctx);
      }
    }

    return quads;
  }
} as const;

// ---------------------------------------------------------------------------
// Class node emission helpers
// ---------------------------------------------------------------------------

function emitClassSubClassRelations(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, graph, issuer, predicateResolver, quads
  } = ctx;

  // H-1: RDFS.subClassOf relations with restriction structure → restriction bnodes.
  // Plain subClassOf relations → direct IRI triples.
  for (const rel of entry.byPredicate.get(RDFS.subClassOf) ?? []) {
    if (ProjectionIndex.isRestrictionStructure(rel.structure)) {
      const {
        constraint, onProperty, value
      } = rel.structure;
      const constraintValue = restrictionConstraintValue(constraint, value, curie);

      if (constraintValue !== undefined) {
        const flatOnProperty = resolveRestrictionOnProperty(onProperty, graph, predicateResolver);
        const rBnode = emitRestriction({
          constraint,
          'constraintValue': constraintValue,
          curie,
          issuer,
          'onProperty': flatOnProperty,
          quads
        });

        quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
      }
    } else {
      const targetIri = QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, targetIri, { curie }));
    }
  }
}

function emitClassRestrictionRelations(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, graph, issuer, predicateResolver, quads
  } = ctx;

  // Site 4: OWL.Restriction relations carry metadata.propertyName — resolve flat predicate IRI.
  for (const rel of entry.byPredicate.get(OWL.Restriction) ?? []) {
    const meta = rel.metadata ?? {};
    const minCard = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;
    let onProperty: string;

    if (predicateResolver !== undefined && typeof meta.propertyName === 'string') {
      const propSubject = propertySubjectIri(subject, meta.propertyName);

      onProperty = predicateResolver({
        'classId': subject,
        'propertyName': meta.propertyName,
        'propertySchema': resolvePropertySchema(graph, propSubject)
      });
    } else {
      onProperty = typeof meta.onProperty === 'string' ? meta.onProperty : '';
    }

    const minCardLit = QuadFactory.literal(minCard, XSD.nonNegativeInteger, { curie });
    const rBnode = emitRestriction({
      'constraint': OWL.minCardinality,
      'constraintValue': minCardLit,
      curie,
      issuer,
      onProperty,
      quads
    });

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }
}

function emitClassEquivalencesAndDisjoint(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const eqBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(eqBnode), { curie }));
    quads.push(QuadFactory.quad(eqBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    const equivIris = equivRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.iri> => {
      return QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });
    });

    quads.push(QuadFactory.quad(eqBnode, OWL.unionOf, QuadFactory.rdfList(equivIris, quads, issuer), { curie }));
  }

  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    const complementIri = QuadFactory.iri(ProjectionIndex.relationTargetId(complementRels[0]), { curie });

    quads.push(QuadFactory.quad(subject, OWL.complementOf, complementIri, { curie }));
  }

  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (disjointRels.length > 0) {
    const disjointIri = QuadFactory.iri(ProjectionIndex.relationTargetId(disjointRels[0]), { curie });

    quads.push(QuadFactory.quad(subject, OWL.disjointWith, disjointIri, { curie }));
  }

  const disjointUnionRels = entry.byPredicate.get(OWL.disjointUnionOf) ?? [];

  if (disjointUnionRels.length > 0) {
    const disjointUnionIris = disjointUnionRels.map((rel: SchemaGraphRelationType): QuadObjectType => {
      return QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });
    });
    const disjointUnionList = QuadFactory.rdfList(disjointUnionIris, quads, issuer);

    quads.push(QuadFactory.quad(subject, OWL.disjointUnionOf, disjointUnionList, { curie }));
  }
}

function emitClassEnumerations(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const typedLiterals = oneOfRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.literal> => {
      return QuadFactory.literal(typedLiteralObject(ProjectionIndex.relationTargetId(rel)), RDF.JSON, { curie });
    });

    quads.push(QuadFactory.quad(subject, OWL.oneOf, QuadFactory.rdfList(typedLiterals, quads, issuer), { curie }));

    return;
  }

  const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

  if (hasValueRels.length > 0) {
    const hasValueTarget = typedLiteralObject(ProjectionIndex.relationTargetId(hasValueRels[0]));
    const valueLit = QuadFactory.literal(hasValueTarget, RDF.JSON, { curie });

    quads.push(QuadFactory.quad(subject, OWL.oneOf, QuadFactory.rdfList([valueLit], quads, issuer), { curie }));
  }
}

// ---------------------------------------------------------------------------
// Class node emission
// ---------------------------------------------------------------------------

function emitClassQuads(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, graph, issuer, predicateResolver, quads
  } = ctx;

  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));

  QuadFactory.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
  QuadFactory.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });

  const deprecated = entry.byPredicate.get(OWL.deprecated);

  if (deprecated !== undefined) {
    quads.push(QuadFactory.quad(subject, OWL.deprecated, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  emitClassSubClassRelations(subject, entry, ctx);
  emitClassRestrictionRelations(subject, entry, ctx);
  emitClassEquivalencesAndDisjoint(subject, entry, ctx);
  emitClassEnumerations(subject, entry, ctx);

  const conditionalItems = owlVocab.processConditionals(entry, quads, curie, issuer);
  const depSchemaItems = owlVocab.processDependentSchemas(subject, entry, quads, curie, issuer);
  const depReqItems = owlVocab.processDependentRequired(subject, entry, quads, curie, issuer, graph, predicateResolver);

  for (const item of [
    ...conditionalItems,
    ...depSchemaItems,
    ...depReqItems
  ]) {
    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, item, { curie }));
  }

  emitContainsQuads(subject, entry, ctx);
  emitPrefixItemQuads(subject, entry, ctx);
  emitArrayItemQuads(subject, entry, ctx);
  emitPatternPropertyQuads(subject, entry, ctx);
}

function typedLiteralObject(value: unknown): TypedLiteralObjectType {
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
// Property node emission helpers
// ---------------------------------------------------------------------------

const OWL_PROPERTY_CHARACTERISTICS: readonly string[] = [
  OWL.TransitiveProperty,
  OWL.SymmetricProperty,
  OWL.AsymmetricProperty,
  OWL.FunctionalProperty,
  OWL.InverseFunctionalProperty,
  OWL.ReflexiveProperty,
  OWL.IrreflexiveProperty
];

function emitPropertyCharacteristics(
  canonicalId: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, quads
  } = ctx;

  if (entry.types.includes(OWL.ObjectProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.ObjectProperty, { curie }), { curie }));
  } else if (entry.types.includes(OWL.DatatypeProperty)) {
    quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(OWL.DatatypeProperty, { curie }), { curie }));
  }

  for (const characteristic of OWL_PROPERTY_CHARACTERISTICS) {
    if (entry.byPredicate.has(characteristic)) {
      quads.push(QuadFactory.quad(canonicalId, RDF.type, QuadFactory.iri(characteristic, { curie }), { curie }));
    }
  }
}

function emitPropertyRangeAndUnion(
  canonicalId: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const hasMaxCount = entry.byPredicate.has(SH.maxCount);
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];
  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];

  if (!hasMaxCount) {
    quads.push(QuadFactory.quad(canonicalId, RDFS.range, QuadFactory.iri(RDF.List, { curie }), { curie }));
  } else if (rangeRels.length > 0) {
    const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, rangeIri, { curie }));
  } else if (datatypeRels.length > 0) {
    const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, RDFS.range, datatypeIri, { curie }));
  }

  for (const rel of entry.all.filter((relation: SchemaGraphRelationType): boolean => {
    return relation.predicate === OWL.unionOf && relation.structure?.kind === 'list';
  })) {
    const structure = rel.structure;

    if (!ProjectionIndex.isListStructure(structure)) {
      continue;
    }
    const memberIris = structure.members.map((member: string): ReturnType<typeof QuadFactory.iri> => {
      return QuadFactory.iri(member, { curie });
    });

    quads.push(QuadFactory.quad(canonicalId, OWL.unionOf, QuadFactory.rdfList(memberIris, quads, issuer), { curie }));
  }

  const inverseRels = entry.byPredicate.get(OWL.inverseOf) ?? [];

  if (inverseRels.length > 0) {
    const inverseIri = QuadFactory.iri(ProjectionIndex.relationTargetId(inverseRels[0]), { curie });

    quads.push(QuadFactory.quad(canonicalId, OWL.inverseOf, inverseIri, { curie }));
  }
}

function emitPropertyAnnotations(
  canonicalId: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, quads
  } = ctx;

  QuadFactory.emitLiterals(canonicalId, entry, RDFS.comment, RDFS.comment, quads, { curie });

  if (entry.byPredicate.has(DASH.readOnly)) {
    const readOnlyLit = QuadFactory.literal(true, XSD.boolean, { curie });

    quads.push(QuadFactory.quad(canonicalId, DASH.readOnly, readOnlyLit, { curie }));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    const writeOnlyLit = QuadFactory.literal(true, XSD.boolean, { curie });

    quads.push(QuadFactory.quad(canonicalId, DASH.writeOnly, writeOnlyLit, { curie }));
  }

  QuadFactory.emitLiterals(canonicalId, entry, DCT.format, DCT.format, quads, { curie });
}

// ---------------------------------------------------------------------------
// Property node emission
// ---------------------------------------------------------------------------

function emitPropertyQuads(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, graph, predicateResolver, quads
  } = ctx;

  if (SchemaIri.fragmentContains(subject, '/patternProperties/')) {
    return;
  }

  if (!SchemaIri.isPropertySubject(subject)) {
    return;
  }

  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const classId = domainRels.length > 0
    ? ProjectionIndex.relationTargetId(domainRels[0])
    : SchemaIri.structuralParent(subject);
  const propName = SchemaIri.lastSegment(subject);
  const propertySchema = resolvePropertySchema(graph, subject);

  const canonicalId = predicateResolver === undefined
    ? canonicalPropertyIri(subject)
    : predicateResolver({
      'classId': classId,
      'propertyName': propName,
      'propertySchema': propertySchema
    });

  emitPropertyCharacteristics(canonicalId, entry, ctx);
  quads.push(QuadFactory.quad(canonicalId, RDFS.domain, QuadFactory.iri(classId, { curie }), { curie }));
  emitPropertyRangeAndUnion(canonicalId, entry, ctx);
  emitPropertyAnnotations(canonicalId, entry, ctx);
}

// ---------------------------------------------------------------------------
// Fallback: canonical property IRI when no predicateResolver is available
// ---------------------------------------------------------------------------

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
// Contains emission (owl:someValuesFrom)
// ---------------------------------------------------------------------------

/**
 * Emit an optional qualified-cardinality restriction for a contains property.
 * Emits a subClassOf restriction bnode and attaches the onDataRange triple.
 */
function emitQualifiedCardinalityRestriction(args: EmitQualifiedCardinalityRestrictionArgsType): void {
  const {
    cardinalityPredicate, containsIriObject, ctx, onProp, rels, subject
  } = args;

  if (rels.length === 0) {
    return;
  }
  const {
    curie, issuer, quads
  } = ctx;
  const val = Number(ProjectionIndex.relationTargetId(rels[0]));
  const lit = QuadFactory.literal(val, XSD.nonNegativeInteger, { curie });
  const rBnode = emitRestriction({
    'constraint': cardinalityPredicate,
    'constraintValue': lit,
    curie,
    issuer,
    'onProperty': onProp,
    quads
  });

  quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  quads.push(QuadFactory.quad(rBnode, OWL.onDataRange, containsIriObject, { curie }));
}

function emitContainsQuads(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, graph, issuer, predicateResolver, quads
  } = ctx;
  // Only pick up `contains` keyword restrictions (predicate = OWL.someValuesFrom),
  // not user-declared restrictions which use RDFS.subClassOf predicate.
  const containsRels = entry.all.filter((rel: SchemaGraphRelationType): boolean => {
    return rel.predicate === OWL.someValuesFrom
      && ProjectionIndex.isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom;
  });

  for (const rel of containsRels) {
    const structure = rel.structure;

    if (!ProjectionIndex.isRestrictionStructure(structure)) {
      continue;
    }
    // Resolve the class-scoped onProperty to the flat canonical predicate IRI.
    const onProp = resolveRestrictionOnProperty(structure.onProperty, graph, predicateResolver);
    const containsTypeRef = String(structure.value);
    const containsIri = QuadFactory.iri(containsTypeRef, { curie });
    const rBnode = emitRestriction({
      'constraint': OWL.someValuesFrom,
      'constraintValue': containsIri,
      curie,
      issuer,
      'onProperty': onProp,
      quads
    });

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));

    const containsIriObject = QuadFactory.iri(containsTypeRef, { curie });

    emitQualifiedCardinalityRestriction({
      'cardinalityPredicate': OWL.minQualifiedCardinality,
      containsIriObject,
      ctx,
      onProp,
      'rels': entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [],
      subject
    });
    emitQualifiedCardinalityRestriction({
      'cardinalityPredicate': OWL.maxQualifiedCardinality,
      containsIriObject,
      ctx,
      onProp,
      'rels': entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [],
      subject
    });
  }
}

// ---------------------------------------------------------------------------
// PrefixItems emission (rdf:_N restrictions)
// ---------------------------------------------------------------------------

function emitPrefixItemQuads(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const memberRels = entry.byPredicate.get(RDFS.member) ?? [];

  for (const [
    i,
    memberRel
  ] of memberRels.entries()) {
    const typeRef = ProjectionIndex.relationTargetId(memberRel);
    const rBnode = emitRestriction({
      'constraint': OWL.allValuesFrom,
      'constraintValue': QuadFactory.iri(typeRef, { curie }),
      curie,
      issuer,
      'onProperty': `rdf:_${i + 1}`,
      quads
    });

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }
}

// ---------------------------------------------------------------------------
// Array item restriction emission (owl:allValuesFrom)
// ---------------------------------------------------------------------------

/** Resolve the item type IRI for an array property, checking direct range first then /items entry. */
function resolveItemTypeId(
  propSubject: string,
  propEntry: RelationIndexType,
  index: Map<string, RelationIndexType>
): null | string {
  const propRangeRels = propEntry.byPredicate.get(RDFS.range) ?? [];

  if (propRangeRels.length > 0) {
    return ProjectionIndex.relationTargetId(propRangeRels[0]);
  }

  const itemsSubject = `${propSubject}/items`;
  const itemsEntry = index.get(itemsSubject);

  if (itemsEntry === undefined) {
    return null;
  }

  const rangeRels = itemsEntry.byPredicate.get(RDFS.range) ?? [];
  const dtRels = itemsEntry.byPredicate.get(SH.datatype) ?? [];

  if (rangeRels.length > 0) {
    return ProjectionIndex.relationTargetId(rangeRels[0]);
  }

  if (dtRels.length > 0) {
    return ProjectionIndex.relationTargetId(dtRels[0]);
  }

  return itemsSubject;
}

/** Resolve the canonical predicate IRI for an array-item property. */
function resolveArrayPropertyCanonicalId(args: ResolveArrayPropertyCanonicalIdArgsType): string {
  const {
    graph, predicateResolver, propEntry, propSubject
  } = args;

  if (predicateResolver === undefined) {
    return canonicalPropertyIri(propSubject);
  }

  const domainRels = propEntry.byPredicate.get(RDFS.domain) ?? [];
  const classId = domainRels.length > 0
    ? ProjectionIndex.relationTargetId(domainRels[0])
    : SchemaIri.structuralParent(propSubject);
  const propName = SchemaIri.lastSegment(propSubject);
  const propertySchema = resolvePropertySchema(graph, propSubject);

  return predicateResolver({
    'classId': classId,
    'propertyName': propName,
    'propertySchema': propertySchema
  });
}

// Site 1 fix: resolve the property IRI via predicateResolver when available
// so array-item restriction onProperty uses the flat canonical IRI rather than
// the class-scoped form produced by canonicalPropertyIri().
function emitArrayItemQuads(
  subject: string,
  _entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, graph, index, issuer, predicateResolver, quads
  } = ctx;

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

    const itemTypeId = resolveItemTypeId(propSubject, propEntry, index);

    if (itemTypeId === null) {
      continue;
    }

    const canonicalId = resolveArrayPropertyCanonicalId({
      graph,
      predicateResolver,
      propEntry,
      propSubject
    });
    const itemTypeIri = QuadFactory.iri(itemTypeId, { curie });
    const rBnode = emitRestriction({
      'constraint': OWL.allValuesFrom,
      'constraintValue': itemTypeIri,
      curie,
      issuer,
      'onProperty': canonicalId,
      quads
    });

    quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  }
}

// ---------------------------------------------------------------------------
// Pattern property emission
// ---------------------------------------------------------------------------

/** Emit OWL quads for a single pattern-property entry. */
function emitPatternPropertyEntry(args: EmitPatternPropertyEntryArgsType): void {
  const {
    ctx, pattern, patternEntry, subject
  } = args;
  const {
    curie, graph, predicateResolver, quads
  } = ctx;
  const patternSubject = `${SchemaIri.splitSubject(subject).base}#/patternProperties/${pattern}`;

  const datatypeRels = patternEntry?.byPredicate.get(SH.datatype) ?? [];
  const rangeRels = patternEntry?.byPredicate.get(RDFS.range) ?? [];
  const hasDatatype = datatypeRels.length > 0;
  const hasRange = rangeRels.length > 0;
  const rdfType = !hasDatatype && !hasRange ? OWL.ObjectProperty : OWL.DatatypeProperty;

  const propIri = predicateResolver === undefined
    ? SchemaIri.propertyIri(subject, pattern)
    : predicateResolver({
      'classId': subject,
      'propertyName': pattern,
      'propertySchema': resolvePropertySchema(graph, patternSubject)
    });

  quads.push(QuadFactory.quad(propIri, RDF.type, QuadFactory.iri(rdfType, { curie }), { curie }));
  quads.push(QuadFactory.quad(propIri, RDFS.domain, QuadFactory.iri(subject, { curie }), { curie }));
  quads.push(QuadFactory.quad(propIri, SH.pattern, QuadFactory.literal(pattern, XSD.string, { curie }), { curie }));

  if (hasDatatype) {
    const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRels[0]), { curie });

    quads.push(QuadFactory.quad(propIri, RDFS.range, datatypeIri, { curie }));
  }

  if (hasRange) {
    const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRels[0]), { curie });

    quads.push(QuadFactory.quad(propIri, RDFS.range, rangeIri, { curie }));
  }

  if (patternEntry !== undefined) {
    QuadFactory.emitLiterals(propIri, patternEntry, RDFS.comment, RDFS.comment, quads, { curie });
  }
}

// Site 2 fix: resolve the pattern-property IRI via predicateResolver when
// available so sh:path / owl:onProperty use the flat canonical IRI.
function emitPatternPropertyQuads(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const { index } = ctx;
  const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty !== true || typeof rel.metadata.pattern !== 'string') {
      continue;
    }

    const pattern = rel.metadata.pattern;
    const { base } = SchemaIri.splitSubject(subject);
    const patternSubject = `${base}#/patternProperties/${pattern}`;

    emitPatternPropertyEntry({
      ctx,
      pattern,
      'patternEntry': index.get(patternSubject),
      subject
    });
  }
}
