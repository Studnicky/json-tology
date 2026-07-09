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

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFnType.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphRelationType } from '../../types/SchemaGraph.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { ProjectionEmitContextType } from '../../types/ProjectionEmitContextType.js';
import type { EmitNodeShapeArgsType } from '../../types/EmitNodeShapeArgsType.js';
import type { EmitPropertyShapeArgsType } from '../../types/EmitPropertyShapeArgsType.js';
import type { EmitNodeShapePropertiesArgsType } from '../../types/EmitNodeShapePropertiesArgsType.js';
import type { EmitNodeShapeCompositionArgsType } from '../../types/EmitNodeShapeCompositionArgsType.js';
import type { EmitPropertyShapeConstraintsArgsType } from '../../types/EmitPropertyShapeConstraintsArgsType.js';
import type { EmitCountConstraintArgsType } from '../../types/EmitCountConstraintArgsType.js';
import type { EmitRangeConstraintArgsType } from '../../types/EmitRangeConstraintArgsType.js';
import type { EmitContainsQualifiedCardinalityArgsType } from '../../types/EmitContainsQualifiedCardinalityArgsType.js';
import { IdentifierIssuer } from '../quads/IdentifierIssuer.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { OWL_CARDINALITY_PREDICATE_IRIS } from '../../constants/ONTOLOGY_PREDICATES.js';
import { XSD_IRI_PREFIX } from '../../constants/STANDARD_PREFIXES.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { QuadEmit } from './QuadEmit.js';
import { PropertyProjection } from './PropertyProjection.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import type { RelationIndexType } from '../../types/RelationIndexType.js';
import { VocabProjection } from './VocabProjection.js';

/**
 * Target-ref resolution, grouped as a method on a single-method internal
 * namespace object (see `Lists`/`Terms`) because the name collides with the
 * project's banned freestanding verb-prefix list (resolve/...).
 */
const TargetRef = {
  resolveTargetRef(targetNodeId: string, index: Map<string, RelationIndexType>): string {
    const targetEntry = index.get(targetNodeId);

    if (targetEntry === undefined) {
      return targetNodeId;
    }

    const rangeRels = targetEntry.byPredicate.get(RDFS.range) ?? [];

    if (rangeRels.length > 0) {
      const rangeRel0 = rangeRels.at(0);

      if (rangeRel0 === undefined) {
        return targetNodeId;
      }

      return ProjectionIndex.relationTargetId(rangeRel0);
    }

    return targetNodeId;
  }
} as const;

function relationToEquivIri(
  rel: SchemaGraphRelationType,
  index: Map<string, RelationIndexType>,
  curie: CurieInterface | undefined
): ReturnType<typeof QuadFactory.iri> {
  const targetId = TargetRef.resolveTargetRef(ProjectionIndex.relationTargetId(rel), index);

  return QuadFactory.iri(targetId, { curie });
}

function relationToOneOfLiteral(
  rel: SchemaGraphRelationType,
  curie: CurieInterface | undefined
): ReturnType<typeof QuadFactory.literal> {
  const result = QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, { curie });

  return result;
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

/**
 * Emit an `sh:PropertyShape` bnode with `sh:path` and `sh:minCount 1`.
 * Returns the bnode label so the caller can reference it.
 */
function emitMinCountOnePropertyShape(
  pathIri: string,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer: IdentifierIssuerInterface | undefined
): string {
  const psBnode = QuadFactory.nextBnode(issuer);

  quads.push(QuadFactory.quad(psBnode, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));
  quads.push(QuadFactory.quad(psBnode, SH.path, QuadFactory.iri(pathIri, { curie }), { curie }));
  quads.push(QuadFactory.quad(psBnode, SH.minCount, QuadFactory.literal(1, XSD.integer, { curie }), { curie }));

  return psBnode;
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
    const withoutPsBnode = emitMinCountOnePropertyShape(ifRef, quads, curie, issuer);

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

      const domainRel0 = domainRels.at(0);

      if (domainRels.length === 0 || domainRel0 === undefined || ProjectionIndex.relationTargetId(domainRel0) !== thenRef) {
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
    // Emit a PropertyShape that asserts the trigger property is present (minCount 1),
    // wrap it in a NodeShape-like container, then negate the container with sh:not.
    // The result is "trigger property is absent".
    //
    // Chain: withoutWrapperBnode -sh:not-> withoutContainerBnode -sh:property-> withoutPsBnode
    //
    // The previous implementation also allocated innerBnode/complementBnode and pushed
    // a complementBnode -sh:not-> innerBnode triple. innerBnode was never populated
    // (no quads referenced it as subject) and neither bnode appeared in the return
    // chain, making the entire complementBnode subtree dead output. Removed.
    const withoutPsBnode = emitMinCountOnePropertyShape(triggerPropIri, quads, curie, issuer);

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
    const reqPsBnode = emitMinCountOnePropertyShape(propIri, quads, curie, issuer);

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
    const result = branches.filter((branch: QuadObjectType): boolean => {
      return branch.termType === 'BlankNode' || branch.termType === 'NamedNode';
    });

    return result;
  }
}

