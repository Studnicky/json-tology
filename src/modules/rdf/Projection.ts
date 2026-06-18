/**
 * Projection — projects SchemaGraph relations into RDF quads.
 *
 * TBox projection is purely relation-driven: projectGraph() iterates
 * graph.allRelations() and maps each to one or more quads. No semantic
 * re-derivation occurs here — all RDF content is owned by extractRelations().
 *
 * ABox projection reads graph.semantics() for property enumeration because
 * it maps validated instance data to quads, not schema structure.
 */

import type { AnnotationEmitModeType } from '../../types/AnnotationEmitModeType.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFnType.js';
import type { SkolemizeFnType } from '../../types/SkolemizeFnType.js';
import type { ProjectInstanceArgsType } from '../../types/ProjectInstanceArgsType.js';
import type { ProjectPropertyArgsType } from '../../types/ProjectPropertyArgsType.js';
import type { RefTargetType } from '../../types/RefTargetType.js';
import type { LookupGraphFn } from '../../types/LookupGraphFn.js';
import type { ProjectInstancePropertyArgsType } from '../../types/ProjectInstancePropertyArgsType.js';
import type { ProjectAnnotatedEdgeArgsType } from '../../types/ProjectAnnotatedEdgeArgsType.js';
import type { ResolveEdgeTargetIriArgsType } from '../../types/ResolveEdgeTargetIriArgsType.js';
import type { EmitAnnotationQuadsArgsType } from '../../types/EmitAnnotationQuadsArgsType.js';
import type { EmitFlatAnnotationQuadsArgsType } from '../../types/EmitFlatAnnotationQuadsArgsType.js';
import type { ProjectScalarValueArgsType } from '../../types/ProjectScalarValueArgsType.js';
import type { ProjectAboxArgsType } from '../../types/ProjectAboxArgsType.js';
import { collectEffectiveProperties } from '../graph/EffectiveProperties.js';
import { Terms } from '../quads/Terms.js';
import { Curie } from '../quads/Curie.js';

import {
  RDF, XSD
} from '../../constants/IRI.js';
import { XsdTypes } from '../quads/XsdTypes.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import { MaterializationErrorCode } from '../../constants/ERROR_CODES.js';
import {
  hasCycle, isRecord
} from '../data/DataTypes.js';
import { PredicateResolver } from '../graph/PredicateResolver.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { Hash } from '../hash/Hash.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { findAnnotatedEdgeStructure } from './ProjectionHelpers.js';
import { resolveRef as canonicalResolveRef } from '../graph/RefResolution.js';

// ---------------------------------------------------------------------------
// TBox projection — purely relation-driven
// ---------------------------------------------------------------------------

/**
 * ABox projection — projects validated instance data into RDF quads.
 *
 * @remarks
 * ABox projection (`abox`) reads `graph.semantics()` for property enumeration
 * because it maps validated instance data to quads, not schema structure.
 * TBox projection is owned by `OwlProjection`; quad-to-JSON-LD conversion is
 * owned by `JsonLdFormatter`.
 *
 * @example
 * ```ts
 * const aboxQuads = Projection.abox(graph, data, baseIRI, { curie });
 * ```
 *
 * @defaultValue Uses a canonical predicate resolver derived from `baseIRI` when no `predicateResolver` option is provided.
 * @category RDF
 * @since 0.1.0
 * @see {@link OwlProjection}
 * @group Projection
 */
export const Projection = {
  abox(
    graph: SchemaGraphInterface,
    data: unknown,
    baseIRI: string,
    options?: { 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
      'curie'?: CurieInterface | undefined;
      'entryNode'?: SchemaGraphNodeType | undefined;
      'graphIRI'?: string | undefined;
      'iriFor'?: SkolemizeFnType | undefined;
      'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
      'predicateResolver'?: PredicateResolverFnType | undefined }
  ): QuadInterface[] {
    return projectAbox({
      'annotationEmitMode': options?.annotationEmitMode,
      baseIRI,
      'curie': options?.curie,
      data,
      'entryNode': options?.entryNode,
      graph,
      'graphIRI': options?.graphIRI,
      'iriFor': options?.iriFor,
      'lookupGraph': options?.lookupGraph,
      'predicateResolver': options?.predicateResolver
    });
  }
} as const;

