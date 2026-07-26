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

import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { AnnotationEmitModeEntity } from '../../entities/AnnotationEmitModeEntity.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { PredicateResolverInterface } from '../../interfaces/PredicateResolverInterface.js';
import type { SkolemizeFunctionInterface } from '../../interfaces/SkolemizeFunctionInterface.js';
import type { ProjectInstanceArgumentListInterface } from '../../interfaces/ProjectInstanceArgumentListInterface.js';
import type { ProjectPropertyArgumentListInterface } from '../../interfaces/ProjectPropertyArgumentListInterface.js';
import type { ReferenceTargetInterface } from '../../interfaces/ReferenceTargetInterface.js';
import type { LookupGraphFunctionInterface } from '../../interfaces/LookupGraphFunctionInterface.js';
import type { ProjectInstancePropertyArgumentListInterface } from '../../interfaces/ProjectInstancePropertyArgumentListInterface.js';
import type { ProjectAnnotatedEdgeArgumentListInterface } from '../../interfaces/ProjectAnnotatedEdgeArgumentListInterface.js';
import type { ResolveEdgeTargetIriArgumentsInterface } from '../../interfaces/ResolveEdgeTargetIriArgumentsInterface.js';
import type { EmitAnnotationQuadsArgumentListInterface } from '../../interfaces/EmitAnnotationQuadsArgumentListInterface.js';
import type { EmitFlatAnnotationQuadsArgumentListInterface } from '../../interfaces/EmitFlatAnnotationQuadsArgumentListInterface.js';
import type { ProjectScalarValueArgumentListInterface } from '../../interfaces/ProjectScalarValueArgumentListInterface.js';
import type { ProjectAboxArgumentListInterface } from '../../interfaces/ProjectAboxArgumentListInterface.js';
import { EffectiveProperties } from '../graph/EffectiveProperties.js';
import { Terms } from '../quads/Terms.js';
import { Curie } from '../quads/Curie.js';

import {
  RDF, XSD
} from '../../constants/IRI.js';
import { ALLOWED_IRI_SCHEME_RE } from '../../constants/GRAPH_REGEXES.js';
import {
  CONTROL_CHAR_MAXIMUM, DEL_CODEPOINT
} from '../../constants/NUMERIC.js';
import { XsdTypes } from '../quads/XsdTypes.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import { MATERIALIZATION_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { DataType } from '../data/DataType.js';
import { PredicateResolver } from '../graph/PredicateResolver.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { Hash } from '../hash/Hash.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { PropertyProjection } from './PropertyProjection.js';
import { ReferenceResolution } from '../graph/ReferenceResolution.js';

// ---------------------------------------------------------------------------
// ABox projection
// ---------------------------------------------------------------------------

/** Default IRI-minting fallback — shared by `IriMinter` (defined below `Projection`). */
class InstanceIri {
  static defaultInstanceIri(baseIri: string, classId: string, data: unknown): string {
    const contentHash = Hash.value(data);

    return `${baseIri}/instances/${SchemaIri.escapeSegment(classId)}-${contentHash}`;
  }
}

class IriMinter {
  private readonly baseIri: string;
  private readonly iriFor: SkolemizeFunctionInterface | undefined;
  private readonly memo: WeakMap<object, string>;

  public constructor(baseIri: string, iriFor: SkolemizeFunctionInterface | undefined) {
    this.baseIri = baseIri;
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

    const iri = chosen ?? InstanceIri.defaultInstanceIri(this.baseIri, classId, value);

    if (memoKey !== undefined) {
      this.memo.set(memoKey, iri);
    }

    return iri;
  }
}

