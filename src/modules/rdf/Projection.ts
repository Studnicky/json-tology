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
import type { SkolemizeFnType } from '../../types/Skolemize.js';

import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { JSONLD } from '../../constants/JSONLD.js';
import { resolveSingleXsdType } from '../../constants/XSD_MAPS.js';
import { MaterializationError } from '../../errors/MaterializationError.js';
import {
  hasCycle, isRecord
} from '../data/DataTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { Hash } from '../hash/Hash.js';
import { QuadFactory } from './QuadFactory.js';

// ---------------------------------------------------------------------------
// TBox projection — purely relation-driven
// ---------------------------------------------------------------------------

export function projectGraph(graph: SchemaGraphInterface, options?: { 'curie'?: CurieInterface | undefined }): QuadInterface[] {
  const { curie } = options ?? {};

  QuadFactory.resetBnodeCounter();
  const quads: QuadInterface[] = [];

  const allRelations = graph.allRelations();

  for (const relation of allRelations) {
    projectRelation(relation, quads, curie);
  }

  return quads;
}

// ---------------------------------------------------------------------------
// Data-driven predicate dispatch tables
// ---------------------------------------------------------------------------

interface SimplePredicateEntry {
  readonly 'coerce'?: (value: string) => unknown;
  readonly 'datatype': string;
}

const SIMPLE_LITERAL_PREDICATES = new Map<string, SimplePredicateEntry>([
  [
    DASH.readOnly,
    {
      'coerce': (value) => {
        return value === 'true';
      },
      'datatype': XSD.boolean
    }
  ],
  [
    DASH.writeOnly,
    {
      'coerce': (value) => {
        return value === 'true';
      },
      'datatype': XSD.boolean
    }
  ],
  [
    DCT.format,
    { 'datatype': XSD.string }
  ],
  [
    JT.multipleOf,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    OWL.deprecated,
    { 'datatype': XSD.boolean }
  ],
  [
    OWL.hasValue,
    { 'datatype': XSD.string }
  ],
  [
    OWL.maxQualifiedCardinality,
    {
      'coerce': Number,
      'datatype': XSD.nonNegativeInteger
    }
  ],
  [
    OWL.minQualifiedCardinality,
    {
      'coerce': Number,
      'datatype': XSD.nonNegativeInteger
    }
  ],
  [
    OWL.oneOf,
    { 'datatype': XSD.string }
  ],
  [
    RDFS.comment,
    { 'datatype': XSD.string }
  ],
  [
    RDFS.label,
    { 'datatype': XSD.string }
  ],
  [
    SH.closed,
    { 'datatype': XSD.boolean }
  ],
  [
    SH.maxCount,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.maxExclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.maxInclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.maxLength,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.minCount,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.minExclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.minInclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.minLength,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ]
]);

const IRI_PREDICATES = new Set<string>([
  OWL.complementOf,
  OWL.disjointWith,
  OWL.equivalentClass,
  OWL.inverseOf,
  OWL.someValuesFrom,
  OWL.SymmetricProperty,
  OWL.TransitiveProperty,
  OWL.unionOf,
  RDF.type,
  RDFS.domain,
  RDFS.member,
  RDFS.range,
  RDFS.subClassOf,
  SH.datatype
]);

// ---------------------------------------------------------------------------
// Special predicate handlers (non-trivial emit logic)
// ---------------------------------------------------------------------------

type SpecialHandlerFn = (
  subject: string,
  predicate: string,
  targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
) => void;

function handleDependentRequired(
  subject: string,
  _predicate: string,
  _targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const metadata = relation.metadata ?? {};
  const trigger = typeof metadata.trigger === 'string' ? metadata.trigger : '';
  const required = Array.isArray(metadata.required) ? metadata.required as string[] : [];

  quads.push(QuadFactory.quad(subject, JT.dependentRequired, QuadFactory.literal(
    JSON.stringify({
      required,
      trigger
    }),
    XSD.string,
    { curie }
  ), { curie }));
}