// ---------------------------------------------------------------------------
// ABox projection
// ---------------------------------------------------------------------------

class IriMinter {
  private readonly baseIRI: string;
  private readonly iriFor: SkolemizeFnType | undefined;
  private readonly memo: WeakMap<object, string>;

  public constructor(baseIRI: string, iriFor: SkolemizeFnType | undefined) {
    this.baseIRI = baseIRI;
    this.iriFor = iriFor;
    this.memo = new WeakMap();
  }

  public mint(classId: string, value: unknown, path: string, depth: number): string {
    const memoKey = typeof value === 'object' && value !== null ? value : undefined;

    if (memoKey !== undefined) {
      const cached = this.memo.get(memoKey);

      if (cached !== undefined) {
        return cached;
      }
    }

    let chosen: string | undefined;

    if (this.iriFor !== undefined) {
      chosen = this.iriFor({
        depth,
        path,
        value
      });
    }

    const iri = chosen ?? defaultInstanceIri(this.baseIRI, classId, value);

    if (memoKey !== undefined) {
      this.memo.set(memoKey, iri);
    }

    return iri;
  }
}

function projectAbox(args: ProjectAboxArgsType): QuadInterface[] {
  const {
    annotationEmitMode, baseIRI, curie, data, entryNode, graph, graphIRI, iriFor, lookupGraph, predicateResolver
  } = args;

  const quads: QuadInterface[] = [];
  const rootNode = entryNode ?? graph.rootNode;
  const resolved = resolveNode(graph, rootNode);

  if (!isRecord(data)) {
    return quads;
  }

  if (hasCycle(data)) {
    throw new MaterializationError(
      resolved.node.id,
      {
        'code': MaterializationErrorCode.CYCLIC_DATA,
        'message': `Cyclic data detected during projection of ${resolved.node.id}`,
        'validationErrors': ['cyclic data detected at root']
      }
    );
  }

  const minter = new IriMinter(baseIRI, iriFor);
  const graphTerm = graphIRI === undefined ? Terms.defaultGraph() : Terms.iri(graphIRI);
  const quadOpts = {
    curie,
    'graph': graphTerm
  };
  const resolvePredicate = predicateResolver ?? PredicateResolver.forConfig({
    'baseIRI': baseIRI,
    'enableCanonicalPredicates': undefined,
    'predicateFor': undefined
  });

  projectInstance({
    annotationEmitMode,
    curie,
    data,
    'depth': 0,
    'graph': resolved.graph,
    graphTerm,
    lookupGraph,
    minter,
    'node': resolved.node,
    'path': '',
    'predicateResolver': resolvePredicate,
    quadOpts,
    quads,
    'visited': new WeakSet()
  });

  return quads;
}

function defaultInstanceIri(baseIRI: string, classId: string, data: unknown): string {
  const contentHash = Hash.value(data);

  return `${baseIRI}/instances/${SchemaIri.escapeSegment(classId)}-${contentHash}`;
}

function resolveNode(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeType,
  lookupGraph?: ((schemaId: string) => SchemaGraphInterface | undefined)
): RefTargetType {
  const nodeSemantics = graph.semantics(node);

  if (nodeSemantics.ref === undefined) {
    return {
      graph,
      node
    };
  }

  return canonicalResolveRef(
    nodeSemantics.ref,
    graph,
    lookupGraph === undefined ? {} : { 'lookupGraph': lookupGraph }
  );
}

/**
 * Test whether a member node is a bare `{ "type": "null" }` schema (the typical
 * nullable union sentinel) so it can be ignored when looking for the single
 * meaningful `$ref` member of an `anyOf`/`oneOf` wrapper.
 */
function isNullTypeNode(graph: SchemaGraphInterface, node: SchemaGraphNodeType): boolean {
  const sem = graph.semantics(node);

  return sem.ref === undefined
    && sem.schemaTypes.length === 1
    && sem.schemaTypes[0] === 'null';
}

