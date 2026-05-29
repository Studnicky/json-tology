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
import type { RelationStructure } from '../../types/SchemaGraph.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../../types/Quad.js';
import type { IriMinterInterface } from '../../interfaces/Projection.js';
import type { SkolemizeFnType } from '../../types/Skolemize.js';
import type { SpecialHandlerFn } from '../../types/SpecialHandlerFn.js';
import type {
  ProjectInstanceArgs, ProjectPropertyArgs
} from '../../interfaces/Projection.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
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
import { SchemaIri } from '../graph/SchemaIri.js';
import { Hash } from '../hash/Hash.js';
import { Lists } from './Lists.js';
import { QuadFactory } from './QuadFactory.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';

// ---------------------------------------------------------------------------
// TBox projection — purely relation-driven
// ---------------------------------------------------------------------------

export const Projection = {
  abox(
    graph: SchemaGraphInterface,
    data: unknown,
    baseIRI: string,
    options?: { 'curie'?: CurieInterface | undefined;
      'entryNode'?: SchemaGraphNodeInterface | undefined;
      'graphIRI'?: string | undefined;
      'iriFor'?: SkolemizeFnType | undefined;
      'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined }
  ): QuadInterface[] {
    return projectAbox(graph, data, baseIRI, options);
  },

  graph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined }): QuadInterface[] {
    const { curie } = options ?? {};
    const issuer = new IdentifierIssuer();
    const quads: QuadInterface[] = [];

    const allRelations = graph.allRelations();

    for (const relation of allRelations) {
      projectRelation(relation, quads, curie, issuer);
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

function projectRelation(
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer: IdentifierIssuerInterface
): void {
  if (relation.structure !== undefined) {
    projectStructuredRelation(relation, quads, curie, issuer);

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

function projectStructuredRelation(
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer: IdentifierIssuerInterface
): void {
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
      const items = structure.members.map((member) => {
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

function projectAbox(
  graph: SchemaGraphInterface,
  data: unknown,
  baseIRI: string,
  options?: { 'curie'?: CurieInterface | undefined;
    'entryNode'?: SchemaGraphNodeInterface | undefined;
    'graphIRI'?: string | undefined;
    'iriFor'?: SkolemizeFnType | undefined;
    'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined }
): QuadInterface[] {
  const {
    curie, entryNode, graphIRI, iriFor, lookupGraph
  } = options ?? {};

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

  if (lookupGraph !== undefined) {
    const refId = graph.resolveRefId(nodeSemantics.ref);
    const targetGraph = lookupGraph(refId);

    if (targetGraph !== undefined) {
      return {
        'graph': targetGraph,
        'node': targetGraph.rootNode
      };
    }
  }

  return {
    graph,
    node
  };
}

interface ResolvedNodeInterface {
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}

function projectInstance(args: ProjectInstanceArgs): string {
  const {
    curie, data, depth, graph, graphTerm, lookupGraph, minter, node, path, quadOpts, quads, visited
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
    const nodeSemantics = graph.semantics(node);

    quads.push(QuadFactory.quad(instIRI, RDF.type, QuadFactory.iri(node.id), quadOpts));

    for (const [
      propertyName,
      propertyNode
    ] of nodeSemantics.properties) {
      const value = data[propertyName];

      if (value === undefined || value === null) {
        continue;
      }

      const annotatedEdge = findAnnotatedEdgeStructure(graph, propertyNode);

      if (annotatedEdge !== undefined) {
        projectAnnotatedEdge({
          curie,
          'edge': annotatedEdge,
          graphTerm,
          'instanceIri': instIRI,
          minter,
          'path': `${path}/${propertyName}`,
          quads,
          'sourceId': node.id,
          value
        });

        continue;
      }

      const propertyIRI = `${node.id}#${propertyName}`;
      const resolved = resolveNode(graph, propertyNode, lookupGraph);
      const propertySemantics = resolved.graph.semantics(resolved.node);

      projectPropertyValue({
        curie,
        'depth': depth + 1,
        'graph': resolved.graph,
        graphTerm,
        'instanceIri': instIRI,
        lookupGraph,
        minter,
        'path': `${path}/${propertyName}`,
        propertyIRI,
        'propertyNode': resolved.node,
        propertySemantics,
        quadOpts,
        quads,
        value,
        visited
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

type AnnotatedEdgeStructure = Extract<RelationStructure, { 'kind': 'annotatedEdge' }>;

interface ProjectAnnotatedEdgeArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'graphTerm': DefaultGraphTermType | IriTermType;
  readonly 'instanceIri': string;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
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
function resolveEdgeTargetIri(
  target: unknown,
  edge: AnnotatedEdgeStructure,
  minter: IriMinterInterface,
  path: string
): string {
  if (typeof target === 'string') {
    return target;
  }

  if (isRecord(target)) {
    const idValue = target['@id'] ?? target.id;

    if (typeof idValue === 'string') {
      return idValue;
    }

    return minter.mint(edge.edgeTarget, target, `${path}/target`, 0);
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
function projectAnnotatedEdge(args: ProjectAnnotatedEdgeArgs): void {
  const {
    curie, edge, graphTerm, instanceIri, minter, path, quads, sourceId, value
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

  const targetIri = resolveEdgeTargetIri(value.target, edge, minter, path);
  const objectTerm = Terms.iri(targetIri);
  const quadOpts = {
    curie,
    'graph': graphTerm
  };

  // Base triple: s edgePredicate o
  quads.push(QuadFactory.quad(instanceIri, edge.edgePredicate, objectTerm, quadOpts));

  const annotationValues = isRecord(value.annotations) ? value.annotations : {};

  for (const annotation of edge.edgeAnnotations) {
    const annotationValue = annotationValues[annotation.propertyName];

    if (annotationValue === undefined || annotationValue === null) {
      continue;
    }

    const tripleTerm = QuadFactory.tripleTerm(instanceIri, edge.edgePredicate, objectTerm, { curie });
    const valueTerm = annotationValueTerm(annotationValue, annotation.rangeRef);

    quads.push(QuadFactory.annotationQuad(tripleTerm, annotation.annotationPredicate, valueTerm, quadOpts));
  }
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

function projectSingleValue(args: ProjectPropertyArgs, path: string, value: unknown): void {
  const {
    curie, depth, graph, graphTerm, instanceIri, lookupGraph, minter,
    propertyIRI, propertyNode, propertySemantics, quadOpts, quads, visited
  } = args;

  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    const xsdDatatype = XsdTypes.resolveSingle(
      'string',
      propertySemantics.format === undefined ? undefined : { 'format': propertySemantics.format }
    ) ?? XSD.string;

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, xsdDatatype), quadOpts));

    return;
  }

  if (typeof value === 'number') {
    const datatype = Number.isInteger(value) ? XSD.integer : XSD.double;

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, datatype), quadOpts));

    return;
  }

  if (typeof value === 'boolean') {
    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, XSD.boolean), quadOpts));

    return;
  }

  if (isRecord(value)) {
    let targetGraph = graph;
    let targetNode = propertyNode;

    if (propertySemantics.itemsNode !== undefined) {
      const resolvedItems = resolveNode(graph, propertySemantics.itemsNode, lookupGraph);

      targetGraph = resolvedItems.graph;
      targetNode = resolvedItems.node;
    }

    const targetSemantics = targetGraph.semantics(targetNode);

    if (targetSemantics.properties.size === 0 && !targetSemantics.schemaTypes.includes('object')) {
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
      quadOpts,
      quads,
      visited
    });

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.iri(nestedIRI), quadOpts));
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
