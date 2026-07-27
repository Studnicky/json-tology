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

import type { LiteralTagsEntity } from '../../entities/LiteralTagsEntity.js';
import type { NodeMapInterface } from '../../interfaces/NodeMapInterface.js';
import type { SubjectPredicateQuadsIndexInterface } from '../../interfaces/SubjectPredicateQuadsIndexInterface.js';
import type { StructureWarningEntity } from '../../entities/StructureWarningEntity.js';
import type { ListItemEntity } from '../../entities/ListItemEntity.js';
import type { NormIRInterface } from '../../interfaces/NormIRInterface.js';
import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraphSemanticsInterface.js';
import type { SchemaGraphRelationInterface } from '../../interfaces/SchemaGraphRelationInterface.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { PrefixMapInterface } from '../../interfaces/PrefixMapInterface.js';
import type { SubjectIndexInterface } from '../../interfaces/SubjectIndexInterface.js';
import type { BuildRelationsOptionsInterface } from '../../interfaces/BuildRelationsOptionsInterface.js';
import type { RestrictionResultInterface } from '../../interfaces/RestrictionResultInterface.js';
import type { ResolveRestrictionOptionsInterface } from '../../interfaces/ResolveRestrictionOptionsInterface.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
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
import { IRI_LIKE_RE } from '../../constants/GRAPH_REGEXES.js';

// OWL_NODE_TYPE_IRIS, RDF_TYPE_PREDICATES, OWL_RESTRICTION_CONSTRAINT_IRIS imported from ONTOLOGY_PREDICATES

// ---------------------------------------------------------------------------
// Build SchemaGraphRelationInterface[] from indexed quads
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// QuadGraphBuilder — cohesive graph-construction helpers used by the
// QuadBackedSchemaGraph constructor and by relations() when resolving
// restriction blank nodes.
// ---------------------------------------------------------------------------

