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

import type { QuadInterface } from '../../interfaces/quad.js';
import type { QuadObjectType } from '../../types/quad.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import type {
  SchemaGraphNodeInterface,
  SchemaGraphRelationInterface
} from '../../interfaces/schema-graph.js';
import { resolveSingleXsdType } from '../data/DataTypes.js';
import { Hash } from '../hash/Hash.js';
import { isRecord } from '../data/DataTypes.js';

// ---------------------------------------------------------------------------
// Blank node counter
// ---------------------------------------------------------------------------

let bnodeCounter = 0;

export function nextBnode(): string {
  return `_:b${bnodeCounter++}`;
}

export function resetBnodeCounter(): void {
  bnodeCounter = 0;
}

// ---------------------------------------------------------------------------
// Quad construction helpers
// ---------------------------------------------------------------------------

export function iri(value: string): QuadObjectType {
  return { 'termType': 'NamedNode', value };
}

export function literal(value: unknown, datatype: string): QuadObjectType {
  return {
    'datatype': { 'termType': 'NamedNode' as const, 'value': datatype },
    'language': '',
    'termType': 'Literal',
    value
  };
}

export function bnode(id: string): QuadObjectType {
  return { 'termType': 'BlankNode', 'value': id };
}

export function rdfList(items: QuadObjectType[]): QuadObjectType {
  return { items, 'termType': 'List' };
}

export function quad(subject: string, predicate: string, object: QuadObjectType): QuadInterface {
  return {
    object,
    predicate,
    subject
  };
}

// ---------------------------------------------------------------------------
// TBox projection — purely relation-driven
// ---------------------------------------------------------------------------

export function projectGraph(graph: SchemaGraphInterface): QuadInterface[] {
  resetBnodeCounter();
  const quads: QuadInterface[] = [];

  const allRelations = graph.allRelations();

  for (const rel of allRelations) {
    projectRelation(rel, quads);
  }

  return quads;
}

// ---------------------------------------------------------------------------
// Relation → quad mapping
// ---------------------------------------------------------------------------

function projectRelation(
  rel: SchemaGraphRelationInterface,
  quads: QuadInterface[]
): void {
  // Structured relations produce multi-quad patterns
  if (rel.structure !== undefined) {
    projectStructuredRelation(rel, quads);

    return;
  }

  const subject = rel.source.id;
  const predicate = rel.predicate;
  const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id;

  switch (predicate) {
    case 'dash:readOnly':
    case 'dash:writeOnly':
      quads.push(quad(subject, predicate, literal(targetId === 'true', 'xsd:boolean')));
      break;
    case 'dct:format':
      quads.push(quad(subject, predicate, literal(targetId, 'xsd:string')));
      break;
    case 'jt:dependentRequired': {
      const meta = rel.metadata ?? {};
      const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
      const required = Array.isArray(meta.required) ? meta.required as string[] : [];

      quads.push(quad(subject, 'jt:dependentRequired', literal(
        JSON.stringify({
          required,
          trigger
        }),
        'xsd:string'
      )));
      break;
    }
    case 'jt:multipleOf':
      quads.push(quad(subject, predicate, literal(Number(targetId), 'xsd:decimal')));
      break;
    case 'owl:deprecated':
      quads.push(quad(subject, predicate, literal(targetId, 'xsd:boolean')));
      break;
    case 'owl:hasValue':
      quads.push(quad(subject, predicate, literal(targetId, 'xsd:string')));
      break;
    case 'owl:maxQualifiedCardinality':
    case 'owl:minQualifiedCardinality':
      quads.push(quad(subject, predicate, literal(Number(targetId), 'xsd:nonNegativeInteger')));
      break;
    case 'owl:oneOf':
      quads.push(quad(subject, 'owl:oneOf', literal(targetId, 'xsd:string')));
      break;
    case 'owl:Restriction': {
      const rBnode = nextBnode();
      const meta = rel.metadata ?? {};
      const onProperty = typeof meta.onProperty === 'string' ? meta.onProperty : '';
      const minCard = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;

      quads.push(quad(subject, 'rdfs:subClassOf', bnode(rBnode)));
      quads.push(quad(rBnode, 'rdf:type', iri('owl:Restriction')));
      quads.push(quad(rBnode, 'owl:onProperty', iri(onProperty)));
      quads.push(quad(rBnode, 'owl:minCardinality', literal(minCard, 'xsd:nonNegativeInteger')));
      break;
    }
    case 'rdfs:comment':
    case 'rdfs:label':
      quads.push(quad(subject, predicate, literal(targetId, 'xsd:string')));
      break;
    case 'sh:closed':
      quads.push(quad(subject, predicate, literal(targetId, 'xsd:boolean')));
      break;
    case 'sh:datatype':
      quads.push(quad(subject, predicate, iri(targetId)));
      break;
    case 'sh:maxCount':
    case 'sh:maxLength':
    case 'sh:minCount':
    case 'sh:minLength':
      quads.push(quad(subject, predicate, literal(Number(targetId), 'xsd:integer')));
      break;
    case 'sh:maxExclusive':
    case 'sh:maxInclusive':
    case 'sh:minExclusive':
    case 'sh:minInclusive':
      quads.push(quad(subject, predicate, literal(Number(targetId), 'xsd:decimal')));
      break;
    case 'sh:pattern':
      if (rel.metadata?.patternProperty === true && typeof rel.metadata?.pattern === 'string') {
        quads.push(quad(subject, 'sh:pattern', literal(rel.metadata.pattern, 'xsd:string')));
      } else {
        quads.push(quad(subject, predicate, literal(targetId, 'xsd:string')));
      }
      break;
    default:
      quads.push(quad(subject, predicate, iri(targetId)));
      break;
  }
}

