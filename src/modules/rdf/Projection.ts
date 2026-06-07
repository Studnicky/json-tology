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

import type { CurieInterface } from '../../interfaces/Curie.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type {
  SchemaGraphNodeInterface,
  SchemaGraphRelationInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../../types/Quad.js';
import type { IriMinterInterface } from '../../interfaces/Projection.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import type { SkolemizeFnType } from '../../types/Skolemize.js';
import type { SpecialHandlerFn } from '../../types/SpecialHandlerFn.js';
import type { AnnotatedEdgeStructure } from '../../types/AnnotatedEdgeStructure.js';
import type {
  ProjectInstanceArgs, ProjectPropertyArgs
} from '../../interfaces/Projection.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import type { QuadFactoryQuadOptsInterface } from '../../interfaces/QuadFactoryOpts.js';
import { Terms } from './Terms.js';

import {
  JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import {
  IRI_PREDICATES, SIMPLE_LITERAL_PREDICATES
} from '../../constants/ONTOLOGY_PREDICATES.js';
import { JSONLD } from '../../constants/JSONLD.js';
import { XsdTypes } from './XsdTypes.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import {
  hasCycle, isRecord
} from '../data/DataTypes.js';
import { PredicateResolver } from '../graph/PredicateResolver.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { Hash } from '../hash/Hash.js';
import { Lists } from './Lists.js';
import { QuadFactory } from './QuadFactory.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';

// ---------------------------------------------------------------------------
// TBox projection — purely relation-driven
// ---------------------------------------------------------------------------