/**
 * Projects SchemaGraph relations into RDF quads.
 *
 * @remarks
 * TBox projection is purely relation-driven: `projectGraph()` iterates
 * `graph.allRelations()` and maps each to one or more quads. No semantic
 * re-derivation occurs here — all RDF content is owned by `extractRelations()`.
 *
 * ABox projection (`abox`) reads `graph.semantics()` for property enumeration
 * because it maps validated instance data to quads, not schema structure.
 * TBox projection is owned by `OwlProjection`; quad-to-JSON-LD conversion is
 * owned by `JsonLdFormatter`.
 *
 * @example
 * ```ts
 * const aboxQuads = Projection.abox(graph, data, baseIri, { curie });
 * ```
 *
 * @defaultValue Uses a canonical predicate resolver derived from `baseIri` when no `predicateResolver` option is provided.
 * @category RDF
 * @since 0.1.0
 * @see {@link OwlProjection}
 * @group Projection
 */
export class Projection {
  /**
   * Per-node cache for collectProjectionProperties. The collected property map is
   * node-identity-stable for a given (node, resolveGraph) pair, so memoizing it
   * avoids re-walking allOf/then/else chains on every projected instance. The
   * inner Map is keyed by the lookupGraph closure itself (or `undefined` for the
   * no-lookupGraph case) because cross-graph resolution depends on which registry
   * the closure consults — caching across distinct closures would be unsafe.
   */
  private static readonly collectProjectionPropertiesCache = new WeakMap<
    SchemaGraphNodeInterface,
    Map<LookupGraphFunctionInterface | undefined, Map<string, ReferenceTargetInterface>>
  >();

  public static abox(
    graph: SchemaGraphInterface,
    data: unknown,
    baseIri: string,
    options?: { 'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
      'curie'?: CurieInterface | undefined;
      'entryNode'?: SchemaGraphNodeInterface | undefined;
      'graphIri'?: string | undefined;
      'iriFor'?: SkolemizeFunctionInterface | undefined;
      'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
      'predicateResolver'?: PredicateResolverInterface | undefined }
  ): QuadInterface[] {
    const result = Projection.projectAbox({
      'annotationEmitMode': options?.annotationEmitMode,
      baseIri,
      'curie': options?.curie,
      data,
      'entryNode': options?.entryNode,
      graph,
      'graphIri': options?.graphIri,
      'iriFor': options?.iriFor,
      'lookupGraph': options?.lookupGraph,
      'predicateResolver': options?.predicateResolver
    });

    return result;
  }

