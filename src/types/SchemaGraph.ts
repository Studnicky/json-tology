import type { JsonSchemaType } from './Schema.js';
import type { AnnotatedEdgeDescriptorType } from './AnnotatedEdgeDescriptorType.js';
import type { JtConfigType } from './JtConfig.js';
import type { RawRestrictionDescriptorType } from './RawRestrictionDescriptorType.js';

/**
 * Item produced by `SchemaGraphInterface.collectList` when walking an
 * `rdf:first` / `rdf:rest` / `rdf:nil` chain.
 *
 * Preserves the term shape from the underlying quad store so callers can
 * distinguish blank nodes (anonymous class expressions / facet bnodes),
 * named nodes (IRI references), and literals (with language tags / datatype
 * IRIs) without having to walk raw quads themselves.
 */
export type ListItemType = {
  /** XSD datatype IRI for Literal items (omitted for NamedNode / BlankNode). */
  readonly 'datatype'?: string;
  /** BCP47 language tag for Literal items (omitted for NamedNode / BlankNode). */
  readonly 'language'?: string;
  /** Target value: IRI for NamedNode, bnode id for BlankNode, lexical string for Literal. */
  readonly 'target': string;
  /** rdf/js term-type discriminator for the list item. */
  readonly 'termType': 'BlankNode' | 'Literal' | 'NamedNode';
};

export type RelationPredicateType
  = | 'dash:readOnly'
  | 'dash:writeOnly'
  | 'dct:format'
  | 'jt:dependentRequired'
  | 'jt:multipleOf'
  | 'owl:AsymmetricProperty'
  | 'owl:complementOf'
  | 'owl:deprecated'
  | 'owl:disjointWith'
  | 'owl:equivalentClass'
  | 'owl:FunctionalProperty'
  | 'owl:hasValue'
  | 'owl:InverseFunctionalProperty'
  | 'owl:inverseOf'
  | 'owl:IrreflexiveProperty'
  | 'owl:maxQualifiedCardinality'
  | 'owl:minQualifiedCardinality'
  | 'owl:oneOf'
  | 'owl:ReflexiveProperty'
  | 'owl:Restriction'
  | 'owl:someValuesFrom'
  | 'owl:SymmetricProperty'
  | 'owl:TransitiveProperty'
  | 'owl:unionOf'
  | 'rdf:type'
  | 'rdfs:comment'
  | 'rdfs:domain'
  | 'rdfs:label'
  | 'rdfs:member'
  | 'rdfs:range'
  | 'rdfs:subClassOf'
  | 'sh:closed'
  | 'sh:datatype'
  | 'sh:maxCount'
  | 'sh:maxExclusive'
  | 'sh:maxInclusive'
  | 'sh:maxLength'
  | 'sh:minCount'
  | 'sh:minExclusive'
  | 'sh:minInclusive'
  | 'sh:minLength'
  | 'sh:pattern'
  | (string & {});

/**
 * Structure variants for complex RDF patterns that cannot be expressed
 * as a single flat relation. Each variant maps to a format-independent
 * RDF concept — not a serialization format shape.
 *
 * - restriction: OWL restriction blank node (onProperty + constraint predicates)
 * - list: RDF list (rdf:first/rdf:rest chain of IRIs or blank nodes)
 * - conditional: material conditional (union of intersections for if/then/else)
 * - annotatedEdge: RDF 1.2 triple-term — base triple plus one annotation per entry.
 *   `edgePredicate` is the predicate IRI of the base triple;
 *   `edgeTarget` is the IRI of the base triple object;
 *   `edgeAnnotations` carries the raw annotation sub-schema for each annotation
 *   so predicate IRIs are resolved late (at projection/lift time) via PredicateResolver,
 *   consistent with every other predicate in the system.
 */
export type RelationStructureType
  = | { 'constraint': RelationPredicateType;
    'kind': 'restriction';
    'onProperty': string;
    'value': unknown }
  | {
    'edgeAnnotations': ReadonlyArray<{
      readonly 'propertyName': string;
      readonly 'propertySchema': JsonSchemaType;
      readonly 'rangeRef': string;
    }>;
    'edgePredicate': string;
    'edgeTarget': string;
    'kind': 'annotatedEdge';
  }
  | { 'elseRef'?: string
    'ifRef': string;
    'kind': 'conditional';
    'thenRef'?: string; }
  | { 'kind': 'list';
    'members': string[] };

/**
 * Identity record for a single node in the normalized intermediate representation.
 *
 * @remarks
 * Pairs a schema node's absolute IRI with the JSON Pointer used to locate it
 * within the root schema document. These two coordinates uniquely identify any
 * subschema, including anonymous nodes reached through `$defs`, `properties`,
 * composition branches, or conditional sub-schemas.
 *
 * @example
 * ```ts
 * const node: NormIRNodeType = {
 *   id: 'https://example.com/User#/properties/address',
 *   pointer: '/properties/address',
 * };
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link NormIRType}
 * @group SchemaGraph
 */