/**
 * Unwrap a "transparent" wrapper property whose only meaningful constituent is a
 * `$ref` to a registered class/primitive, resolving through to that referenced
 * target.
 *
 * The canonical nullable-nested / nullable-primitive idiom wraps the real `$ref`
 * in a union or `allOf`:
 *   - `{ anyOf: [{ $ref: X }, { type: 'null' }] }`   (nullable ref)
 *   - `{ oneOf: [{ $ref: X }, { type: 'null' }] }`
 *   - `{ allOf: [{ $ref: X }] }`                       (optional nested ref)
 * The property node itself then carries no `$ref`, no `format`, and no object
 * `type`, so projection reads no datatype (date-time → xsd:string) and mints a
 * `#/properties/<prop>` shape IRI for nested objects instead of the class `$id`.
 *
 * When the wrapper has EXACTLY ONE non-null member and that member is a `$ref`,
 * this resolves to the ref target's `{ graph, node }` so the leaf datatype and
 * the nested node's `rdf:type` come from the referenced schema. Any other shape
 * (multiple meaningful members, inline members, no ref) is returned unchanged.
 */
function unwrapSingleRef(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeType,
  lookupGraph?: ((schemaId: string) => SchemaGraphInterface | undefined)
): RefTargetType {
  const semantics = graph.semantics(node);

  // A direct `$ref` is already resolved by resolveNode; only union/allOf
  // wrappers (which leave the property node ref-less) need unwrapping here.
  if (semantics.ref !== undefined) {
    return {
      graph,
      node
    };
  }

  const oneOfOrUndefined = semantics.oneOf.length > 0 ? semantics.oneOf : undefined;
  const union = semantics.anyOf.length > 0 ? semantics.anyOf : oneOfOrUndefined;

  if (union !== undefined) {
    const meaningful = union.filter((member: SchemaGraphNodeType): boolean => {
      return !isNullTypeNode(graph, member);
    });

    if (meaningful.length === 1) {
      const member = meaningful[0];

      if (member !== undefined && graph.semantics(member).ref !== undefined) {
        return resolveNode(graph, member, lookupGraph);
      }
    }

    return {
      graph,
      node
    };
  }

  // `allOf` with a single `$ref` member: the optional-nested idiom.
  if (semantics.allOf.length === 1) {
    const member = semantics.allOf[0];

    if (member !== undefined && graph.semantics(member).ref !== undefined) {
      return resolveNode(graph, member, lookupGraph);
    }
  }

  return {
    graph,
    node
  };
}

/**
 * Collect every property an instance node effectively carries: its own
 * `properties` plus those reachable through `allOf` members (recursively,
 * resolving `$ref` parents that point to other graphs in the registry).
 *
 * `Compose.subClassOf(Parent, body)` schemas declare their fields inside
 * `allOf[N]` members — the body's own `properties` block carries only the
 * subclass-specific fields, and the parent fields live behind a `$ref`
 * member. Without this walk, ABox projection emits only the body's own
 * properties (and the `rdf:type` triple), dropping every inherited field
 * even though it was validated and materialized. This mirrors
 * `Materializer.collectEffectiveProperties`, which already flattens `allOf`
 * for the materialized JS value; ABox projection must flatten the same way
 * so the canonical graph and the JS value agree.
 *
 * Returns a map keyed by property name, value `{ graph, node }` giving the
 * graph and node where that property's semantics live (which may differ from
 * the instance's own graph when the property is inherited through a $ref).
 * First declaration wins (own properties shadow inherited ones).
 */
// Per-node cache for collectProjectionProperties. The collected property map is
// node-identity-stable for a given (node, resolveGraph) pair, so memoizing it
// avoids re-walking allOf/then/else chains on every projected instance. The
// inner Map is keyed by the lookupGraph closure (or a sentinel for the
// no-lookupGraph case) because cross-graph resolution depends on which registry
// the closure consults — caching across distinct closures would be unsafe.
const NO_LOOKUP_GRAPH = Symbol('no-lookup-graph');
const collectProjectionPropertiesCache = new WeakMap<
  SchemaGraphNodeType,
  Map<LookupGraphFn | typeof NO_LOOKUP_GRAPH, Map<string, RefTargetType>>
>();

