import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { AnnotatedEdgeDescriptorEntity } from '../entities/AnnotatedEdgeDescriptorEntity.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { JtConfigEntity } from '../entities/JtConfigEntity.js';
import type { RawRestrictionDescriptorEntity } from '../entities/RawRestrictionDescriptorEntity.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';

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
  'aliases': StringArrayEntity.Type;
  'allOf': SchemaGraphNodeInterface[];
  'annotatedEdge': AnnotatedEdgeDescriptorEntity.Type | undefined;
  'anyOf': SchemaGraphNodeInterface[];
  'asymmetric': BooleanValueEntity.Type;
  'comment': string | undefined;
  'complementNode': SchemaGraphNodeInterface | undefined;
  'computed': BooleanValueEntity.Type;
  'constValue': unknown;
  'containsNode': SchemaGraphNodeInterface | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'defaultValue': unknown;
  'definitions': Array<[string, SchemaGraphNodeInterface]>;
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, SchemaGraphNodeInterface]>;
  'deprecated': BooleanValueEntity.Type;
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
  'functional': BooleanValueEntity.Type;
  'hasConst': BooleanValueEntity.Type;
  'hasDefault': BooleanValueEntity.Type;
  'ifNode': SchemaGraphNodeInterface | undefined;
  'inverseFunctional': BooleanValueEntity.Type;
  'inverseOf': string | undefined;
  'iriRef': BooleanValueEntity.Type;
  'irreflexive': BooleanValueEntity.Type;
  'itemsNode': SchemaGraphNodeInterface | undefined;
  'jtConfig': JtConfigEntity.Type | undefined;
  'jtFrozen': BooleanValueEntity.Type;
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
  'readOnly': BooleanValueEntity.Type;
  'recursiveAnchor': BooleanValueEntity.Type;
  'recursiveRef': string | undefined;
  'ref': string | undefined;
  'reflexive': BooleanValueEntity.Type;
  'refTargetNode': SchemaGraphNodeInterface | undefined;
  'required': StringArrayEntity.Type;
  'restrictions': RawRestrictionDescriptorEntity.Type[];
  'schemaAnchor': string | undefined;
  'schemaDialect': string | undefined;
  'schemaId': string | undefined;
  'schemaTypes': StringArrayEntity.Type;
  'schemaVocabulary': unknown;
  'symmetric': BooleanValueEntity.Type;
  'thenNode': SchemaGraphNodeInterface | undefined;
  'title': string | undefined;
  'transitive': BooleanValueEntity.Type;
  'unevaluatedItemsNode': SchemaGraphNodeInterface | undefined;
  'unevaluatedPropertiesNode': SchemaGraphNodeInterface | undefined;
  'uniqueItems': BooleanValueEntity.Type;
  'writeOnly': BooleanValueEntity.Type;
}