export type NormIRNodeType = {
  readonly 'id': string;
  readonly 'pointer': string;
};

/**
 * Normalized intermediate representation of a fully traversed schema document.
 *
 * @remarks
 * Produced during the graph-build phase by walking all reachable subschemas in
 * a registered schema document. Captures the complete structural index used
 * to construct the canonical graph:
 * - `nodes` — all reachable subschema nodes.
 * - `children` — direct child nodes keyed by parent IRI and child keyword.
 * - `indexedChildren` — array-valued children (e.g. `allOf`, `oneOf` members).
 * - `entries` — tuple-valued children (e.g. `properties` entries as `[key, nodeId]` pairs).
 * - `anchors` — `$anchor` / `$recursiveAnchor` map from anchor name to node IRI.
 * - `rootSchema` — the original schema document that was traversed.
 *
 * @example
 * ```ts
 * const ir = graph.getNormIR();
 * const childId = ir.children['https://example.com/User']?.['properties/name'];
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link NormIRNodeType}
 * @group SchemaGraph
 */
export type NormIRType = {
  readonly 'anchors': Record<string, string>;
  readonly 'children': Record<string, Record<string, string>>;
  readonly 'entries': Record<string, Record<string, Array<[string, string]>>>;
  readonly 'indexedChildren': Record<string, Record<string, string[]>>;
  readonly 'nodes': NormIRNodeType[];
  readonly 'rootSchema': JsonSchemaType;
};

/**
 * A single node in the canonical schema graph.
 *
 * @remarks
 * Represents any addressable subschema — the root schema, a named `$defs`
 * entry, an inline `properties` value, a composition branch, or any other
 * reachable JSON Schema object. The `id` is the absolute IRI computed during
 * traversal; `pointer` is the JSON Pointer relative to the root document;
 * `schema` is the raw JSON Schema object at that location.
 *
 * Graph operations (validation, semantics extraction, relation indexing) all
 * accept and return `SchemaGraphNodeType` to ensure traversal stays
 * within the canonical node set.
 *
 * @example
 * ```ts
 * const node = graph.node(schema);
 * if (node) {
 *   const semantics = graph.semantics(node);
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link SchemaGraphSemanticsType}
 * @group SchemaGraph
 */
export type SchemaGraphNodeType = {
  'id': string;
  'pointer': string;
  'schema': JsonSchemaType;
};

/**
 * Fully projected semantic view of a schema graph node.
 *
 * @remarks
 * Returned by `SchemaGraphInterface.semantics(node)`. Every JSON Schema keyword
 * understood by the engine is surfaced as a typed field, with absent keywords
 * returning `undefined`, `false`, or an empty array/map as appropriate for the
 * field's type. Extension keywords and json-tology-specific fields (prefixed
 * `jt`) are included alongside the standard vocabulary.
 *
 * Consumers should read from this interface rather than from `node.schema`
 * directly: the graph normalizes composition (`allOf` members, `$ref` targets,
 * recursive anchors) and computes derived fields (`computed`, `iriRef`,
 * `schemaTypes`) that are not present verbatim in the raw JSON Schema.
 *
 * @example
 * ```ts
 * const sem = graph.semantics(node);
 * if (sem.required.includes('id')) {
 *   // 'id' is a required property
 * }
 * for (const [key, childNode] of sem.properties) {
 *   // iterate declared properties
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link SchemaGraphNodeType}
 * @group SchemaGraph
 */