/**
 * Collect every property an instance node effectively carries for ABox projection:
 * own `properties` plus those reachable through `allOf` members and if/then/else
 * conditional branches, resolving cross-graph `$ref` members via `lookupGraph`.
 *
 * Delegates to the canonical `collectEffectiveProperties` walker. The per-node,
 * per-lookupGraph two-level cache is preserved so that a large quad stream with
 * repeated instances does not re-walk the allOf/then/else chains on every call.
 */
function collectProjectionProperties(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeType,
  lookupGraph?: LookupGraphFn
): Map<string, RefTargetType> {
  const cacheKey = lookupGraph ?? NO_LOOKUP_GRAPH;
  let byLookup = collectProjectionPropertiesCache.get(node);

  if (byLookup === undefined) {
    byLookup = new Map();
    collectProjectionPropertiesCache.set(node, byLookup);
  } else {
    const cached = byLookup.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }
  }

  // Build a resolveGraph that tries lookupGraph first, then falls back to
  // scanning the current graph for an embedded-$id node — matching the
  // two-path resolution in resolveNode().
  const resolveGraph = lookupGraph === undefined
    ? undefined
    : (refId: string): SchemaGraphInterface | undefined => {
      const found = lookupGraph(refId);

      if (found !== undefined) {
        return found;
      }

      // Embedded-$id fallback: a $ref to an $id declared inside this graph's
      // $defs is not a separately-registered schema, so lookupGraph misses it.
      // Scan the current graph's nodes for a node whose id matches refId.
      // If found, wrap it in a synthetic single-node view — but since the
      // canonical walker always starts at rootNode of the returned graph,
      // we return undefined here so the walker skips the cross-graph hop
      // and relies on resolveNode() at the property-value level instead.
      // Property-collection only needs to follow allOf/then/else for subClassOf
      // inheritance; embedded-$id refs appear as property VALUES (not allOf
      // members), so this path is not exercised during property-name collection.
      return undefined;
    };

  const collected = collectEffectiveProperties(graph, node, resolveGraph);

  byLookup.set(cacheKey, collected);

  return collected;
}

function projectInstanceProperty(args: ProjectInstancePropertyArgsType): void {
  const {
    baseArgs, instIRI, nodeId, propertyEntry, propertyName
  } = args;
  const {
    annotationEmitMode, curie, data, depth, graphTerm, lookupGraph, minter, path, predicateResolver, quadOpts, quads, visited
  } = baseArgs;
  const propertyPath = `${path}/${propertyName}`;
  const propertyValue = data[propertyName];
  const propertyNode = propertyEntry.node;
  const propertyGraph = propertyEntry.graph;
  const annotatedEdge = findAnnotatedEdgeStructure(propertyGraph, propertyNode);

  if (annotatedEdge !== undefined) {
    projectAnnotatedEdge({
      annotationEmitMode,
      curie,
      depth,
      'edge': annotatedEdge,
      graphTerm,
      'instanceIri': instIRI,
      minter,
      'path': propertyPath,
      predicateResolver,
      quadOpts,
      quads,
      'sourceId': nodeId,
      'value': propertyValue
    });

    return;
  }

  const propertyIRI = predicateResolver({
    'classId': nodeId,
    propertyName,
    'propertySchema': propertyNode.schema
  });
  const directlyResolved = resolveNode(propertyGraph, propertyNode, lookupGraph);
  // Follow a transparent wrapper — `anyOf`/`oneOf [{ $ref: X }, null]` or
  // `allOf [{ $ref: X }]` — to the referenced target so the leaf datatype
  // (e.g. xsd:dateTime) and the nested node's rdf:type (the class $id, not a
  // `#/properties/<prop>` shape IRI) come from the referenced schema.
  const resolved = unwrapSingleRef(directlyResolved.graph, directlyResolved.node, lookupGraph);

  projectPropertyValue({
    annotationEmitMode,
    curie,
    'depth': depth + 1,
    'graph': resolved.graph,
    graphTerm,
    'instanceIri': instIRI,
    lookupGraph,
    minter,
    'path': propertyPath,
    predicateResolver,
    propertyIRI,
    'propertyNode': resolved.node,
    'propertySemantics': resolved.graph.semantics(resolved.node),
    quadOpts,
    quads,
    'value': propertyValue,
    visited
  });
}

