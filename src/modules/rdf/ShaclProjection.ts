/**
 * ShaclProjection — projects SchemaGraph relations into SHACL-vocabulary quads.
 *
 * Iterates graph.allRelations() and emits SHACL shapes:
 * sh:NodeShape for class nodes, sh:PropertyShape for properties,
 * sh:and/sh:or for composition, sh:qualifiedValueShape for contains.
 *
 * Groups properties by structural parent (pointer path), not rdfs:domain.
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
import type { EmitNodeShapeArgsType } from '../../types/EmitNodeShapeArgs.js';
import type { EmitPropertyShapeArgsType } from '../../types/EmitPropertyShapeArgs.js';
import type { EmitNodeShapePropertiesArgsType } from '../../types/EmitNodeShapePropertiesArgs.js';
import type { EmitNodeShapeCompositionArgsType } from '../../types/EmitNodeShapeCompositionArgs.js';
import type { EmitPropertyShapeConstraintsArgsType } from '../../types/EmitPropertyShapeConstraintsArgs.js';
import type { EmitCountConstraintArgsType } from '../../types/EmitCountConstraintArgs.js';
import type { EmitRangeConstraintArgsType } from '../../types/EmitRangeConstraintArgs.js';
import type { EmitContainsQualifiedCardinalityArgsType } from '../../types/EmitContainsQualifiedCardinalityArgs.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from './QuadFactory.js';
import { resolvePropertySchema } from './ProjectionHelpers.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import type { RelationIndexType } from '../../types/RelationIndex.js';
import { VocabProjection } from './VocabProjection.js';

const XSD_IRI_PREFIX = STANDARD_PREFIXES.xsd;

function relationToEquivIri(
  rel: SchemaGraphRelationType,
  index: Map<string, RelationIndexType>,
  curie: CurieInterface | undefined
): ReturnType<typeof QuadFactory.iri> {
  const targetId = resolveTargetRef(ProjectionIndex.relationTargetId(rel), index);

  return QuadFactory.iri(targetId, { curie });
}

function relationToOneOfLiteral(
  rel: SchemaGraphRelationType,
  curie: CurieInterface | undefined
): ReturnType<typeof QuadFactory.literal> {
  return QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, { curie });
}

function resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndexType>): string {
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

function isExcludedFragment(fragment: null | string): boolean {
  if (fragment === null) {
    return false;
  }

  if (
    fragment.includes('/items')
    || fragment.includes('/contains')
    || fragment.includes('/prefixItems/')
    || fragment.includes('/patternProperties/')
    || fragment.includes('/dependentSchemas/')
  ) {
    return true;
  }

  return fragment === '/if' || fragment === '/then' || fragment === '/else';
}

function hasSerializablePredicate(entry: RelationIndexType): boolean {
  return entry.byPredicate.has(RDFS.subClassOf)
    || entry.byPredicate.has(OWL.equivalentClass)
    || entry.byPredicate.has(OWL.complementOf)
    || entry.byPredicate.has(OWL.disjointWith)
    || entry.byPredicate.has(OWL.oneOf)
    || entry.byPredicate.has(RDFS.member)
    || entry.byPredicate.has(SH.pattern)
    || entry.byPredicate.has(JT.dependentRequired);
}

function hasSerializableStructure(entry: RelationIndexType): boolean {
  for (const rel of entry.all) {
    if (rel.structure?.kind === 'conditional') {
      return true;
    }

    if (ProjectionIndex.isRestrictionStructure(rel.structure)
      && rel.structure.constraint === OWL.someValuesFrom) {
      return true;
    }
  }

  return false;
}

function isSerializationCandidate(
  subject: string,
  entry: RelationIndexType,
  propertyIndex: Map<string, string[]>
): boolean {
  if (SchemaIri.isPropertySubject(subject)) {
    return false;
  }

  const parts = SchemaIri.splitSubject(subject);

  if (isExcludedFragment(parts.fragment)) {
    return false;
  }

  if (entry.types.includes(OWL.Class)) {
    return true;
  }

  const props = propertyIndex.get(subject);

  if (props !== undefined && props.length > 0) {
    return true;
  }

  if (hasSerializablePredicate(entry) || hasSerializableStructure(entry)) {
    return true;
  }

  return parts.fragment === null || parts.fragment === '';
}

class ShaclVocabProjection extends VocabProjection {
  private readonly graph: SchemaGraphInterface;
  private readonly index: Map<string, RelationIndexType>;
  private readonly predicateResolver: PredicateResolverFnType | undefined;

  constructor(
    index: Map<string, RelationIndexType>,
    graph: SchemaGraphInterface,
    predicateResolver: PredicateResolverFnType | undefined
  ) {
    super();
    this.graph = graph;
    this.index = index;
    this.predicateResolver = predicateResolver;
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
      const depCtx: ProjectionEmitContextType = {
        curie,
        'graph': this.graph,
        'index': this.index,
        'issuer': issuer,
        'predicateResolver': this.predicateResolver,
        quads
      };

      emitPropertyShape({
        'bnodeId': psBnode,
        'classId': subject,
        'ctx': depCtx,
        'entry': propEntry,
        'overridePathClassId': subject,
        'subject': propSubject
      });
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

  wrapConditionalBranches(
    branches: QuadObjectType[],
    _quads: QuadInterface[],
    _curie: CurieInterface | undefined,
    _issuer?: IdentifierIssuerInterface
  ): QuadObjectType[] {
    // SHACL: branches are already in the correct sh:or form — pass through without
    // wrapping in an additional union node (unlike OWL which wraps in owl:unionOf).
    return branches.filter((branch: QuadObjectType): boolean => {
      return branch.termType === 'BlankNode' || branch.termType === 'NamedNode';
    });
  }
}

/** Build the property-parent index: maps each parent subject IRI to its property subject IRIs. */
function buildPropertyIndex(index: Map<string, RelationIndexType>): Map<string, string[]> {
  const propertyIndex = new Map<string, string[]>();

  for (const [subject] of index) {
    if (subject.startsWith('_:') || !SchemaIri.isPropertySubject(subject)) {
      continue;
    }

    // Skip array-item child subjects (/items, /prefixItems/N, /contains).
    // Their range constraints are folded onto the parent array property shape
    // in emitPropertyShape; emitting them as standalone property shapes would
    // produce phantom "#items" shapes on the class node.
    const parts = SchemaIri.splitSubject(subject);

    if (isExcludedFragment(parts.fragment)) {
      continue;
    }

    const parentId = SchemaIri.structuralParent(subject);
    const list = propertyIndex.get(parentId) ?? [];

    list.push(subject);
    propertyIndex.set(parentId, list);
  }

  return propertyIndex;
}

