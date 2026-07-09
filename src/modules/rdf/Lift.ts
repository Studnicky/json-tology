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

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import type { SubjectGroupType } from '../../types/SubjectGroupType.js';
import type { LiftOptionsType } from '../../types/LiftOptionsType.js';
import type { RefTargetType } from '../../types/RefTargetType.js';
import type { TripleTermIndexType } from '../../types/TripleTermIndexType.js';
import type { PredicateIndexType } from '../../types/PredicateIndexType.js';
import type { LiftedObjectType } from '../../types/LiftedObjectType.js';
import type { SubjectKindType } from '../../types/SubjectKindType.js';
import type { EffectivePropertyMapType } from '../../types/EffectivePropertyMapType.js';
import type { ResolvedTypeNodeType } from '../../types/ResolvedTypeNodeType.js';
import type { OptionalLiftedObjectType } from '../../types/OptionalLiftedObjectType.js';
import type { FindPropertyQuadsArgsType } from '../../types/FindPropertyQuadsArgsType.js';
import type { LiftContextType } from '../../types/LiftContextType.js';
import type { LiftSubjectArgsType } from '../../types/LiftSubjectArgsType.js';
import type { LiftSingleValueArgsType } from '../../types/LiftSingleValueArgsType.js';
import type { LiftAnnotatedEdgeArgsType } from '../../types/LiftAnnotatedEdgeArgsType.js';
import type { LiftPropertyValueArgsType } from '../../types/LiftPropertyValueArgsType.js';
import type { LiftMatchingQuadsArgsType } from '../../types/LiftMatchingQuadsArgsType.js';
import type { LiftImplArgsType } from '../../types/LiftImplArgsType.js';
import { EffectiveProperties } from '../graph/EffectiveProperties.js';

import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { RDF } from '../../constants/IRI.js';
import { GraphError } from '../../errors/GraphError.js';

import { Lists } from '../quads/Lists.js';
import { Terms } from '../quads/Terms.js';
import { PropertyProjection } from './PropertyProjection.js';

// ---------------------------------------------------------------------------
// Lift internals
// ---------------------------------------------------------------------------

const TRIPLE_KEY_SEP = ' ';

function tripleTermKey(subject: string, predicate: string, object: string): string {
  const result = `${subject}${TRIPLE_KEY_SEP}${predicate}${TRIPLE_KEY_SEP}${object}`;

  return result;
}

/**
 * Group annotation quads (those whose subject is a `Quad` triple term) by their
 * quoted inner triple. Quads with non-Quad subjects are ignored here — they are
 * handled by the ordinary subject grouping.
 */
function indexTripleTermQuads(quads: QuadInterface[]): TripleTermIndexType {
  const index: TripleTermIndexType = new Map();

  for (const quad of quads) {
    const subject = quad.subject;

    if (subject.termType !== 'Quad') {
      continue;
    }

    const key = tripleTermKey(subject.subject.value, subject.predicate.value, subject.object.value);
    let list = index.get(key);

    if (list === undefined) {
      list = [];
      index.set(key, list);
    }
    list.push(quad);
  }

  return index;
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
function quadDedupeKey(quad: QuadInterface): string {
  const result = `${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph.value}`;

  return result;
}

function groupBySubject(quads: QuadInterface[]): SubjectGroupType {
  const groups: SubjectGroupType = new Map();

  for (const quad of quads) {
    // Triple-term-subject quads (annotation quads) are grouped separately by
    // their quoted inner triple, not by the (empty) Quad subject value.
    if (quad.subject.termType === 'Quad') {
      continue;
    }

    const subjectValue = quad.subject.value;
    let entry = groups.get(subjectValue);

    if (!entry) {
      entry = [];
      groups.set(subjectValue, entry);
    }
    entry.push(quad);
  }

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
      const dk = quadDedupeKey(quad);

      if (!seen.has(dk)) {
        seen.add(dk);
        deduped.push(quad);
      }
    }
    groups.set(key, deduped);
  }

  return groups;
}

function typeOf(quads: QuadInterface[]): SubjectKindType {
  for (const quad of quads) {
    const predicateValue = quad.predicate.value;

    if (predicateValue === RDF.type
      && quad.object.termType === 'NamedNode') {
      return quad.object.value;
    }
  }

  return undefined;
}

/**
 * Type/ref resolution helpers, grouped as methods on a single internal
 * namespace object (see `Lists`/`Terms`) because their names collide with
 * the project's banned freestanding verb-prefix list (resolve/...).
 */
