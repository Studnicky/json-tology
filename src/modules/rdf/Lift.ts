/**
 * Lift — reverse projection from RDF quads back to typed JS objects.
 *
 * Inverse of `projectAbox()`: given quads and a target schema ID,
 * reconstructs plain JS objects by mapping property IRIs back to
 * schema property names and deserializing literal values.
 *
 * Handles:
 * - Internal quads (prefixed `rdf:type`, `classId#propName` IRIs)
 * - External quads (full IRI predicates, blank node nesting)
 * - Inline nested objects (pointer-based type IRIs)
 * - Structural subtyping (Compose.extend child → parent lift)
 *
 * After the RDF/JS spec compliance refactor, `QuadInterface` is itself
 * rdf/js-compatible — external quads from `n3`, `eyereasoner`, etc. can
 * be passed directly without a conversion bridge.
 */

import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import type { SubjectGroupInterface } from '../../interfaces/SubjectGroupInterface.js';
import type { LiftOptionsInterface } from '../../interfaces/LiftOptionsInterface.js';
import type { ReferenceTargetInterface } from '../../interfaces/ReferenceTargetInterface.js';
import type { TripleTermIndexInterface } from '../../interfaces/TripleTermIndexInterface.js';
import type { PredicateIndexInterface } from '../../interfaces/PredicateIndexInterface.js';
import type { LiftedObjectEntity } from '../../entities/LiftedObjectEntity.js';
import { DangerousObjectKeyEntity } from '../../entities/DangerousObjectKeyEntity.js';
import type { SubjectKindEntity } from '../../entities/SubjectKindEntity.js';
import type { EffectivePropertyMapInterface } from '../../interfaces/EffectivePropertyMapInterface.js';
import type { FindPropertyQuadsArgumentListInterface } from '../../interfaces/FindPropertyQuadsArgumentListInterface.js';
import type { LiftContextInterface } from '../../interfaces/LiftContextInterface.js';
import type { LiftSubjectArgumentListInterface } from '../../interfaces/LiftSubjectArgumentListInterface.js';
import type { LiftSingleValueArgumentListInterface } from '../../interfaces/LiftSingleValueArgumentListInterface.js';
import type { LiftAnnotatedEdgeArgumentListInterface } from '../../interfaces/LiftAnnotatedEdgeArgumentListInterface.js';
import type { LiftPropertyValueArgumentListInterface } from '../../interfaces/LiftPropertyValueArgumentListInterface.js';
import type { LiftMatchingQuadsArgumentListInterface } from '../../interfaces/LiftMatchingQuadsArgumentListInterface.js';
import type { LiftImplArgumentListInterface } from '../../interfaces/LiftImplArgumentListInterface.js';
import { EffectiveProperties } from '../graph/EffectiveProperties.js';

import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { RDF } from '../../constants/IRI.js';
import {
  PREDICATE_INDEX_THRESHOLD, TRIPLE_KEY_SEP
} from '../../constants/NUMERIC.js';
import { GraphError } from '../../errors/GraphError.js';

import { Lists } from '../quads/Lists.js';
import { Terms } from '../quads/Terms.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { PropertyProjection } from './PropertyProjection.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { PredicateResolverInterface } from '../../interfaces/PredicateResolverInterface.js';
import type { JsonSchemaType } from '../../types/Schema.js';

/**
 * Lift typed JS objects from RDF quads.
 *
 * @remarks
 * Given a schema ID and a set of quads (from ABox projection, a reasoner,
 * or any RDF source that produces rdf/js-compatible quads), reconstructs
 * plain JS objects matching the schema.
 *
 * Supports:
 * - Internal quads (from `projectAbox`) — 100% lossless round-trip
 * - External quads (from `n3`, `eyereasoner`) — pass directly (QuadInterface is rdf/js-compatible)
 * - Structural subtyping — `Compose.extend()` children lift as parent types
 * - Inline nested objects — pointer-based type IRIs resolved within parent graph
 * - Blank node nesting — blank node references followed like named nodes
 *
 * @example
 * ```ts
 * const objects = Lift.instances(schemaId, quads, registry);
 * ```
 *
 * @category RDF
 * @since 0.17.0
 * @see {@link Projection}
 * @group Lift
 */