class QuadGraphBuilder {
  /**
   * Build the optional language / datatype / termType fields that ride along
   * on a relation, preserving the source literal's tags when the target is a
   * Literal. NamedNode and BlankNode targets carry only `termType`; the
   * language/datatype tags are emitted strictly for Literal terms.
   */
  public static literalTagsForQuad(quad: QuadInterface): LiteralTagsEntity.Type {
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

  public static nodeMap(
    subjectIndex: SubjectIndexInterface,
    predicateIndex: SubjectPredicateQuadsIndexInterface,
    curie: CurieInterface
  ): NodeMapInterface {
    const nodeMap: NodeMapInterface = new Map();

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

  /**
   * Resolve or synthesise a node for `subject`. Subjects without a recognised
   * OWL type (typically blank nodes carrying restriction / list / facet shapes)
   * get a synthetic stub so their outgoing relations can be returned by
   * `relationsForSubject` without scanning the full relation list.
   */
  public static nodeOrStub(
    subject: string,
    nodeMap: Map<string, SchemaGraphNodeInterface>,
    stubMap: Map<string, SchemaGraphNodeInterface>
  ): SchemaGraphNodeInterface {
    const existing = nodeMap.get(subject);

    if (existing !== undefined) {
      return existing;
    }

    const cachedStub = stubMap.get(subject);

    if (cachedStub !== undefined) {
      return cachedStub;
    }

    const stub: SchemaGraphNodeInterface = {
      'id': subject,
      'pointer': '',
      'schema': { '$id': subject }
    };

    stubMap.set(subject, stub);

    return stub;
  }

  public static objectIriValue(quad: QuadInterface, curie: CurieInterface): string {
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
  public static predicateIndex(subjectIndex: SubjectIndexInterface): SubjectPredicateQuadsIndexInterface {
    const index: SubjectPredicateQuadsIndexInterface = new Map();

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

  /** Probe-term `.equals` stub for `Lists.collect` — never invoked on the probe itself. */
  public static probeNeverEquals(): boolean {
    const result = false;

    return result;
  }

  public static relations(argumentList: BuildRelationsOptionsInterface): SchemaGraphRelationInterface[] {
    const {
      curie,
      nodeMap,
      predicateIndex,
      stubMap
    } = argumentList;
    const relations: SchemaGraphRelationInterface[] = [];

    for (const [
      subject,
      predicateMap
    ] of predicateIndex) {
      const sourceNode = QuadGraphBuilder.nodeOrStub(subject, nodeMap, stubMap);
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
              const restriction = QuadGraphBuilder.restrictionBnode({
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
          const targetValue = QuadGraphBuilder.objectIriValue(quad, curie);
          const targetNode = nodeMap.get(targetValue);
          const tags = QuadGraphBuilder.literalTagsForQuad(quad);

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

  // OWL_RESTRICTION_CONSTRAINT_IRIS imported from ONTOLOGY_PREDICATES
  private static restrictionBnode(argumentList: ResolveRestrictionOptionsInterface): RestrictionResultInterface | undefined {
    const {
      bnodeId,
      bnodePredicateMap,
      curie
    } = argumentList;

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
  readonly #rootSchema: Record<string, unknown>;
  private readonly nodeList: SchemaGraphNodeInterface[];
  private readonly nodeMap: Map<string, SchemaGraphNodeInterface>;
  /** Quads supplied to the constructor — retained so `collectList` can walk
   * `rdf:first`/`rdf:rest` chains directly via the canonical Lists helper. */
  private readonly quads: readonly QuadInterface[];
  private readonly relationList: SchemaGraphRelationInterface[];
  /** Lazy subject → outgoing relations index. Built on first
   * `relationsForSubject` call and cached. */
  private relationsBySubject: Map<string, SchemaGraphRelationInterface[]> | undefined = undefined;

  public constructor(
    quads: readonly QuadInterface[],
    options?: { 'baseIri'?: string;
      'prefixes'?: PrefixMapInterface }
  ) {
    const mergedPrefixes: PrefixMapInterface = Object.assign({}, STANDARD_PREFIXES, options?.prefixes);
    const curie = new Curie(mergedPrefixes);
    const subjectIndex = QuadFactory.indexBySubject(quads);
    const predicateIndex = QuadGraphBuilder.predicateIndex(subjectIndex);
    const stubMap = new Map<string, SchemaGraphNodeInterface>();

    this.quads = quads;
    this.nodeMap = QuadGraphBuilder.nodeMap(subjectIndex, predicateIndex, curie);
    this.nodeList = [...this.nodeMap.values()];
    this.relationList = QuadGraphBuilder.relations({
      curie,
      'nodeMap': this.nodeMap,
      'predicateIndex': predicateIndex,
      'stubMap': stubMap,
      'subjectIndex': subjectIndex
    });

    // Root schema stub — carries the base IRI so callers can inspect it.
    this.#rootSchema = { '$id': options?.baseIri ?? '' };
  }

  public allRelations(): SchemaGraphRelationInterface[] {
    return this.relationList;
  }

  // SchemaGraphInterface shape methods — not meaningful for quad-backed graphs;
  // dispatchers traverse allRelations() and nodes() directly.

  public child(_node: SchemaGraphNodeInterface, _key: string): SchemaGraphNodeInterface | undefined {
    const result = undefined;

    return result;
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
  public collectList(head: string): ListItemEntity.Type[] {
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
      && IRI_LIKE_RE.test(head);
    const headTerm = looksLikeIri
      ? {
        'equals': QuadGraphBuilder.probeNeverEquals,
        'termType': 'NamedNode' as const,
        'value': head
      }
      : {
        'equals': QuadGraphBuilder.probeNeverEquals,
        'termType': 'BlankNode' as const,
        'value': head
      };
    const items = Lists.collect(headTerm, this.quads);
    const result: ListItemEntity.Type[] = [];

    for (const item of items) {
      switch (item.termType) {
        case 'BlankNode':
          result.push({
            'target': item.value,
            'termType': 'BlankNode'
          });
          break;
        case 'Literal':
          result.push(this.literalListItem(item));
          break;
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
  public domainOf(_node: SchemaGraphNodeInterface): SchemaGraphNodeInterface | undefined {
    const result = undefined;

    return result;
  }

  /**
   * The quad-backed graph has no embedded-$id sub-schema index — it is built
   * from serialised OWL quads rather than from a live JSON Schema document.
   * Returns undefined for all ids.
   */
  public embeddedNode(_id: string): SchemaGraphNodeInterface | undefined {
    const result = undefined;

    return result;
  }

  /**
   * The quad-backed graph has no embedded-$id sub-schema index — it is built
   * from serialised OWL quads rather than from a live JSON Schema document.
   * Returns an empty iterator.
   */
  public embeddedSchemaIds(): IterableIterator<string> {
    const result = [][Symbol.iterator]();

    return result;
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
      'rootSchema': this.#rootSchema
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

  /**
   * Decode a `Literal` list item collected by `collectList`. Encodes the
   * typed JS value via String() so the `target` field remains a plain
   * string per the ListItemEntity.Type contract; callers recover the typed value
   * by re-applying Terms.decodeLiteral semantics through the `datatype`
   * IRI preserved here.
   */
  private literalListItem(item: Extract<QuadObjectType, { 'termType': 'Literal' }>): ListItemEntity.Type {
    const decoded = Terms.decodeLiteral(item);

    return {
      'datatype': item.datatype.value,
      'language': item.language,
      'target': decoded === null || decoded === undefined ? item.value : String(decoded),
      'termType': 'Literal'
    };
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
    const result = this.relationList.filter((rel) => {
      return rel.source.id === node.id;
    });

    return result;
  }

  public relationsForSubject(subjectIri: string): SchemaGraphRelationInterface[] {
    if (this.relationsBySubject === undefined) {
      const index = new Map<string, SchemaGraphRelationInterface[]>();

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

  public resolveFragment(fragment: string): SchemaGraphNodeInterface {
    const node = this.nodeMap.get(fragment);

    if (node === undefined) {
      throw new GraphError(`Unknown fragment in quad-backed graph: #${fragment}`, {
        'code': GRAPH_ERROR_CODE.ANCHOR_NOT_FOUND,
        'pointer': fragment
      });
    }

    return node;
  }

  public resolvePointer(pointer: string): SchemaGraphNodeInterface {
    const node = this.nodeMap.get(pointer);

    if (node === undefined) {
      throw new GraphError(`Node not found for pointer in quad-backed graph: ${pointer}`, {
        'code': GRAPH_ERROR_CODE.POINTER_NOT_FOUND,
        pointer
      });
    }

    return node;
  }

  public resolveReferenceId(reference: string): string {
    if (!reference.startsWith('#')) {
      return reference;
    }
    const fragment = reference.slice(1);
    const node = this.nodeMap.get(fragment);

    return node?.id ?? reference;
  }

  public get rootNode(): SchemaGraphNodeInterface {
    // The first named-class node, or a synthetic stub.
    const first = this.nodeList.at(0);

    return first ?? {
      'id': String(this.#rootSchema.$id ?? ''),
      'pointer': '',
      'schema': this.#rootSchema
    };
  }

  public get rootSchema(): Record<string, unknown> {
    return this.#rootSchema;
  }

  public semantics(_node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface {
    // Quad-backed graphs do not populate semantics — dispatchers use allRelations().
    const result = EMPTY_SEMANTICS;

    return result;
  }

  public validateStructure(): StructureWarningEntity.Type[] {
    return [];
  }
}