/**
 * Projects SchemaGraph relations into RDF quads and JSON-LD nodes.
 *
 * @remarks
 * TBox projection (`graph`) is purely relation-driven: iterates `graph.allRelations()` and
 * maps each relation to one or more quads. ABox projection (`abox`) reads `graph.semantics()`
 * for property enumeration because it maps validated instance data to quads, not schema structure.
 *
 * @example
 * ```ts
 * const tboxQuads = Projection.graph(graph, { curie });
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
    options?: { 'curie'?: CurieInterface | undefined;
      'entryNode'?: SchemaGraphNodeInterface | undefined;
      'graphIRI'?: string | undefined;
      'iriFor'?: SkolemizeFnType | undefined;
      'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
      'predicateResolver'?: PredicateResolverFnType | undefined }
  ): QuadInterface[] {
    return projectAbox({
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
  },

  graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const issuer = new IdentifierIssuer();
    const quads: QuadInterface[] = [];

    const allRelations = graph.allRelations();

    for (const relation of allRelations) {
      projectRelation({
        curie,
        issuer,
        quads,
        relation
      });
    }

    return quads;
  },

  toJsonLdNodes(quads: QuadInterface[]): Array<Record<string, unknown>> {
    return quadsToJsonLdNodes(quads);
  }
} as const;

// ---------------------------------------------------------------------------
// Special predicate handlers (non-trivial emit logic)
// ---------------------------------------------------------------------------

function handleDependentRequired(
  subject: string,
  _predicate: string,
  _targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  _issuer: IdentifierIssuerInterface
): void {
  const metadata = relation.metadata ?? {};
  const trigger = typeof metadata.trigger === 'string' ? metadata.trigger : '';
  const required = Array.isArray(metadata.required) ? metadata.required as string[] : [];

  quads.push(QuadFactory.quad(subject, JT.dependentRequired, QuadFactory.literal(
    JSON.stringify({
      required,
      trigger
    }),
    XSD.string
  ), { curie }));
}

function handleRestriction(
  subject: string,
  _predicate: string,
  _targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer: IdentifierIssuerInterface
): void {
  const rBnode = QuadFactory.nextBnode(issuer);
  const metadata = relation.metadata ?? {};
  const onProperty = typeof metadata.onProperty === 'string' ? metadata.onProperty : '';
  const minCard = typeof metadata.minCardinality === 'number' ? metadata.minCardinality : 1;

  quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  quads.push(QuadFactory.quad(rBnode, RDF.type, QuadFactory.iri(OWL.Restriction), { curie }));
  quads.push(QuadFactory.quad(rBnode, OWL.onProperty, QuadFactory.iri(onProperty), { curie }));
  const minCardLit = QuadFactory.literal(minCard, XSD.nonNegativeInteger);

  quads.push(QuadFactory.quad(rBnode, OWL.minCardinality, minCardLit, { curie }));
}

function handlePattern(
  subject: string,
  predicate: string,
  targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  _issuer: IdentifierIssuerInterface
): void {
  if (relation.metadata?.patternProperty === true && typeof relation.metadata.pattern === 'string') {
    const patternLit = QuadFactory.literal(relation.metadata.pattern, XSD.string);

    quads.push(QuadFactory.quad(subject, SH.pattern, patternLit, { curie }));
  } else {
    const targetLit = QuadFactory.literal(targetId, XSD.string);

    quads.push(QuadFactory.quad(subject, predicate, targetLit, { curie }));
  }
}

const SPECIAL_HANDLERS = new Map<string, SpecialHandlerFn>([
  [
    JT.dependentRequired,
    handleDependentRequired
  ],
  [
    OWL.Restriction,
    handleRestriction
  ],
  [
    SH.pattern,
    handlePattern
  ]
]);

// ---------------------------------------------------------------------------
// Relation → quad mapping
// ---------------------------------------------------------------------------

interface ProjectRelationArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'issuer': IdentifierIssuerInterface;
  readonly 'quads': QuadInterface[];
  readonly 'relation': SchemaGraphRelationInterface;
}

function projectRelation(args: ProjectRelationArgs): void {
  const {
    curie, issuer, quads, relation
  } = args;

  if (relation.structure !== undefined) {
    projectStructuredRelation({
      curie,
      issuer,
      quads,
      relation
    });

    return;
  }

  const subject = relation.source.id;
  const predicate = relation.predicate;
  const targetId = typeof relation.target === 'string' ? relation.target : relation.target.id;

  const special = SPECIAL_HANDLERS.get(predicate);

  if (special !== undefined) {
    special(subject, predicate, targetId, relation, quads, curie, issuer);

    return;
  }

  if (IRI_PREDICATES.has(predicate)) {
    quads.push(QuadFactory.quad(subject, predicate, QuadFactory.iri(targetId), { curie }));

    return;
  }

  const literalEntry = SIMPLE_LITERAL_PREDICATES.get(predicate);

  if (literalEntry !== undefined) {
    const value = literalEntry.coerce === undefined ? targetId : literalEntry.coerce(targetId);

    quads.push(QuadFactory.quad(subject, predicate, QuadFactory.literal(value, literalEntry.datatype), { curie }));
  }
}

function projectStructuredRelation(args: ProjectRelationArgs): void {
  const {
    curie, issuer, quads, relation
  } = args;
  const subject = relation.source.id;
  const structure = relation.structure;

  if (structure === undefined) {
    return;
  }

  switch (structure.kind) {
    case 'annotatedEdge':
      // Annotated edges are ABox triple-term emissions, projected separately via
      // findAnnotatedEdgeStructure/projectAnnotatedEdge — not a TBox structure here.
      break;
    case 'conditional': {
      const condBnode = QuadFactory.nextBnode(issuer);

      quads.push(QuadFactory.quad(subject, OWL.unionOf, QuadFactory.bnode(condBnode), { curie }));
      quads.push(QuadFactory.quad(condBnode, RDF.type, QuadFactory.iri(OWL.Class), { curie }));
      quads.push(QuadFactory.quad(condBnode, JT.if, QuadFactory.iri(structure.ifRef), { curie }));
      if (structure.thenRef !== undefined) {
        quads.push(QuadFactory.quad(condBnode, JT.thenBranch, QuadFactory.iri(structure.thenRef), { curie }));
      }
      if (structure.elseRef !== undefined) {
        quads.push(QuadFactory.quad(condBnode, JT.else, QuadFactory.iri(structure.elseRef), { curie }));
      }
      break;
    }
    case 'list': {
      const items = structure.members.map((member: string): ReturnType<typeof QuadFactory.iri> => {
        return QuadFactory.iri(member);
      });
      const list = Lists.build(items, issuer);

      quads.push(QuadFactory.quad(subject, relation.predicate, list.head, { curie }));
      quads.push(...list.triples);
      break;
    }
    case 'restriction': {
      const restrictionBnode = QuadFactory.nextBnode(issuer);
      const onPropertyIri = QuadFactory.iri(structure.onProperty);
      const constraintIri = QuadFactory.iri(String(structure.value));
      const constraintPredicate = String(structure.constraint);

      quads.push(QuadFactory.quad(subject, relation.predicate, QuadFactory.bnode(restrictionBnode), { curie }));
      quads.push(QuadFactory.quad(restrictionBnode, RDF.type, QuadFactory.iri(OWL.Restriction), { curie }));
      quads.push(QuadFactory.quad(restrictionBnode, OWL.onProperty, onPropertyIri, { curie }));
      quads.push(QuadFactory.quad(restrictionBnode, constraintPredicate, constraintIri, { curie }));
      break;
    }
  }
}

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

interface ProjectAboxArgs {
  readonly 'baseIRI': string;
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'data': unknown;
  readonly 'entryNode'?: SchemaGraphNodeInterface | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
  readonly 'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
}

function projectAbox(args: ProjectAboxArgs): QuadInterface[] {
  const {
    baseIRI, curie, data, entryNode, graph, graphIRI, iriFor, lookupGraph, predicateResolver
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
      ['cyclic data detected at root'],
      {
        'code': 'CYCLIC_DATA',
        'message': `Cyclic data detected during projection of ${resolved.node.id}`
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
  node: SchemaGraphNodeInterface,
  lookupGraph?: ((schemaId: string) => SchemaGraphInterface | undefined)
): ResolvedNodeInterface {
  const nodeSemantics = graph.semantics(node);

  if (nodeSemantics.ref === undefined) {
    return {
      graph,
      node
    };
  }
  if (nodeSemantics.ref.startsWith('#')) {
    const fragment = nodeSemantics.ref.slice(1);

    return {
      graph,
      'node': graph.resolveFragment(fragment)
    };
  }

  const refId = graph.resolveRefId(nodeSemantics.ref);

  if (lookupGraph !== undefined) {
    const targetGraph = lookupGraph(refId);

    if (targetGraph !== undefined) {
      return {
        'graph': targetGraph,
        'node': targetGraph.rootNode
      };
    }
  }

  // Embedded `$defs` `$id`: a $ref whose target is an embedded `$id` declared
  // inside this same graph's `$defs` is not a separately-registered schema, so
  // lookupGraph cannot find it. Resolve it within the current graph by matching
  // the node whose id equals the ref. Without this, ABox projection of such a
  // ref leaves the node unresolved (its `$ref` never followed), which surfaces
  // downstream as REF_UNRESOLVED.
  const embedded = findNodeById(graph, refId);

  if (embedded !== undefined) {
    return {
      graph,
      'node': embedded
    };
  }

  return {
    graph,
    node
  };
}

/**
 * Find a node within `graph` whose `id` matches `id`, if any. Used to resolve a
 * `$ref` that targets an embedded `$defs` `$id` declared in the same graph
 * (rather than a separately-registered schema).
 */
