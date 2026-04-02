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

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type {
  SchemaGraphNodeInterface,
  SchemaGraphRelationInterface
} from '../../interfaces/SchemaGraph.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { resolveSingleXsdType } from '../../constants/XSD_MAPS.js';
import { Hash } from '../hash/Hash.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { JSONLD } from '../../constants/JSONLD.js';
import { QuadFactory } from './QuadFactory.js';

export { QuadFactory } from './QuadFactory.js';

// ---------------------------------------------------------------------------
// TBox projection — purely relation-driven
// ---------------------------------------------------------------------------

export function projectGraph(graph: SchemaGraphInterface, curie?: CurieInterface): QuadInterface[] {
  QuadFactory.resetBnodeCounter();
  const quads: QuadInterface[] = [];

  const allRelations = graph.allRelations();

  for (const relation of allRelations) {
    projectRelation(relation, quads, curie);
  }

  return quads;
}

// ---------------------------------------------------------------------------
// Predicate dispatch handlers
// ---------------------------------------------------------------------------

function handleIri(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(QuadFactory.quad(subject, predicate, QuadFactory.iri(targetId, curie), curie));
}

function handleStringLiteral(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(QuadFactory.quad(subject, predicate, QuadFactory.literal(targetId, XSD.string, curie), curie));
}

function handleBooleanCoerce(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(QuadFactory.quad(subject, predicate, QuadFactory.literal(targetId === 'true', XSD.boolean, curie), curie));
}

function handleBooleanLiteral(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(QuadFactory.quad(subject, predicate, QuadFactory.literal(targetId, XSD.boolean, curie), curie));
}

function handleIntegerLiteral(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(QuadFactory.quad(subject, predicate, QuadFactory.literal(Number(targetId), XSD.integer, curie), curie));
}

function handleDecimalLiteral(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(QuadFactory.quad(subject, predicate, QuadFactory.literal(Number(targetId), XSD.decimal, curie), curie));
}

function handleNonNegativeInteger(
  subject: string,
  predicate: string,
  targetId: string,
  _relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const cardLit = QuadFactory.literal(Number(targetId), XSD.nonNegativeInteger, curie);

  quads.push(QuadFactory.quad(subject, predicate, cardLit, curie));
}

function handleDependentRequired(
  subject: string,
  _predicate: string,
  _targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
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
    curie
  ), curie));
}

function handleRestriction(
  subject: string,
  _predicate: string,
  _targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const rBnode = QuadFactory.nextBnode();
  const metadata = relation.metadata ?? {};
  const onProperty = typeof metadata.onProperty === 'string' ? metadata.onProperty : '';
  const minCard = typeof metadata.minCardinality === 'number' ? metadata.minCardinality : 1;

  quads.push(QuadFactory.quad(subject, RDFS.subClassOf, QuadFactory.bnode(rBnode), curie));
  quads.push(QuadFactory.quad(rBnode, RDF.type, QuadFactory.iri(OWL.Restriction, curie), curie));
  quads.push(QuadFactory.quad(rBnode, OWL.onProperty, QuadFactory.iri(onProperty, curie), curie));
  const minCardLit = QuadFactory.literal(minCard, XSD.nonNegativeInteger, curie);

  quads.push(QuadFactory.quad(rBnode, OWL.minCardinality, minCardLit, curie));
}

function handlePattern(
  subject: string,
  predicate: string,
  targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  if (relation.metadata?.patternProperty === true && typeof relation.metadata.pattern === 'string') {
    const patternLit = QuadFactory.literal(relation.metadata.pattern, XSD.string, curie);

    quads.push(QuadFactory.quad(subject, SH.pattern, patternLit, curie));
  } else {
    const targetLit = QuadFactory.literal(targetId, XSD.string, curie);

    quads.push(QuadFactory.quad(subject, predicate, targetLit, curie));
  }
}

// ---------------------------------------------------------------------------
// Predicate dispatch map
// ---------------------------------------------------------------------------