function handleRestriction(
  subject: string,
  _predicate: string,
  _targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const rBnode = QuadFactory.nextBnode();
  const metadata = relation.metadata ?? {};
  const onProperty = typeof metadata.onProperty === 'string' ? metadata.onProperty : '';
  const minCard = typeof metadata.minCardinality === 'number' ? metadata.minCardinality : 1;

  quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), { curie }));
  quads.push(QuadFactory.quad(rBnode, RDF.type, QuadFactory.iri(OWL.Restriction, { curie }), { curie }));
  quads.push(QuadFactory.quad(rBnode, OWL.onProperty, QuadFactory.iri(onProperty, { curie }), { curie }));
  const minCardLit = QuadFactory.literal(minCard, XSD.nonNegativeInteger, { curie });

  quads.push(QuadFactory.quad(rBnode, OWL.minCardinality, minCardLit, { curie }));
}

function handlePattern(
  subject: string,
  predicate: string,
  targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  if (relation.metadata?.patternProperty === true && typeof relation.metadata.pattern === 'string') {
    const patternLit = QuadFactory.literal(relation.metadata.pattern, XSD.string, { curie });

    quads.push(QuadFactory.quad(subject, SH.pattern, patternLit, { curie }));
  } else {
    const targetLit = QuadFactory.literal(targetId, XSD.string, { curie });

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
  curie: CurieInterface | undefined
): void {
  if (relation.structure !== undefined) {
    projectStructuredRelation(relation, quads, curie);

    return;
  }

  const subject = relation.source.id;
  const predicate = relation.predicate;
  const targetId = typeof relation.target === 'string' ? relation.target : relation.target.id;

  const special = SPECIAL_HANDLERS.get(predicate);

  if (special !== undefined) {
    special(subject, predicate, targetId, relation, quads, curie);

    return;
  }

  if (IRI_PREDICATES.has(predicate)) {
    quads.push(QuadFactory.quad(subject, predicate, QuadFactory.iri(targetId, { curie }), { curie }));

    return;
  }

  const literalEntry = SIMPLE_LITERAL_PREDICATES.get(predicate);

  if (literalEntry !== undefined) {
    const value = literalEntry.coerce === undefined ? targetId : literalEntry.coerce(targetId);

    const litObj = QuadFactory.literal(value, literalEntry.datatype, { curie });

    quads.push(QuadFactory.quad(subject, predicate, litObj, { curie }));
  }
}

function projectStructuredRelation(
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined
): void {
  const subject = relation.source.id;
  const structure = relation.structure;

  if (structure === undefined) {
    return;
  }

  switch (structure.kind) {
    case 'conditional': {
      const condBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(subject, OWL.unionOf, QuadFactory.bnode(condBnode), { curie }));
      quads.push(QuadFactory.quad(condBnode, RDF.type, QuadFactory.iri(OWL.Class, { curie }), { curie }));
      quads.push(QuadFactory.quad(condBnode, JT.if, QuadFactory.iri(structure.ifRef, { curie }), { curie }));
      if (structure.thenRef !== undefined) {
        const thenIri = QuadFactory.iri(structure.thenRef, { curie });

        quads.push(QuadFactory.quad(condBnode, JT.thenBranch, thenIri, { curie }));
      }
      if (structure.elseRef !== undefined) {
        quads.push(QuadFactory.quad(condBnode, JT.else, QuadFactory.iri(structure.elseRef, { curie }), { curie }));
      }
      break;
    }
    case 'list': {
      const items = structure.members.map((member) => {
        return QuadFactory.iri(member, { curie });
      });

      quads.push(QuadFactory.quad(subject, relation.predicate, QuadFactory.rdfList(items), { curie }));
      break;
    }
    case 'restriction': {
      const restrictionBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(subject, relation.predicate, QuadFactory.bnode(restrictionBnode), { curie }));
      quads.push(QuadFactory.quad(restrictionBnode, RDF.type, QuadFactory.iri(OWL.Restriction, { curie }), { curie }));
      const onPropIri = QuadFactory.iri(structure.onProperty, { curie });

      quads.push(QuadFactory.quad(restrictionBnode, OWL.onProperty, onPropIri, { curie }));
      const constraintVal = QuadFactory.iri(String(structure.value), { curie });

      quads.push(QuadFactory.quad(restrictionBnode, String(structure.constraint), constraintVal, { curie }));
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

interface ProjectInstanceArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'data': Record<string, unknown>;
  readonly 'depth': number;
  readonly 'graph': SchemaGraphInterface;
  readonly 'minter': IriMinter;
  readonly 'node': SchemaGraphNodeInterface;
  readonly 'path': string;
  readonly 'quads': QuadInterface[];
  readonly 'visited': WeakSet<object>;
}

interface ProjectPropertyArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'graph': SchemaGraphInterface;
  readonly 'instanceIri': string;
  readonly 'minter': IriMinter;
  readonly 'path': string;
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeInterface;
  readonly 'propertySemantics': { 'format': string | undefined;
    'itemsNode': SchemaGraphNodeInterface | undefined };
  readonly 'quads': QuadInterface[];
  readonly 'value': unknown;
  readonly 'visited': WeakSet<object>;
}