export class Lift {
  // ---------------------------------------------------------------------------
  // Perf: memo for collectEffectiveLiftProperties
  //
  // The effective-property map for a given (node, registry) pair is stable
  // within a session: the graph and registry are immutable after schema
  // registration. Cache by node identity so repeated calls to liftSubject
  // (especially for the same target class inside a large quad stream) skip
  // the recursive graph walk on all but the first call.
  //
  // The WeakMap key is the SchemaGraphNodeInterface (object reference), so
  // the cache is automatically GC'd when the node is no longer reachable.
  // ---------------------------------------------------------------------------
  private static readonly effectivePropertiesCache = new WeakMap<
    SchemaGraphNodeInterface,
    EffectivePropertyMapInterface
  >();

  private static buildPredicateIndex(subjectQuads: QuadInterface[]): PredicateIndexInterface {
    const index = QuadFactory.groupByKey(subjectQuads, (quad: QuadInterface): string => {
      const key = quad.predicate.value;

      return key;
    });

    return index;
  }

  /**
   * Collect every property an instance node effectively carries for lift:
   * own `properties` plus those reachable through `allOf` members, and
   * if/then/else conditional branches. Cross-graph `$ref` members are resolved
   * via the registry. First declaration wins; cycle-safe.
   *
   * Delegates to the canonical `collectEffectivePropertiesMemo` walker with a
   * `resolveGraph` backed by the registry and the class-level node-keyed cache.
   */
  private static collectEffectiveLiftProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    registry: SchemaRegistryInterface
  ): EffectivePropertyMapInterface {
    const result = EffectiveProperties.collectMemo(
      Lift.effectivePropertiesCache,
      graph,
      node,
      (referenceId: string): SchemaGraphInterface | undefined => {
        const referenceGraph = registry.graph(referenceId);

        return referenceGraph;
      }
    );

    return result;
  }

  /**
   * Find quads matching a schema property.
   *
   * Pass 1: exact match on the resolved predicate IRI (flat canonical or
   *         explicit `x-jt-predicate`, as returned by the forward resolver).
   * Pass 2: fragment match — any predicate whose fragment equals `propName`
   *         (legacy `classId#propName` safety net; no-ops for flat IRIs).
   */
  private static findPropertyQuads(findPropertyQuadsArgumentList: FindPropertyQuadsArgumentListInterface): QuadInterface[] {
    const {
      index, predicateIri, propName, subjectQuads
    } = findPropertyQuadsArgumentList;

    if (index !== undefined) {
      const byExact = index.get(predicateIri);

      if (byExact !== undefined && byExact.length > 0) {
        return byExact;
      }

      const matches: QuadInterface[] = [];

      for (const [
        predicate,
        quads
      ] of index) {
        const hash = predicate.lastIndexOf('#');

        if (hash !== -1 && predicate.slice(hash + 1) === propName) {
          for (const quad of quads) {
            matches.push(quad);
          }
        }
      }

      return matches;
    }

    const byExact = subjectQuads.filter((quad: QuadInterface): boolean => {
      return quad.predicate.value === predicateIri;
    });

    if (byExact.length > 0) {
      return byExact;
    }

    return subjectQuads.filter((quad: QuadInterface): boolean => {
      const hash = quad.predicate.value.lastIndexOf('#');

      return hash !== -1 && quad.predicate.value.slice(hash + 1) === propName;
    });
  }

  private static groupBySubject(quads: QuadInterface[]): SubjectGroupInterface {
    // Triple-term-subject quads (annotation quads) are grouped separately by
    // their quoted inner triple, not by the (empty) Quad subject value.
    const groups: SubjectGroupInterface = QuadFactory.groupByKey(quads, (quad: QuadInterface): string | undefined => {
      return quad.subject.termType === 'Quad' ? undefined : quad.subject.value;
    });

    // Deduplicate quads within each group: RDF is a set, not a bag. A shared
    // node IRI appearing as the object of multiple parent properties causes the
    // same quads to be appended more than once. Remove exact duplicates so
    // scalar properties don't become spurious arrays.
    for (const [
      key,
      list
    ] of groups) {
      if (list.length <= 1) {
        continue;
      }
      const seen = new Set<string>();
      const deduped: QuadInterface[] = [];

      for (const quad of list) {
        const dk = Lift.quadDedupeKey(quad);

        if (!seen.has(dk)) {
          seen.add(dk);
          deduped.push(quad);
        }
      }
      groups.set(key, deduped);
    }

    return groups;
  }

  /**
   * Group annotation quads (those whose subject is a `Quad` triple term) by their
   * quoted inner triple. Quads with non-Quad subjects are ignored here — they are
   * handled by the ordinary subject grouping.
   */
  private static indexTripleTermQuads(quads: QuadInterface[]): TripleTermIndexInterface {
    const index = QuadFactory.groupByKey(quads, (quad: QuadInterface): string | undefined => {
      const subject = quad.subject;

      return subject.termType === 'Quad'
        ? Lift.tripleTermKey(subject.subject.value, subject.predicate.value, subject.object.value)
        : undefined;
    });

    return index;
  }

  public static instances(
    schemaId: string,
    quads: QuadInterface[],
    registry: SchemaRegistryInterface,
    options?: LiftOptionsInterface
  ): unknown[] {
    const result = Lift.liftInstancesImpl(schemaId, quads, {
      'curie': options?.curie,
      'predicateResolver': options?.predicateResolver,
      registry
    });

    return result;
  }

  /**
   * Check if `candidateId` is structurally compatible with a pre-computed
   * target property map — i.e. the candidate's effective properties are a
   * superset of the target's.
   *
   * Accepts a pre-computed `targetProps` so callers can hoist the (possibly
   * expensive) target property collection outside a tight subject loop.
   * This handles `Compose.extend()` child → parent lifting.
   */
  private static isStructurallyCompatibleWithProps(
    candidateId: string,
    targetProps: Map<string, ReferenceTargetInterface>,
    registry: SchemaRegistryInterface
  ): boolean {
    const candidateGraph = registry.graph(candidateId);

    if (!candidateGraph) {
      return false;
    }

    const candidateProps = Lift.collectEffectiveLiftProperties(
      candidateGraph,
      candidateGraph.rootNode,
      registry
    );

    for (const [name] of targetProps) {
      if (!candidateProps.has(name)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Lift an annotated edge back to its `{ target, annotations }` shape.
   *
   * The base triple `s edgePredicate o` lives in `subjectQuads`; the annotation
   * quads (triple-term subjects) are grouped in `tripleTermIndex` by the quoted
   * inner triple. Returns undefined when no base triple is present.
   */
  private static liftAnnotatedEdge(argumentList: LiftAnnotatedEdgeArgumentListInterface): LiftedObjectEntity.Type | undefined {
    const {
      classId, curie, edge, predicateResolver, subjectIri, subjectQuads, tripleTermIndex
    } = argumentList;
    const baseQuad = subjectQuads.find((quad: QuadInterface): boolean => {
      return quad.predicate.value === edge.edgePredicate && quad.object.termType === 'NamedNode';
    });

    if (baseQuad === undefined) {
      return undefined;
    }

    const targetIri = baseQuad.object.value;
    // Use a null-prototype object so setting any annotation key (including
    // adversarial keys like '__proto__', 'constructor', 'prototype') cannot
    // walk up to Object.prototype. Sec 3.2 guard.
    const annotations = Object.create(null) as Record<string, unknown>;
    const annotationQuads = tripleTermIndex.get(Lift.tripleTermKey(subjectIri, edge.edgePredicate, targetIri)) ?? [];
    const annotationQuadsByPredicate = new Map<string, QuadInterface>();

    for (const quad of annotationQuads) {
      if (!annotationQuadsByPredicate.has(quad.predicate.value)) {
        annotationQuadsByPredicate.set(quad.predicate.value, quad);
      }
    }

    for (const annotation of edge.edgeAnnotations) {
      const propName = annotation.propertyName;

      // Skip any key that could pollute the prototype chain.
      if (DangerousObjectKeyEntity.validate(propName)) {
        continue;
      }

      const annotationPredicate = Lift.resolvePropertyPredicateIri(
        classId,
        annotation.propertyName,
        annotation.propertySchema,
        predicateResolver,
        curie
      );
      const match = annotationQuadsByPredicate.get(annotationPredicate);

      if (match === undefined) {
        continue;
      }

      const narrowed = Lists.asQuadObject(match.object);

      if (narrowed === undefined) {
        continue;
      }

      annotations[propName] = narrowed.termType === 'Literal'
        ? Terms.decodeLiteral(narrowed)
        : narrowed.value;
    }

    return {
      annotations,
      'target': targetIri
    };
  }

  /**
   * Lift typed JS objects from RDF quads.
   *
   * Given a schema ID and a set of quads (from ABox projection, a reasoner,
   * or any RDF source that produces rdf/js-compatible quads), reconstructs
   * plain JS objects matching the schema.
   *
   * Supports:
   * - Internal quads (from `projectAbox`) — 100% lossless round-trip
   * - External quads (from `n3`, `eyereasoner`) — pass directly (QuadInterface is
   *   rdf/js-compatible; no conversion bridge required)
   * - Structural subtyping — `Compose.extend()` children lift as parent types
   * - Inline nested objects — pointer-based type IRIs resolved within parent graph
   * - Blank node nesting — blank node references followed like named nodes
   *
   * @param schemaId - The `$id` of the target schema.
   * @param quads - RDF quads in rdf/js-compatible format.
   * @param registry - Schema registry for graph/schema lookup.
   * @returns Array of reconstructed objects (unvalidated — caller should `instantiate()` for full validation).
   */
  private static liftInstancesImpl(
    schemaId: string,
    quads: QuadInterface[],
    argumentList: LiftImplArgumentListInterface
  ): unknown[] {
    const {
      curie, predicateResolver, registry
    } = argumentList;
    const targetResolved = Lift.resolveNodeForType(schemaId, registry);

    if (!targetResolved) {
      return [];
    }

    const {
      'graph': targetGraph, 'node': targetNode
    } = targetResolved;
    const groups = Lift.groupBySubject(quads);
    const tripleTermIndex = Lift.indexTripleTermQuads(quads);
    const results: unknown[] = [];

    // Perf 4: hoist target effective-property collection outside the subject
    // loop. collectEffectiveLiftProperties is memoised, but hoisting avoids
    // even the WeakMap lookup on every iteration.
    const targetProps = Lift.collectEffectiveLiftProperties(targetGraph, targetNode, registry);

    // Fast-path: a target with no effective properties cannot match anything.
    if (targetProps.size === 0) {
      return results;
    }

    const context: LiftContextInterface = {
      'allGroups': groups,
      curie,
      predicateResolver,
      registry,
      tripleTermIndex
    };

    for (const [
      , subjectQuads
    ] of groups) {
      const subjectType = Lift.typeOf(subjectQuads);

      if (subjectType === undefined) {
        continue;
      }

      if (subjectType === schemaId) {
        // Exact match
        results.push(Lift.liftSubject({
          'classId': schemaId,
          context,
          'graph': targetGraph,
          'node': targetNode,
          subjectQuads
        }));
        continue;
      }

      // Structural compatibility — e.g. Compose.extend child → parent
      if (Lift.isStructurallyCompatibleWithProps(subjectType, targetProps, registry)) {
        results.push(Lift.liftSubject({
          'classId': subjectType,
          context,
          'graph': targetGraph,
          'node': targetNode,
          subjectQuads
        }));
      }
    }

    return results;
  }

  /** Narrow a single matched quad's object and lift it against `targetNode`. Shared by both `liftMatchingQuads` branches. */
  private static liftMatchedQuad(
    quad: QuadInterface,
    context: LiftContextInterface,
    parentGraph: SchemaGraphInterface,
    targetNode: SchemaGraphNodeInterface
  ): unknown {
    const narrowed = Lists.asQuadObject(quad.object);

    return narrowed === undefined
      ? undefined
      : Lift.liftSingleValue({
        'context': context,
        'object': narrowed,
        parentGraph,
        targetNode
      });
  }

  private static liftMatchingQuads(matchingQuadsArgumentList: LiftMatchingQuadsArgumentListInterface): unknown {
    const {
      context, isArray, matching, nestedNode, propGraph, resolvedNode
    } = matchingQuadsArgumentList;

    if (isArray || matching.length > 1) {
      return matching.map((quad: QuadInterface): unknown => {
        const lifted = Lift.liftMatchedQuad(quad, context, propGraph, nestedNode);

        return lifted;
      });
    }

    const firstMatch = matching[0];

    if (firstMatch === undefined) {
      return undefined;
    }

    return Lift.liftMatchedQuad(firstMatch, context, propGraph, resolvedNode);
  }

  private static liftPropertyValue(propertyValueArgumentList: LiftPropertyValueArgumentListInterface): unknown {
    const {
      classId, context, index, propEntry, propName, subjectIri, subjectQuads
    } = propertyValueArgumentList;
    const propNode = propEntry.node;
    const propGraph = propEntry.graph;
    const edge = PropertyProjection.findAnnotatedEdge(propGraph, propNode);

    if (edge !== undefined) {
      return Lift.liftAnnotatedEdge({
        classId,
        'curie': context.curie,
        edge,
        'predicateResolver': context.predicateResolver,
        subjectIri,
        subjectQuads,
        'tripleTermIndex': context.tripleTermIndex
      });
    }

    // Expand CURIE predicates (e.g. 'bk:title' → full IRI) so they match the
    // full-IRI predicates emitted by toQuads/QuadFactory.
    const predicateIri = Lift.resolvePropertyPredicateIri(
      classId,
      propName,
      propNode.schema,
      context.predicateResolver,
      context.curie
    );
    const matching = Lift.findPropertyQuads({
      index,
      predicateIri,
      propName,
      subjectQuads
    });

    if (matching.length === 0) {
      return undefined;
    }

    const resolvedNode = Lift.resolveLocalReference(propGraph, propNode);
    const propSem = propGraph.semantics(resolvedNode);
    const isArray = propSem.schemaTypes.includes('array');
    const nestedNode = propSem.itemsNode
      ? Lift.resolveLocalReference(propGraph, propSem.itemsNode)
      : resolvedNode;

    return Lift.liftMatchingQuads({
      context,
      isArray,
      matching,
      nestedNode,
      propGraph,
      resolvedNode
    });
  }

  private static liftSingleValue(argumentList: LiftSingleValueArgumentListInterface): unknown {
    const {
      context, object, parentGraph, targetNode
    } = argumentList;

    if (object.termType === 'Literal') {
      return Terms.decodeLiteral(object);
    }

    // Follow IRI / BlankNode references via the subject group index.
    const referenceQuads = context.allGroups.get(object.value);

    if (referenceQuads) {
      const referenceType = Lift.typeOf(referenceQuads);

      if (referenceType !== undefined) {
        // Try resolving via registry (handles pointer-based IDs too)
        const resolved = Lift.resolveNodeForType(referenceType, context.registry);

        if (resolved) {
          return Lift.liftSubject({
            'classId': referenceType,
            context,
            'graph': resolved.graph,
            'node': resolved.node,
            'subjectQuads': referenceQuads
          });
        }
      }

      // No type or unresolved — try the target node from the parent schema
      const targetSem = parentGraph.semantics(targetNode);

      if (targetSem.properties.size > 0) {
        return Lift.liftSubject({
          'classId': targetNode.id,
          context,
          'graph': parentGraph,
          'node': targetNode,
          'subjectQuads': referenceQuads
        });
      }
    }

    // Plain IRI reference — return as string
    return object.value;
  }

  private static liftSubject(argumentList: LiftSubjectArgumentListInterface): LiftedObjectEntity.Type {
    const {
      classId, context, graph, node, subjectQuads
    } = argumentList;
    const object: LiftedObjectEntity.Type = {};
    const firstSubjectQuad = subjectQuads[0];
    const subjectIri = firstSubjectQuad === undefined ? classId : firstSubjectQuad.subject.value;
    const effectiveProperties = Lift.collectEffectiveLiftProperties(graph, node, context.registry);
    const index = effectiveProperties.size > PREDICATE_INDEX_THRESHOLD
      ? Lift.buildPredicateIndex(subjectQuads)
      : undefined;

    for (const [
      propName,
      propEntry
    ] of effectiveProperties) {
      const lifted = Lift.liftPropertyValue({
        classId,
        context,
        index,
        propEntry,
        propName,
        subjectIri,
        subjectQuads
      });

      if (lifted !== undefined) {
        object[propName] = lifted;
      }
    }

    return object;
  }

  /**
   * Build a deduplication key for a quad.
   * RDF is defined as a SET of triples/quads — duplicate quads are semantically
   * identical and should not produce duplicate values when lifted. A shared
   * blank-node or named-node IRI (e.g. two properties pointing to the same
   * Money instance) results in the same quad appearing more than once in the
   * flat quad stream; without deduplication these become spurious multi-value
   * arrays for scalar properties.
   */
  private static quadDedupeKey(quad: QuadInterface): string {
    const result = `${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph.value}`;

    return result;
  }

  /**
   * Resolve a `$ref` against a graph node, following local fragment refs and
   * embedded-`$id` `$defs` targets. Falls through to the original node when
   * there is no ref, or the ref cannot be resolved locally.
   */
  private static resolveLocalReference(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface
  ): SchemaGraphNodeInterface {
    const sem = graph.semantics(node);

    if (sem.ref === undefined) {
      return node;
    }
    if (sem.ref.startsWith('#')) {
      return graph.resolveFragment(sem.ref.slice(1));
    }

    // Embedded `$defs` `$id`: a non-fragment `$ref` (e.g.
    // `urn:bookstore:BookCatalogEntryVariant`) targeting an `$id` declared inside
    // this same graph's `$defs` is not a separately-registered schema, so it
    // resolves by matching the node whose id equals the ref target. Mirrors the
    // same-graph embedded-$id fallback in Projection.resolveNode and
    // Materializer.resolveTargetGraphAndNode. Without this, array items whose
    // schema is an embedded-$id ref keep their unresolved (property-less) node,
    // so nested instances lift back as plain IRI strings instead of objects.
    const referenceId = graph.resolveReferenceId(sem.ref);

    for (const candidate of graph.nodes()) {
      if (candidate.id === referenceId) {
        return candidate;
      }
    }

    return node;
  }

  /**
   * Resolve a type IRI to a graph + node pair.
   *
   * Handles both root schemas (`$id` → direct registry lookup) and inline
   * nested objects with pointer-based IDs (`User#/properties/address`).
   */
  private static resolveNodeForType(
    typeIri: string,
    registry: SchemaRegistryInterface
  ): ReferenceTargetInterface | undefined {
    const directGraph = registry.graph(typeIri);

    if (directGraph) {
      return {
        'graph': directGraph,
        'node': directGraph.rootNode
      };
    }

    // Pointer-based ID: 'https://example.com/User#/properties/address'
    const hashSlash = typeIri.indexOf('#/');

    if (hashSlash === -1) {
      return undefined;
    }

    const rootId = typeIri.slice(0, hashSlash);
    const pointer = typeIri.slice(hashSlash + 1);
    const rootGraph = registry.graph(rootId);

    if (!rootGraph) {
      return undefined;
    }

    try {
      return {
        'graph': rootGraph,
        'node': rootGraph.resolvePointer(pointer)
      };
    } catch (error) {
      if (error instanceof GraphError && error.code === GRAPH_ERROR_CODE.POINTER_NOT_FOUND) {
        return undefined;
      }

      throw error;
    }
  }

  /**
   * Resolve the predicate IRI for a class/property pair: `predicateResolver`
   * when supplied, else the `classId#propertyName` default, then CURIE-expanded.
   * Shared by property lifting and annotated-edge lifting.
   */
  private static resolvePropertyPredicateIri(
    classId: string,
    propertyName: string,
    propertySchema: JsonSchemaType,
    predicateResolver: PredicateResolverInterface | undefined,
    curie: CurieInterface | undefined
  ): string {
    const rawPredicate = predicateResolver === undefined
      ? `${classId}#${propertyName}`
      : predicateResolver({
        'classId': classId,
        'propertyName': propertyName,
        'propertySchema': propertySchema
      });

    return curie === undefined ? rawPredicate : curie.expandIfNeeded(rawPredicate);
  }

  private static tripleTermKey(subject: string, predicate: string, object: string): string {
    const result = `${subject}${TRIPLE_KEY_SEP}${predicate}${TRIPLE_KEY_SEP}${object}`;

    return result;
  }

  private static typeOf(quads: QuadInterface[]): SubjectKindEntity.Type | undefined {
    for (const quad of quads) {
      const predicateValue = quad.predicate.value;

      if (predicateValue === RDF.type
        && quad.object.termType === 'NamedNode') {
        return quad.object.value;
      }
    }

    return undefined;
  }
}
