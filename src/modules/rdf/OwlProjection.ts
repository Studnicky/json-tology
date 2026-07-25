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

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { PredicateResolverFunctionType } from '../../types/PredicateResolverFunctionType.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphRelationType } from '../../types/SchemaGraph.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { ProjectionEmitContextType } from '../../types/ProjectionEmitContextType.js';
import type { EmitQualifiedCardinalityRestrictionArgumentListType } from '../../types/EmitQualifiedCardinalityRestrictionArgsType.js';
import type { EmitRestrictionArgumentListType } from '../../types/EmitRestrictionArgsType.js';
import type { OptionalQuadObjectType } from '../../types/OptionalQuadObjectType.js';
import type { TypedLiteralObjectType } from '../../types/TypedLiteralObjectType.js';
import type { EmitPatternPropertyEntryArgumentListType } from '../../types/EmitPatternPropertyEntryArgsType.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import {
  OWL_CARDINALITY_PREDICATE_IRIS, OWL_PROPERTY_CHARACTERISTICS
} from '../../constants/ONTOLOGY_PREDICATES.js';
import {
  SHACL_TO_XSD_FACET,
  XSD_FACET_DATATYPE
} from '../../constants/XSD_FACETS.js';
import { XsdTypes } from '../quads/XsdTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { QuadEmit } from './QuadEmit.js';

import { ProjectionIndex } from './ProjectionIndex.js';
import type { RelationIndexType } from '../../types/RelationIndexType.js';
import { IdentifierIssuer } from '../quads/IdentifierIssuer.js';
import { VocabProjection } from './VocabProjection.js';
import { PropertyProjection } from './PropertyProjection.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';

// ---------------------------------------------------------------------------
// Restriction bnode emission — shared by OwlVocabProjection and OwlProjection
// ---------------------------------------------------------------------------

class RestrictionEmit {
  /** Emit an `owl:Restriction` with `owl:minCardinality 1` on `onProperty`. Returns the bnode label. */
  static emitMinimumCardinalityOneRestriction(
    onProperty: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer: IdentifierIssuerInterface | undefined
  ): string {
    const minimumOne = QuadFactory.literal(1, XSD.nonNegativeInteger, { curie });

    return RestrictionEmit.emitRestriction({
      'constraint': OWL.minCardinality,
      'constraintValue': minimumOne,
      curie,
      issuer,
      onProperty,
      quads
    });
  }

  static emitRestriction(argumentList: EmitRestrictionArgumentListType): string {
    const {
      constraint, constraintValue, curie, issuer, onProperty, quads
    } = argumentList;
    const rBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(rBnode, RDF.type, QuadFactory.iri(OWL.Restriction, { curie }), { curie }));
    quads.push(QuadFactory.quad(rBnode, OWL.onProperty, QuadFactory.iri(onProperty, { curie }), { curie }));
    quads.push(QuadFactory.quad(rBnode, constraint, constraintValue, { curie }));