/**
 * Property-parent index construction, grouped as a method on a
 * single-method internal namespace object (see `Lists`/`Terms`) because the
 * name collides with the project's banned freestanding verb-prefix list
 * (build/...).
 */
const PropertyIndex = {
  /** Build the property-parent index: maps each parent subject IRI to its property subject IRIs. */
  buildPropertyIndex(index: Map<string, RelationIndexType>): Map<string, string[]> {
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
} as const;

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
    const propertyIndex = PropertyIndex.buildPropertyIndex(index);

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

  QuadEmit.emitLiterals(subject, entry, RDFS.label, SH.name, quads, { curie });
  QuadEmit.emitLiterals(subject, entry, RDFS.comment, SH.description, quads, { curie });

  if (entry.byPredicate.has(OWL.deprecated)) {
    quads.push(QuadFactory.quad(subject, SH.deactivated, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  if (entry.byPredicate.has(SH.closed)) {
    quads.push(QuadFactory.quad(subject, SH.closed, QuadFactory.literal(true, XSD.boolean, { curie }), { curie }));
  }

  QuadEmit.emitConstraintLiteral(subject, entry, SH.minCount, XSD.integer, quads, { curie });
  QuadEmit.emitConstraintLiteral(subject, entry, SH.maxCount, XSD.integer, quads, { curie });
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

/**
 * Emit a SHACL property shape for a restriction-structured `rdfs:subClassOf` relation.
 *
 * OWL restriction structures carry `constraint` (e.g. `owl:minCardinality`),
 * `onProperty`, and `value`. This function mirrors OWL's `emitClassSubClassRelations`
 * handler but emits SHACL `sh:PropertyShape` constraints instead of `owl:Restriction`
 * bnodes, so user-declared restrictions are not silently dropped by SHACL projection.
 *
 * Only cardinality and value restrictions are mapped; `owl:someValuesFrom` restrictions
 * are already handled by `emitContainsPropertyShape` and are skipped here.
 *
 * Returns the property shape bnode label, or `undefined` when the constraint cannot
 * be represented as a SHACL property shape.
 */
function emitRestrictionPropertyShape(
  onProperty: string,
  constraint: string,
  value: unknown,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer: IdentifierIssuerInterface | undefined,
  graph: SchemaGraphInterface,
  predicateResolver: PredicateResolverFnType | undefined
): string | undefined {
  // owl:someValuesFrom restrictions are handled in emitContainsPropertyShape — skip here.
  if (constraint === OWL.someValuesFrom) {
    return undefined;
  }

  // Collect-then-commit: build the constraint triples into a local buffer FIRST.
  // Each entry is [predicate IRI, object term]. Only after we confirm the constraint
  // is representable do we allocate the bnode and append everything (type + path +
  // constraint) to the shared quads array.
  // Any early return below produces no quads — no orphaned PropertyShape nodes.
  const pending: Array<[string, QuadObjectType]> = [];
  const flatOnProperty = PropertyProjection.resolveRestriction(onProperty, graph, predicateResolver);

  if (OWL_CARDINALITY_PREDICATE_IRIS.has(constraint)) {
    const n = PropertyProjection.finiteNumber(value);

    if (n === undefined) {
      return undefined;
    }

    const countLit = QuadFactory.literal(n, XSD.integer, { curie });

    if (constraint === OWL.minCardinality) {
      pending.push([
        SH.minCount,
        countLit
      ]);
    } else if (constraint === OWL.maxCardinality) {
      pending.push([
        SH.maxCount,
        countLit
      ]);
    } else {
      // owl:cardinality → both minCount and maxCount
      pending.push([
        SH.minCount,
        countLit
      ]);
      pending.push([
        SH.maxCount,
        countLit
      ]);
    }
  } else if (constraint === OWL.hasValue) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const hasValueLit = QuadFactory.literal(String(value), XSD.string, { curie });

      pending.push([
        SH.hasValue,
        hasValueLit
      ]);
    } else {
      return undefined;
    }
  } else if (constraint === OWL.allValuesFrom && typeof value === 'string' && value !== '') {
    const valueIri = QuadFactory.iri(value, { curie });
    const rangePred = value.startsWith(XSD_IRI_PREFIX) ? SH.datatype : SH.node;

    pending.push([
      rangePred,
      valueIri
    ]);
  } else {
    return undefined;
  }

  // Constraint is representable — commit: allocate bnode and push all quads.
  const psBnode = QuadFactory.nextBnode(issuer);

  quads.push(QuadFactory.quad(psBnode, RDF.type, QuadFactory.iri(SH.PropertyShape, { curie }), { curie }));
  quads.push(QuadFactory.quad(psBnode, SH.path, QuadFactory.iri(flatOnProperty, { curie }), { curie }));

  for (const [
    pred,
    obj
  ] of pending) {
    quads.push(QuadFactory.quad(psBnode, pred, obj, { curie }));
  }

  return psBnode;
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
    if (ProjectionIndex.isRestrictionStructure(rel.structure)) {
      // Restriction-structured subClassOf: emit a SHACL property shape and include it in sh:and.
      // OWL handles these as owl:Restriction bnodes; SHACL translates them to sh:PropertyShape.
      const {
        constraint, onProperty, value
      } = rel.structure;
      const psBnode = emitRestrictionPropertyShape(
        onProperty,
        constraint,
        value,
        quads,
        curie,
        issuer,
        graph,
        predicateResolver
      );

      if (psBnode !== undefined) {
        andItems.push(QuadFactory.bnode(psBnode));
      }
    } else {
      andItems.push(QuadFactory.iri(ProjectionIndex.relationTargetId(rel), { curie }));
    }
  }

  const depReqItems = shaclVocab.emitDependentRequired(
    subject,
    entry,
    quads,
    curie,
    {
      graph,
      issuer,
      predicateResolver
    }
  );
  const depSchemaItems = shaclVocab.emitDependentSchemas(subject, entry, quads, curie, issuer);
  const conditionalItems = shaclVocab.emitConditionals(entry, quads, curie, issuer);

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
      const result = relationToEquivIri(rel, index, curie);

      return result;
    });

    quads.push(QuadFactory.quad(subject, SH.or, QuadFactory.rdfList(orItems, quads, issuer), { curie }));
  }

  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    const complementRel0 = complementRels.at(0);

    if (complementRel0 !== undefined) {
      const compRef = TargetRef.resolveTargetRef(ProjectionIndex.relationTargetId(complementRel0), index);

      quads.push(QuadFactory.quad(subject, SH.not, QuadFactory.iri(compRef, { curie }), { curie }));
    }
  }

  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (complementRels.length === 0 && disjointRels.length > 0) {
    const disjointRel0 = disjointRels.at(0);

    if (disjointRel0 === undefined) {
      return;
    }
    const disjRef = TargetRef.resolveTargetRef(ProjectionIndex.relationTargetId(disjointRel0), index);

    quads.push(QuadFactory.quad(subject, SH.not, QuadFactory.iri(disjRef, { curie }), { curie }));
  }

  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const values = oneOfRels.map((rel: SchemaGraphRelationType): ReturnType<typeof QuadFactory.literal> => {
      const result = relationToOneOfLiteral(rel, curie);

      return result;
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
  const rel0 = rels.at(0);

  if (rel0 === undefined) {
    return;
  }
  const count = Number(ProjectionIndex.relationTargetId(rel0));

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
  const rangeRel0 = rangeRels.at(0);

  if (rangeRel0 === undefined) {
    return;
  }
  const rangeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(rangeRel0), opts);
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
    const datatypeRel0 = datatypeRels.at(0);

    if (datatypeRel0 === undefined) {
      return;
    }
    const datatypeIri = QuadFactory.iri(ProjectionIndex.relationTargetId(datatypeRel0), opts);

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
    const hasValueRel0 = hasValueRels.at(0);

    if (hasValueRel0 === undefined) {
      return;
    }
    const hasValueLit = QuadFactory.literal(ProjectionIndex.relationTargetId(hasValueRel0), XSD.string, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.hasValue, hasValueLit, opts));
  }

  for (const rel of entry.byPredicate.get(SH.pattern) ?? []) {
    if (rel.metadata?.patternProperty === true) {
      continue;
    }
    const patternLit = QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, opts);

    quads.push(QuadFactory.quad(bnodeId, SH.pattern, patternLit, opts));
  }

  QuadEmit.emitConstraintLiteral(bnodeId, entry, SH.minLength, XSD.integer, quads, opts);
  QuadEmit.emitConstraintLiteral(bnodeId, entry, SH.maxLength, XSD.integer, quads, opts);
  QuadEmit.emitConstraintLiteral(bnodeId, entry, SH.minInclusive, XSD.decimal, quads, opts);
  QuadEmit.emitConstraintLiteral(bnodeId, entry, SH.maxInclusive, XSD.decimal, quads, opts);
  QuadEmit.emitConstraintLiteral(bnodeId, entry, SH.minExclusive, XSD.decimal, quads, opts);
  QuadEmit.emitConstraintLiteral(bnodeId, entry, SH.maxExclusive, XSD.decimal, quads, opts);
  QuadEmit.emitConstraintLiteral(bnodeId, entry, JT.multipleOf, XSD.decimal, quads, opts);

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
  const domainRel0 = domainRels.at(0);
  const pathClassId = overridePathClassId
    ?? (domainRels.length > 0 && domainRel0 !== undefined ? ProjectionIndex.relationTargetId(domainRel0) : classId);
  const propName = SchemaIri.lastSegment(subject);
  const propertySchema = PropertyProjection.resolveSchema(graph, subject);
  const canonicalId = predicateResolver === undefined
    ? SchemaIri.propertyIri(pathClassId, propName)
    : predicateResolver({
      'classId': pathClassId,
      'propertyName': propName,
      propertySchema
    });

  quads.push(QuadFactory.quad(bnodeId, SH.path, QuadFactory.iri(canonicalId, opts), opts));
  QuadEmit.emitLiterals(bnodeId, entry, RDFS.label, SH.name, quads, opts);
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
  QuadEmit.emitLiterals(bnodeId, entry, RDFS.comment, SH.description, quads, opts);
  QuadEmit.emitLiterals(bnodeId, entry, DCT.format, DCT.format, quads, opts);
}

