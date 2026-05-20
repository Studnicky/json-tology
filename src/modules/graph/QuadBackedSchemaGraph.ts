/**
 * QuadBackedSchemaGraph — SchemaGraphInterface implementation backed by OWL 2 quads.
 *
 * This is the structural inverse of OwlProjection.graph(): where OwlProjection walks
 * SchemaGraph relations and emits QuadInterface[], QuadBackedSchemaGraph ingests those
 * same quads and reconstructs a SchemaGraphInterface that phase-1 dispatchers can
 * traverse via allRelations(), nodes(), and relations().
 *
 * Supported-axiom envelope:
 * Every IRI predicate that OwlProjection emits in the forward direction is accepted
 * in the inverse. The dispatchers (phase 1+) may extend the inverse beyond what the
 * forward projector emits today — this class records all incoming predicates and
 * surfaces them through allRelations() without filtering.
 *
 * Populates:
 * - Graph nodes from rdf:type triples (owl:Class, owl:ObjectProperty,
 *   owl:DatatypeProperty, owl:NamedIndividual, owl:Restriction, rdfs:Datatype)
 * - Graph relations from all non-type predicates that OwlProjection is known to emit:
 *   rdfs:subClassOf, owl:equivalentClass, owl:complementOf, owl:disjointWith,
 *   owl:unionOf, owl:intersectionOf, owl:oneOf, owl:onProperty, owl:someValuesFrom,
 *   owl:allValuesFrom, owl:minCardinality, owl:maxCardinality, owl:cardinality,
 *   owl:minQualifiedCardinality, owl:maxQualifiedCardinality, owl:onDataRange,
 *   owl:inverseOf, rdfs:domain, rdfs:range, sh:datatype, sh:maxCount, sh:pattern,
 *   dash:readOnly, dash:writeOnly, dct:format, rdfs:label, rdfs:comment,
 *   owl:deprecated, owl:hasValue, rdfs:member, owl:TransitiveProperty,
 *   owl:SymmetricProperty, owl:AsymmetricProperty, owl:FunctionalProperty,
 *   owl:InverseFunctionalProperty, owl:ReflexiveProperty, owl:IrreflexiveProperty,
 *   owl:sameAs
 * - Blank-node Restriction shapes are attached to their parent class via the
 *   owl:onProperty + constraint pattern
 *
 * Does NOT materialise JSON Schema objects — that is the phase-1 dispatchers' job.
 */