export function projectAbox(
  graph: SchemaGraphInterface,
  data: unknown,
  baseIRI: string,
  options?: { 'curie'?: CurieInterface | undefined;
    'entryNode'?: SchemaGraphNodeInterface | undefined;
    'graphIRI'?: string | undefined;
    'iriFor'?: SkolemizeFnType | undefined }
): QuadInterface[] {
  const {
    curie, entryNode, graphIRI, iriFor
  } = options ?? {};

  QuadFactory.resetBnodeCounter();
  const quads: QuadInterface[] = [];
  const rootNode = entryNode ?? graph.rootNode;
  const resolved = resolveNode(graph, rootNode);

  if (!isRecord(data)) {
    return quads;
  }

  if (hasCycle(data)) {
    throw new MaterializationError(
      resolved.id,
      ['cyclic data detected at root'],
      {
        'code': 'CYCLIC_DATA',
        'message': `Cyclic data detected during projection of ${resolved.id}`
      }
    );
  }

  const minter = new IriMinter(baseIRI, iriFor);

  projectInstance({
    curie,
    data,
    'depth': 0,
    graph,
    minter,
    'node': resolved,
    'path': '',
    quads,
    'visited': new WeakSet()
  });

  if (graphIRI !== undefined) {
    for (const quad of quads) {
      quad.graph = graphIRI;
    }
  }

  return quads;
}

function defaultInstanceIri(baseIRI: string, classId: string, data: unknown): string {
  const contentHash = Hash.value(data);

  return `${baseIRI}/instances/${SchemaIri.escapeSegment(classId)}-${contentHash}`;
}

function resolveNode(graph: SchemaGraphInterface, node: SchemaGraphNodeInterface): SchemaGraphNodeInterface {
  const nodeSemantics = graph.semantics(node);

  if (nodeSemantics.ref === undefined) {
    return node;
  }
  if (nodeSemantics.ref.startsWith('#')) {
    const fragment = nodeSemantics.ref.slice(1);

    return graph.resolveFragment(fragment);
  }

  return node;
}

