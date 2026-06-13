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

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { SubjectGroupType } from '../../types/SubjectGroup.js';
import type { LiftOptionsInterface } from '../../interfaces/LiftOptionsInterface.js';
import type { ResolvedRefInterface } from '../../interfaces/ResolvedRef.js';
import type { TripleTermIndexType } from '../../types/TripleTermIndexType.js';
import type { PredicateIndexType } from '../../types/PredicateIndexType.js';
import type { LiftedObjectType } from '../../types/LiftedObjectType.js';
import type { SubjectTypeType } from '../../types/SubjectTypeType.js';
import type { EffectivePropertyMapType } from '../../types/EffectivePropertyMapType.js';
import type { ResolvedTypeNodeType } from '../../types/ResolvedTypeNodeType.js';
import type { OptionalAnnotatedEdgeType } from '../../types/OptionalAnnotatedEdgeType.js';
import type { OptionalLiftedObjectType } from '../../types/OptionalLiftedObjectType.js';
import type { FindPropertyQuadsArgsInterface } from '../../interfaces/FindPropertyQuadsArgs.js';
import type { LiftContextInterface } from '../../interfaces/LiftContext.js';
import type { LiftSubjectArgsInterface } from '../../interfaces/LiftSubjectArgs.js';
import type { LiftSingleValueArgsInterface } from '../../interfaces/LiftSingleValueArgs.js';
import type { LiftAnnotatedEdgeArgsInterface } from '../../interfaces/LiftAnnotatedEdgeArgs.js';
import type { LiftPropertyValueArgsInterface } from '../../interfaces/LiftPropertyValueArgs.js';
import type { LiftMatchingQuadsArgsInterface } from '../../interfaces/LiftMatchingQuadsArgs.js';
import type { LiftImplArgsInterface } from '../../interfaces/LiftImplArgs.js';

import { RDF } from '../../constants/IRI.js';

import { asQuadObject } from './Lists.js';
import { decodeLiteral } from './Terms.js';

// ---------------------------------------------------------------------------
// Lift internals
// ---------------------------------------------------------------------------

const TRIPLE_KEY_SEP = ' ';