import type {
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { PrefixMap } from '../../interfaces/OwlImport.js';
import { GraphError } from '../../errors/GraphError.js';
import {
  OWL, RDF, RDFS
} from '../../constants/IRI.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';
import { decodeLiteral } from '../rdf/Terms.js';

// ---------------------------------------------------------------------------
// OWL term IRIs (full form) — used in normaliseIri expansion
// ---------------------------------------------------------------------------

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';

/** OWL type IRIs that introduce a graph node. Full IRI and prefixed forms. */
const NODE_TYPES: ReadonlySet<string> = new Set([
  `${OWL_NS}Class`,
  `${OWL_NS}DatatypeProperty`,
  `${OWL_NS}NamedIndividual`,
  `${OWL_NS}ObjectProperty`,
  `${OWL_NS}Restriction`,
  `${RDF_NS}Property`,
  `${RDFS_NS}Class`,
  `${RDFS_NS}Datatype`,
  OWL.Class,
  OWL.DatatypeProperty,
  OWL.ObjectProperty,
  OWL.Restriction,
  'owl:NamedIndividual',
  'rdf:Property',
  'rdfs:Class',
  'rdfs:Datatype'
]);

/** rdf:type predicate — full IRI and prefixed form. */
const TYPE_PREDICATES: ReadonlySet<string> = new Set([
  `${RDF_NS}type`,
  RDF.type
]);

// ---------------------------------------------------------------------------
// Normalise CURIE-prefixed IRI to its canonical (prefixed) form.
// Handles both full IRI input and already-prefixed input.
// ---------------------------------------------------------------------------

function buildExpansionMap(prefixes: PrefixMap): Map<string, string> {
  const map = new Map<string, string>();

  for (const [
    prefix,
    ns
  ] of Object.entries(prefixes)) {
    map.set(ns, `${prefix}:`);
  }

  return map;
}

function compactIri(iri: string, expansionMap: Map<string, string>): string {
  for (const [
    ns,
    prefixColon
  ] of expansionMap) {
    if (iri.startsWith(ns)) {
      return `${prefixColon}${iri.slice(ns.length)}`;
    }
  }

  return iri;
}

// ---------------------------------------------------------------------------
// Internal quad index types
// ---------------------------------------------------------------------------

/** All quads grouped by subject IRI. */
type SubjectIndex = Map<string, QuadInterface[]>;

/** Per-subject predicate-to-object groups. */
type PredicateIndex = Map<string, Map<string, QuadInterface[]>>;

function buildSubjectIndex(quads: readonly QuadInterface[]): SubjectIndex {
  const index: SubjectIndex = new Map();

  for (const quad of quads) {
    const subjectIri = quad.subject.value;
    let list = index.get(subjectIri);

    if (list === undefined) {
      list = [];
      index.set(subjectIri, list);
    }
    list.push(quad);
  }

  return index;
}

function buildPredicateIndex(subjectIndex: SubjectIndex): PredicateIndex {
  const index: PredicateIndex = new Map();

  for (const [
    subject,
    quads
  ] of subjectIndex) {
    const predicateMap = new Map<string, QuadInterface[]>();

    for (const quad of quads) {
      const predicateValue = quad.predicate.value;
      let list = predicateMap.get(predicateValue);

      if (list === undefined) {
        list = [];
        predicateMap.set(predicateValue, list);
      }
      list.push(quad);
    }
    index.set(subject, predicateMap);
  }

  return index;
}

// ---------------------------------------------------------------------------
// Blank SchemaGraphSemanticsInterface — never populated; dispatchers don't
// use semantics() on quad-backed graphs.
// ---------------------------------------------------------------------------

const EMPTY_SEMANTICS: SchemaGraphSemanticsInterface = Object.freeze({
  'additionalItemsNode': undefined,
  'additionalPropertiesNode': undefined,
  'aliases': [],
  'allOf': [],
  'anyOf': [],
  'asymmetric': false,
  'comment': undefined,
  'complementNode': undefined,
  'computed': false,
  'constValue': undefined,
  'containsNode': undefined,
  'contentEncoding': undefined,
  'contentMediaType': undefined,
  'defaultValue': undefined,
  'definitions': [],
  'dependentRequired': {},
  'dependentSchemaEntries': [],
  'deprecated': false,
  'description': undefined,
  'discriminatorMapping': undefined,
  'discriminatorPropertyName': undefined,
  'disjointWith': undefined,
  'dynamicAnchor': undefined,
  'dynamicRef': undefined,
  'elseNode': undefined,
  'enumValues': undefined,
  'equivalentTo': undefined,
  'examples': undefined,
  'exclusiveMaximum': undefined,
  'exclusiveMinimum': undefined,
  'extensions': {},
  'format': undefined,
  'functional': false,
  'hasConst': false,
  'hasDefault': false,
  'ifNode': undefined,
  'inverseFunctional': false,
  'inverseOf': undefined,
  'irreflexive': false,
  'itemsNode': undefined,
  'jtConfig': undefined,
  'jtFrozen': false,
  'jtStrict': undefined,
  'maxContains': undefined,
  'maximum': undefined,
  'maxItems': undefined,
  'maxLength': undefined,
  'maxProperties': undefined,
  'minContains': undefined,
  'minimum': undefined,
  'minItems': undefined,
  'minLength': undefined,
  'minProperties': undefined,
  'multipleOf': undefined,
  'oneOf': [],
  'pattern': undefined,
  'patternPropertyEntries': [],
  'prefixItems': [],
  'properties': new Map(),
  'propertyNamesNode': undefined,
  'rdfsDomain': undefined,
  'rdfsRange': undefined,
  'readOnly': false,
  'recursiveAnchor': false,
  'recursiveRef': undefined,
  'ref': undefined,
  'reflexive': false,
  'refTargetNode': undefined,
  'required': [],
  'schemaAnchor': undefined,
  'schemaDialect': undefined,
  'schemaId': undefined,
  'schemaTypes': [],
  'schemaVocabulary': undefined,
  'symmetric': false,
  'thenNode': undefined,
  'title': undefined,
  'transitive': false,
  'unevaluatedItemsNode': undefined,
  'unevaluatedPropertiesNode': undefined,
  'uniqueItems': false,
  'writeOnly': false
});

// ---------------------------------------------------------------------------
// Build SchemaGraphNodeInterface stubs from the quad subject index
// ---------------------------------------------------------------------------

function buildNodeMap(
  subjectIndex: SubjectIndex,
  predicateIndex: PredicateIndex,
  expansionMap: Map<string, string>
): Map<string, SchemaGraphNodeInterface> {
  const nodeMap = new Map<string, SchemaGraphNodeInterface>();

  for (const [
    subject,
    predicateMap
  ] of predicateIndex) {
    // Only create a node when the subject has a recognised OWL type assertion.
    const typeQuads = predicateMap.get(`${RDF_NS}type`) ?? predicateMap.get(RDF.type) ?? [];
    const hasOWLType = typeQuads.some((typeQuad) => {
      return typeQuad.object.termType === 'NamedNode'
        && (NODE_TYPES.has(typeQuad.object.value) || NODE_TYPES.has(compactIri(typeQuad.object.value, expansionMap)));
    });

    if (!hasOWLType) {
      // Blank nodes and OWL ontology declarations without a recognised type
      // are indexed but not exposed as primary nodes.
      // We still need them in subjectIndex for restriction look-up below.
      continue;
    }

    // Build a minimal schema stub: { $id } so that node.schema.id is accessible.
    const schema: Record<string, unknown> = { '$id': subject };

    nodeMap.set(subject, {
      'id': subject,
      'pointer': '',
      'schema': schema
    });
  }

  // Suppress unused parameter warning — subjectIndex used by callers for bnode lookup.
  void subjectIndex;

  return nodeMap;
}

// ---------------------------------------------------------------------------
// Build SchemaGraphRelationInterface[] from indexed quads
// ---------------------------------------------------------------------------

function objectIriValue(quad: QuadInterface, expansionMap: Map<string, string>): string {
  if (quad.object.termType === 'NamedNode') {
    return compactIri(quad.object.value, expansionMap);
  }
  if (quad.object.termType === 'BlankNode') {
    return quad.object.value;
  }
  if (quad.object.termType === 'Literal') {
    return quad.object.value;
  }

  // Variable or embedded Quad (rdf/js RDF*) — neither has an IRI form,
  // so return the empty string and let downstream dispatch ignore it.
  return '';
}

function buildRelations(
  nodeMap: Map<string, SchemaGraphNodeInterface>,
  predicateIndex: PredicateIndex,
  subjectIndex: SubjectIndex,
  expansionMap: Map<string, string>
): SchemaGraphRelationInterface[] {
  const relations: SchemaGraphRelationInterface[] = [];

  for (const [
    subject,
    predicateMap
  ] of predicateIndex) {
    const sourceNode = nodeMap.get(subject);

    if (sourceNode === undefined) {
      // Blank-node subject — handled inline when processing their parent class.
      continue;
    }

    for (const [
      rawPredicate,
      quads
    ] of predicateMap) {
      const predicate = compactIri(rawPredicate, expansionMap);

      // rdf:type → collect as types on relations (used by ProjectionIndex)
      if (TYPE_PREDICATES.has(rawPredicate)) {
        for (const quad of quads) {
          if (quad.object.termType !== 'NamedNode') {
            continue;
          }
          const typeIri = compactIri(quad.object.value, expansionMap);

          relations.push({
            'predicate': RDF.type,
            'source': sourceNode,
            'target': typeIri
          });
        }
        continue;
      }

      // rdfs:subClassOf — may point to a blank-node Restriction; resolve inline.
      if (predicate === RDFS.subClassOf || rawPredicate === `${RDFS_NS}subClassOf`) {
        for (const quad of quads) {
          if (quad.object.termType === 'BlankNode') {
            // Attempt to resolve the restriction blank node.
            const bnodeId = quad.object.value;
            const bnodePredicateMap = predicateIndex.get(bnodeId);
            const restriction = resolveRestrictionBnode(bnodeId, bnodePredicateMap, subjectIndex, expansionMap);

            if (restriction === undefined) {
              relations.push({
                'predicate': RDFS.subClassOf,
                'source': sourceNode,
                'target': bnodeId
              });
            } else {
              relations.push({
                'metadata': restriction.metadata,
                'predicate': RDFS.subClassOf,
                'source': sourceNode,
                'structure': restriction.structure,
                'target': restriction.targetIri
              });
            }
          } else if (quad.object.termType === 'NamedNode') {
            const targetIri = compactIri(quad.object.value, expansionMap);
            const targetNode = nodeMap.get(quad.object.value) ?? nodeMap.get(targetIri);

            relations.push({
              'predicate': RDFS.subClassOf,
              'source': sourceNode,
              'target': targetNode ?? targetIri
            });
          }
        }
        continue;
      }

      // All other predicates — emit a relation per quad.
      for (const quad of quads) {
        const targetValue = objectIriValue(quad, expansionMap);
        const targetNode = nodeMap.get(targetValue);

        relations.push({
          'predicate': predicate,
          'source': sourceNode,
          'target': targetNode ?? targetValue
        });
      }
    }
  }

  return relations;
}

// ---------------------------------------------------------------------------
// Restriction blank-node resolver
// ---------------------------------------------------------------------------

interface RestrictionResult {
  'metadata': Record<string, unknown>;
  'structure': {
    'constraint': string;
    'kind': 'restriction';
    'onProperty': string;
    'value': unknown;
  };
  'targetIri': string;
}

const RESTRICTION_CONSTRAINTS: ReadonlySet<string> = new Set([
  `${OWL_NS}allValuesFrom`,
  `${OWL_NS}cardinality`,
  `${OWL_NS}hasValue`,
  `${OWL_NS}maxCardinality`,
  `${OWL_NS}maxQualifiedCardinality`,
  `${OWL_NS}minCardinality`,
  `${OWL_NS}minQualifiedCardinality`,
  `${OWL_NS}someValuesFrom`,
  OWL.allValuesFrom,
  OWL.cardinality,
  OWL.hasValue,
  OWL.maxCardinality,
  OWL.maxQualifiedCardinality,
  OWL.minCardinality,
  OWL.minQualifiedCardinality,
  OWL.someValuesFrom
]);

function resolveRestrictionBnode(
  bnodeId: string,
  bnodePredicateMap: Map<string, QuadInterface[]> | undefined,
  _subjectIndex: SubjectIndex,
  expansionMap: Map<string, string>
): RestrictionResult | undefined {
  if (bnodePredicateMap === undefined) {
    return undefined;
  }

  // Check it's typed as owl:Restriction
  const typeQuads = bnodePredicateMap.get(`${RDF_NS}type`) ?? bnodePredicateMap.get(RDF.type) ?? [];
  const isRestriction = typeQuads.some((typeQuad) => {
    return typeQuad.object.termType === 'NamedNode'
      && (typeQuad.object.value === `${OWL_NS}Restriction` || typeQuad.object.value === OWL.Restriction);
  });

  if (!isRestriction) {
    return undefined;
  }

  // Extract owl:onProperty
  const onPropertyQuads = bnodePredicateMap.get(`${OWL_NS}onProperty`) ?? bnodePredicateMap.get(OWL.onProperty) ?? [];

  if (onPropertyQuads.length === 0) {
    return undefined;
  }
  const onPropertyIri = compactIri(
    onPropertyQuads[0].object.termType === 'NamedNode' ? onPropertyQuads[0].object.value : '',
    expansionMap
  );

  // Find the constraint predicate
  for (const [
    rawPred,
    constraintQuads
  ] of bnodePredicateMap) {
    if (!RESTRICTION_CONSTRAINTS.has(rawPred)) {
      continue;
    }
    const constraint = compactIri(rawPred, expansionMap);
    const constraintQuad = constraintQuads.at(0);

    if (constraintQuad === undefined) {
      continue;
    }

    let value: unknown;
    let targetIri: string;

    switch (constraintQuad.object.termType) {
      case 'BlankNode':
        value = constraintQuad.object.value;
        targetIri = constraintQuad.object.value;

        break;

      case 'Literal':
        value = decodeLiteral(constraintQuad.object);
        targetIri = String(constraintQuad.object.value);

        break;

      case 'NamedNode':
        targetIri = compactIri(constraintQuad.object.value, expansionMap);
        value = targetIri;

        break;

      case 'Quad':
      case 'Variable':
        // RDF* quoted-triple / SPARQL variable — not a valid restriction value.
        continue;
    }

    return {
      'metadata': {
        'onProperty': onPropertyIri,
        'restrictionBnode': bnodeId
      },
      'structure': {
        constraint,
        'kind': 'restriction',
        'onProperty': onPropertyIri,
        value
      },
      'targetIri': targetIri
    };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// QuadBackedSchemaGraph — SchemaGraphInterface backed by OWL quads
// ---------------------------------------------------------------------------

/**
 * SchemaGraphInterface implementation populated from OWL 2 TBox quads.
 *
 * This is the structural inverse of OwlProjection.graph(): it accepts the quads
 * that OwlProjection would emit for a given SchemaGraph and reconstructs a graph
 * that phase-1 dispatchers can traverse.
 *
 * Instantiate via SchemaGraph.fromQuads(quads, options) — do not construct directly.
 */
export class QuadBackedSchemaGraph implements SchemaGraphInterface {
  private readonly _rootSchema: Record<string, unknown>;
  private readonly nodeList: SchemaGraphNodeInterface[];
  private readonly nodeMap: Map<string, SchemaGraphNodeInterface>;
  private readonly relationList: SchemaGraphRelationInterface[];

  public constructor(
    quads: readonly QuadInterface[],
    options?: { 'baseIRI'?: string;
      'prefixes'?: PrefixMap }
  ) {
    const mergedPrefixes: PrefixMap = {
      ...DEFAULT_PREFIXES,
      ...options?.prefixes
    };
    const expansionMap = buildExpansionMap(mergedPrefixes);
    const subjectIndex = buildSubjectIndex(quads);
    const predicateIndex = buildPredicateIndex(subjectIndex);

    this.nodeMap = buildNodeMap(subjectIndex, predicateIndex, expansionMap);
    this.nodeList = [...this.nodeMap.values()];
    this.relationList = buildRelations(this.nodeMap, predicateIndex, subjectIndex, expansionMap);

    // Root schema stub — carries the base IRI so callers can inspect it.
    this._rootSchema = { '$id': options?.baseIRI ?? '' };
  }

  public allRelations(): SchemaGraphRelationInterface[] {
    return this.relationList;
  }

  // SchemaGraphInterface shape methods — not meaningful for quad-backed graphs;
  // dispatchers traverse allRelations() and nodes() directly.

  public child(_node: SchemaGraphNodeInterface, _key: string): SchemaGraphNodeInterface | undefined {
    return undefined;
  }

  public entries(_node: SchemaGraphNodeInterface, _key: string): Array<[string, SchemaGraphNodeInterface]> {
    return [];
  }

  public getNormIR(): NormIRInterface {
    return {
      'anchors': {},
      'children': {},
      'entries': {},
      'indexedChildren': {},
      'nodes': this.nodeList.map((node) => {
        return {
          'id': node.id,
          'pointer': node.pointer
        };
      }),
      'rootSchema': this._rootSchema
    };
  }

  public indexedChildren(_node: SchemaGraphNodeInterface, _key: string): SchemaGraphNodeInterface[] {
    return [];
  }

  public keywordValue(node: SchemaGraphNodeInterface, key: string): unknown {
    const schema = node.schema;

    if (typeof schema === 'boolean') {
      return undefined;
    }

    return schema[key];
  }

  public node(schema: Record<string, unknown>): SchemaGraphNodeInterface | undefined {
    const id = schema.$id;

    if (typeof id !== 'string') {
      return undefined;
    }

    return this.nodeMap.get(id);
  }

  public nodes(): SchemaGraphNodeInterface[] {
    return this.nodeList;
  }

  public relations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[] {
    return this.relationList.filter((rel) => {
      return rel.source.id === node.id;
    });
  }

  public resolveFragment(fragment: string): SchemaGraphNodeInterface {
    const node = this.nodeMap.get(fragment);

    if (node === undefined) {
      throw new GraphError('ANCHOR_NOT_FOUND', `Unknown fragment in quad-backed graph: #${fragment}`, fragment);
    }

    return node;
  }

  public resolvePointer(pointer: string): SchemaGraphNodeInterface {
    const node = this.nodeMap.get(pointer);

    if (node === undefined) {
      throw new GraphError('POINTER_NOT_FOUND', `Node not found for pointer in quad-backed graph: ${pointer}`, pointer);
    }

    return node;
  }

  public resolveRefId(ref: string): string {
    if (!ref.startsWith('#')) {
      return ref;
    }
    const fragment = ref.slice(1);
    const node = this.nodeMap.get(fragment);

    return node?.id ?? ref;
  }

  public get rootNode(): SchemaGraphNodeInterface {
    // The first named-class node, or a synthetic stub.
    const first = this.nodeList.at(0);

    return first ?? {
      'id': String(this._rootSchema.$id ?? ''),
      'pointer': '',
      'schema': this._rootSchema
    };
  }

  public get rootSchema(): Record<string, unknown> {
    return this._rootSchema;
  }

  public semantics(_node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface {
    // Quad-backed graphs do not populate semantics — dispatchers use allRelations().
    return EMPTY_SEMANTICS;
  }

  public validateStructure(): StructureWarningInterface[] {
    return [];
  }
}