/**
 * Projects SchemaGraph relations into SHACL-vocabulary RDF quads.
 *
 * @remarks
 * Iterates `graph.allRelations()` and emits SHACL shapes: `sh:NodeShape` for
 * class nodes, `sh:PropertyShape` for properties, `sh:and`/`sh:or` for
 * composition, and `sh:qualifiedValueShape` for `contains` constraints.
 * Groups properties by structural parent (pointer path), not `rdfs:domain`.
 * The output quads can be passed directly to `JsonLdFormatter.fromQuads()`.
 *
 * @example
 * ```ts
 * const quads = ShaclProjection.graph(graph, { curie });
 * ```
 *
 * @defaultValue Uses a fresh `IdentifierIssuer` when no `issuer` option is provided.
 * @category RDF
 * @since 0.1.0
 * @see {@link OwlProjection}
 * @group ShaclProjection
 */
export const ShaclProjection = {
  graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined;
    'issuer'?: IdentifierIssuerInterface | undefined;
    'predicateResolver'?: PredicateResolverFnType | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const { predicateResolver } = options ?? {};
    const issuer = options?.issuer ?? new IdentifierIssuer();
    const quads: QuadInterface[] = [];
    const allRelations = graph.allRelations();
    const index = ProjectionIndex.build(allRelations);
    const propertyIndex = buildPropertyIndex(index);

    const shaclVocab = new ShaclVocabProjection(index, graph, predicateResolver);
    const ctx: ProjectionEmitContextType = {
      curie,
      graph,
      index,
      'issuer': issuer,
      predicateResolver,
      quads
    };

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

      emitNodeShape({
        ctx,
        entry,
        propertyIndex,
        shaclVocab,
        subject
      });
    }

    return quads;
  }
} as const;

function emitNodeShapeMetadata(subject: string, entry: RelationIndexType, ctx: ProjectionEmitContextType): void {
  const {
    curie, quads
  } = ctx;

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
}

