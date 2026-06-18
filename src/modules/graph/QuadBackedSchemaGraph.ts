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
  ListItemType,
  NormIRType,
  SchemaGraphNodeType, SchemaGraphRelationType,
  SchemaGraphSemanticsType, StructureWarningType
} from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { PrefixMapType } from '../../types/OwlImport.js';
import type {
  BuildRelationsOptionsType,
  CollectedListType,
  LiteralTagsType,
  NodeEntriesType,
  NodeMapType,
  OptionalChildNodeType,
  OptionalNodeType,
  OptionalRestrictionType,
  ResolveRestrictionOptionsType,
  RootSchemaRecordType,
  SubjectIndexType,
  SubjectPredicateQuadsIndexType,
  SubjectRelationsType
} from '../../types/QuadBackedSchemaGraph.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import {
  OWL, RDF, RDFS
} from '../../constants/IRI.js';
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import {
  OWL_NODE_TYPE_IRIS,
  OWL_RESTRICTION_CONSTRAINT_IRIS,
  RDF_TYPE_PREDICATES
} from '../../constants/ONTOLOGY_PREDICATES.js';
import { Curie } from '../quads/Curie.js';
import { Lists } from '../quads/Lists.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { Terms } from '../quads/Terms.js';
import { EMPTY_SEMANTICS } from '../../constants/EMPTY_SEMANTICS.js';

// OWL_NODE_TYPE_IRIS, RDF_TYPE_PREDICATES, OWL_RESTRICTION_CONSTRAINT_IRIS imported from ONTOLOGY_PREDICATES