function projectInstance(args: ProjectInstanceArgs): string {
  const {
    curie, data, depth, graph, minter, node, path, quads, visited
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

  const instIRI = minter.mint(node.id, data, path, depth);
  const nodeSemantics = graph.semantics(node);

  quads.push(QuadFactory.quad(instIRI, RDF.type, QuadFactory.iri(node.id, { curie }), { curie }));

  for (const [
    propertyName,
    propertyNode
  ] of nodeSemantics.properties) {
    const value = data[propertyName];

    if (value === undefined || value === null) {
      continue;
    }

    const propertyIRI = `${node.id}#${propertyName}`;
    const resolved = resolveNode(graph, propertyNode);
    const propertySemantics = graph.semantics(resolved);

    projectPropertyValue({
      curie,
      'depth': depth + 1,
      graph,
      'instanceIri': instIRI,
      minter,
      'path': `${path}/${propertyName}`,
      propertyIRI,
      'propertyNode': resolved,
      propertySemantics,
      quads,
      value,
      visited
    });
  }

  return instIRI;
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
      projectSingleValue({
        ...args,
        'path': `${path}/${index}`,
        'value': element
      });
    }

    return;
  }

  projectSingleValue(args);
}

function projectSingleValue(args: ProjectPropertyArgs): void {
  const {
    curie, depth, graph, instanceIri, minter, path,
    propertyIRI, propertyNode, propertySemantics, quads, value, visited
  } = args;

  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    const xsdDatatype = resolveSingleXsdType(
      'string',
      propertySemantics.format === undefined ? undefined : { 'format': propertySemantics.format }
    ) ?? XSD.string;

    const strLit = QuadFactory.literal(value, xsdDatatype, { curie });

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, strLit, { curie }));

    return;
  }

  if (typeof value === 'number') {
    const datatype = Number.isInteger(value) ? XSD.integer : XSD.double;

    const numLit = QuadFactory.literal(value, datatype, { curie });

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, numLit, { curie }));

    return;
  }

  if (typeof value === 'boolean') {
    const boolLit = QuadFactory.literal(value, XSD.boolean, { curie });

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, boolLit, { curie }));

    return;
  }

  if (isRecord(value)) {
    let targetNode = propertyNode;

    if (propertySemantics.itemsNode !== undefined) {
      targetNode = resolveNode(graph, propertySemantics.itemsNode);
    }

    const targetSemantics = graph.semantics(targetNode);

    if (targetSemantics.properties.size === 0 && !targetSemantics.schemaTypes.includes('object')) {
      return;
    }

    const nestedIRI = projectInstance({
      curie,
      'data': value,
      depth,
      graph,
      minter,
      'node': targetNode,
      path,
      quads,
      visited
    });

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.iri(nestedIRI, { curie }), { curie }));
  }
}

// ---------------------------------------------------------------------------
// Quad → JSON-LD node conversion
// ---------------------------------------------------------------------------

export function quadsToJsonLdNodes(quads: QuadInterface[]): Array<Record<string, unknown>> {
  const subjects = new Map<string, Record<string, unknown>>();

  for (const entry of quads) {
    let node = subjects.get(entry.subject);

    if (!node) {
      node = { [JSONLD.id]: entry.subject };
      subjects.set(entry.subject, node);
    }

    const value = quadObjectToJsonLd(entry.object);

    if (entry.predicate === RDF.type) {
      node[JSONLD.type] = value;
    } else if (node[entry.predicate] === undefined) {
      node[entry.predicate] = value;
    } else {
      if (Array.isArray(node[entry.predicate])) {
        (node[entry.predicate] as unknown[]).push(value);
      } else {
        node[entry.predicate] = [
          node[entry.predicate],
          value
        ];
      }
    }
  }

  return [...subjects.values()];
}

function quadObjectToJsonLd(quadObject: QuadObjectType): unknown {
  switch (quadObject.termType) {
    case 'BlankNode':
      return { [JSONLD.id]: quadObject.value };
    case 'List':
      return {
        [JSONLD.list]: quadObject.items.map((item) => {
          return quadObjectToJsonLd(item);
        })
      };
    case 'Literal':
      return quadObject.value;
    case 'NamedNode':
      return { [JSONLD.id]: quadObject.value };
  }

  return undefined;
}
