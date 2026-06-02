import type {
  RelationPredicateType, RelationStructure
} from '../types/SchemaGraph.js';
import type { AnnotatedEdgeDescriptorInterface } from './AnnotatedEdgeDescriptorInterface.js';


import type { JsonSchemaType } from '../types/Schema.js';
import type { JtConfigType } from '../types/JtConfig.js';
import type { RawRestrictionDescriptorType } from '../types/RawRestrictionDescriptor.js';

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
 * const node: NormIRNodeInterface = {
 *   id: 'https://example.com/User#/properties/address',
 *   pointer: '/properties/address',
 * };
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link NormIRInterface}
 * @group SchemaGraph
 */
export interface NormIRNodeInterface {
  readonly 'id': string;
  readonly 'pointer': string;
}

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
 * @see {@link NormIRNodeInterface}
 * @group SchemaGraph
 */
export interface NormIRInterface {
  readonly 'anchors': Record<string, string>;
  readonly 'children': Record<string, Record<string, string>>;
  readonly 'entries': Record<string, Record<string, Array<[string, string]>>>;
  readonly 'indexedChildren': Record<string, Record<string, string[]>>;
  readonly 'nodes': NormIRNodeInterface[];
  readonly 'rootSchema': JsonSchemaType;
}

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
 * accept and return `SchemaGraphNodeInterface` to ensure traversal stays
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
 * @see {@link SchemaGraphSemanticsInterface}
 * @group SchemaGraph
 */
export interface SchemaGraphNodeInterface {
  'id': string;
  'pointer': string;
  'schema': JsonSchemaType;
}

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
 * @see {@link SchemaGraphNodeInterface}
 * @group SchemaGraph
 */
export interface SchemaGraphSemanticsInterface {
  'additionalItemsNode': boolean | SchemaGraphNodeInterface | undefined;
  'additionalPropertiesNode': boolean | SchemaGraphNodeInterface | undefined;
  'aliases': readonly string[];
  'allOf': SchemaGraphNodeInterface[];
  'annotatedEdge': AnnotatedEdgeDescriptorInterface | undefined;
  'anyOf': SchemaGraphNodeInterface[];
  'asymmetric': boolean;
  'comment': string | undefined;
  'complementNode': SchemaGraphNodeInterface | undefined;
  'computed': boolean;
  'constValue': unknown;
  'containsNode': SchemaGraphNodeInterface | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'defaultValue': unknown;
  'definitions': Array<[string, SchemaGraphNodeInterface]>;
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, SchemaGraphNodeInterface]>;
  'deprecated': boolean;
  'description': string | undefined;
  'discriminatorMapping': Record<string, string> | undefined;
  'discriminatorPropertyName': string | undefined;
  'disjointWith': string | undefined;
  'dynamicAnchor': string | undefined;
  'dynamicRef': string | undefined;
  'elseNode': SchemaGraphNodeInterface | undefined;
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
  'ifNode': SchemaGraphNodeInterface | undefined;
  'inverseFunctional': boolean;
  'inverseOf': string | undefined;
  'iriRef': boolean;
  'irreflexive': boolean;
  'itemsNode': SchemaGraphNodeInterface | undefined;
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
  'oneOf': SchemaGraphNodeInterface[];
  'pattern': string | undefined;
  'patternPropertyEntries': Array<[string, SchemaGraphNodeInterface]>;
  'prefixItems': SchemaGraphNodeInterface[];
  'properties': ReadonlyMap<string, SchemaGraphNodeInterface>;
  'propertyNamesNode': SchemaGraphNodeInterface | undefined;
  'rdfsDomain': string | undefined;
  'rdfsRange': string | undefined;
  'readOnly': boolean;
  'recursiveAnchor': boolean;
  'recursiveRef': string | undefined;
  'ref': string | undefined;
  'reflexive': boolean;
  'refTargetNode': SchemaGraphNodeInterface | undefined;
  'required': string[];
  'restrictions': readonly RawRestrictionDescriptorType[];
  'schemaAnchor': string | undefined;
  'schemaDialect': string | undefined;
  'schemaId': string | undefined;
  'schemaTypes': string[];
  'schemaVocabulary': unknown;
  'symmetric': boolean;
  'thenNode': SchemaGraphNodeInterface | undefined;
  'title': string | undefined;
  'transitive': boolean;
  'unevaluatedItemsNode': SchemaGraphNodeInterface | undefined;
  'unevaluatedPropertiesNode': SchemaGraphNodeInterface | undefined;
  'uniqueItems': boolean;
  'writeOnly': boolean;
}

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
 * @see {@link SchemaGraphNodeInterface}
 * @group SchemaGraph
 */
export interface SchemaGraphRelationInterface {
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
  'source': SchemaGraphNodeInterface;
  'structure'?: RelationStructure;
  'target': SchemaGraphNodeInterface | string;
  /**
   * rdf/js term-type discriminator for the relation's target. Populated by
   * the quad-backed graph during construction; left undefined by the
   * forward-projection graph (whose targets are always graph nodes or IRIs).
   */
  readonly 'termType'?: 'BlankNode' | 'Literal' | 'NamedNode';
}

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
 * @see {@link SchemaGraphNodeInterface}
 * @group SchemaGraph
 */
export interface StructureWarningInterface {
  'message': string;
  'path': string;
  'rule': string;
}

export { type ListItemType } from '../types/SchemaGraph.js';