function projectInstance(args: ProjectInstanceArgsType): string {
  const {
    data, depth, graph, lookupGraph, minter, node, path, quadOpts, quads, visited
  } = args;

  if (visited.has(data)) {
    throw new MaterializationError(
      node.id,
      {
        'code': MaterializationErrorCode.CYCLIC_DATA,
        'message': `Cyclic data detected during projection of ${node.id} at ${path === '' ? 'root' : path}`,
        'validationErrors': [`cyclic data detected at ${path === '' ? 'root' : path}`]
      }
    );
  }
  visited.add(data);

  try {
    const instIRI = minter.mint(node.id, data, path, depth);

    quads.push(QuadFactory.quad(instIRI, RDF.type, QuadFactory.iri(node.id), quadOpts));

    // Flatten own `properties` plus every `allOf` member's properties so
    // subclass instances (Compose.subClassOf bodies carry inherited fields
    // behind a $ref allOf member) project their inherited fields too, not
    // just the body-local ones. Mirrors Materializer.collectEffectiveProperties.
    const effectiveProperties = collectProjectionProperties(graph, node, lookupGraph);

    for (const [
      propertyName,
      propertyEntry
    ] of effectiveProperties) {
      const value = data[propertyName];

      if (value === undefined || value === null) {
        continue;
      }

      projectInstanceProperty({
        'baseArgs': args,
        instIRI,
        'nodeId': node.id,
        propertyEntry,
        propertyName
      });
    }

    return instIRI;
  } finally {
    visited.delete(data);
  }
}

// ---------------------------------------------------------------------------
// Annotated edge (RDF 1.2 triple-term) projection
// ---------------------------------------------------------------------------

/**
 * Resolve the target term IRI for an annotated edge value.
 *
 * The value may be:
 * - a string IRI (`{ target: '...rockruff' }`),
 * - an object carrying an `@id` / `id` IRI, or
 * - a nested instance object — minted via the IRI minter.
 */
function resolveEdgeTargetIri(args: ResolveEdgeTargetIriArgsType): string {
  const {
    depth, edge, minter, path, target
  } = args;

  if (typeof target === 'string') {
    return target;
  }

  if (isRecord(target)) {
    const idValue = target['@id'] ?? target.id;

    if (typeof idValue === 'string') {
      return idValue;
    }

    return minter.mint(edge.edgeTarget, target, `${path}/target`, depth + 1);
  }

  return String(target);
}

/**
 * Build a `QuadObjectType` term for an annotation value.
 * Strings/numbers/booleans/Dates become typed literals; IRI-valued targets
 * (string starting with a scheme) are emitted as NamedNode references when the
 * annotation range resolves to a class IRI.
 */
function annotationValueTerm(value: unknown, rangeRef: string): QuadObjectType {
  if (typeof value === 'string' && Curie.isAbsolute(value) && isClassRange(rangeRef)) {
    return Terms.iri(value);
  }

  if (typeof value === 'string') {
    return Terms.literal(value, { 'datatype': Terms.iri(XSD.string) });
  }

  if (typeof value === 'number') {
    // Annotated-edge annotations carry only a `$ref`-resolved class/type IRI
    // (`rangeRef`), not a JSON Schema `type`+`format` pair, so the declared
    // numeric precision is not available here the way it is on the standard
    // property path (projectSingleValue reads propertySemantics.schemaTypes).
    // The runtime heuristic is retained for this distinct code path.
    return Terms.literal(value, { 'datatype': Terms.iri(Number.isInteger(value) ? XSD.integer : XSD.double) });
  }

  if (typeof value === 'boolean') {
    return Terms.literal(value, { 'datatype': Terms.iri(XSD.boolean) });
  }

  if (value instanceof Date) {
    return Terms.literal(value, { 'datatype': Terms.iri(XSD.dateTime) });
  }

  return Terms.literal(String(value), { 'datatype': Terms.iri(XSD.string) });
}