export type SchemaGraphSemanticsType = {
  'additionalItemsNode': boolean | SchemaGraphNodeType | undefined;
  'additionalPropertiesNode': boolean | SchemaGraphNodeType | undefined;
  'aliases': readonly string[];
  'allOf': SchemaGraphNodeType[];
  'annotatedEdge': AnnotatedEdgeDescriptorType | undefined;
  'anyOf': SchemaGraphNodeType[];
  'asymmetric': boolean;
  'comment': string | undefined;
  'complementNode': SchemaGraphNodeType | undefined;
  'computed': boolean;
  'constValue': unknown;
  'containsNode': SchemaGraphNodeType | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'defaultValue': unknown;
  'definitions': Array<[string, SchemaGraphNodeType]>;
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, SchemaGraphNodeType]>;
  'deprecated': boolean;
  'description': string | undefined;
  'discriminatorMapping': Record<string, string> | undefined;
  'discriminatorPropertyName': string | undefined;
  'disjointWith': string | undefined;
  'dynamicAnchor': string | undefined;
  'dynamicRef': string | undefined;
  'elseNode': SchemaGraphNodeType | undefined;
  'enumValues': undefined | unknown[];
  'equivalentTo': string | undefined;
  'examples': undefined | unknown[];
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'extensions': Record<string, unknown>;
  'format': string | undefined;
  'functional': boolean;
  'hasConst': boolean;
  'hasDefault': boolean;
  'ifNode': SchemaGraphNodeType | undefined;
  'inverseFunctional': boolean;
  'inverseOf': string | undefined;
  'iriRef': boolean;
  'irreflexive': boolean;
  'itemsNode': SchemaGraphNodeType | undefined;
  'jtConfig': JtConfigType | undefined;
  'jtFrozen': boolean;
  'jtStrict': boolean | undefined;
  'language': string | undefined;
  'maxContains': number | undefined;
  'maximum': number | undefined;
  'maxItems': number | undefined;
  'maxLength': number | undefined;
  'maxProperties': number | undefined;
  'minContains': number | undefined;
  'minimum': number | undefined;
  'minItems': number | undefined;
  'minLength': number | undefined;
  'minProperties': number | undefined;
  'multipleOf': number | undefined;
  'oneOf': SchemaGraphNodeType[];
  'pattern': string | undefined;
  'patternPropertyEntries': Array<[string, SchemaGraphNodeType]>;
  'prefixItems': SchemaGraphNodeType[];
  'properties': ReadonlyMap<string, SchemaGraphNodeType>;
  'propertyNamesNode': SchemaGraphNodeType | undefined;
  'rdfsDomain': string | undefined;
  'rdfsRange': string | undefined;
  'readOnly': boolean;
  'recursiveAnchor': boolean;
  'recursiveRef': string | undefined;
  'ref': string | undefined;
  'reflexive': boolean;
  'refTargetNode': SchemaGraphNodeType | undefined;
  'required': string[];
  'restrictions': readonly RawRestrictionDescriptorType[];
  'schemaAnchor': string | undefined;
  'schemaDialect': string | undefined;
  'schemaId': string | undefined;
  'schemaTypes': string[];
  'schemaVocabulary': unknown;
  'symmetric': boolean;
  'thenNode': SchemaGraphNodeType | undefined;
  'title': string | undefined;
  'transitive': boolean;
  'unevaluatedItemsNode': SchemaGraphNodeType | undefined;
  'unevaluatedPropertiesNode': SchemaGraphNodeType | undefined;
  'uniqueItems': boolean;
  'writeOnly': boolean;
};

/**
 * A directed edge in the canonical schema graph connecting a source node to a
 * target via a named predicate.
 *
 * @remarks
 * Relations are the primary query surface for ontology serializers,
 * materialization logic, and graph traversal utilities. Each relation carries
 * the predicate IRI (e.g. `rdfs:subClassOf`, `rdf:type`, an annotation
 * property IRI), source and target nodes or literal IRIs, and optional metadata
 * such as RDF term-type, XSD datatype, and BCP47 language tag.
 *
 * The `structure` field records how the relation was derived (e.g. from an
 * `allOf` member, a `$ref`, a composition operator) to support downstream
 * consumers that need to distinguish structural from semantic edges.
 *
 * @example
 * ```ts
 * for (const rel of graph.allRelations()) {
 *   if (rel.predicate === 'rdfs:subClassOf') {
 *     console.log(rel.source.id, '->', rel.target);
 *   }
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link SchemaGraphNodeType}
 * @group SchemaGraph
 */
export type SchemaGraphRelationType = {
  /**
   * XSD datatype IRI when `target` is a Literal — empty / undefined for
   * NamedNode or BlankNode targets. Populated by the quad-backed graph from
   * the source quad's `object.datatype.value`; the forward-projection graph
   * leaves it undefined because datatype is computed at projection time.
   */
  readonly 'datatype'?: string;
  /**
   * BCP47 language tag when `target` is a language-tagged Literal — empty /
   * undefined otherwise. Populated by the quad-backed graph from the source
   * quad's `object.language`.
   */
  readonly 'language'?: string;
  'metadata'?: Record<string, unknown>;
  'predicate': RelationPredicateType;
  'source': SchemaGraphNodeType;
  'structure'?: RelationStructureType;
  'target': SchemaGraphNodeType | string;
  /**
   * rdf/js term-type discriminator for the relation's target. Populated by
   * the quad-backed graph during construction; left undefined by the
   * forward-projection graph (whose targets are always graph nodes or IRIs).
   */
  readonly 'termType'?: 'BlankNode' | 'Literal' | 'NamedNode';
};

/**
 * A single diagnostic warning produced by `SchemaGraphInterface.validateStructure`.
 *
 * @remarks
 * Structure warnings surface schema graph inconsistencies that do not prevent
 * execution but indicate modelling issues: missing `$id` on referenced nodes,
 * dangling `$ref` IRIs, unreachable `$defs` entries, or other structural
 * invariants that the graph enforces. Each warning identifies the rule that
 * fired, the JSON Pointer path within the schema document where the issue was
 * detected, and a human-readable message describing the problem.
 *
 * @example
 * ```ts
 * const warnings = graph.validateStructure();
 * for (const w of warnings) {
 *   console.warn(`[${w.rule}] at ${w.path}: ${w.message}`);
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link SchemaGraphNodeType}
 * @group SchemaGraph
 */
export type StructureWarningType = {
  'message': string;
  'path': string;
  'rule': string;
};