const TypeResolution = {
  /**
   * Resolve a `$ref` against a graph node, following local fragment refs and
   * embedded-`$id` `$defs` targets. Falls through to the original node when
   * there is no ref, or the ref cannot be resolved locally.
   */
  resolveLocalRef(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType
  ): SchemaGraphNodeType {
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
    const refId = graph.resolveRefId(sem.ref);

    for (const candidate of graph.nodes()) {
      if (candidate.id === refId) {
        return candidate;
      }
    }

    return node;
  },

  /**
   * Resolve a type IRI to a graph + node pair.
   *
   * Handles both root schemas (`$id` → direct registry lookup) and inline
   * nested objects with pointer-based IDs (`User#/properties/address`).
   */
  resolveNodeForType(
    typeIri: string,
    registry: SchemaRegistryInterface
  ): ResolvedTypeNodeType {
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
} as const;

/**
 * Check if `candidateId` is structurally compatible with a pre-computed
 * target property map — i.e. the candidate's effective properties are a
 * superset of the target's.
 *
 * Accepts a pre-computed `targetProps` so callers can hoist the (possibly
 * expensive) target property collection outside a tight subject loop.
 * This handles `Compose.extend()` child → parent lifting.
 */
function isStructurallyCompatibleWithProps(
  candidateId: string,
  targetProps: Map<string, RefTargetType>,
  registry: SchemaRegistryInterface
): boolean {
  const candidateGraph = registry.graph(candidateId);

  if (!candidateGraph) {
    return false;
  }

  const candidateProps = collectEffectiveLiftProperties(
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

// ---------------------------------------------------------------------------
// Perf: memo for collectEffectiveLiftProperties
//
// The effective-property map for a given (node, registry) pair is stable
// within a session: the graph and registry are immutable after schema
// registration. Cache by node identity so repeated calls to liftSubject
// (especially for the same target class inside a large quad stream) skip
// the recursive graph walk on all but the first call.
//
// The WeakMap key is the SchemaGraphNodeType (object reference), so
// the cache is automatically GC'd when the node is no longer reachable.
// ---------------------------------------------------------------------------
const effectivePropertiesCache = new WeakMap<
  SchemaGraphNodeType,
  EffectivePropertyMapType
>();

const PREDICATE_INDEX_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Lift context — shared parameters for liftSubject / liftSingleValue
// ---------------------------------------------------------------------------

/**
 * Predicate/quad lookup helpers, grouped as methods on a single internal
 * namespace object (see `Lists`/`Terms`) because their names collide with
 * the project's banned freestanding verb-prefix list (build/find/...).
 */
const PredicateQuads = {
  buildPredicateIndex(subjectQuads: QuadInterface[]): PredicateIndexType {
    const index: PredicateIndexType = new Map();

    for (const quad of subjectQuads) {
      const predicateValue = quad.predicate.value;
      let list = index.get(predicateValue);

      if (list === undefined) {
        list = [];
        index.set(predicateValue, list);
      }
      list.push(quad);
    }

    return index;
  },

  /**
   * Find quads matching a schema property.
   *
   * Pass 1: exact match on the resolved predicate IRI (flat canonical or
   *         explicit `x-jt-predicate`, as returned by the forward resolver).
   * Pass 2: fragment match — any predicate whose fragment equals `propName`
   *         (legacy `classId#propName` safety net; no-ops for flat IRIs).
   */
  findPropertyQuads(fpArgs: FindPropertyQuadsArgsType): QuadInterface[] {
    const {
      index, predicateIri, propName, subjectQuads
    } = fpArgs;

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
} as const;

/**
 * Lift an annotated edge back to its `{ target, annotations }` shape.
 *
 * The base triple `s edgePredicate o` lives in `subjectQuads`; the annotation
 * quads (triple-term subjects) are grouped in `tripleTermIndex` by the quoted
 * inner triple. Returns undefined when no base triple is present.
 */
function liftAnnotatedEdge(args: LiftAnnotatedEdgeArgsType): OptionalLiftedObjectType {
  const {
    classId, curie, edge, predicateResolver, subjectIri, subjectQuads, tripleTermIndex
  } = args;
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
  const FORBIDDEN_ANNOTATION_KEYS: ReadonlySet<string> = new Set([
    '__proto__',
    'constructor',
    'prototype'
  ]);
  const annotations = Object.create(null) as Record<string, unknown>;
  const annotationQuads = tripleTermIndex.get(tripleTermKey(subjectIri, edge.edgePredicate, targetIri)) ?? [];

  for (const annotation of edge.edgeAnnotations) {
    const propName = annotation.propertyName;

    // Skip any key that could pollute the prototype chain.
    if (FORBIDDEN_ANNOTATION_KEYS.has(propName)) {
      continue;
    }

    const rawPredicate = predicateResolver === undefined
      ? `${classId}#${annotation.propertyName}`
      : predicateResolver({
        'classId': classId,
        'propertyName': annotation.propertyName,
        'propertySchema': annotation.propertySchema
      });
    const annotationPredicate = curie === undefined ? rawPredicate : curie.expandIfNeeded(rawPredicate);
    const match = annotationQuads.find((quad: QuadInterface): boolean => {
      return quad.predicate.value === annotationPredicate;
    });

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
 * Collect every property an instance node effectively carries for lift:
 * own `properties` plus those reachable through `allOf` members, and
 * if/then/else conditional branches. Cross-graph `$ref` members are resolved
 * via the registry. First declaration wins; cycle-safe.
 *
 * Delegates to the canonical `collectEffectivePropertiesMemo` walker with a
 * `resolveGraph` backed by the registry and the module-level node-keyed cache.
 */
function collectEffectiveLiftProperties(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeType,
  registry: SchemaRegistryInterface
): EffectivePropertyMapType {
  const result = EffectiveProperties.collectMemo(
    effectivePropertiesCache,
    graph,
    node,
    (refId: string): SchemaGraphInterface | undefined => {
      const refGraph = registry.graph(refId);

      return refGraph;
    }
  );

  return result;
}

function liftPropertyValue(pvArgs: LiftPropertyValueArgsType): unknown {
  const {
    classId, ctx, index, propEntry, propName, subjectIri, subjectQuads
  } = pvArgs;
  const propNode = propEntry.node;
  const propGraph = propEntry.graph;
  const edge = PropertyProjection.findAnnotatedEdge(propGraph, propNode);

  if (edge !== undefined) {
    return liftAnnotatedEdge({
      classId,
      'curie': ctx.curie,
      edge,
      'predicateResolver': ctx.predicateResolver,
      subjectIri,
      subjectQuads,
      'tripleTermIndex': ctx.tripleTermIndex
    });
  }

  const rawPredicateIri = ctx.predicateResolver === undefined
    ? `${classId}#${propName}`
    : ctx.predicateResolver({
      'classId': classId,
      'propertyName': propName,
      'propertySchema': propNode.schema
    });
  // Expand CURIE predicates (e.g. 'bk:title' → full IRI) so they match the
  // full-IRI predicates emitted by toQuads/QuadFactory.
  const predicateIri = ctx.curie === undefined ? rawPredicateIri : ctx.curie.expandIfNeeded(rawPredicateIri);
  const matching = PredicateQuads.findPropertyQuads({
    index,
    predicateIri,
    propName,
    subjectQuads
  });

  if (matching.length === 0) {
    return undefined;
  }

  const resolvedNode = TypeResolution.resolveLocalRef(propGraph, propNode);
  const propSem = propGraph.semantics(resolvedNode);
  const isArray = propSem.schemaTypes.includes('array');
  const nestedNode = propSem.itemsNode
    ? TypeResolution.resolveLocalRef(propGraph, propSem.itemsNode)
    : resolvedNode;

  return liftMatchingQuads({
    ctx,
    isArray,
    matching,
    nestedNode,
    propGraph,
    resolvedNode
  });
}

function liftMatchingQuads(mqArgs: LiftMatchingQuadsArgsType): unknown {
  const {
    ctx, isArray, matching, nestedNode, propGraph, resolvedNode
  } = mqArgs;

  if (isArray || matching.length > 1) {
    return matching.map((quad: QuadInterface): unknown => {
      const narrowed = Lists.asQuadObject(quad.object);

      return narrowed === undefined
        ? undefined
        : liftSingleValue({
          'ctx': ctx,
          'obj': narrowed,
          'parentGraph': propGraph,
          'targetNode': nestedNode
        });
    });
  }

  const firstMatch = matching[0];

  if (firstMatch === undefined) {
    return undefined;
  }

  const narrowed = Lists.asQuadObject(firstMatch.object);

  return narrowed === undefined
    ? undefined
    : liftSingleValue({
      'ctx': ctx,
      'obj': narrowed,
      'parentGraph': propGraph,
      'targetNode': resolvedNode
    });
}

function liftSubject(args: LiftSubjectArgsType): LiftedObjectType {
  const {
    classId, ctx, graph, node, subjectQuads
  } = args;
  const obj: LiftedObjectType = {};
  const firstSubjectQuad = subjectQuads[0];
  const subjectIri = firstSubjectQuad === undefined ? classId : firstSubjectQuad.subject.value;
  const effectiveProperties = collectEffectiveLiftProperties(graph, node, ctx.registry);
  const index = effectiveProperties.size > PREDICATE_INDEX_THRESHOLD
    ? PredicateQuads.buildPredicateIndex(subjectQuads)
    : undefined;

  for (const [
    propName,
    propEntry
  ] of effectiveProperties) {
    const lifted = liftPropertyValue({
      classId,
      ctx,
      index,
      propEntry,
      propName,
      subjectIri,
      subjectQuads
    });

    if (lifted !== undefined) {
      obj[propName] = lifted;
    }
  }

  return obj;
}

function liftSingleValue(args: LiftSingleValueArgsType): unknown {
  const {
    ctx, obj, parentGraph, targetNode
  } = args;

  if (obj.termType === 'Literal') {
    return Terms.decodeLiteral(obj);
  }

  // Follow IRI / BlankNode references via the subject group index.
  const refQuads = ctx.allGroups.get(obj.value);

  if (refQuads) {
    const refType = typeOf(refQuads);

    if (refType !== undefined) {
      // Try resolving via registry (handles pointer-based IDs too)
      const resolved = TypeResolution.resolveNodeForType(refType, ctx.registry);

      if (resolved) {
        return liftSubject({
          'classId': refType,
          ctx,
          'graph': resolved.graph,
          'node': resolved.node,
          'subjectQuads': refQuads
        });
      }
    }

    // No type or unresolved — try the target node from the parent schema
    const targetSem = parentGraph.semantics(targetNode);

    if (targetSem.properties.size > 0) {
      return liftSubject({
        'classId': targetNode.id,
        ctx,
        'graph': parentGraph,
        'node': targetNode,
        'subjectQuads': refQuads
      });
    }
  }

  // Plain IRI reference — return as string
  return obj.value;
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
function liftInstancesImpl(
  schemaId: string,
  quads: QuadInterface[],
  args: LiftImplArgsType
): unknown[] {
  const {
    curie, predicateResolver, registry
  } = args;
  const targetResolved = TypeResolution.resolveNodeForType(schemaId, registry);

  if (!targetResolved) {
    return [];
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = targetResolved;
  const groups = groupBySubject(quads);
  const tripleTermIndex = indexTripleTermQuads(quads);
  const results: unknown[] = [];

  // Perf 4: hoist target effective-property collection outside the subject
  // loop. collectEffectiveLiftProperties is memoised, but hoisting avoids
  // even the WeakMap lookup on every iteration.
  const targetProps = collectEffectiveLiftProperties(targetGraph, targetNode, registry);

  // Fast-path: a target with no effective properties cannot match anything.
  if (targetProps.size === 0) {
    return results;
  }

  const ctx: LiftContextType = {
    'allGroups': groups,
    curie,
    predicateResolver,
    registry,
    tripleTermIndex
  };

  for (const [
    , subjectQuads
  ] of groups) {
    const subjectType = typeOf(subjectQuads);

    if (subjectType === undefined) {
      continue;
    }

    if (subjectType === schemaId) {
      // Exact match
      results.push(liftSubject({
        'classId': schemaId,
        ctx,
        'graph': targetGraph,
        'node': targetNode,
        subjectQuads
      }));
      continue;
    }

    // Structural compatibility — e.g. Compose.extend child → parent
    if (isStructurallyCompatibleWithProps(subjectType, targetProps, registry)) {
      results.push(liftSubject({
        'classId': subjectType,
        ctx,
        'graph': targetGraph,
        'node': targetNode,
        subjectQuads
      }));
    }
  }

  return results;
}

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
export const Lift = {
  instances(
    schemaId: string,
    quads: QuadInterface[],
    registry: SchemaRegistryInterface,
    options?: LiftOptionsType
  ): unknown[] {
    const result = liftInstancesImpl(schemaId, quads, {
      'curie': options?.curie,
      'predicateResolver': options?.predicateResolver,
      registry
    });

    return result;
  }
} as const;