// Allowed absolute-IRI schemes for x-jt-iriRef property values. Rejects
// dangerous schemes (e.g. `javascript:`, `data:`); alternatives are kept
// alphabetically sorted.
const ALLOWED_IRI_SCHEME_RE = /^(?:file|ftp|https?|urn):/u;
const DEL_CODE_POINT = 0x7F;
const FIRST_PRINTABLE_CODE_POINT = 0x21;

// An absolute IRI must start with an allowed scheme and contain no ASCII control
// characters (U+0000-U+001F), space (U+0020), or DEL (U+007F). The codepoint
// scan avoids embedding raw control characters in a regular expression.
function isAbsoluteIri(value: string): boolean {
  if (!ALLOWED_IRI_SCHEME_RE.test(value)) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0;

    if (code < FIRST_PRINTABLE_CODE_POINT || code === DEL_CODE_POINT) {
      return false;
    }
  }

  return true;
}

function isClassRange(rangeRef: string): boolean {
  return Curie.isAbsolute(rangeRef);
}

/**
 * Emit the base triple and one annotation quad per annotation for an annotated edge.
 *
 * Base triple: `s edgePredicate o` (graph = graphIRI).
 * Annotation quads: `<< s edgePredicate o >> annotationPredicate value` (graph = graphIRI).
 * All quads share the SAME named graph — a triple term carries no graph membership,
 * so the base and annotation triples MUST be asserted in one named graph.
 *
 * Raises a MaterializationError when no `graphIRI` was supplied (the default
 * graph is not a valid home for an annotated edge).
 */
/** Emit one annotation quad per annotation on the edge. */
function emitAnnotationQuads(args: EmitAnnotationQuadsArgsType): void {
  const {
    annotationValues, classId, edge, predicateResolver, quadOpts, quads, tripleTerm
  } = args;

  for (const annotation of edge.edgeAnnotations) {
    const annotationValue = annotationValues[annotation.propertyName];

    if (annotationValue === undefined || annotationValue === null) {
      continue;
    }
    const annotationPredicate = predicateResolver({
      'classId': classId,
      'propertyName': annotation.propertyName,
      'propertySchema': annotation.propertySchema
    });
    const annotationTerm = annotationValueTerm(annotationValue, annotation.rangeRef);

    quads.push(QuadFactory.annotationQuad(tripleTerm, annotationPredicate, annotationTerm, quadOpts));
  }
}

/** Emit flat `<instanceIri> <annotationPredicate> <value>` triples (no triple-term). */
function emitFlatAnnotationQuads(args: EmitFlatAnnotationQuadsArgsType): void {
  const {
    annotationValues, classId, edge, instanceIri, predicateResolver, quadOpts, quads
  } = args;

  for (const annotation of edge.edgeAnnotations) {
    const annotationValue = annotationValues[annotation.propertyName];

    if (annotationValue === undefined || annotationValue === null) {
      continue;
    }
    const annotationPredicate = predicateResolver({
      'classId': classId,
      'propertyName': annotation.propertyName,
      'propertySchema': annotation.propertySchema
    });
    const annotationTerm = annotationValueTerm(annotationValue, annotation.rangeRef);

    quads.push(QuadFactory.quad(instanceIri, annotationPredicate, annotationTerm, quadOpts));
  }
}