function emitNodeShapeProperties(args: EmitNodeShapePropertiesArgsType): void {
  const {
    ctx, entry, propertyIndex, subject
  } = args;
  const {
    curie, index, issuer, quads
  } = ctx;
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

    emitPropertyShape({
      'bnodeId': psBnode,
      'classId': subject,
      ctx,
      'entry': propEntry,
      'overridePathClassId': undefined,
      'subject': propSubject
    });
    quads.push(QuadFactory.quad(subject, SH.property, QuadFactory.bnode(psBnode), { curie }));
  }

  emitContainsPropertyShape(subject, entry, ctx);
}

function emitNodeShapeComposition(args: EmitNodeShapeCompositionArgsType): void {
  const {
    ctx, entry, shaclVocab, subject
  } = args;
  const {
    curie, graph, issuer, predicateResolver, quads
  } = ctx;
  const andItems: QuadObjectType[] = [];
  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

  for (const rel of subClassRels) {
    andItems.push(QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie }));
  }

  const depReqItems = shaclVocab.processDependentRequired(
    subject,
    entry,
    quads,
    curie,
    issuer,
    graph,
    predicateResolver
  );
  const depSchemaItems = shaclVocab.processDependentSchemas(subject, entry, quads, curie, issuer);
  const conditionalItems = shaclVocab.processConditionals(entry, quads, curie, issuer);

  andItems.push(...depReqItems, ...depSchemaItems, ...conditionalItems);

  if (andItems.length > 0) {
    quads.push(QuadFactory.quad(subject, SH.and, QuadFactory.rdfList(andItems, quads, issuer), { curie }));
  }
}

function emitNodeShapeEquivalences(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, index, issuer, quads
  } = ctx;
  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const orItems = equivRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.iri> => {
      return relationToEquivIri(rel, index, curie);
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
    const values = oneOfRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.literal> => {
      return relationToOneOfLiteral(rel, curie);
    });

    quads.push(QuadFactory.quad(subject, SH.in, QuadFactory.rdfList(values, quads, issuer), { curie }));
  }
}

function emitNodeShape(args: EmitNodeShapeArgsType): void {
  const {
    ctx, entry, propertyIndex, shaclVocab, subject
  } = args;
  const {
    curie, quads
  } = ctx;

  quads.push(QuadFactory.quad(subject, RDF.type, QuadFactory.iri(SH.NodeShape, { curie }), { curie }));
  emitNodeShapeMetadata(subject, entry, ctx);
  emitNodeShapeProperties({
    ctx,
    entry,
    propertyIndex,
    subject
  });
  emitNodeShapeComposition({
    ctx,
    entry,
    shaclVocab,
    subject
  });
  emitNodeShapeEquivalences(subject, entry, ctx);
}

/** Emit a numeric count constraint (minCount or maxCount) if the relation list is non-empty. */
function emitCountConstraint(args: EmitCountConstraintArgsType): void {
  const {
    bnodeId, opts, predicate, quads, rels
  } = args;

  if (rels.length === 0) {
    return;
  }
  const count = Number(ProjectionIndex.relationTargetId(rels[0]));

  quads.push(QuadFactory.quad(bnodeId, predicate, QuadFactory.literal(count, XSD.integer, opts), opts));
}

/** Emit the sh:class or sh:node range constraint based on cardinality and datatype presence. */
function emitRangeConstraint(args: EmitRangeConstraintArgsType): void {
  const {
    bnodeId, datatypeRels, opts, quads, rangeRels
  } = args;

  if (rangeRels.length === 0) {
    return;
  }
  const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRels[0]), opts);
  const rangePredicate = datatypeRels.length > 0 || rangeRels.length > 1 ? SH.class : SH.node;

  quads.push(QuadFactory.quad(bnodeId, rangePredicate, rangeIri, opts));
}

function emitPropertyShapeTypeConstraints(args: EmitPropertyShapeConstraintsArgsType): void {
  const {
    bnodeId, entry, opts, quads
  } = args;
  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];

  if (datatypeRels.length > 0 && rangeRels.length === 0) {
    const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRels[0]), opts);

    quads.push(QuadFactory.quad(bnodeId, SH.datatype, datatypeIri, opts));
  }

  emitCountConstraint({
    bnodeId,
    opts,
    'predicate': SH.minCount,
    quads,
    'rels': entry.byPredicate.get(SH.minCount) ?? []
  });
  emitCountConstraint({
    bnodeId,
    opts,
    'predicate': SH.maxCount,
    quads,
    'rels': entry.byPredicate.get(SH.maxCount) ?? []
  });
  emitRangeConstraint({
    bnodeId,
    datatypeRels,
    opts,
    quads,
    rangeRels
  });
}