function tripleTermKey(subject: string, predicate: string, object: string): string {
  return `${subject}${TRIPLE_KEY_SEP}${predicate}${TRIPLE_KEY_SEP}${object}`;
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
  return `${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph.value}`;
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

function typeOf(quads: QuadInterface[]): SubjectTypeType {
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
 * Resolve a type IRI to a graph + node pair.
 *
 * Handles both root schemas (`$id` → direct registry lookup) and inline
 * nested objects with pointer-based IDs (`User#/properties/address`).
 */
function resolveNodeForType(
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
  } catch {
    return undefined;
  }
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
function isStructurallyCompatibleWithProps(
  candidateId: string,
  targetProps: Map<string, ResolvedRefInterface>,
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
// The WeakMap key is the SchemaGraphNodeInterface (object reference), so
// the cache is automatically GC'd when the node is no longer reachable.
// ---------------------------------------------------------------------------
const effectivePropertiesCache = new WeakMap<
  SchemaGraphNodeInterface,
  Map<string, ResolvedRefInterface>
>();

const PREDICATE_INDEX_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Lift context — shared parameters for liftSubject / liftSingleValue
// ---------------------------------------------------------------------------

function buildPredicateIndex(subjectQuads: QuadInterface[]): PredicateIndexType {
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
}

/**
 * Find quads matching a schema property.
 *
 * Pass 1: exact match on the resolved predicate IRI (flat canonical or
 *         explicit `x-jt-predicate`, as returned by the forward resolver).
 * Pass 2: fragment match — any predicate whose fragment equals `propName`
 *         (legacy `classId#propName` safety net; no-ops for flat IRIs).
 */
function findPropertyQuads(fpArgs: FindPropertyQuadsArgsInterface): QuadInterface[] {
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

function resolveLocalRef(
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
  const refId = graph.resolveRefId(sem.ref);

  for (const candidate of graph.nodes()) {
    if (candidate.id === refId) {
      return candidate;
    }
  }

  return node;
}

/**
 * Find the `annotatedEdge` structure relation on a property node, if any.
 */
function findAnnotatedEdgeStructure(
  graph: SchemaGraphInterface,
  propertyNode: SchemaGraphNodeInterface
): OptionalAnnotatedEdgeType {
  for (const relation of graph.relations(propertyNode)) {
    if (relation.structure?.kind === 'annotatedEdge') {
      return relation.structure;
    }
  }

  return undefined;
}

/**
 * Lift an annotated edge back to its `{ target, annotations }` shape.
 *
 * The base triple `s edgePredicate o` lives in `subjectQuads`; the annotation
 * quads (triple-term subjects) are grouped in `tripleTermIndex` by the quoted
 * inner triple. Returns undefined when no base triple is present.
 */
function liftAnnotatedEdge(args: LiftAnnotatedEdgeArgsInterface): OptionalLiftedObjectType {
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

    const narrowed = asQuadObject(match.object);

    if (narrowed === undefined) {
      continue;
    }

    annotations[propName] = narrowed.termType === 'Literal'
      ? decodeLiteral(narrowed)
      : narrowed.value;
  }

  return {
    annotations,
    'target': targetIri
  };
}

/**
 * Collect every property an instance node effectively carries for lift:
 * its own `properties` plus those reachable through `allOf` members
 * (recursively, resolving `$ref` parents that point to other graphs in the
 * registry). `Compose.subClassOf(Parent, body)` schemas keep inherited fields
 * behind a `$ref` allOf member, so without this walk the lifted object only
 * regains the body-local fields and drops everything inherited — the exact
 * inverse asymmetry the projection side flattens via collectProjectionProperties.
 *
 * Each entry records the graph where the property's semantics live, which may
 * differ from the instance's graph for inherited (cross-graph $ref) fields.
 * First declaration wins (own properties shadow inherited ones).
 */
function collectEffectiveLiftPropertiesImpl(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface,
  registry: SchemaRegistryInterface
): EffectivePropertyMapType {
  const collected: EffectivePropertyMapType = new Map();
  const visited = new Set<SchemaGraphNodeInterface>();

  const walk = (currentGraph: SchemaGraphInterface, current: SchemaGraphNodeInterface): void => {
    if (visited.has(current)) {
      return;
    }
    visited.add(current);

    const sem = currentGraph.semantics(current);

    // Cross-graph $ref member (e.g. allOf[0] = { $ref: 'urn:bookstore:Book' }):
    // resolve into the referenced graph's root node and walk that.
    if (sem.ref !== undefined && !sem.ref.startsWith('#')) {
      const refId = currentGraph.resolveRefId(sem.ref);
      const refGraph = registry.graph(refId);

      if (refGraph !== undefined) {
        walk(refGraph, refGraph.rootNode);

        return;
      }
    }

    for (const [
      name,
      propNode
    ] of sem.properties) {
      if (!collected.has(name)) {
        collected.set(name, {
          'graph': currentGraph,
          'node': propNode
        });
      }
    }

    for (const member of sem.allOf) {
      walk(currentGraph, member);
    }

    // if/then/else conditional-branch properties (e.g. EBook's epubVersion
    // under the fileFormat==='epub' then-branch) are real instance properties;
    // walk both branches so a projected branch property can be lifted back.
    if (sem.thenNode !== undefined) {
      walk(currentGraph, sem.thenNode);
    }
    if (sem.elseNode !== undefined) {
      walk(currentGraph, sem.elseNode);
    }
  };

  walk(graph, node);

  return collected;
}

/**
 * Memoised wrapper around `collectEffectiveLiftPropertiesImpl`.
 *
 * The effective-property map is stable within a session (graphs and the
 * registry are immutable after schema registration), so we cache by node
 * identity. The WeakMap ensures no memory leak when nodes are GC'd.
 */
function collectEffectiveLiftProperties(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface,
  registry: SchemaRegistryInterface
): EffectivePropertyMapType {
  const cached = effectivePropertiesCache.get(node);

  if (cached !== undefined) {
    return cached;
  }

  const result = collectEffectiveLiftPropertiesImpl(graph, node, registry);

  effectivePropertiesCache.set(node, result);

  return result;
}

function liftPropertyValue(pvArgs: LiftPropertyValueArgsInterface): unknown {
  const {
    classId, ctx, index, propEntry, propName, subjectIri, subjectQuads
  } = pvArgs;
  const propNode = propEntry.node;
  const propGraph = propEntry.graph;
  const edge = findAnnotatedEdgeStructure(propGraph, propNode);

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
  const matching = findPropertyQuads({
    index,
    predicateIri,
    propName,
    subjectQuads
  });

  if (matching.length === 0) {
    return undefined;
  }

  const resolvedNode = resolveLocalRef(propGraph, propNode);
  const propSem = propGraph.semantics(resolvedNode);
  const isArray = propSem.schemaTypes.includes('array');
  const nestedNode = propSem.itemsNode
    ? resolveLocalRef(propGraph, propSem.itemsNode)
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

function liftMatchingQuads(mqArgs: LiftMatchingQuadsArgsInterface): unknown {
  const {
    ctx, isArray, matching, nestedNode, propGraph, resolvedNode
  } = mqArgs;

  if (isArray || matching.length > 1) {
    return matching.map((quad: QuadInterface): unknown => {
      const narrowed = asQuadObject(quad.object);

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

  const narrowed = asQuadObject(matching[0].object);

  return narrowed === undefined
    ? undefined
    : liftSingleValue({
      'ctx': ctx,
      'obj': narrowed,
      'parentGraph': propGraph,
      'targetNode': resolvedNode
    });
}

function liftSubject(args: LiftSubjectArgsInterface): LiftedObjectType {
  const {
    classId, ctx, graph, node, subjectQuads
  } = args;
  const obj: LiftedObjectType = {};
  const subjectIri = subjectQuads.length > 0 ? subjectQuads[0].subject.value : classId;
  const effectiveProperties = collectEffectiveLiftProperties(graph, node, ctx.registry);
  const index = effectiveProperties.size > PREDICATE_INDEX_THRESHOLD
    ? buildPredicateIndex(subjectQuads)
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

function liftSingleValue(args: LiftSingleValueArgsInterface): unknown {
  const {
    ctx, obj, parentGraph, targetNode
  } = args;

  if (obj.termType === 'Literal') {
    return decodeLiteral(obj);
  }

  // Follow IRI / BlankNode references via the subject group index.
  const refQuads = ctx.allGroups.get(obj.value);

  if (refQuads) {
    const refType = typeOf(refQuads);

    if (refType !== undefined) {
      // Try resolving via registry (handles pointer-based IDs too)
      const resolved = resolveNodeForType(refType, ctx.registry);

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
  args: LiftImplArgsInterface
): unknown[] {
  const {
    curie, predicateResolver, registry
  } = args;
  const targetResolved = resolveNodeForType(schemaId, registry);

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

  const ctx: LiftContextInterface = {
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
    options?: LiftOptionsInterface
  ): unknown[] {
    return liftInstancesImpl(schemaId, quads, {
      'curie': options?.curie,
      'predicateResolver': options?.predicateResolver,
      registry
    });
  }
} as const;