function emitContainsQualifiedCardinality(args: EmitContainsQualifiedCardinalityArgsType): void {
  const {
    curie, entry, psBnode, quads
  } = args;
  const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];

  if (minQualRels.length > 0) {
    const minQualRel0 = minQualRels.at(0);

    if (minQualRel0 !== undefined) {
      const minQual = Number(ProjectionIndex.relationTargetId(minQualRel0));
      const minQualLit = QuadFactory.literal(minQual, XSD.integer, { curie });

      quads.push(QuadFactory.quad(psBnode, SH.qualifiedMinCount, minQualLit, { curie }));
    }
  }

  const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

  if (maxQualRels.length > 0) {
    const maxQualRel0 = maxQualRels.at(0);

    if (maxQualRel0 === undefined) {
      return;
    }
    const maxQual = Number(ProjectionIndex.relationTargetId(maxQualRel0));
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
  // Guard: only pick up `contains` keyword restrictions (predicate = OWL.someValuesFrom),
  // not user-declared restrictions which use RDFS.subClassOf predicate.
  // Without this guard SHACL would also match user restrictions and emit spurious shapes.
  const containsRels = ProjectionIndex.filterContainsRestrictions(entry.all);

  if (containsRels.length === 0) {
    return;
  }

  const containsRel0 = containsRels.at(0);

  if (containsRel0 === undefined) {
    return;
  }

  const structure = containsRel0.structure;

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