function projectAnnotatedEdge(args: ProjectAnnotatedEdgeArgsType): void {
  const {
    annotationEmitMode = 'star-only', curie, depth, edge, graphTerm, instanceIri, minter, path, predicateResolver, quadOpts, quads, sourceId, value
  } = args;

  if (graphTerm.termType === 'DefaultGraph') {
    throw new MaterializationError(
      sourceId,
      {
        'code': MaterializationErrorCode.MISSING_GRAPH_IRI,
        'message': `Annotated edge ${edge.edgePredicate} at ${path} requires a graphIRI: a triple term carries no graph membership, so the base triple and its annotations must share one named graph. Pass { graphIRI } to toQuads.`,
        'validationErrors': [`annotated edge ${edge.edgePredicate} requires an explicit graphIRI`]
      }
    );
  }

  if (!isRecord(value)) {
    throw new MaterializationError(
      sourceId,
      {
        'code': MaterializationErrorCode.MATERIALIZATION_FAILED,
        'message': `Annotated edge ${edge.edgePredicate} at ${path} expects { target, annotations }, received ${typeof value}.`,
        'validationErrors': [`annotated edge ${edge.edgePredicate} value must be an object with target + annotations`]
      }
    );
  }

  const targetIri = resolveEdgeTargetIri({
    depth,
    edge,
    minter,
    path,
    'target': value.target
  });
  const objectTerm = Terms.iri(targetIri);

  // Base triple: s edgePredicate o. Reuse the caller's quadOpts (same curie +
  // named graph) instead of rebuilding the bag per edge.
  quads.push(QuadFactory.quad(instanceIri, edge.edgePredicate, objectTerm, quadOpts));

  const annotationValues = isRecord(value.annotations) ? value.annotations : {};

  if (annotationEmitMode === 'star-only' || annotationEmitMode === 'both') {
    // The triple term `<< s edgePredicate o >>` is loop-invariant across all
    // annotations on this edge — build it once above the loop.
    const tripleTerm = QuadFactory.tripleTerm(instanceIri, edge.edgePredicate, objectTerm, { curie });

    emitAnnotationQuads({
      annotationValues,
      'classId': sourceId,
      edge,
      predicateResolver,
      quadOpts,
      quads,
      tripleTerm
    });
  }

  if (annotationEmitMode === 'flat-only' || annotationEmitMode === 'both') {
    emitFlatAnnotationQuads({
      annotationValues,
      'classId': sourceId,
      edge,
      'instanceIri': instanceIri,
      predicateResolver,
      quadOpts,
      quads
    });
  }
}

function projectPropertyValue(args: ProjectPropertyArgsType): void {
  const {
    path, value
  } = args;

  if (Array.isArray(value)) {
    const elements = value as readonly unknown[];

    for (const [
      index,
      element
    ] of elements.entries()) {
      projectSingleValue(args, `${path}/${index}`, element);
    }

    return;
  }

  projectSingleValue(args, path, value);
}

/**
 * Resolve the XSD datatype for a numeric ABox literal from the property's
 * DECLARED schema type (canonical-graph mandate). Prefers the declared numeric
 * type ('integer' or 'number') resolved through XsdTypes with the declared
 * `format`, so the ABox literal datatype matches the TBox/SHACL declaration.
 * Falls back to runtime inference only when no numeric type is declared.
 */
function numericDatatype(value: number, schemaTypes: readonly string[], format: string | undefined): string {
  const runtimeFallback = Number.isInteger(value) ? XSD.integer : XSD.double;

  let declaredNumericType: string | undefined;

  if (schemaTypes.includes('integer')) {
    declaredNumericType = 'integer';
  } else if (schemaTypes.includes('number')) {
    declaredNumericType = 'number';
  }

  if (declaredNumericType === undefined) {
    return runtimeFallback;
  }

  const formatOption = format === undefined ? undefined : { 'format': format };

  return XsdTypes.resolveSingle(declaredNumericType, formatOption) ?? runtimeFallback;
}

function projectStringValue(value: string, ctx: ProjectScalarValueArgsType): void {
  const {
    instanceIri, path, propertyIRI, propertyNode, propertySemantics, quadOpts, quads
  } = ctx;

  if (propertySemantics.iriRef) {
    // Validate that the runtime value is a syntactically safe absolute IRI
    // before emitting it as a NamedNode. Reject control characters, spaces,
    // and dangerous schemes (e.g. `javascript:`) to prevent taint propagation
    // into the quad stream.
    if (!isAbsoluteIri(value)) {
      throw new MaterializationError(
        propertyNode.id,
        {
          'code': MaterializationErrorCode.INVALID_IRI_VALUE,
          'message': `Property ${propertyIRI} (x-jt-iriRef) received an invalid IRI: "${value}". Expected an absolute IRI with an allowed scheme (http/https/urn/ftp/file) and no control characters or spaces.`,
          'validationErrors': [`invalid IRI value at ${path}: ${value}`]
        }
      );
    }
    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.iri(value), quadOpts));

    return;
  }

  if (propertySemantics.language !== undefined && propertySemantics.language !== '') {
    const langLiteral = QuadFactory.literal(value, XSD.string, { 'language': propertySemantics.language });

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, langLiteral, quadOpts));

    return;
  }

  const xsdDatatype = XsdTypes.resolveSingle(
    'string',
    propertySemantics.format === undefined ? undefined : { 'format': propertySemantics.format }
  ) ?? XSD.string;

  quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, xsdDatatype), quadOpts));
}