  /**
   * Build a `QuadObjectType` term for an annotation value.
   * Strings/numbers/booleans/Dates become typed literals; IRI-valued targets
   * (string starting with a scheme) are emitted as NamedNode references when the
   * annotation range resolves to a class IRI.
   */
  private static annotationValueTerm(value: unknown, rangeReference: string): QuadObjectType {
    if (typeof value === 'string' && Curie.isAbsolute(value) && Projection.isClassRange(rangeReference)) {
      return Terms.iri(value);
    }

    if (typeof value === 'string') {
      return Terms.literal(value, { 'datatype': Terms.iri(XSD.string) });
    }

    if (typeof value === 'number') {
      // Annotated-edge annotations carry only a `$ref`-resolved class/type IRI
      // (`rangeReference`), not a JSON Schema `type`+`format` pair, so the declared
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

  /**
   * Collect every property an instance node effectively carries for ABox projection:
   * own `properties` plus those reachable through `allOf` members and if/then/else
   * conditional branches, resolving cross-graph `$ref` members via `lookupGraph`.
   *
   * Delegates to the canonical `collectEffectiveProperties` walker. The per-node,
   * per-lookupGraph two-level cache is preserved so that a large quad stream with
   * repeated instances does not re-walk the allOf/then/else chains on every call.
   */
  private static collectProjectionProperties(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    lookupGraph?: LookupGraphFunctionInterface
  ): Map<string, ReferenceTargetInterface> {
    const cacheKey = lookupGraph;
    let byLookup = Projection.collectProjectionPropertiesCache.get(node);

    if (byLookup === undefined) {
      byLookup = new Map();
      Projection.collectProjectionPropertiesCache.set(node, byLookup);
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
      : (referenceId: string): SchemaGraphInterface | undefined => {
        const found = lookupGraph(referenceId);

        if (found !== undefined) {
          return found;
        }

        // Embedded-$id fallback: a $ref to an $id declared inside this graph's
        // $defs is not a separately-registered schema, so lookupGraph misses it.
        // Scan the current graph's nodes for a node whose id matches referenceId.
        // If found, wrap it in a synthetic single-node view — but since the
        // canonical walker always starts at rootNode of the returned graph,
        // we return undefined here so the walker skips the cross-graph hop
        // and relies on resolveNode() at the property-value level instead.
        // Property-collection only needs to follow allOf/then/else for subClassOf
        // inheritance; embedded-$id refs appear as property VALUES (not allOf
        // members), so this path is not exercised during property-name collection.
        return undefined;
      };

    const collected = EffectiveProperties.collect(graph, node, resolveGraph);

    byLookup.set(cacheKey, collected);

    return collected;
  }

  /** Emit one annotation quad per annotation on the edge. */
  private static emitAnnotationQuads(argumentList: EmitAnnotationQuadsArgumentListInterface): void {
    const {
      annotationValues, classId, edge, predicateResolver, quadOptions, quads, tripleTerm
    } = argumentList;

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
      const annotationTerm = Projection.annotationValueTerm(annotationValue, annotation.rangeRef);

      quads.push(QuadFactory.annotationQuad(tripleTerm, annotationPredicate, annotationTerm, quadOptions));
    }
  }

  /** Emit flat `<instanceIri> <annotationPredicate> <value>` triples (no triple-term). */
  private static emitFlatAnnotationQuads(argumentList: EmitFlatAnnotationQuadsArgumentListInterface): void {
    const {
      annotationValues, classId, edge, instanceIri, predicateResolver, quadOptions, quads
    } = argumentList;

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
      const annotationTerm = Projection.annotationValueTerm(annotationValue, annotation.rangeRef);

      quads.push(QuadFactory.quad(instanceIri, annotationPredicate, annotationTerm, quadOptions));
    }
  }

  // An absolute IRI must start with an allowed scheme and contain no ASCII control
  // characters (U+0000-U+001F), space (U+0020), or DEL (U+007F). The codepoint
  // scan avoids embedding raw control characters in a regular expression.
  private static isAbsoluteIri(value: string): boolean {
    if (!ALLOWED_IRI_SCHEME_RE.test(value)) {
      return false;
    }

    const { length } = value;

    for (let index = 0; index < length; index += 1) {
      const code = value.codePointAt(index) ?? 0;

      if (code <= CONTROL_CHAR_MAXIMUM || code === DEL_CODEPOINT) {
        return false;
      }
    }

    return true;
  }

  private static isClassRange(rangeReference: string): boolean {
    const result = Curie.isAbsolute(rangeReference);

    return result;
  }

  /**
   * Test whether a member node is a bare `{ "type": "null" }` schema (the typical
   * nullable union sentinel) so it can be ignored when looking for the single
   * meaningful `$ref` member of an `anyOf`/`oneOf` wrapper.
   */
  private static isNullTypeNode(graph: SchemaGraphInterface, node: SchemaGraphNodeInterface): boolean {
    const sem = graph.semantics(node);

    return sem.ref === undefined
      && sem.schemaTypes.length === 1
      && sem.schemaTypes[0] === 'null';
  }

  /**
   * Resolve the XSD datatype for a numeric ABox literal from the property's
   * DECLARED schema type (canonical-graph mandate). Prefers the declared numeric
   * type ('integer' or 'number') resolved through XsdTypes with the declared
   * `format`, so the ABox literal datatype matches the TBox/SHACL declaration.
   * Falls back to runtime inference only when no numeric type is declared.
   */
  private static numericDatatype(value: number, schemaTypes: readonly string[], format: string | undefined): string {
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

  // ---------------------------------------------------------------------------
  // Annotated edge (RDF 1.2 triple-term) projection
  // ---------------------------------------------------------------------------

  private static projectAbox(argumentList: ProjectAboxArgumentListInterface): QuadInterface[] {
    const {
      annotationEmitMode, baseIri, curie, data, entryNode, graph, graphIri, iriFor, lookupGraph, predicateResolver
    } = argumentList;

    const quads: QuadInterface[] = [];
    const rootNode = entryNode ?? graph.rootNode;
    const resolved = Projection.resolveNode(graph, rootNode);

    if (!DataType.isRecord(data)) {
      return quads;
    }

    if (DataType.hasCycle(data)) {
      throw new MaterializationError(
        resolved.node.id,
        {
          'code': MATERIALIZATION_ERROR_CODE.CYCLIC_DATA,
          'message': `Cyclic data detected during projection of ${resolved.node.id}`,
          'validationErrors': ['cyclic data detected at root']
        }
      );
    }

    const minter = new IriMinter(baseIri, iriFor);
    const graphTerm = graphIri === undefined ? Terms.defaultGraph() : Terms.iri(graphIri);
    const quadOptions = {
      curie,
      'graph': graphTerm
    };
    const resolvePredicate = predicateResolver ?? PredicateResolver.forConfig({
      'baseIri': baseIri,
      'enableCanonicalPredicates': undefined,
      'predicateFor': undefined
    });

    Projection.projectInstance({
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
      quadOptions,
      quads,
      'visited': new WeakSet()
    });

    return quads;
  }

  /**
   * Emit the base triple and one annotation quad per annotation for an annotated edge.
   *
   * Base triple: `s edgePredicate o` (graph = graphIri).
   * Annotation quads: `<< s edgePredicate o >> annotationPredicate value` (graph = graphIri).
   * All quads share the SAME named graph — a triple term carries no graph membership,
   * so the base and annotation triples MUST be asserted in one named graph.
   *
   * Raises a MaterializationError when no `graphIri` was supplied (the default
   * graph is not a valid home for an annotated edge).
   */
  private static projectAnnotatedEdge(argumentList: ProjectAnnotatedEdgeArgumentListInterface): void {
    const {
      annotationEmitMode = 'star-only', curie, depth, edge, graphTerm, instanceIri, minter, path, predicateResolver, quadOptions, quads, sourceId, value
    } = argumentList;

    if (graphTerm.termType === 'DefaultGraph') {
      throw new MaterializationError(
        sourceId,
        {
          'code': MATERIALIZATION_ERROR_CODE.MISSING_GRAPH_IRI,
          'message': `Annotated edge ${edge.edgePredicate} at ${path} requires a graphIri: a triple term carries no graph membership, so the base triple and its annotations must share one named graph. Pass { graphIri } to toQuads.`,
          'validationErrors': [`annotated edge ${edge.edgePredicate} requires an explicit graphIri`]
        }
      );
    }

    if (!DataType.isRecord(value)) {
      throw new MaterializationError(
        sourceId,
        {
          'code': MATERIALIZATION_ERROR_CODE.MATERIALIZATION_FAILED,
          'message': `Annotated edge ${edge.edgePredicate} at ${path} expects { target, annotations }, received ${typeof value}.`,
          'validationErrors': [`annotated edge ${edge.edgePredicate} value must be an object with target + annotations`]
        }
      );
    }

    const targetIri = Projection.resolveEdgeTargetIri({
      depth,
      edge,
      minter,
      path,
      'target': value.target
    });
    const objectTerm = Terms.iri(targetIri);

    // Base triple: s edgePredicate o. Reuse the caller's quadOptions (same curie +
    // named graph) instead of rebuilding the bag per edge.
    quads.push(QuadFactory.quad(instanceIri, edge.edgePredicate, objectTerm, quadOptions));

    const annotationValues = DataType.isRecord(value.annotations) ? value.annotations : {};

    if (annotationEmitMode === 'star-only' || annotationEmitMode === 'both') {
      // The triple term `<< s edgePredicate o >>` is loop-invariant across all
      // annotations on this edge — build it once above the loop.
      const tripleTerm = QuadFactory.tripleTerm(instanceIri, edge.edgePredicate, objectTerm, { curie });

      Projection.emitAnnotationQuads({
        annotationValues,
        'classId': sourceId,
        edge,
        predicateResolver,
        quadOptions,
        quads,
        tripleTerm
      });
    }

    if (annotationEmitMode === 'flat-only' || annotationEmitMode === 'both') {
      Projection.emitFlatAnnotationQuads({
        annotationValues,
        'classId': sourceId,
        edge,
        'instanceIri': instanceIri,
        predicateResolver,
        quadOptions,
        quads
      });
    }
  }

  private static projectInstance(argumentList: ProjectInstanceArgumentListInterface): string {
    const {
      data, depth, graph, lookupGraph, minter, node, path, quadOptions, quads, visited
    } = argumentList;

    if (visited.has(data)) {
      throw new MaterializationError(
        node.id,
        {
          'code': MATERIALIZATION_ERROR_CODE.CYCLIC_DATA,
          'message': `Cyclic data detected during projection of ${node.id} at ${path === '' ? 'root' : path}`,
          'validationErrors': [`cyclic data detected at ${path === '' ? 'root' : path}`]
        }
      );
    }
    visited.add(data);

    try {
      const instIri = minter.mint(node.id, data, path, depth);

      quads.push(QuadFactory.quad(instIri, RDF.type, QuadFactory.iri(node.id), quadOptions));

      // Flatten own `properties` plus every `allOf` member's properties so
      // subclass instances (Compose.subClassOf bodies carry inherited fields
      // behind a $ref allOf member) project their inherited fields too, not
      // just the body-local ones. Mirrors Materializer.collectEffectiveProperties.
      const effectiveProperties = Projection.collectProjectionProperties(graph, node, lookupGraph);

      for (const [
        propertyName,
        propertyEntry
      ] of effectiveProperties) {
        const value = data[propertyName];

        if (value === undefined || value === null) {
          continue;
        }

        Projection.projectInstanceProperty({
          'baseArgumentList': argumentList,
          instIri,
          'nodeId': node.id,
          propertyEntry,
          propertyName
        });
      }

      return instIri;
    } finally {
      visited.delete(data);
    }
  }

  private static projectInstanceProperty(argumentList: ProjectInstancePropertyArgumentListInterface): void {
    const {
      baseArgumentList, instIri, nodeId, propertyEntry, propertyName
    } = argumentList;
    const {
      annotationEmitMode, curie, data, depth, graphTerm, lookupGraph, minter, path, predicateResolver, quadOptions, quads, visited
    } = baseArgumentList;
    const propertyPath = `${path}/${propertyName}`;
    const propertyValue = data[propertyName];
    const propertyNode = propertyEntry.node;
    const propertyGraph = propertyEntry.graph;
    const annotatedEdge = PropertyProjection.findAnnotatedEdge(propertyGraph, propertyNode);

    if (annotatedEdge !== undefined) {
      Projection.projectAnnotatedEdge({
        annotationEmitMode,
        curie,
        depth,
        'edge': annotatedEdge,
        graphTerm,
        'instanceIri': instIri,
        minter,
        'path': propertyPath,
        predicateResolver,
        quadOptions,
        quads,
        'sourceId': nodeId,
        'value': propertyValue
      });

      return;
    }

    const propertyIri = predicateResolver({
      'classId': nodeId,
      propertyName,
      'propertySchema': propertyNode.schema
    });
    const directlyResolved = Projection.resolveNode(propertyGraph, propertyNode, lookupGraph);
    // Follow a transparent wrapper — `anyOf`/`oneOf [{ $ref: X }, null]` or
    // `allOf [{ $ref: X }]` — to the referenced target so the leaf datatype
    // (e.g. xsd:dateTime) and the nested node's rdf:type (the class $id, not a
    // `#/properties/<prop>` shape IRI) come from the referenced schema.
    const resolved = Projection.unwrapSingleReference(directlyResolved.graph, directlyResolved.node, lookupGraph);

    Projection.projectPropertyValue({
      annotationEmitMode,
      curie,
      'depth': depth + 1,
      'graph': resolved.graph,
      graphTerm,
      'instanceIri': instIri,
      lookupGraph,
      minter,
      'path': propertyPath,
      predicateResolver,
      propertyIri,
      'propertyNode': resolved.node,
      'propertySemantics': resolved.graph.semantics(resolved.node),
      quadOptions,
      quads,
      'value': propertyValue,
      visited
    });
  }

  private static projectNumberValue(value: number, context: ProjectScalarValueArgumentListInterface): void {
    const {
      instanceIri, path, propertyIri, propertyNode, propertySemantics, quadOptions, quads
    } = context;

    // Reject non-finite values: NaN/Infinity are not valid RDF/XSD literals
    // (e.g. "NaN"^^xsd:decimal is invalid in XSD). Throw early so the caller
    // receives a clear MaterializationError instead of an invalid quad stream.
    if (!Number.isFinite(value)) {
      throw new MaterializationError(
        propertyNode.id,
        {
          'code': MATERIALIZATION_ERROR_CODE.NON_FINITE_NUMBER,
          'message': `Non-finite numeric value (${String(value)}) at ${path} cannot be serialized as an RDF literal. Supply a finite number.`,
          'validationErrors': [`non-finite numeric value at ${path}`]
        }
      );
    }

    // Derive datatype from the DECLARED schema type (canonical-graph mandate)
    // so ABox matches TBox/SHACL; fall back to runtime inference only when no
    // numeric type is declared (e.g. freeform / untyped value).
    const datatype = Projection.numericDatatype(value, propertySemantics.schemaTypes, propertySemantics.format);

    quads.push(QuadFactory.quad(instanceIri, propertyIri, QuadFactory.literal(value, datatype), quadOptions));
  }

  private static projectObjectValue(argumentList: ProjectPropertyArgumentListInterface, path: string, value: Record<string, unknown>): void {
    const {
      annotationEmitMode, curie, depth, graph, graphTerm, instanceIri, lookupGraph, minter,
      predicateResolver, propertyIri, propertyNode, propertySemantics, quadOptions, quads, visited
    } = argumentList;

    let targetGraph = graph;
    let targetNode = propertyNode;

    if (propertySemantics.itemsNode !== undefined) {
      const resolvedItems = Projection.resolveNode(graph, propertySemantics.itemsNode, lookupGraph);

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

    const nestedIri = Projection.projectInstance({
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
      quadOptions,
      quads,
      visited
    });

    quads.push(QuadFactory.quad(instanceIri, propertyIri, QuadFactory.iri(nestedIri), quadOptions));
  }

  private static projectPropertyValue(argumentList: ProjectPropertyArgumentListInterface): void {
    const {
      path, value
    } = argumentList;

    if (Array.isArray(value)) {
      const elements = value as readonly unknown[];

      for (const [
        index,
        element
      ] of elements.entries()) {
        Projection.projectSingleValue(argumentList, `${path}/${index}`, element);
      }

      return;
    }

    Projection.projectSingleValue(argumentList, path, value);
  }

  private static projectSingleValue(argumentList: ProjectPropertyArgumentListInterface, path: string, value: unknown): void {
    const {
      instanceIri, propertyIri, propertyNode, propertySemantics, quadOptions, quads
    } = argumentList;

    if (value === null || value === undefined) {
      return;
    }

    const scalarContext: ProjectScalarValueArgumentListInterface = {
      instanceIri,
      path,
      propertyIri,
      propertyNode,
      propertySemantics,
      quadOptions,
      quads
    };

    if (typeof value === 'string') {
      Projection.projectStringValue(value, scalarContext);

      return;
    }

    if (typeof value === 'number') {
      Projection.projectNumberValue(value, scalarContext);

      return;
    }

    if (typeof value === 'boolean') {
      // boolean has no XSD format variants — emit XSD.boolean directly.
      quads.push(QuadFactory.quad(instanceIri, propertyIri, QuadFactory.literal(value, XSD.boolean), quadOptions));

      return;
    }

    if (DataType.isRecord(value)) {
      Projection.projectObjectValue(argumentList, path, value);
    }
  }

  private static projectStringValue(value: string, context: ProjectScalarValueArgumentListInterface): void {
    const {
      instanceIri, path, propertyIri, propertyNode, propertySemantics, quadOptions, quads
    } = context;

    if (propertySemantics.iriRef) {
      // Validate that the runtime value is a syntactically safe absolute IRI
      // before emitting it as a NamedNode. Reject control characters, spaces,
      // and dangerous schemes (e.g. `javascript:`) to prevent taint propagation
      // into the quad stream.
      if (!Projection.isAbsoluteIri(value)) {
        throw new MaterializationError(
          propertyNode.id,
          {
            'code': MATERIALIZATION_ERROR_CODE.INVALID_IRI_VALUE,
            'message': `Property ${propertyIri} (x-jt-iriRef) received an invalid IRI: "${value}". Expected an absolute IRI with an allowed scheme (http/https/urn/ftp/file) and no control characters or spaces.`,
            'validationErrors': [`invalid IRI value at ${path}: ${value}`]
          }
        );
      }
      quads.push(QuadFactory.quad(instanceIri, propertyIri, QuadFactory.iri(value), quadOptions));

      return;
    }

    if (propertySemantics.language !== undefined && propertySemantics.language !== '') {
      const langLiteral = QuadFactory.literal(value, XSD.string, { 'language': propertySemantics.language });

      quads.push(QuadFactory.quad(instanceIri, propertyIri, langLiteral, quadOptions));

      return;
    }

    const xsdDatatype = XsdTypes.resolveSingle(
      'string',
      propertySemantics.format === undefined ? undefined : { 'format': propertySemantics.format }
    ) ?? XSD.string;

    quads.push(QuadFactory.quad(instanceIri, propertyIri, QuadFactory.literal(value, xsdDatatype), quadOptions));
  }

  /**
   * Resolve the target term IRI for an annotated edge value.
   *
   * The value may be:
   * - a string IRI (`{ target: '...rockruff' }`),
   * - an object carrying an `@id` / `id` IRI, or
   * - a nested instance object — minted via the IRI minter.
   *
   * @remarks
   * Its `target['@id']`-style dynamic key access must not nest inside an
   * enclosing object literal (breaks V8 hidden classes) — a plain static
   * method on the class body has no such ancestor.
   */
  private static resolveEdgeTargetIri(argumentList: ResolveEdgeTargetIriArgumentsInterface): string {
    const {
      depth, edge, minter, path, target
    } = argumentList;

    if (typeof target === 'string') {
      return target;
    }

    if (DataType.isRecord(target)) {
      const idValue = target['@id'] ?? target.id;

      if (typeof idValue === 'string') {
        return idValue;
      }

      return minter.mint(edge.edgeTarget, target, `${path}/target`, depth + 1);
    }

    return String(target);
  }

  private static resolveNode(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    lookupGraph?: ((schemaId: string) => SchemaGraphInterface | undefined)
  ): ReferenceTargetInterface {
    const nodeSemantics = graph.semantics(node);

    if (nodeSemantics.ref === undefined) {
      return {
        graph,
        node
      };
    }

    return ReferenceResolution.resolve(
      nodeSemantics.ref,
      graph,
      lookupGraph === undefined ? {} : { 'lookupGraph': lookupGraph }
    );
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
  private static unwrapSingleReference(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeInterface,
    lookupGraph?: ((schemaId: string) => SchemaGraphInterface | undefined)
  ): ReferenceTargetInterface {
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
      const meaningful = union.filter((member: SchemaGraphNodeInterface): boolean => {
        return !Projection.isNullTypeNode(graph, member);
      });

      if (meaningful.length === 1) {
        const member = meaningful[0];

        if (member !== undefined && graph.semantics(member).ref !== undefined) {
          return Projection.resolveNode(graph, member, lookupGraph);
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
        return Projection.resolveNode(graph, member, lookupGraph);
      }
    }

    return {
      graph,
      node
    };
  }
}