    return rBnode;
  }
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
      const firstRestriction = reqRestrictions.at(0);

      if (firstRestriction !== undefined) {
        unionMembers.push(firstRestriction);
      }
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
    ifReference: string,
    elseReference: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const complementBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(complementBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(complementBnode, OWL.complementOf, QuadFactory.iri(ifReference, { curie }), { curie }));

    const branchBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(branchBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(branchBnode, OWL.intersectionOf, QuadFactory.rdfList([
      QuadFactory.bnode(complementBnode),
      QuadFactory.iri(elseReference, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(branchBnode);
  }

  emitConditionalThenBranch(
    ifReference: string,
    thenReference: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const branchBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(branchBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(branchBnode, OWL.intersectionOf, QuadFactory.rdfList([
      QuadFactory.iri(ifReference, { curie }),
      QuadFactory.iri(thenReference, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(branchBnode);
  }

  emitDependentSchemaBranch(
    _subject: string,
    ifReference: string,
    thenReference: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const restrictionBnode = RestrictionEmit.emitMinimumCardinalityOneRestriction(ifReference, quads, curie, issuer);

    const withoutTriggerBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(withoutTriggerBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(withoutTriggerBnode, OWL.complementOf, QuadFactory.bnode(restrictionBnode), { curie }));

    const unionBnode = QuadFactory.nextBnode(issuer);

    quads.push(QuadFactory.quad(unionBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
    quads.push(QuadFactory.quad(unionBnode, OWL.unionOf, QuadFactory.rdfList([
      QuadFactory.bnode(withoutTriggerBnode),
      QuadFactory.iri(thenReference, { curie })
    ], quads, issuer), { curie }));

    return QuadFactory.bnode(unionBnode);
  }

  emitNotTriggerBranch(
    triggerPropIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const restrictionBnode = RestrictionEmit.emitMinimumCardinalityOneRestriction(triggerPropIri, quads, curie, issuer);

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
    const reqBnode = RestrictionEmit.emitMinimumCardinalityOneRestriction(propIri, quads, curie, issuer);

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
export class OwlProjection {
  // ---------------------------------------------------------------------------
  // Fallback: canonical property IRI when no predicateResolver is available
  // ---------------------------------------------------------------------------
  private static canonicalPropertyIri(subject: string): string {
    const parts = SchemaIri.splitSubject(subject);

    if (parts.fragment === null) {
      return subject;
    }

    const split = SchemaIri.splitAtProperties(parts.fragment);

    if (split === undefined) {
      // No /properties/ segment — use last fragment segment as the property name.
      const propName = parts.fragment.split('/').at(-1) ?? '';

      return SchemaIri.propertyIri(parts.base, propName);
    }

    // Route through SchemaIri.structuralParent so the domain parent-stripping
    // logic (allOf/N segments) is applied identically to the domain quad emission.
    const parentId = SchemaIri.structuralParent(subject);

    return SchemaIri.propertyIri(parentId, split.property);
  }

  private static cardinalityConstraintValue(value: unknown, curie: CurieInterface | undefined): OptionalQuadObjectType {
    const n = PropertyProjection.finiteNumber(value);

    if (n === undefined) {
      return undefined;
    }

    return QuadFactory.literal(n, XSD.nonNegativeInteger, { curie });
  }

  // ---------------------------------------------------------------------------
  // Array item restriction emission (owl:allValuesFrom)
  // ---------------------------------------------------------------------------

  // Site 1 fix: resolve the property IRI via predicateResolver when available
  // so array-item restriction onProperty uses the flat canonical IRI rather than
  // the class-scoped form produced by canonicalPropertyIri().
  private static emitArrayItemQuads(
    subject: string,
    _entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, graph, index, issuer, predicateResolver, quads
    } = context;

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

      const itemTypeId = OwlProjection.resolveItemTypeId(propSubject, propEntry, index);

      if (itemTypeId === null) {
        continue;
      }

      const canonicalId = PropertyProjection.resolveCanonicalIri({
        'fallback': OwlProjection.canonicalPropertyIri,
        graph,
        predicateResolver,
        propEntry,
        propSubject
      });
      const itemTypeIri = QuadFactory.iri(itemTypeId, { curie });
      const rBnode = RestrictionEmit.emitRestriction({
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
  // Class node emission helpers
  // ---------------------------------------------------------------------------

  private static emitClassEnumerations(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, issuer, quads
    } = context;
    const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

    if (oneOfRels.length > 0) {
      const typedLiterals = OwlProjection.enumLiteralsFromOneOf(oneOfRels, curie);

      quads.push(QuadFactory.quad(subject, OWL.oneOf, QuadFactory.rdfList(typedLiterals, quads, issuer), { curie }));

      return;
    }

    const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

    if (hasValueRels.length > 0) {
      const firstHasValueRel = hasValueRels.at(0);

      if (firstHasValueRel !== undefined) {
        const hasValueTarget = OwlProjection.typedLiteralObject(ProjectionIndex.relationTargetId(firstHasValueRel));
        const valueLit = QuadFactory.literal(hasValueTarget, RDF.JSON, { curie });

        quads.push(QuadFactory.quad(subject, OWL.oneOf, QuadFactory.rdfList([valueLit], quads, issuer), { curie }));
      }
    }
  }

  private static emitClassEquivalencesAndDisjoint(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, issuer, quads
    } = context;
    const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

    if (equivRels.length > 0) {
      const eqBnode = QuadFactory.nextBnode(issuer);

      quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(eqBnode), { curie }));
      quads.push(QuadFactory.quad(eqBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
      const equivIris = equivRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.iri> => {
        const result = QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });

        return result;
      });

      quads.push(QuadFactory.quad(eqBnode, OWL.unionOf, QuadFactory.rdfList(equivIris, quads, issuer), { curie }));
    }

    const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

    if (complementRels.length > 0) {
      const firstComplementRel = complementRels.at(0);

      if (firstComplementRel !== undefined) {
        const complementIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstComplementRel), { curie });

        quads.push(QuadFactory.quad(subject, OWL.complementOf, complementIri, { curie }));
      }
    }

    const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

    if (disjointRels.length > 0) {
      const firstDisjointRel = disjointRels.at(0);

      if (firstDisjointRel !== undefined) {
        const disjointIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstDisjointRel), { curie });

        quads.push(QuadFactory.quad(subject, OWL.disjointWith, disjointIri, { curie }));
      }
    }

    const disjointUnionRels = entry.byPredicate.get(OWL.disjointUnionOf) ?? [];

    if (disjointUnionRels.length > 0) {
      const disjointUnionIris = disjointUnionRels.map((rel: SchemaGraphRelationType): QuadObjectType => {
        const result = QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie });

        return result;
      });
      const disjointUnionList = QuadFactory.rdfList(disjointUnionIris, quads, issuer);

      quads.push(QuadFactory.quad(subject, OWL.disjointUnionOf, disjointUnionList, { curie }));
    }
  }

  // ---------------------------------------------------------------------------
  // Class node emission
  // ---------------------------------------------------------------------------

  private static emitClassQuads(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, graph, issuer, predicateResolver, quads
    } = context;

    quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));

    QuadEmit.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
    QuadEmit.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });

    const deprecated = entry.byPredicate.get(OWL.deprecated);

    if (deprecated !== undefined) {
      quads.push(QuadFactory.quad(subject, OWL.deprecated, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
    }

    OwlProjection.emitClassSubClassRelations(subject, entry, context);
    OwlProjection.emitClassRestrictionRelations(subject, entry, context);
    OwlProjection.emitClassEquivalencesAndDisjoint(subject, entry, context);
    OwlProjection.emitClassEnumerations(subject, entry, context);

    const conditionalItems = owlVocab.emitConditionals(entry, quads, curie, issuer);
    const depSchemaItems = owlVocab.emitDependentSchemas(subject, entry, quads, curie, issuer);
    const depReqItems = owlVocab.emitDependentRequired(subject, entry, quads, curie, {
      graph,
      issuer,
      predicateResolver
    });

    const subClassOfItems = [
      ...conditionalItems,
      ...depSchemaItems,
      ...depReqItems
    ];

    for (const [
      , item
    ] of subClassOfItems.entries()) {
      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, item, { curie }));
    }

    OwlProjection.emitContainsQuads(subject, entry, context);
    OwlProjection.emitPrefixItemQuads(subject, entry, context);
    OwlProjection.emitArrayItemQuads(subject, entry, context);
    OwlProjection.emitPatternPropertyQuads(subject, entry, context);
  }

  private static emitClassRestrictionRelations(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, graph, issuer, predicateResolver, quads
    } = context;

    // Site 4: OWL.Restriction relations carry metadata.propertyName — resolve flat predicate IRI.
    for (const rel of entry.byPredicate.get(OWL.Restriction) ?? []) {
      const meta = rel.metadata ?? {};
      const minimumCardinality = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;
      let onProperty: string;

      if (predicateResolver !== undefined && typeof meta.propertyName === 'string') {
        const propSubject = PropertyProjection.subjectIri(subject, meta.propertyName);

        onProperty = predicateResolver({
          'classId': subject,
          'propertyName': meta.propertyName,
          'propertySchema': PropertyProjection.resolveSchema(graph, propSubject)
        });
      } else if (typeof meta.onProperty === 'string' && meta.onProperty !== '') {
        onProperty = meta.onProperty;
      } else {
        throw new GraphError(
          `OWL restriction on subject <${subject}> has no resolvable onProperty IRI`,
          { 'code': GRAPH_ERROR_CODE.INVALID_PREDICATE_IRI }
        );
      }

      const minimumCardinalityLiteral = QuadFactory.literal(minimumCardinality, XSD.nonNegativeInteger, { curie });
      const rBnode = RestrictionEmit.emitRestriction({
        'constraint': OWL.minCardinality,
        'constraintValue': minimumCardinalityLiteral,
        curie,
        issuer,
        onProperty,
        quads
      });

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
    }
  }

  private static emitClassSubClassRelations(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, graph, issuer, predicateResolver, quads
    } = context;

    // H-1: RDFS.subClassOf relations with restriction structure → restriction bnodes.
    // Plain subClassOf relations → direct IRI triples.
    for (const rel of entry.byPredicate.get(RDFS.subClassOf) ?? []) {
      if (ProjectionIndex.isRestrictionStructure(rel.structure)) {
        const {
          constraint, onProperty, value
        } = rel.structure;
        const constraintValue = OwlProjection.restrictionConstraintValue(constraint, value, curie);

        if (constraintValue !== undefined) {
          const flatOnProperty = PropertyProjection.resolveRestriction(onProperty, graph, predicateResolver);
          const rBnode = RestrictionEmit.emitRestriction({
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

  // ---------------------------------------------------------------------------
  // Contains emission (owl:someValuesFrom)
  // ---------------------------------------------------------------------------

  private static emitContainsQuads(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, graph, issuer, predicateResolver, quads
    } = context;
    // Only pick up `contains` keyword restrictions (predicate = OWL.someValuesFrom),
    // not user-declared restrictions which use RDFS.subClassOf predicate.
    const containsRels = ProjectionIndex.filterContainsRestrictions(entry.all);

    for (const rel of containsRels) {
      const structure = rel.structure;

      if (!ProjectionIndex.isRestrictionStructure(structure)) {
        continue;
      }
      // Resolve the class-scoped onProperty to the flat canonical predicate IRI.
      const onProp = PropertyProjection.resolveRestriction(structure.onProperty, graph, predicateResolver);
      const containsTypeReference = String(structure.value);
      const containsIri = QuadFactory.iri(containsTypeReference, { curie });
      const rBnode = RestrictionEmit.emitRestriction({
        'constraint': OWL.someValuesFrom,
        'constraintValue': containsIri,
        curie,
        issuer,
        'onProperty': onProp,
        quads
      });

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));

      const containsIriObject = QuadFactory.iri(containsTypeReference, { curie });

      OwlProjection.emitQualifiedCardinalityRestriction({
        'cardinalityPredicate': OWL.minQualifiedCardinality,
        containsIriObject,
        context,
        onProp,
        'rels': entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [],
        subject
      });
      OwlProjection.emitQualifiedCardinalityRestriction({
        'cardinalityPredicate': OWL.maxQualifiedCardinality,
        containsIriObject,
        context,
        onProp,
        'rels': entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [],
        subject
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Primitive schema detection and emission
  //
  // SHACL_TO_XSD_FACET and XSD_FACET_DATATYPE are imported from the canonical
  // bidirectional facet table in src/constants/XSD_FACETS.ts.
  // ---------------------------------------------------------------------------

  private static emitDatatypeEnumeration(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, issuer, quads
    } = context;
    const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

    if (oneOfRels.length > 0) {
      const enumLiterals = OwlProjection.enumLiteralsFromOneOf(oneOfRels, curie);
      const equivBnode = QuadFactory.nextBnode(issuer);

      quads.push(QuadFactory.quad(subject, OWL.equivalentClass, QuadFactory.bnode(equivBnode), { curie }));
      quads.push(QuadFactory.quad(equivBnode, OWL.oneOf, QuadFactory.rdfList(enumLiterals, quads, issuer), { curie }));
    }
  }

  private static emitDatatypeFacetBnodes(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, issuer, quads
    } = context;
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

  private static emitDatatypeMetadata(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, quads
    } = context;
    const multipleOfRels = entry.byPredicate.get(JT.multipleOf) ?? [];

    if (multipleOfRels.length > 0) {
      const firstMultipleOfRel = multipleOfRels.at(0);

      if (firstMultipleOfRel !== undefined) {
        quads.push(QuadFactory.quad(
          subject,
          JT.multipleOf,
          QuadFactory.literal(Number(ProjectionIndex.relationTargetId(firstMultipleOfRel)), XSD.decimal, { curie }),
          { curie }
        ));
      }
    }

    // H-2: read format from JT.format graph relation, not from source.schema.format
    const formatRels = entry.byPredicate.get(JT.format) ?? [];

    if (formatRels.length > 0) {
      const firstFormatRel = formatRels.at(0);

      if (firstFormatRel !== undefined) {
        quads.push(QuadFactory.quad(
          subject,
          JT.format,
          QuadFactory.literal(ProjectionIndex.relationTargetId(firstFormatRel), XSD.string, { curie }),
          { curie }
        ));
      }
    }

    QuadEmit.emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, { curie });
    QuadEmit.emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, { curie });
  }

  private static emitDatatypeQuads(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, quads
    } = context;

    quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(RDFS.Datatype, { curie }), { curie }));

    const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
    let xsdType: string | undefined;

    if (datatypeRels.length > 0) {
      const firstDatatypeRel = datatypeRels.at(0);

      if (firstDatatypeRel !== undefined) {
        xsdType = ProjectionIndex.relationTargetId(firstDatatypeRel);
        quads.push(QuadFactory.quad(subject, OWL.onDatatype, QuadFactory.iri(xsdType, { curie }), { curie }));
      }
    }

    OwlProjection.emitDatatypeFacetBnodes(subject, entry, context);
    OwlProjection.emitDatatypeEnumeration(subject, entry, context);
    OwlProjection.emitDatatypeMetadata(subject, entry, context);
  }

  // ---------------------------------------------------------------------------
  // Pattern property emission
  // ---------------------------------------------------------------------------

  /** Emit OWL quads for a single pattern-property entry. */
  private static emitPatternPropertyEntry(argumentList: EmitPatternPropertyEntryArgumentListType): void {
    const {
      context, pattern, patternEntry, subject
    } = argumentList;
    const {
      curie, graph, predicateResolver, quads
    } = context;
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
        'propertySchema': PropertyProjection.resolveSchema(graph, patternSubject)
      });

    quads.push(QuadFactory.quad(propIri, RDF.type, QuadFactory.iri(rdfType, { curie }), { curie }));
    quads.push(QuadFactory.quad(propIri, RDFS.domain, QuadFactory.iri(subject, { curie }), { curie }));
    quads.push(QuadFactory.quad(propIri, SH.pattern, QuadFactory.literal(pattern, XSD.string, { curie }), { curie }));

    if (hasDatatype) {
      const firstDatatypeRel = datatypeRels.at(0);

      if (firstDatatypeRel !== undefined) {
        const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstDatatypeRel), { curie });

        quads.push(QuadFactory.quad(propIri, RDFS.range, datatypeIri, { curie }));
      }
    }

    if (hasRange) {
      const firstRangeRel = rangeRels.at(0);

      if (firstRangeRel !== undefined) {
        const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstRangeRel), { curie });

        quads.push(QuadFactory.quad(propIri, RDFS.range, rangeIri, { curie }));
      }
    }

    if (patternEntry !== undefined) {
      QuadEmit.emitLiterals(propIri, patternEntry, RDFS.comment, RDFS.comment, quads, { curie });
    }
  }

  // ---------------------------------------------------------------------------
  // PrefixItems emission (rdf:_N restrictions)
  // ---------------------------------------------------------------------------

  // Site 2 fix: resolve the pattern-property IRI via predicateResolver when
  // available so sh:path / owl:onProperty use the flat canonical IRI.
  private static emitPatternPropertyQuads(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const { index } = context;
    const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

    for (const rel of patternRels) {
      if (rel.metadata?.patternProperty !== true || typeof rel.metadata.pattern !== 'string') {
        continue;
      }

      const pattern = rel.metadata.pattern;
      const { base } = SchemaIri.splitSubject(subject);
      const patternSubject = `${base}#/patternProperties/${pattern}`;

      OwlProjection.emitPatternPropertyEntry({
        context,
        pattern,
        'patternEntry': index.get(patternSubject),
        subject
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Property node emission helpers
  // ---------------------------------------------------------------------------

  private static emitPrefixItemQuads(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, issuer, quads
    } = context;
    const memberRels = entry.byPredicate.get(RDFS.member) ?? [];

    for (const [
      i,
      memberRel
    ] of memberRels.entries()) {
      const typeReference = ProjectionIndex.relationTargetId(memberRel);
      const rBnode = RestrictionEmit.emitRestriction({
        'constraint': OWL.allValuesFrom,
        'constraintValue': QuadFactory.iri(typeReference, { curie }),
        curie,
        issuer,
        'onProperty': `rdf:_${i + 1}`,
        quads
      });

      quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
    }
  }

  private static emitPropertyAnnotations(
    canonicalId: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, quads
    } = context;

    QuadEmit.emitLiterals(canonicalId, entry, RDFS.comment, RDFS.comment, quads, { curie });

    if (entry.byPredicate.has(DASH.readOnly)) {
      const readOnlyLit = QuadFactory.literal(true, XSD.boolean, { curie });

      quads.push(QuadFactory.quad(canonicalId, DASH.readOnly, readOnlyLit, { curie }));
    }

    if (entry.byPredicate.has(DASH.writeOnly)) {
      const writeOnlyLit = QuadFactory.literal(true, XSD.boolean, { curie });

      quads.push(QuadFactory.quad(canonicalId, DASH.writeOnly, writeOnlyLit, { curie }));
    }

    QuadEmit.emitLiterals(canonicalId, entry, DCT.format, DCT.format, quads, { curie });
  }

  // ---------------------------------------------------------------------------
  // Property node emission
  // ---------------------------------------------------------------------------

  private static emitPropertyCharacteristics(
    canonicalId: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, quads
    } = context;

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

  private static emitPropertyQuads(
    subject: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, graph, predicateResolver, quads
    } = context;

    if (SchemaIri.fragmentContains(subject, '/patternProperties/')) {
      return;
    }

    if (!SchemaIri.isPropertySubject(subject)) {
      return;
    }

    const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
    const firstDomainRel = domainRels.at(0);
    const classId = firstDomainRel === undefined
      ? SchemaIri.structuralParent(subject)
      : ProjectionIndex.relationTargetId(firstDomainRel);

    const canonicalId = PropertyProjection.resolveCanonicalIri({
      'fallback': OwlProjection.canonicalPropertyIri,
      graph,
      predicateResolver,
      'propEntry': entry,
      'propSubject': subject
    });

    OwlProjection.emitPropertyCharacteristics(canonicalId, entry, context);
    quads.push(QuadFactory.quad(canonicalId, RDFS.domain, QuadFactory.iri(classId, { curie }), { curie }));
    OwlProjection.emitPropertyRangeAndUnion(canonicalId, entry, context);
    OwlProjection.emitPropertyAnnotations(canonicalId, entry, context);
  }

  private static emitPropertyRangeAndUnion(
    canonicalId: string,
    entry: RelationIndexType,
    context: ProjectionEmitContextType
  ): void {
    const {
      curie, issuer, quads
    } = context;
    const hasMaximumCount = entry.byPredicate.has(SH.maxCount);
    const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];
    const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];

    if (!hasMaximumCount) {
      quads.push(QuadFactory.quad(canonicalId, RDFS.range, QuadFactory.iri(RDF.List, { curie }), { curie }));
    } else if (rangeRels.length > 0) {
      const firstRangeRel = rangeRels.at(0);

      if (firstRangeRel !== undefined) {
        const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstRangeRel), { curie });

        quads.push(QuadFactory.quad(canonicalId, RDFS.range, rangeIri, { curie }));
      }
    } else if (datatypeRels.length > 0) {
      const firstDatatypeRangeRel = datatypeRels.at(0);

      if (firstDatatypeRangeRel !== undefined) {
        const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstDatatypeRangeRel), { curie });

        quads.push(QuadFactory.quad(canonicalId, RDFS.range, datatypeIri, { curie }));
      }
    }

    const unionOfListRels = entry.all.filter((relation: SchemaGraphRelationType): boolean => {
      return relation.predicate === OWL.unionOf && relation.structure?.kind === 'list';
    });

    for (const rel of unionOfListRels) {
      const structure = rel.structure;

      if (!ProjectionIndex.isListStructure(structure)) {
        continue;
      }
      const memberIris = structure.members.map((member: string): ReturnType<typeof QuadFactory.iri> => {
        const result = QuadFactory.iri(member, { curie });

        return result;
      });

      quads.push(QuadFactory.quad(canonicalId, OWL.unionOf, QuadFactory.rdfList(memberIris, quads, issuer), { curie }));
    }

    const inverseRels = entry.byPredicate.get(OWL.inverseOf) ?? [];

    if (inverseRels.length > 0) {
      const firstInverseRel = inverseRels.at(0);

      if (firstInverseRel !== undefined) {
        const inverseIri = QuadFactory.iri(ProjectionIndex.relationTargetId(firstInverseRel), { curie });

        quads.push(QuadFactory.quad(canonicalId, OWL.inverseOf, inverseIri, { curie }));
      }
    }
  }

  /**
   * Emit an optional qualified-cardinality restriction for a contains property.
   * Emits a subClassOf restriction bnode and attaches the onDataRange triple.
   */
  private static emitQualifiedCardinalityRestriction(argumentList: EmitQualifiedCardinalityRestrictionArgumentListType): void {
    const {
      cardinalityPredicate, containsIriObject, context, onProp, rels, subject
    } = argumentList;

    if (rels.length === 0) {
      return;
    }
    const firstRel = rels.at(0);

    if (firstRel === undefined) {
      return;
    }
    const {
      curie, issuer, quads
    } = context;
    const value = Number(ProjectionIndex.relationTargetId(firstRel));
    const lit = QuadFactory.literal(value, XSD.nonNegativeInteger, { curie });
    const rBnode = RestrictionEmit.emitRestriction({
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

  /** Map a `oneOf` relation list to typed-literal objects for `rdf:JSON`. */
  private static enumLiteralsFromOneOf(
    rels: SchemaGraphRelationType[],
    curie: CurieInterface | undefined
  ): Array<ReturnType<typeof QuadFactory.literal>> {
    const result = rels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.literal> => {
      const literal = QuadFactory.literal(OwlProjection.typedLiteralObject(ProjectionIndex.relationTargetId(rel)), RDF.JSON, { curie });

      return literal;
    });

    return result;
  }

  public static graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined;
    'issuer'?: IdentifierIssuerInterface | undefined;
    'predicateResolver'?: PredicateResolverFunctionType | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const { predicateResolver } = options ?? {};
    const issuer = options?.issuer ?? new IdentifierIssuer();
    const quads: QuadInterface[] = [];
    const allRelations = graph.allRelations();
    const index = ProjectionIndex.build(allRelations);
    const context: ProjectionEmitContextType = {
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
        if (OwlProjection.isPrimitiveEntry(entry)) {
          OwlProjection.emitDatatypeQuads(sourceId, entry, context);
        } else {
          OwlProjection.emitClassQuads(sourceId, entry, context);
        }
      }

      if (entry.types.includes(OWL.DatatypeProperty) || entry.types.includes(OWL.ObjectProperty)) {
        OwlProjection.emitPropertyQuads(sourceId, entry, context);
      }
    }

    return quads;
  }

  private static hasValueConstraintValue(value: unknown, curie: CurieInterface | undefined): OptionalQuadObjectType {
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

  private static isPrimitiveEntry(entry: RelationIndexType): boolean {
    return entry.byPredicate.has(SH.datatype) && !entry.byPredicate.has(OWL.Restriction);
  }

  /** Resolve the item type IRI for an array property, checking direct range first then /items entry. */
  private static resolveItemTypeId(
    propSubject: string,
    propEntry: RelationIndexType,
    index: Map<string, RelationIndexType>
  ): null | string {
    const propRangeRels = propEntry.byPredicate.get(RDFS.range) ?? [];

    if (propRangeRels.length > 0) {
      const firstPropRangeRel = propRangeRels.at(0);

      if (firstPropRangeRel !== undefined) {
        return ProjectionIndex.relationTargetId(firstPropRangeRel);
      }
    }

    const itemsSubject = `${propSubject}/items`;
    const itemsEntry = index.get(itemsSubject);

    if (itemsEntry === undefined) {
      return null;
    }

    const rangeRels = itemsEntry.byPredicate.get(RDFS.range) ?? [];
    const dtRels = itemsEntry.byPredicate.get(SH.datatype) ?? [];

    if (rangeRels.length > 0) {
      const firstRangeRel = rangeRels.at(0);

      if (firstRangeRel !== undefined) {
        return ProjectionIndex.relationTargetId(firstRangeRel);
      }
    }

    if (dtRels.length > 0) {
      const firstDtRel = dtRels.at(0);

      if (firstDtRel !== undefined) {
        return ProjectionIndex.relationTargetId(firstDtRel);
      }
    }

    return itemsSubject;
  }

  private static restrictionConstraintValue(
    constraint: string,
    value: unknown,
    curie: CurieInterface | undefined
  ): OptionalQuadObjectType {
    if (OWL_CARDINALITY_PREDICATE_IRIS.has(constraint)) {
      return OwlProjection.cardinalityConstraintValue(value, curie);
    }

    if (constraint === OWL.hasValue) {
      return OwlProjection.hasValueConstraintValue(value, curie);
    }

    if (typeof value !== 'string' || value === '') {
      return undefined;
    }

    return QuadFactory.iri(value, { curie });
  }

  private static typedLiteralObject(value: unknown): TypedLiteralObjectType {
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
}