function projectNumberValue(value: number, ctx: ProjectScalarValueArgsType): void {
  const {
    instanceIri, path, propertyIRI, propertyNode, propertySemantics, quadOpts, quads
  } = ctx;

  // Reject non-finite values: NaN/Infinity are not valid RDF/XSD literals
  // (e.g. "NaN"^^xsd:decimal is invalid in XSD). Throw early so the caller
  // receives a clear MaterializationError instead of an invalid quad stream.
  if (!Number.isFinite(value)) {
    throw new MaterializationError(
      propertyNode.id,
      {
        'code': MaterializationErrorCode.NON_FINITE_NUMBER,
        'message': `Non-finite numeric value (${String(value)}) at ${path} cannot be serialized as an RDF literal. Supply a finite number.`,
        'validationErrors': [`non-finite numeric value at ${path}`]
      }
    );
  }

  // Derive datatype from the DECLARED schema type (canonical-graph mandate)
  // so ABox matches TBox/SHACL; fall back to runtime inference only when no
  // numeric type is declared (e.g. freeform / untyped value).
  const datatype = numericDatatype(value, propertySemantics.schemaTypes, propertySemantics.format);

  quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, datatype), quadOpts));
}

function projectObjectValue(args: ProjectPropertyArgsType, path: string, value: Record<string, unknown>): void {
  const {
    annotationEmitMode, curie, depth, graph, graphTerm, instanceIri, lookupGraph, minter,
    predicateResolver, propertyIRI, propertyNode, propertySemantics, quadOpts, quads, visited
  } = args;

  let targetGraph = graph;
  let targetNode = propertyNode;

  if (propertySemantics.itemsNode !== undefined) {
    const resolvedItems = resolveNode(graph, propertySemantics.itemsNode, lookupGraph);

    targetGraph = resolvedItems.graph;
    targetNode = resolvedItems.node;
  }

  const targetSemantics = targetGraph.semantics(targetNode);

  // Allow allOf-composed schemas (e.g. Compose.subClassOf) through: their
  // own `properties` map is empty and they carry no top-level `type:object`,
  // but their `allOf` members do. Without this guard, any $ref-targeted
  // schema built by Compose.subClassOf would be silently skipped, losing
  // all nested object data from the ABox quad stream.
  if (
    targetSemantics.properties.size === 0
    && targetSemantics.allOf.length === 0
    && !targetSemantics.schemaTypes.includes('object')
  ) {
    return;
  }

  const nestedIRI = projectInstance({
    annotationEmitMode,
    curie,
    'data': value,
    depth,
    'graph': targetGraph,
    graphTerm,
    lookupGraph,
    minter,
    'node': targetNode,
    path,
    predicateResolver,
    quadOpts,
    quads,
    visited
  });

  quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.iri(nestedIRI), quadOpts));
}

function projectSingleValue(args: ProjectPropertyArgsType, path: string, value: unknown): void {
  const {
    instanceIri, propertyIRI, propertyNode, propertySemantics, quadOpts, quads
  } = args;

  if (value === null || value === undefined) {
    return;
  }

  const scalarCtx: ProjectScalarValueArgsType = {
    instanceIri,
    path,
    propertyIRI,
    propertyNode,
    propertySemantics,
    quadOpts,
    quads
  };

  if (typeof value === 'string') {
    projectStringValue(value, scalarCtx);

    return;
  }

  if (typeof value === 'number') {
    projectNumberValue(value, scalarCtx);

    return;
  }

  if (typeof value === 'boolean') {
    // boolean has no XSD format variants — emit XSD.boolean directly.
    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, XSD.boolean), quadOpts));

    return;
  }

  if (isRecord(value)) {
    projectObjectValue(args, path, value);
  }
}

