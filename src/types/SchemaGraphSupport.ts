/**
 * Return types for SchemaGraphSupport helper functions.
 *
 * Every function in SchemaGraphSupport that returns a structured value
 * uses a named type declared here so the return-type naming rule is satisfied.
 *
 * @category Graph
 * @since 0.18.0
 * @group Graph
 */

import type {
  SchemaGraphNodeType,
  SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { RawRestrictionDescriptorType } from './RawRestrictionDescriptorType.js';
import type { AnnotatedEdgeDescriptorType } from '../types/AnnotatedEdgeDescriptorType.js';
import type { JtConfigType } from './JtConfig.js';

/**
 * Named return type for {@link normalizeLanguageTag}.
 *
 * The validated BCP-47 language tag string, or undefined when absent.
 *
 * @remarks
 * Throws a GraphError when a malformed tag is provided.
 *
 * @example
 * ```ts
 * const tag: NormalizedLanguageTagType = normalizeLanguageTag(rawLang);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type NormalizedLanguageTagType = string | undefined;

/**
 * Named return type for {@link normalizeAliases}.
 *
 * An immutable ordered list of alias strings from the `jt:alias` keyword.
 *
 * @remarks
 * Returns an empty array when the keyword is absent or has no string entries.
 *
 * @example
 * ```ts
 * const aliases: NormalizedAliasesType = normalizeAliases(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type NormalizedAliasesType = string[];

/**
 * Named return type for {@link extractRestrictions}.
 *
 * An immutable ordered list of raw restriction descriptor objects from
 * the `jt:restrictions` keyword.
 *
 * @remarks
 * Returns an empty array when the keyword is absent or has no valid entries.
 *
 * @example
 * ```ts
 * const restrictions: ExtractedRestrictionsType = extractRestrictions(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type ExtractedRestrictionsType = RawRestrictionDescriptorType[];

/**
 * Named return type for {@link extractAnnotatedEdgeDescriptor}.
 *
 * The parsed annotated-edge descriptor, or undefined when the keyword is absent.
 *
 * @remarks
 * Returns undefined when `jt:annotatedEdge` is not a valid record shape.
 *
 * @example
 * ```ts
 * const edge: ExtractedAnnotatedEdgeType = extractAnnotatedEdgeDescriptor(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type ExtractedAnnotatedEdgeType = AnnotatedEdgeDescriptorType | undefined;

/**
 * Named return type for {@link extractJtConfig}.
 *
 * The parsed jt:config object, or undefined when the keyword is absent.
 *
 * @remarks
 * Returns undefined when `jt:config` is not a valid record shape or has
 * no recognised fields.
 *
 * @example
 * ```ts
 * const cfg: ExtractedJtConfigType = extractJtConfig(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type ExtractedJtConfigType = JtConfigType | undefined;

/**
 * Named return type for {@link normalizeDynamicAnchor}.
 *
 * The `$dynamicAnchor` or `$recursiveAnchor` value, or undefined when absent.
 *
 * @remarks
 * When `$recursiveAnchor` is true the value is the empty string `''`.
 *
 * @example
 * ```ts
 * const anchor: NormalizedDynamicAnchorType = normalizeDynamicAnchor(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type NormalizedDynamicAnchorType = string | undefined;

/**
 * Named return type for {@link normalizeDependentRequired}.
 *
 * A record mapping property names to lists of required co-present properties.
 *
 * @remarks
 * Returns an empty record when `dependentRequired` is absent or has no
 * valid array-valued entries.
 *
 * @example
 * ```ts
 * const dr: NormalizedDependentRequiredType = normalizeDependentRequired(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type NormalizedDependentRequiredType = Record<string, string[]>;

/**
 * Named return type for {@link collectSchemaExtensions}.
 *
 * A record of all non-standard keyword entries from the schema object.
 *
 * @remarks
 * Extension keys are any keywords not in the `KNOWN_SCHEMA_KEYWORDS` set.
 *
 * @example
 * ```ts
 * const ext: SchemaExtensionsType = collectSchemaExtensions(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type SchemaExtensionsType = Record<string, unknown>;

/**
 * Named return type for {@link resolveAdditionalSchemaNode}.
 *
 * The `additionalProperties` or `additionalItems` value: either a boolean,
 * a resolved child node, or undefined when the keyword is absent.
 *
 * @remarks
 * Returns a boolean when the schema keyword is set to `true` or `false`;
 * otherwise resolves the child node.
 *
 * @example
 * ```ts
 * const node: AdditionalSchemaNodeType = resolveAdditionalSchemaNode(node, child, 'additionalProperties');
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type AdditionalSchemaNodeType = boolean | SchemaGraphNodeType | undefined;

/**
 * Named return type for {@link parentPropertiesPointer}, {@link propertyNameFromPointer},
 * {@link normalizeLanguageTag}, {@link normalizeDynamicAnchor}, and {@link strOrUndef}.
 *
 * Either a string value or undefined when the source is absent or the wrong type.
 *
 * @remarks
 * Used as the canonical "optional string" return shape throughout the
 * SchemaGraphSupport utilities.
 *
 * @example
 * ```ts
 * const ptr: OptionalStringType = parentPropertiesPointer(pointer);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type OptionalStringType = string | undefined;

/**
 * Named return type for {@link numOrUndef}.
 *
 * Either a number value or undefined when the source is absent or the wrong type.
 *
 * @remarks
 * Used as the canonical "optional number" return shape throughout the
 * SchemaGraphSupport utilities.
 *
 * @example
 * ```ts
 * const n: OptionalNumberType = numOrUndef(schema.maximum);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type OptionalNumberType = number | undefined;

/**
 * Named return type for {@link resolveAdditionalNodes}.
 *
 * Partial semantics containing `additionalItemsNode` and `additionalPropertiesNode`.
 *
 * @remarks
 * Used to compose the final SchemaGraphSemanticsType without repeating resolution logic.
 *
 * @example
 * ```ts
 * const nodes: AdditionalNodesResultType = resolveAdditionalNodes(graph, node);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type AdditionalNodesResultType = Pick<
  SchemaGraphSemanticsType,
  'additionalItemsNode' | 'additionalPropertiesNode'
>;

/**
 * Named return type for {@link extractDiscriminatorFields}.
 *
 * Partial semantics containing `discriminatorMapping` and `discriminatorPropertyName`.
 *
 * @remarks
 * Used to compose the final SchemaGraphSemanticsType without repeating discriminator logic.
 *
 * @example
 * ```ts
 * const fields: DiscriminatorFieldsType = extractDiscriminatorFields(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type DiscriminatorFieldsType = Pick<
  SchemaGraphSemanticsType,
  'discriminatorMapping' | 'discriminatorPropertyName'
>;

/**
 * Named return type for {@link extractRdfsDomainRange}.
 *
 * Partial semantics containing `rdfsDomain` and `rdfsRange`.
 *
 * @remarks
 * Used to compose the final SchemaGraphSemanticsType.
 *
 * @example
 * ```ts
 * const domainRange: DomainRangeFieldsType = extractRdfsDomainRange(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type DomainRangeFieldsType = Pick<SchemaGraphSemanticsType, 'rdfsDomain' | 'rdfsRange'>;

/**
 * Named return type for {@link extractScalarFields}.
 *
 * A record of all string/number/vocabulary scalar semantics fields extracted
 * from the raw schema object.
 *
 * @remarks
 * Consolidates all `typeof x === 'string/number'` extractions into one
 * named shape to keep `extractSemantics` within complexity limits.
 *
 * @example
 * ```ts
 * const scalars: ScalarFieldsType = extractScalarFields(schema);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type ScalarFieldsType = Pick<
  SchemaGraphSemanticsType,
  | 'comment'
  | 'contentEncoding'
  | 'contentMediaType'
  | 'description'
  | 'disjointWith'
  | 'dynamicRef'
  | 'equivalentTo'
  | 'exclusiveMaximum'
  | 'exclusiveMinimum'
  | 'format'
  | 'inverseOf'
  | 'maxContains'
  | 'maximum'
  | 'maxItems'
  | 'maxLength'
  | 'maxProperties'
  | 'minContains'
  | 'minimum'
  | 'minItems'
  | 'minLength'
  | 'minProperties'
  | 'multipleOf'
  | 'pattern'
  | 'recursiveRef'
  | 'schemaAnchor'
  | 'schemaDialect'
  | 'schemaId'
  | 'schemaVocabulary'
  | 'title'
>;

/**
 * Named return type for {@link buildSemanticsGraphPart}.
 *
 * The graph-traversal portion of the semantics: child nodes and indexed
 * children that require a live `GraphAccessorInterface` to resolve.
 *
 * @remarks
 * Used as a partial contribution to the final `SchemaGraphSemanticsType`
 * in `buildSemantics`, which merges this with the scalar and boolean fields.
 *
 * @example
 * ```ts
 * const part: SemanticsGraphPartType = buildSemanticsGraphPart(ctx);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type SemanticsGraphPartType = Pick<
  SchemaGraphSemanticsType,
  | 'allOf'
  | 'anyOf'
  | 'complementNode'
  | 'containsNode'
  | 'definitions'
  | 'dependentSchemaEntries'
  | 'elseNode'
  | 'ifNode'
  | 'itemsNode'
  | 'oneOf'
  | 'patternPropertyEntries'
  | 'prefixItems'
  | 'properties'
  | 'propertyNamesNode'
  | 'ref'
  | 'refTargetNode'
  | 'required'
  | 'thenNode'
  | 'unevaluatedItemsNode'
  | 'unevaluatedPropertiesNode'
>;

/**
 * Named return type for {@link extractBooleanFlags}.
 *
 * A record of all boolean semantics flags extracted from the raw schema object
 * and the resolved jt:config.
 *
 * @remarks
 * Consolidates all `schema.x === true` extractions into one named shape
 * to keep `extractSemantics` within complexity limits.
 *
 * @example
 * ```ts
 * const flags: BooleanFlagsType = extractBooleanFlags(schema, jtConfig);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type BooleanFlagsType = Pick<
  SchemaGraphSemanticsType,
  | 'asymmetric'
  | 'computed'
  | 'deprecated'
  | 'functional'
  | 'hasConst'
  | 'hasDefault'
  | 'inverseFunctional'
  | 'iriRef'
  | 'irreflexive'
  | 'jtFrozen'
  | 'readOnly'
  | 'recursiveAnchor'
  | 'reflexive'
  | 'symmetric'
  | 'transitive'
  | 'uniqueItems'
  | 'writeOnly'
>;

/**
 * A single property entry: a tuple of property name and its resolved graph node.
 *
 * @remarks
 * Used internally by `propertiesMap` in SchemaGraphSupport to build the properties
 * map from indexed graph entries.
 *
 * @example
 * ```ts
 * const entries: PropertyEntryType[] = graph.entries(node, 'properties');
 * ```
 *
 * @category Graph
 * @since 0.21.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type PropertyEntryType = [string, SchemaGraphNodeType];

/**
 * An immutable map from property name to the resolved schema graph node.
 *
 * @remarks
 * Returned by `propertiesMap` and held as `SchemaGraphSemanticsType.properties`.
 * Using a `ReadonlyMap` prevents mutation of the semantics cache.
 *
 * @example
 * ```ts
 * const map: PropertyMapType = propertiesMap(entries);
 * ```
 *
 * @category Graph
 * @since 0.21.0
 * @see {@link SchemaGraphSupport}
 * @group Graph
 */
export type PropertyMapType = ReadonlyMap<string, SchemaGraphNodeType>;