function buildPredicateIndex(subjectIndex: SubjectIndexType): SubjectPredicateQuadsIndexType {
  const index: SubjectPredicateQuadsIndexType = new Map();

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
// Build SchemaGraphNodeType stubs from the quad subject index
// ---------------------------------------------------------------------------

function buildNodeMap(
  subjectIndex: SubjectIndexType,
  predicateIndex: SubjectPredicateQuadsIndexType,
  curie: CurieInterface
): NodeMapType {
  const nodeMap: NodeMapType = new Map();

  for (const [
    subject,
    predicateMap
  ] of predicateIndex) {
    // Only create a node when the subject has a recognised OWL type assertion.
    const typeQuads = predicateMap.get(RDF.type) ?? [];
    const hasOWLType = typeQuads.some((typeQuad: QuadInterface): boolean => {
      return typeQuad.object.termType === 'NamedNode'
        && (OWL_NODE_TYPE_IRIS.has(typeQuad.object.value) || OWL_NODE_TYPE_IRIS.has(curie.compact(typeQuad.object.value)));
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
// Build SchemaGraphRelationType[] from indexed quads
// ---------------------------------------------------------------------------

function objectIriValue(quad: QuadInterface, curie: CurieInterface): string {
  if (quad.object.termType === 'NamedNode') {
    return curie.compact(quad.object.value);
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

/**
 * Build the optional language / datatype / termType fields that ride along
 * on a relation, preserving the source literal's tags when the target is a
 * Literal. NamedNode and BlankNode targets carry only `termType`; the
 * language/datatype tags are emitted strictly for Literal terms.
 */
function literalTagsForQuad(quad: QuadInterface): LiteralTagsType {
  switch (quad.object.termType) {
    case 'BlankNode':
      return { 'termType': 'BlankNode' };
    case 'Literal':
      return {
        'datatype': quad.object.datatype.value,
        'language': quad.object.language,
        'termType': 'Literal'
      };
    case 'NamedNode':
      return { 'termType': 'NamedNode' };
    case 'Quad':
    case 'Variable':
      return {};
    default:
      return {};
  }
}

/**
 * Resolve or synthesise a node for `subject`. Subjects without a recognised
 * OWL type (typically blank nodes carrying restriction / list / facet shapes)
 * get a synthetic stub so their outgoing relations can be returned by
 * `relationsForSubject` without scanning the full relation list.
 */
function nodeOrStub(
  subject: string,
  nodeMap: Map<string, SchemaGraphNodeType>,
  stubMap: Map<string, SchemaGraphNodeType>
): SchemaGraphNodeType {
  const existing = nodeMap.get(subject);

  if (existing !== undefined) {
    return existing;
  }

  const cachedStub = stubMap.get(subject);

  if (cachedStub !== undefined) {
    return cachedStub;
  }

  const stub: SchemaGraphNodeType = {
    'id': subject,
    'pointer': '',
    'schema': { '$id': subject }
  };

  stubMap.set(subject, stub);

  return stub;
}

function buildRelations(opts: BuildRelationsOptionsType): SchemaGraphRelationType[] {
  const {
    curie,
    nodeMap,
    predicateIndex,
    stubMap
  } = opts;
  const relations: SchemaGraphRelationType[] = [];

  for (const [
    subject,
    predicateMap
  ] of predicateIndex) {
    const sourceNode = nodeOrStub(subject, nodeMap, stubMap);
    const isNamedSubject = nodeMap.has(subject);

    for (const [
      rawPredicate,
      quads
    ] of predicateMap) {
      const predicate = curie.compact(rawPredicate);

      // rdf:type → collect as types on relations (used by ProjectionIndex)
      if (RDF_TYPE_PREDICATES.has(rawPredicate)) {
        for (const quad of quads) {
          if (quad.object.termType !== 'NamedNode') {
            continue;
          }
          const typeIri = curie.compact(quad.object.value);

          relations.push({
            'predicate': RDF.type,
            'source': sourceNode,
            'target': typeIri,
            'termType': 'NamedNode'
          });
        }
        continue;
      }

      // rdfs:subClassOf — may point to a blank-node Restriction; resolve inline.
      // Only triggered for named-class subjects; bnode-sourced subClassOf is
      // emitted via the generic branch below so its sibling predicates remain
      // walkable via relationsForSubject().
      if (isNamedSubject && (predicate === RDFS.subClassOf || rawPredicate === RDFS.subClassOf)) {
        for (const quad of quads) {
          if (quad.object.termType === 'BlankNode') {
            // Attempt to resolve the restriction blank node.
            const bnodeId = quad.object.value;
            const bnodePredicateMap = predicateIndex.get(bnodeId);
            const restriction = resolveRestrictionBnode({
              bnodeId,
              'bnodePredicateMap': bnodePredicateMap,
              curie
            });

            if (restriction === undefined) {
              relations.push({
                'predicate': RDFS.subClassOf,
                'source': sourceNode,
                'target': bnodeId,
                'termType': 'BlankNode'
              });
            } else {
              relations.push({
                'metadata': restriction.metadata,
                'predicate': RDFS.subClassOf,
                'source': sourceNode,
                'structure': restriction.structure,
                'target': restriction.targetIri,
                'termType': 'BlankNode'
              });
            }
          } else if (quad.object.termType === 'NamedNode') {
            const targetIri = curie.compact(quad.object.value);
            const targetNode = nodeMap.get(quad.object.value) ?? nodeMap.get(targetIri);

            relations.push({
              'predicate': RDFS.subClassOf,
              'source': sourceNode,
              'target': targetNode ?? targetIri,
              'termType': 'NamedNode'
            });
          }
        }
        continue;
      }

      // All other predicates — emit a relation per quad with literal-tag preservation.
      for (const quad of quads) {
        const targetValue = objectIriValue(quad, curie);
        const targetNode = nodeMap.get(targetValue);
        const tags = literalTagsForQuad(quad);

        relations.push({
          ...tags,
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


// OWL_RESTRICTION_CONSTRAINT_IRIS imported from ONTOLOGY_PREDICATES

function resolveRestrictionBnode(opts: ResolveRestrictionOptionsType): OptionalRestrictionType {
  const {
    bnodeId,
    bnodePredicateMap,
    curie
  } = opts;

  if (bnodePredicateMap === undefined) {
    return undefined;
  }

  // Check it's typed as owl:Restriction
  const typeQuads = bnodePredicateMap.get(RDF.type) ?? [];
  const isRestriction = typeQuads.some((typeQuad) => {
    return typeQuad.object.termType === 'NamedNode'
      && typeQuad.object.value === OWL.Restriction;
  });

  if (!isRestriction) {
    return undefined;
  }

  // Extract owl:onProperty
  const onPropertyQuads = bnodePredicateMap.get(OWL.onProperty) ?? [];

  if (onPropertyQuads.length === 0) {
    return undefined;
  }
  const onPropertyQuad = onPropertyQuads[0];

  if (onPropertyQuad === undefined) {
    return undefined;
  }

  const onPropertyIri = curie.compact(onPropertyQuad.object.termType === 'NamedNode' ? onPropertyQuad.object.value : '');

  // Find the constraint predicate
  for (const [
    rawPred,
    constraintQuads
  ] of bnodePredicateMap) {
    if (!OWL_RESTRICTION_CONSTRAINT_IRIS.has(rawPred)) {
      continue;
    }
    // Keep constraint as full IRI — downstream importDispatch handlers compare
    // against OWL.* constants from IRI.ts (full IRIs), not compact CURIEs.
    const constraint = rawPred;
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
        value = Terms.decodeLiteral(constraintQuad.object);
        targetIri = String(constraintQuad.object.value);

        break;

      case 'NamedNode':
        // Keep as full IRI — no compact form in restriction value targets.
        targetIri = constraintQuad.object.value;
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
  private readonly nodeList: SchemaGraphNodeType[];
  private readonly nodeMap: Map<string, SchemaGraphNodeType>;
  /** Quads supplied to the constructor — retained so `collectList` can walk
   * `rdf:first`/`rdf:rest` chains directly via the canonical Lists helper. */
  private readonly quads: readonly QuadInterface[];
  private readonly relationList: SchemaGraphRelationType[];
  /** Lazy subject → outgoing relations index. Built on first
   * `relationsForSubject` call and cached. */
  private relationsBySubject: Map<string, SchemaGraphRelationType[]> | undefined = undefined;

  public constructor(
    quads: readonly QuadInterface[],
    options?: { 'baseIRI'?: string;
      'prefixes'?: PrefixMapType }
  ) {
    const mergedPrefixes: PrefixMapType = {
      ...STANDARD_PREFIXES,
      ...options?.prefixes
    };
    const curie = new Curie(mergedPrefixes);
    const subjectIndex = QuadFactory.indexBySubject(quads);
    const predicateIndex = buildPredicateIndex(subjectIndex);
    const stubMap = new Map<string, SchemaGraphNodeType>();

    this.quads = quads;
    this.nodeMap = buildNodeMap(subjectIndex, predicateIndex, curie);
    this.nodeList = [...this.nodeMap.values()];
    this.relationList = buildRelations({
      curie,
      'nodeMap': this.nodeMap,
      'predicateIndex': predicateIndex,
      'stubMap': stubMap,
      'subjectIndex': subjectIndex
    });

    // Root schema stub — carries the base IRI so callers can inspect it.
    this._rootSchema = { '$id': options?.baseIRI ?? '' };
  }

  public allRelations(): SchemaGraphRelationType[] {
    return this.relationList;
  }

  // SchemaGraphInterface shape methods — not meaningful for quad-backed graphs;
  // dispatchers traverse allRelations() and nodes() directly.

  public child(_node: SchemaGraphNodeType, _key: string): OptionalChildNodeType {
    return undefined;
  }

  /**
   * Walk the RDF list rooted at `head` using the canonical `Lists.collect`
   * helper against the constructor-supplied quad store. `head` may be a
   * NamedNode IRI (e.g. an explicit list head) or a blank-node id (the usual
   * case when the list is the value of `owl:withRestrictions`, `owl:hasKey`,
   * `owl:unionOf`, etc.).
   *
   * Returns the typed JS value for Literal items (via `Terms.decodeLiteral`) and
   * the IRI / bnode-id string for NamedNode / BlankNode items, preserving
   * the term-type so dispatchers can branch on the kind.
   */
  public collectList(head: string): CollectedListType {
    if (head === '' || head === RDF.nil || head === 'rdf:nil') {
      return [];
    }

    // Lists.collect calls `quad.subject.equals(cursor)`. The stored quad
    // subjects carry spec-compliant `.equals` (compare termType + value),
    // so the probe term only needs the correct `termType` and `value`
    // fields. The probe's own `.equals` is never invoked.
    //
    // Discriminate term-type heuristically: a NamedNode head must be a full
    // IRI (or compact CURIE) — anything else is treated as a blank node.
    // The blank-node value is preserved verbatim (both `_:b0` and `b0` forms
    // appear in the wild depending on the producer, so the relation target
    // string we received is the authoritative match).
    const looksLikeIri = !head.startsWith('_:')
      && /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|#|\/)/u.test(head);
    const headTerm = looksLikeIri
      ? {
        'equals': () => {
          return false;
        },
        'termType': 'NamedNode' as const,
        'value': head
      }
      : {
        'equals': () => {
          return false;
        },
        'termType': 'BlankNode' as const,
        'value': head
      };
    const items = Lists.collect(headTerm, this.quads);
    const result: ListItemType[] = [];

    for (const item of items) {
      switch (item.termType) {
        case 'BlankNode':
          result.push({
            'target': item.value,
            'termType': 'BlankNode'
          });
          break;
        case 'Literal': {
          const decoded = Terms.decodeLiteral(item);

          // Encode the typed JS value via String() so the `target` field
          // remains a plain string per the ListItemType contract; callers
          // recover the typed value by re-applying Terms.decodeLiteral semantics
          // through the `datatype` IRI we preserve below.
          result.push({
            'datatype': item.datatype.value,
            'language': item.language,
            'target': decoded === null || decoded === undefined ? item.value : String(decoded),
            'termType': 'Literal'
          });
          break;
        }
        case 'NamedNode':
          result.push({
            'target': item.value,
            'termType': 'NamedNode'
          });
          break;
      }
    }

    return result;
  }

  /**
   * The quad-backed graph is constructed from serialised OWL quads, not from
   * the lowering process that builds the domain map. Domain edges are available
   * directly as rdfs:domain relations in allRelations(); there is no pre-built
   * WeakMap index. Returns undefined for all nodes.
   */
  public domainOf(_node: SchemaGraphNodeType): SchemaGraphNodeType | undefined {
    return undefined;
  }

  /**
   * The quad-backed graph has no embedded-$id sub-schema index — it is built
   * from serialised OWL quads rather than from a live JSON Schema document.
   * Returns undefined for all ids.
   */
  public embeddedNode(_id: string): SchemaGraphNodeType | undefined {
    return undefined;
  }

  /**
   * The quad-backed graph has no embedded-$id sub-schema index — it is built
   * from serialised OWL quads rather than from a live JSON Schema document.
   * Returns an empty iterator.
   */
  public embeddedSchemaIds(): IterableIterator<string> {
    return [][Symbol.iterator]();
  }

  public entries(_node: SchemaGraphNodeType, _key: string): NodeEntriesType {
    return [];
  }

  public getNormIR(): NormIRType {
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

  public indexedChildren(_node: SchemaGraphNodeType, _key: string): SchemaGraphNodeType[] {
    return [];
  }

  public keywordValue(node: SchemaGraphNodeType, key: string): unknown {
    const schema = node.schema;

    if (typeof schema === 'boolean') {
      return undefined;
    }

    return schema[key];
  }

  public node(schema: Record<string, unknown>): OptionalNodeType {
    const id = schema.$id;

    if (typeof id !== 'string') {
      return undefined;
    }

    return this.nodeMap.get(id);
  }

  public nodes(): SchemaGraphNodeType[] {
    return this.nodeList;
  }

  public relations(node: SchemaGraphNodeType): SchemaGraphRelationType[] {
    return this.relationList.filter((rel) => {
      return rel.source.id === node.id;
    });
  }

  public relationsForSubject(subjectIri: string): SubjectRelationsType {
    if (this.relationsBySubject === undefined) {
      const index = new Map<string, SchemaGraphRelationType[]>();

      for (const relation of this.relationList) {
        const key = relation.source.id;
        let list = index.get(key);

        if (list === undefined) {
          list = [];
          index.set(key, list);
        }
        list.push(relation);
      }
      this.relationsBySubject = index;
    }

    return this.relationsBySubject.get(subjectIri) ?? [];
  }

  public resolveFragment(fragment: string): SchemaGraphNodeType {
    const node = this.nodeMap.get(fragment);

    if (node === undefined) {
      throw new GraphError(`Unknown fragment in quad-backed graph: #${fragment}`, {
        'code': GraphErrorCode.ANCHOR_NOT_FOUND,
        'pointer': fragment
      });
    }

    return node;
  }

  public resolvePointer(pointer: string): SchemaGraphNodeType {
    const node = this.nodeMap.get(pointer);

    if (node === undefined) {
      throw new GraphError(`Node not found for pointer in quad-backed graph: ${pointer}`, {
        'code': GraphErrorCode.POINTER_NOT_FOUND,
        pointer
      });
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

  public get rootNode(): SchemaGraphNodeType {
    // The first named-class node, or a synthetic stub.
    const first = this.nodeList.at(0);

    return first ?? {
      'id': String(this._rootSchema.$id ?? ''),
      'pointer': '',
      'schema': this._rootSchema
    };
  }

  public get rootSchema(): RootSchemaRecordType {
    return this._rootSchema;
  }

  public semantics(_node: SchemaGraphNodeType): SchemaGraphSemanticsType {
    // Quad-backed graphs do not populate semantics — dispatchers use allRelations().
    return EMPTY_SEMANTICS;
  }

  public validateStructure(): StructureWarningType[] {
    return [];
  }
}