function findNodeById(
  graph: SchemaGraphInterface,
  id: string
): SchemaGraphNodeInterface | undefined {
  for (const candidate of graph.nodes()) {
    if (candidate.id === id) {
      return candidate;
    }
  }

  return undefined;
}

interface ResolvedNodeInterface {
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}

/**
 * Test whether a member node is a bare `{ "type": "null" }` schema (the typical
 * nullable union sentinel) so it can be ignored when looking for the single
 * meaningful `$ref` member of an `anyOf`/`oneOf` wrapper.
 */
function isNullTypeNode(graph: SchemaGraphInterface, node: SchemaGraphNodeInterface): boolean {
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
  node: SchemaGraphNodeInterface,
  lookupGraph?: ((schemaId: string) => SchemaGraphInterface | undefined)
): ResolvedNodeInterface {
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
      return !isNullTypeNode(graph, member);
    });

    if (meaningful.length === 1) {
      const member = meaningful[0];

      if (graph.semantics(member).ref !== undefined) {
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

    if (graph.semantics(member).ref !== undefined) {
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
// node-identity-stable for a given (node, lookupGraph) pair, so memoizing it
// avoids re-walking allOf/then/else chains on every projected instance. The
// inner Map is keyed by the lookupGraph closure (or a sentinel for the
// no-lookupGraph case) because cross-graph resolution depends on which registry
// the closure consults — caching across distinct closures would be unsafe.
type LookupGraphFn = (schemaId: string) => SchemaGraphInterface | undefined;

const NO_LOOKUP_GRAPH = Symbol('no-lookup-graph');
const collectProjectionPropertiesCache = new WeakMap<
  SchemaGraphNodeInterface,
  Map<LookupGraphFn | typeof NO_LOOKUP_GRAPH, Map<string, ResolvedNodeInterface>>
>();

interface WalkProjectionPropertiesArgs {
  readonly 'collected': Map<string, ResolvedNodeInterface>;
  readonly 'current': SchemaGraphNodeInterface;
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'lookupGraph': LookupGraphFn | undefined;
  readonly 'visited': Set<SchemaGraphNodeInterface>;
}

/**
 * Recursively walk `current` collecting all effective properties into `collected`,
 * following `allOf`, `then`, and `else` members.
 */
function walkProjectionProperties(args: WalkProjectionPropertiesArgs): void {
  const {
    collected, current, currentGraph, lookupGraph, visited
  } = args;

  if (visited.has(current)) {
    return;
  }
  visited.add(current);

  const resolved = resolveNode(currentGraph, current, lookupGraph);

  // A $ref hop lands on resolved.node; mark it visited too so a later sibling
  // edge that resolves to the same node does not re-walk its members.
  visited.add(resolved.node);
  const semantics = resolved.graph.semantics(resolved.node);

  for (const [
    name,
    propNode
  ] of semantics.properties) {
    if (!collected.has(name)) {
      collected.set(name, {
        'graph': resolved.graph,
        'node': propNode
      });
    }
  }

  // Shared sub-args builder for recursive steps — same graph, lookup, collected, visited.
  const step = (node: SchemaGraphNodeInterface): void => {
    walkProjectionProperties({
      collected,
      'current': node,
      'currentGraph': resolved.graph,
      lookupGraph,
      visited
    });
  };

  for (const member of semantics.allOf) {
    step(member);
  }

  // if/then/else conditional-branch properties (e.g. EBook requires
  // epubVersion when fileFormat === 'epub') are real properties of the
  // instance. Walk both branches: projection only emits a property when its
  // value is actually present in `data`, so including the inactive branch's
  // keys here cannot fabricate quads — it only ensures the active branch's
  // value is projected (and thus survives the fromQuads round-trip).
  if (semantics.thenNode !== undefined) {
    step(semantics.thenNode);
  }
  if (semantics.elseNode !== undefined) {
    step(semantics.elseNode);
  }
}

function collectProjectionProperties(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface,
  lookupGraph?: LookupGraphFn
): Map<string, ResolvedNodeInterface> {
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

  const collected = new Map<string, ResolvedNodeInterface>();
  const visited = new Set<SchemaGraphNodeInterface>();

  walkProjectionProperties({
    collected,
    'current': node,
    'currentGraph': graph,
    lookupGraph,
    visited
  });
  byLookup.set(cacheKey, collected);

  return collected;
}

interface ProjectInstancePropertyArgs {
  readonly 'baseArgs': ProjectInstanceArgs;
  readonly 'instIRI': string;
  readonly 'nodeId': string;
  readonly 'propertyEntry': ResolvedNodeInterface;
  readonly 'propertyName': string;
}

function projectInstanceProperty(args: ProjectInstancePropertyArgs): void {
  const {
    baseArgs, instIRI, nodeId, propertyEntry, propertyName
  } = args;
  const {
    curie, data, depth, graphTerm, lookupGraph, minter, path, predicateResolver, quadOpts, quads, visited
  } = baseArgs;
  const propertyPath = `${path}/${propertyName}`;
  const propertyValue = data[propertyName];
  const propertyNode = propertyEntry.node;
  const propertyGraph = propertyEntry.graph;
  const annotatedEdge = findAnnotatedEdgeStructure(propertyGraph, propertyNode);

  if (annotatedEdge !== undefined) {
    projectAnnotatedEdge({
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

function projectInstance(args: ProjectInstanceArgs): string {
  const {
    data, depth, graph, lookupGraph, minter, node, path, quadOpts, quads, visited
  } = args;

  if (visited.has(data)) {
    throw new MaterializationError(
      node.id,
      [`cyclic data detected at ${path === '' ? 'root' : path}`],
      {
        'code': 'CYCLIC_DATA',
        'message': `Cyclic data detected during projection of ${node.id} at ${path === '' ? 'root' : path}`
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

interface ProjectAnnotatedEdgeArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'graphTerm': DefaultGraphTermType | IriTermType;
  readonly 'instanceIri': string;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsInterface;
  readonly 'quads': QuadInterface[];
  readonly 'sourceId': string;
  readonly 'value': unknown;
}

/**
 * Find the `annotatedEdge` structure relation attached to a property node, if any.
 */
function findAnnotatedEdgeStructure(
  graph: SchemaGraphInterface,
  propertyNode: SchemaGraphNodeInterface
): AnnotatedEdgeStructure | undefined {
  for (const relation of graph.relations(propertyNode)) {
    if (relation.structure?.kind === 'annotatedEdge') {
      return relation.structure;
    }
  }

  return undefined;
}

/**
 * Resolve the target term IRI for an annotated edge value.
 *
 * The value may be:
 * - a string IRI (`{ target: '...rockruff' }`),
 * - an object carrying an `@id` / `id` IRI, or
 * - a nested instance object — minted via the IRI minter.
 */
interface ResolveEdgeTargetIriArgs {
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'target': unknown;
}

function resolveEdgeTargetIri(args: ResolveEdgeTargetIriArgs): string {
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
  if (typeof value === 'string' && isIriReference(value) && isClassRange(rangeRef)) {
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

function isIriReference(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:');
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
  return isIriReference(rangeRef);
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
interface EmitAnnotationQuadsArgs {
  readonly 'annotationValues': Record<string, unknown>;
  readonly 'classId': string;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsInterface;
  readonly 'quads': QuadInterface[];
  readonly 'tripleTerm': ReturnType<typeof QuadFactory.tripleTerm>;
}

/** Emit one annotation quad per annotation on the edge. */
function emitAnnotationQuads(args: EmitAnnotationQuadsArgs): void {
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

function projectAnnotatedEdge(args: ProjectAnnotatedEdgeArgs): void {
  const {
    curie, depth, edge, graphTerm, instanceIri, minter, path, predicateResolver, quadOpts, quads, sourceId, value
  } = args;

  if (graphTerm.termType === 'DefaultGraph') {
    throw new MaterializationError(
      sourceId,
      [`annotated edge ${edge.edgePredicate} requires an explicit graphIRI`],
      {
        'code': 'MISSING_GRAPH_IRI',
        'message': `Annotated edge ${edge.edgePredicate} at ${path} requires a graphIRI: a triple term carries no graph membership, so the base triple and its annotations must share one named graph. Pass { graphIRI } to toQuads.`
      }
    );
  }

  if (!isRecord(value)) {
    throw new MaterializationError(
      sourceId,
      [`annotated edge ${edge.edgePredicate} value must be an object with target + annotations`],
      {
        'code': 'MATERIALIZATION_FAILED',
        'message': `Annotated edge ${edge.edgePredicate} at ${path} expects { target, annotations }, received ${typeof value}.`
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

  // The triple term `<< s edgePredicate o >>` is loop-invariant across all
  // annotations on this edge — build it once above the loop.
  const tripleTerm = QuadFactory.tripleTerm(instanceIri, edge.edgePredicate, objectTerm, { curie });

  emitAnnotationQuads({
    'annotationValues': isRecord(value.annotations) ? value.annotations : {},
    'classId': sourceId,
    edge,
    predicateResolver,
    quadOpts,
    quads,
    tripleTerm
  });
}

function projectPropertyValue(args: ProjectPropertyArgs): void {
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

interface ProjectScalarValueArgs {
  readonly 'instanceIri': string;
  readonly 'path': string;
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeInterface;
  readonly 'propertySemantics': ProjectPropertyArgs['propertySemantics'];
  readonly 'quadOpts': QuadFactoryQuadOptsInterface;
  readonly 'quads': QuadInterface[];
}

function projectStringValue(value: string, ctx: ProjectScalarValueArgs): void {
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
        [`invalid IRI value at ${path}: ${value}`],
        {
          'code': 'INVALID_IRI_VALUE',
          'message': `Property ${propertyIRI} (x-jt-iriRef) received an invalid IRI: "${value}". Expected an absolute IRI with an allowed scheme (http/https/urn/ftp/file) and no control characters or spaces.`
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

function projectNumberValue(value: number, ctx: ProjectScalarValueArgs): void {
  const {
    instanceIri, path, propertyIRI, propertyNode, propertySemantics, quadOpts, quads
  } = ctx;

  // Reject non-finite values: NaN/Infinity are not valid RDF/XSD literals
  // (e.g. "NaN"^^xsd:decimal is invalid in XSD). Throw early so the caller
  // receives a clear MaterializationError instead of an invalid quad stream.
  if (!Number.isFinite(value)) {
    throw new MaterializationError(
      propertyNode.id,
      [`non-finite numeric value at ${path}`],
      {
        'code': 'NON_FINITE_NUMBER',
        'message': `Non-finite numeric value (${String(value)}) at ${path} cannot be serialized as an RDF literal. Supply a finite number.`
      }
    );
  }

  // Derive datatype from the DECLARED schema type (canonical-graph mandate)
  // so ABox matches TBox/SHACL; fall back to runtime inference only when no
  // numeric type is declared (e.g. freeform / untyped value).
  const datatype = numericDatatype(value, propertySemantics.schemaTypes, propertySemantics.format);

  quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, datatype), quadOpts));
}

function projectObjectValue(args: ProjectPropertyArgs, path: string, value: Record<string, unknown>): void {
  const {
    curie, depth, graph, graphTerm, instanceIri, lookupGraph, minter,
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

function projectSingleValue(args: ProjectPropertyArgs, path: string, value: unknown): void {
  const {
    instanceIri, propertyIRI, propertyNode, propertySemantics, quadOpts, quads
  } = args;

  if (value === null || value === undefined) {
    return;
  }

  const scalarCtx: ProjectScalarValueArgs = {
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

// ---------------------------------------------------------------------------
// Quad → JSON-LD node conversion
// ---------------------------------------------------------------------------

function quadsToJsonLdNodes(quads: QuadInterface[]): Array<Record<string, unknown>> {
  const subjects = new Map<string, Record<string, unknown>>();

  for (const entry of quads) {
    const subjectValue = entry.subject.value;
    let node = subjects.get(subjectValue);

    if (!node) {
      node = { [JSONLD.id]: subjectValue };
      subjects.set(subjectValue, node);
    }

    const narrowed = Lists.asQuadObject(entry.object);

    if (narrowed === undefined) {
      continue;
    }
    const value = quadObjectToJsonLd(narrowed);
    const predicateValue = entry.predicate.value;

    if (predicateValue === RDF.type) {
      node[JSONLD.type] = value;
    } else if (node[predicateValue] === undefined) {
      node[predicateValue] = value;
    } else {
      if (Array.isArray(node[predicateValue])) {
        (node[predicateValue] as unknown[]).push(value);
      } else {
        node[predicateValue] = [
          node[predicateValue],
          value
        ];
      }
    }
  }

  return [...subjects.values()];
}

function quadObjectToJsonLd(quadObject: QuadObjectType): unknown {
  if (quadObject.termType === 'BlankNode' || quadObject.termType === 'NamedNode') {
    return { [JSONLD.id]: quadObject.value };
  }

  return quadObject.value;
}