/**
 * Project relations with structured metadata into multi-quad patterns.
 */
function projectStructuredRelation(
  rel: SchemaGraphRelationInterface,
  quads: QuadInterface[]
): void {
  const subject = rel.source.id;
  const structure = rel.structure!;

  switch (structure.kind) {
    case 'conditional': {
      const condBnode = nextBnode();

      quads.push(quad(subject, 'owl:unionOf', bnode(condBnode)));
      quads.push(quad(condBnode, 'rdf:type', iri('owl:Class')));
      quads.push(quad(condBnode, 'jt:if', iri(structure.ifRef)));
      if (structure.thenRef !== undefined) {
        quads.push(quad(condBnode, 'jt:then', iri(structure.thenRef)));
      }
      if (structure.elseRef !== undefined) {
        quads.push(quad(condBnode, 'jt:else', iri(structure.elseRef)));
      }
      break;
    }
    case 'list': {
      const items = structure.members.map((m) => {
        return iri(m);
      });

      quads.push(quad(subject, rel.predicate, rdfList(items)));
      break;
    }
    case 'restriction': {
      const rBnode = nextBnode();

      quads.push(quad(subject, rel.predicate, bnode(rBnode)));
      quads.push(quad(rBnode, 'rdf:type', iri('owl:Restriction')));
      quads.push(quad(rBnode, 'owl:onProperty', iri(structure.onProperty)));
      quads.push(quad(rBnode, String(structure.constraint), iri(String(structure.value))));
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// ABox projection
// ---------------------------------------------------------------------------

/**
 * Project validated instance data into ABox quads.
 *
 * @param entryNode - Optional entry node (for schemas with root-level $ref).
 *   Defaults to `graph.rootNode`.
 */
export function projectAbox(
  graph: SchemaGraphInterface,
  data: unknown,
  baseIRI: string,
  entryNode?: SchemaGraphNodeInterface
): QuadInterface[] {
  resetBnodeCounter();
  const quads: QuadInterface[] = [];
  const rootNode = entryNode ?? graph.rootNode;
  const resolved = resolveNode(graph, rootNode);

  if (!isRecord(data)) {
    return quads;
  }

  projectInstance(graph, resolved, data, baseIRI, quads);

  return quads;
}

function escapeSegment(value: string): string {
  return encodeURIComponent(value).replaceAll('%2F', '/');
}

function instanceIRI(baseIRI: string, classId: string, data: unknown): string {
  const contentHash = Hash.value(data);

  return `${baseIRI}/instances/${escapeSegment(classId)}-${contentHash}`;
}

/**
 * Resolve local refs within the graph. For nodes with a `$ref` that starts
 * with `#`, resolves to the target node. External refs return the node as-is.
 */
function resolveNode(graph: SchemaGraphInterface, node: SchemaGraphNodeInterface): SchemaGraphNodeInterface {
  const sem = graph.semantics(node);

  if (sem.ref === undefined) {
    return node;
  }
  if (sem.ref.startsWith('#')) {
    const fragment = sem.ref.slice(1);

    return graph.resolveFragment(fragment);
  }

  return node;
}

function projectInstance(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface,
  data: Record<string, unknown>,
  baseIRI: string,
  quads: QuadInterface[]
): string {
  const instIRI = instanceIRI(baseIRI, node.id, data);
  const sem = graph.semantics(node);

  quads.push(quad(instIRI, 'rdf:type', iri(node.id)));

  for (const [
    propName,
    propNode
  ] of sem.properties) {
    const value = data[propName];

    if (value === undefined || value === null) {
      continue;
    }

    const propIRI = `${node.id}#${propName}`;
    const resolved = resolveNode(graph, propNode);
    const propSem = graph.semantics(resolved);

    projectPropertyValue(graph, propIRI, propSem, resolved, value, baseIRI, instIRI, quads);
  }

  return instIRI;
}

function projectPropertyValue(
  graph: SchemaGraphInterface,
  propIRI: string,
  propSem: { 'format': string | undefined;
    'itemsNode': SchemaGraphNodeInterface | undefined },
  propNode: SchemaGraphNodeInterface,
  value: unknown,
  baseIRI: string,
  instIRI: string,
  quads: QuadInterface[]
): void {
  if (Array.isArray(value)) {
    for (const element of value) {
      projectSingleValue(graph, propIRI, propSem, propNode, element, baseIRI, instIRI, quads);
    }

    return;
  }

  projectSingleValue(graph, propIRI, propSem, propNode, value, baseIRI, instIRI, quads);
}

function projectSingleValue(
  graph: SchemaGraphInterface,
  propIRI: string,
  propSem: { 'format': string | undefined;
    'itemsNode': SchemaGraphNodeInterface | undefined },
  propNode: SchemaGraphNodeInterface,
  value: unknown,
  baseIRI: string,
  instIRI: string,
  quads: QuadInterface[]
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    const xsd = resolveSingleXsdType('string', propSem.format ?? undefined) ?? 'xsd:string';

    quads.push(quad(instIRI, propIRI, literal(value, xsd)));

    return;
  }

  if (typeof value === 'number') {
    const dt = Number.isInteger(value) ? 'xsd:integer' : 'xsd:double';

    quads.push(quad(instIRI, propIRI, literal(value, dt)));

    return;
  }

  if (typeof value === 'boolean') {
    quads.push(quad(instIRI, propIRI, literal(value, 'xsd:boolean')));

    return;
  }

  if (isRecord(value)) {
    let targetNode = propNode;

    if (propSem.itemsNode !== undefined) {
      targetNode = resolveNode(graph, propSem.itemsNode);
    }

    const sem = graph.semantics(targetNode);

    if (sem.properties.size === 0 && !sem.schemaTypes.includes('object')) {
      return;
    }

    const nestedIRI = projectInstance(graph, targetNode, value, baseIRI, quads);

    quads.push(quad(instIRI, propIRI, iri(nestedIRI)));
  }
}

// ---------------------------------------------------------------------------
// Quad → JSON-LD node conversion
// ---------------------------------------------------------------------------

/**
 * Convert ABox quads into JSON-LD node objects grouped by subject.
 * This preserves the public ABox node shape while keeping blank-node
 * identifiers stable.
 */
export function quadsToJsonLdNodes(quads: QuadInterface[]): Array<Record<string, unknown>> {
  const subjects = new Map<string, Record<string, unknown>>();

  for (const q of quads) {
    let node = subjects.get(q.subject);

    if (!node) {
      node = { '@id': q.subject };
      subjects.set(q.subject, node);
    }

    const value = quadObjectToJsonLd(q.object);

    if (q.predicate === 'rdf:type') {
      node['@type'] = value;
    } else if (node[q.predicate] === undefined) {
      node[q.predicate] = value;
    } else {
      if (Array.isArray(node[q.predicate])) {
        (node[q.predicate] as unknown[]).push(value);
      } else {
        node[q.predicate] = [
          node[q.predicate],
          value
        ];
      }
    }
  }

  return [...subjects.values()];
}

function quadObjectToJsonLd(obj: QuadObjectType): unknown {
  switch (obj.termType) {
    case 'BlankNode':
      return { '@id': obj.value };
    case 'NamedNode':
      return { '@id': obj.value };
    case 'List':
      return { '@list': obj.items.map(quadObjectToJsonLd) };
    case 'Literal':
      return obj.value;
  }
}