function emitPropertyShapeValueConstraints(args: EmitPropertyShapeConstraintsArgsType): void {
  const {
    bnodeId, entry, opts, quads
  } = args;
  const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

  if (hasValueRels.length > 0) {
    const hasValueLit = QuadFactory.literal(ProjectionIndex.relationTargetId(hasValueRels[0]), XSD.string, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.hasValue, hasValueLit, opts));
  }

  for (const rel of entry.byPredicate.get(SH.pattern) ?? []) {
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

  if (entry.byPredicate.has(DASH.readOnly)) {
    quads.push(QuadFactory.quad(bnodeId, DASH.readOnly, QuadFactory.literal(true, XSD.boolean, opts), opts));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    quads.push(QuadFactory.quad(bnodeId, DASH.writeOnly, QuadFactory.literal(true, XSD.boolean, opts), opts));
  }
}

function emitPropertyShape(args: EmitPropertyShapeArgsType): void {
  const {
    bnodeId, classId, ctx, entry, overridePathClassId, subject
  } = args;
  const {
    curie, graph, index, predicateResolver, quads
  } = ctx;
  const opts = { curie };

  quads.push(QuadFactory.quad(bnodeId, RDF.type, QuadFactory.iri(SH.PropertyShape, opts), opts));

  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const pathClassId = overridePathClassId
    ?? (domainRels.length > 0 ? ProjectionIndex.relationTargetId(domainRels[0]) : classId);
  const propName = SchemaIri.lastSegment(subject);
  const propertySchema = resolvePropertySchema(graph, subject);
  const canonicalId = predicateResolver === undefined
    ? SchemaIri.propertyIri(pathClassId, propName)
    : predicateResolver({
      'classId': pathClassId,
      'propertyName': propName,
      propertySchema
    });

  quads.push(QuadFactory.quad(bnodeId, SH.path, QuadFactory.iri(canonicalId, opts), opts));
  QuadFactory.emitLiterals(bnodeId, entry, RDFS.label, SH.name, quads, opts);
  emitPropertyShapeTypeConstraints({
    bnodeId,
    entry,
    opts,
    quads
  });

  // For array properties whose own entry carries no range or datatype constraint,
  // fold the constraint from the /items child entry (if present) onto this shape.
  // This handles `{ type: 'array', items: { $ref: '...' } }` and
  // `{ type: 'array', items: { type: 'string' } }` patterns.
  const entryHasRange = (entry.byPredicate.get(RDFS.range) ?? []).length > 0;
  const entryHasDatatype = (entry.byPredicate.get(SH.datatype) ?? []).length > 0;

  if (!entryHasRange && !entryHasDatatype) {
    const itemsEntry = index.get(`${subject}/items`);

    if (itemsEntry !== undefined) {
      emitPropertyShapeTypeConstraints({
        bnodeId,
        'entry': itemsEntry,
        opts,
        quads
      });
    }
  }

  emitPropertyShapeValueConstraints({
    bnodeId,
    entry,
    opts,
    quads
  });
  QuadFactory.emitLiterals(bnodeId, entry, RDFS.comment, SH.description, quads, opts);
  QuadFactory.emitLiterals(bnodeId, entry, DCT.format, DCT.format, quads, opts);
}

function emitContainsQualifiedCardinality(args: EmitContainsQualifiedCardinalityArgsType): void {
  const {
    curie, entry, psBnode, quads
  } = args;
  const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];

  if (minQualRels.length > 0) {
    const minQual = Number(ProjectionIndex.relationTargetId(minQualRels[0]));
    const minQualLit = QuadFactory.literal(minQual, XSD.integer, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedMinCount, minQualLit, { curie }));
  }

  const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

  if (maxQualRels.length > 0) {
    const maxQual = Number(ProjectionIndex.relationTargetId(maxQualRels[0]));
    const maxQualLit = QuadFactory.literal(maxQual, XSD.integer, { curie });

    quads.push(QuadFactory.quad(psBnode, SH.qualifiedMaxCount, maxQualLit, { curie }));
  }
}

function emitContainsPropertyShape(
  subject: string,
  entry: RelationIndexType,
  ctx: ProjectionEmitContextType
): void {
  const {
    curie, issuer, quads
  } = ctx;
  const containsRels = entry.all.filter((rel: SchemaGraphRelationType): boolean => {
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

  emitContainsQualifiedCardinality({
    curie,
    entry,
    psBnode,
    quads
  });
  quads.push(QuadFactory.quad(subject, SH.property, QuadFactory.bnode(psBnode), { curie }));
}