const PREDICATE_HANDLERS = new Map<string, (
  subject: string,
  predicate: string,
  targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
) => void>([
  [
    DASH.readOnly,
    handleBooleanCoerce
  ],
  [
    DASH.writeOnly,
    handleBooleanCoerce
  ],
  [
    DCT.format,
    handleStringLiteral
  ],
  [
    JT.dependentRequired,
    handleDependentRequired
  ],
  [
    JT.multipleOf,
    handleDecimalLiteral
  ],
  [
    OWL.complementOf,
    handleIri
  ],
  [
    OWL.deprecated,
    handleBooleanLiteral
  ],
  [
    OWL.disjointWith,
    handleIri
  ],
  [
    OWL.equivalentClass,
    handleIri
  ],
  [
    OWL.hasValue,
    handleStringLiteral
  ],
  [
    OWL.inverseOf,
    handleIri
  ],
  [
    OWL.maxQualifiedCardinality,
    handleNonNegativeInteger
  ],
  [
    OWL.minQualifiedCardinality,
    handleNonNegativeInteger
  ],
  [
    OWL.oneOf,
    handleStringLiteral
  ],
  [
    OWL.Restriction,
    handleRestriction
  ],
  [
    OWL.someValuesFrom,
    handleIri
  ],
  [
    OWL.SymmetricProperty,
    handleIri
  ],
  [
    OWL.TransitiveProperty,
    handleIri
  ],
  [
    OWL.unionOf,
    handleIri
  ],
  [
    RDF.type,
    handleIri
  ],
  [
    RDFS.comment,
    handleStringLiteral
  ],
  [
    RDFS.domain,
    handleIri
  ],
  [
    RDFS.label,
    handleStringLiteral
  ],
  [
    RDFS.member,
    handleIri
  ],
  [
    RDFS.range,
    handleIri
  ],
  [
    RDFS.subClassOf,
    handleIri
  ],
  [
    SH.closed,
    handleBooleanLiteral
  ],
  [
    SH.datatype,
    handleIri
  ],
  [
    SH.maxCount,
    handleIntegerLiteral
  ],
  [
    SH.maxExclusive,
    handleDecimalLiteral
  ],
  [
    SH.maxInclusive,
    handleDecimalLiteral
  ],
  [
    SH.maxLength,
    handleIntegerLiteral
  ],
  [
    SH.minCount,
    handleIntegerLiteral
  ],
  [
    SH.minExclusive,
    handleDecimalLiteral
  ],
  [
    SH.minInclusive,
    handleDecimalLiteral
  ],
  [
    SH.minLength,
    handleIntegerLiteral
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
  curie?: CurieInterface
): void {
  if (relation.structure !== undefined) {
    projectStructuredRelation(relation, quads, curie);

    return;
  }

  const subject = relation.source.id;
  const predicate = relation.predicate;
  const targetId = typeof relation.target === 'string' ? relation.target : relation.target.id;

  const handler = PREDICATE_HANDLERS.get(predicate);

  if (handler !== undefined) {
    handler(subject, predicate, targetId, relation, quads, curie);
  }
}

function projectStructuredRelation(
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const subject = relation.source.id;
  const structure = relation.structure;

  if (structure === undefined) {
    return;
  }

  switch (structure.kind) {
    case 'conditional': {
      const condBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(subject, OWL.unionOf, QuadFactory.bnode(condBnode), curie));
      quads.push(QuadFactory.quad(condBnode, RDF.type, QuadFactory.iri(OWL.Class, curie), curie));
      quads.push(QuadFactory.quad(condBnode, JT.if, QuadFactory.iri(structure.ifRef, curie), curie));
      if (structure.thenRef !== undefined) {
        quads.push(QuadFactory.quad(condBnode, JT.thenBranch, QuadFactory.iri(structure.thenRef, curie), curie));
      }
      if (structure.elseRef !== undefined) {
        quads.push(QuadFactory.quad(condBnode, JT.else, QuadFactory.iri(structure.elseRef, curie), curie));
      }
      break;
    }
    case 'list': {
      const items = structure.members.map((member) => {
        return QuadFactory.iri(member, curie);
      });

      quads.push(QuadFactory.quad(subject, relation.predicate, QuadFactory.rdfList(items), curie));
      break;
    }
    case 'restriction': {
      const restrictionBnode = QuadFactory.nextBnode();

      quads.push(QuadFactory.quad(subject, relation.predicate, QuadFactory.bnode(restrictionBnode), curie));
      quads.push(QuadFactory.quad(restrictionBnode, RDF.type, QuadFactory.iri(OWL.Restriction, curie), curie));
      const onPropIri = QuadFactory.iri(structure.onProperty, curie);

      quads.push(QuadFactory.quad(restrictionBnode, OWL.onProperty, onPropIri, curie));
      const constraintVal = QuadFactory.iri(String(structure.value), curie);

      quads.push(QuadFactory.quad(restrictionBnode, String(structure.constraint), constraintVal, curie));
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// ABox projection
// ---------------------------------------------------------------------------

export function projectAbox(
  graph: SchemaGraphInterface,
  data: unknown,
  baseIRI: string,
  entryNode?: SchemaGraphNodeInterface,
  curie?: CurieInterface
): QuadInterface[] {
  QuadFactory.resetBnodeCounter();
  const quads: QuadInterface[] = [];
  const rootNode = entryNode ?? graph.rootNode;
  const resolved = resolveNode(graph, rootNode);

  if (!isRecord(data)) {
    return quads;
  }

  projectInstance(graph, resolved, data, baseIRI, quads, curie);

  return quads;
}

function instanceIRI(baseIRI: string, classId: string, data: unknown): string {
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

function projectInstance(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface,
  data: Record<string, unknown>,
  baseIRI: string,
  quads: QuadInterface[],
  curie?: CurieInterface
): string {
  const instIRI = instanceIRI(baseIRI, node.id, data);
  const nodeSemantics = graph.semantics(node);

  quads.push(QuadFactory.quad(instIRI, RDF.type, QuadFactory.iri(node.id, curie), curie));

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

    projectPropertyValue(graph, propertyIRI, propertySemantics, resolved, value, baseIRI, instIRI, quads, curie);
  }

  return instIRI;
}

function projectPropertyValue(
  graph: SchemaGraphInterface,
  propertyIRI: string,
  propertySemantics: { 'format': string | undefined;
    'itemsNode': SchemaGraphNodeInterface | undefined },
  propertyNode: SchemaGraphNodeInterface,
  value: unknown,
  baseIRI: string,
  instanceIri: string,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const emit = (val: unknown): void => {
    projectSingleValue(graph, propertyIRI, propertySemantics, propertyNode, val, baseIRI, instanceIri, quads, curie);
  };

  if (Array.isArray(value)) {
    for (const element of value) {
      emit(element);
    }

    return;
  }

  emit(value);
}

function projectSingleValue(
  graph: SchemaGraphInterface,
  propertyIRI: string,
  propertySemantics: { 'format': string | undefined;
    'itemsNode': SchemaGraphNodeInterface | undefined },
  propertyNode: SchemaGraphNodeInterface,
  value: unknown,
  baseIRI: string,
  instanceIri: string,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    const xsdDatatype = resolveSingleXsdType('string', propertySemantics.format ?? undefined) ?? XSD.string;

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, xsdDatatype, curie), curie));

    return;
  }

  if (typeof value === 'number') {
    const datatype = Number.isInteger(value) ? XSD.integer : XSD.double;

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, datatype, curie), curie));

    return;
  }

  if (typeof value === 'boolean') {
    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.literal(value, XSD.boolean, curie), curie));

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

    const nestedIRI = projectInstance(graph, targetNode, value, baseIRI, quads, curie);

    quads.push(QuadFactory.quad(instanceIri, propertyIRI, QuadFactory.iri(nestedIRI, curie), curie));
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
