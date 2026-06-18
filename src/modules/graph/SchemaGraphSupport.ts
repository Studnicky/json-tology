import type {
  SchemaGraphNodeType,
  SchemaGraphSemanticsType, StructureWarningType
} from '../../types/SchemaGraph.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import { RDFS } from '../../constants/IRI.js';
import { ALLOF_EXTENSION_RE } from '../../constants/GRAPH_REGEXES.js';
import { EMPTY_SEMANTICS } from '../../constants/EMPTY_SEMANTICS.js';
import {
  DEFS_POINTER_PARTS_LENGTH, KNOWN_SCHEMA_KEYWORDS,
  MIN_PROPERTY_POINTER_PARTS,
  PRIMITIVE_CONSTRAINT_KEYWORDS,
  PRIMITIVE_TYPES
} from '../../constants/SCHEMA_KEYWORDS.js';
import { DataType } from '../data/DataType.js';
import { SchemaIri } from './SchemaIri.js';
import type { JsonSchemaType } from '../../types/Schema.js';
import type { GraphAccessorInterface } from '../../interfaces/GraphAccessorInterface.js';
import type { JtConfigType } from '../../types/JtConfig.js';
import { RESTRICTIONS_KEY } from '../../constants/COMPOSITION.js';
import type { RawRestrictionDescriptorType } from '../../types/RawRestrictionDescriptorType.js';
import type {
  AdditionalNodesResultType,
  AdditionalSchemaNodeType,
  BooleanFlagsType,
  ExtractedAnnotatedEdgeType,
  ExtractedJtConfigType,
  ExtractedRestrictionsType,
  NormalizedAliasesType,
  NormalizedDependentRequiredType,
  NormalizedDynamicAnchorType,
  NormalizedLanguageTagType,
  OptionalNumberType,
  OptionalStringType,
  PropertyEntry,
  PropertyMap,
  ScalarFieldsType,
  SchemaExtensionsType,
  SemanticsBuildContextType
} from '../../types/SchemaGraphSupport.js';

/** BCP-47 language tag pattern: one or more subtags of 1–8 ASCII chars, hyphen-separated. */
const BCP47_TAG_RE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/u;

/** Type guard for string values; used in array filters. */
function isString(entry: unknown): boolean {
  return typeof entry === 'string';
}

/** Error message prefix for invalid BCP-47 language tags. */
const BCP47_INVALID_TAG_PREFIX = 'x-jt-language value is not a valid BCP-47 language tag: ';

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

/**
 * Validate and normalize the `x-jt-language` annotation. Returns the tag when it
 * matches the BCP-47 shape, `undefined` when absent, and throws a GraphError for
 * a malformed tag (e.g. `"\n"`, `"INVALID!!!"`).
 */
function normalizeLanguageTag(rawLang: unknown): NormalizedLanguageTagType {
  if (typeof rawLang !== 'string') {
    return undefined;
  }

  if (!BCP47_TAG_RE.test(rawLang)) {
    throw new GraphError(
      `${BCP47_INVALID_TAG_PREFIX}${JSON.stringify(rawLang)}`,
      { 'code': GraphErrorCode.INVALID_LANGUAGE_TAG }
    );
  }

  return rawLang;
}

function normalizeAliases(schema: Record<string, unknown>): NormalizedAliasesType {
  const raw = schema['jt:alias'];

  if (typeof raw === 'string') {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw.filter((entry: unknown): boolean => {
      return isString(entry);
    }) as string[];
  }

  return [];
}

function extractRestrictions(schema: Record<string, unknown>): ExtractedRestrictionsType {
  const raw = schema[RESTRICTIONS_KEY];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((entry: unknown): boolean => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }
    const rec = entry as Record<string, unknown>;

    return typeof rec.kind === 'string' && typeof rec.onProperty === 'string' && 'value' in rec;
  }) as RawRestrictionDescriptorType[];
}

function extractAnnotatedEdgeDescriptor(schema: Record<string, unknown>): ExtractedAnnotatedEdgeType {
  const raw = schema['jt:annotatedEdge'];

  if (!DataType.isRecord(raw)) {
    return undefined;
  }

  const predicate = typeof raw.predicate === 'string' ? raw.predicate : undefined;
  const targetRef = typeof raw.targetRef === 'string' ? raw.targetRef : undefined;

  if (predicate === undefined || targetRef === undefined) {
    return undefined;
  }

  const annotations: Record<string, JsonSchemaType> = {};

  if (DataType.isRecord(raw.annotations)) {
    for (const [
      propName,
      propSchema
    ] of Object.entries(raw.annotations)) {
      // Carry the whole annotation sub-schema (range `$ref` plus any
      // predicate-binding keywords like x-jt-predicate / $id) so the predicate
      // IRI can be grounded by PredicateResolver at projection/lift time.
      if (DataType.isRecord(propSchema) && typeof propSchema.$ref === 'string') {
        annotations[propName] = propSchema;
      }
    }
  }

  return {
    annotations,
    predicate,
    targetRef
  };
}

function extractJtConfig(schema: Record<string, unknown>): ExtractedJtConfigType {
  const raw = schema['jt:config'];

  if (!DataType.isRecord(raw)) {
    return undefined;
  }

  const config: JtConfigType = {};

  if (typeof raw.strict === 'boolean') {
    config.strict = raw.strict;
  }
  if (typeof raw.frozen === 'boolean') {
    config.frozen = raw.frozen;
  }
  if (raw.extra === 'allow' || raw.extra === 'forbid' || raw.extra === 'ignore') {
    config.extra = raw.extra;
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

const EMPTY_MAP: PropertyMap = new Map();

function propertiesMap(entries: PropertyEntry[]): PropertyMap {
  return entries.length === 0 ? EMPTY_MAP : new Map(entries);
}

function normalizeSchemaTypes(schema: Record<string, unknown>): string[] {
  const rawType = schema.type;

  if (typeof rawType === 'string') {
    return [rawType];
  }

  if (Array.isArray(rawType)) {
    return rawType.filter((entry: unknown): boolean => {
      return isString(entry);
    }) as string[];
  }

  return [];
}

function normalizeDynamicAnchor(schema: Record<string, unknown>): NormalizedDynamicAnchorType {
  if (typeof schema.$dynamicAnchor === 'string') {
    return schema.$dynamicAnchor;
  }

  if (schema.$recursiveAnchor === true) {
    return '';
  }

  return undefined;
}

function normalizeDependentRequired(schema: Record<string, unknown>): NormalizedDependentRequiredType {
  if (!DataType.isRecord(schema.dependentRequired)) {
    return {};
  }

  const result: NormalizedDependentRequiredType = {};

  for (const [
    key,
    value
  ] of Object.entries(schema.dependentRequired)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const entries = value.filter((entry: unknown): boolean => {
      return isString(entry);
    }) as string[];

    result[key] = entries;
  }

  return result;
}

function collectSchemaExtensions(schema: Record<string, unknown>): SchemaExtensionsType {
  const extensions: SchemaExtensionsType = {};

  for (const key of Object.keys(schema)) {
    if (!KNOWN_SCHEMA_KEYWORDS.has(key)) {
      extensions[key] = schema[key];
    }
  }

  return extensions;
}

function resolveAdditionalSchemaNode(
  node: SchemaGraphNodeType,
  child: (node: SchemaGraphNodeType, key: string) => SchemaGraphNodeType | undefined,
  key: 'additionalItems' | 'additionalProperties'
): AdditionalSchemaNodeType {
  if (!DataType.isRecord(node.schema) || !(key in node.schema)) {
    return undefined;
  }

  const rawValue = node.schema[key];

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  return child(node, key);
}

function pointerId(rootSchema: JsonSchemaType, pointer: string): string {
  if (pointer === '') {
    return typeof rootSchema === 'object'
      && !Array.isArray(rootSchema)
      && typeof rootSchema.$id === 'string'
      ? rootSchema.$id
      : '#root';
  }

  if (typeof rootSchema === 'object'
    && !Array.isArray(rootSchema)
    && typeof rootSchema.$id === 'string') {
    return `${rootSchema.$id}#${pointer}`;
  }

  return `#${pointer}`;
}


function constraintKeywordsOf(schema: Record<string, unknown>): string[] {
  return Object.keys(schema).filter((key: string): boolean => {
    return PRIMITIVE_CONSTRAINT_KEYWORDS.has(key);
  });
}

function isInDefs(pointer: string): boolean {
  return pointer.includes('/$defs/');
}

function isInAllOfExtensionBlock(pointer: string): boolean {
  // Skip direct allOf members (/allOf/0, /allOf/1, etc.) and their properties
  // These are produced by Compose.extend and are structural, not inline definitions
  return ALLOF_EXTENSION_RE.test(pointer);
}

// ---------------------------------------------------------------------------
// extractSemantics — broken into focused helpers to meet the complexity limit
// ---------------------------------------------------------------------------

/** Resolve additional schema nodes (additionalItems and additionalProperties). */
function resolveAdditionalNodes(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeType
): AdditionalNodesResultType {
  return {
    'additionalItemsNode': resolveAdditionalSchemaNode(node, (parent: SchemaGraphNodeType, key: string): SchemaGraphNodeType | undefined => {
      return graph.child(parent, key);
    }, 'additionalItems'),
    'additionalPropertiesNode': resolveAdditionalSchemaNode(node, (parent: SchemaGraphNodeType, key: string): SchemaGraphNodeType | undefined => {
      return graph.child(parent, key);
    }, 'additionalProperties')
  };
}

/** Coerce a schema property to string or undefined. */
function strOrUndef(val: unknown): OptionalStringType {
  return typeof val === 'string' ? val : undefined;
}

/** Coerce a schema property to number or undefined. */
function numOrUndef(val: unknown): OptionalNumberType {
  return typeof val === 'number' ? val : undefined;
}

/** Extract all scalar (string, number, vocabulary) fields from the schema. */
function extractScalarFields(schema: Record<string, unknown>): ScalarFieldsType {
  return {
    'comment': strOrUndef(schema.$comment),
    'contentEncoding': strOrUndef(schema.contentEncoding),
    'contentMediaType': strOrUndef(schema.contentMediaType),
    'description': strOrUndef(schema.description),
    'disjointWith': strOrUndef(schema.disjointWith),
    'dynamicRef': strOrUndef(schema.$dynamicRef),
    'equivalentTo': strOrUndef(schema.equivalentTo),
    'exclusiveMaximum': numOrUndef(schema.exclusiveMaximum),
    'exclusiveMinimum': numOrUndef(schema.exclusiveMinimum),
    'format': strOrUndef(schema.format),
    'inverseOf': strOrUndef(schema.inverseOf),
    'maxContains': numOrUndef(schema.maxContains),
    'maximum': numOrUndef(schema.maximum),
    'maxItems': numOrUndef(schema.maxItems),
    'maxLength': numOrUndef(schema.maxLength),
    'maxProperties': numOrUndef(schema.maxProperties),
    'minContains': numOrUndef(schema.minContains),
    'minimum': numOrUndef(schema.minimum),
    'minItems': numOrUndef(schema.minItems),
    'minLength': numOrUndef(schema.minLength),
    'minProperties': numOrUndef(schema.minProperties),
    'multipleOf': numOrUndef(schema.multipleOf),
    'pattern': strOrUndef(schema.pattern),
    'recursiveRef': strOrUndef(schema.$recursiveRef),
    'schemaAnchor': strOrUndef(schema.$anchor),
    'schemaDialect': strOrUndef(schema.$schema),
    'schemaId': strOrUndef(schema.$id),
    'schemaVocabulary': schema.$vocabulary,
    'title': strOrUndef(schema.title)
  };
}

/** Extract all boolean flag fields from the schema. */
function extractBooleanFlags(
  schema: Record<string, unknown>,
  jtConfig: ExtractedJtConfigType
): BooleanFlagsType {
  return {
    'asymmetric': schema.asymmetric === true,
    'computed': schema['jt:computed'] === true,
    'deprecated': schema.deprecated === true,
    'functional': schema.functional === true,
    'hasConst': 'const' in schema,
    'hasDefault': 'default' in schema,
    'inverseFunctional': schema.inverseFunctional === true,
    'iriRef': schema['x-jt-iriRef'] === true
      || (typeof schema.format === 'string' && schema.format === 'iri'),
    'irreflexive': schema.irreflexive === true,
    'jtFrozen': schema['jt:frozen'] === true || jtConfig?.frozen === true,
    'readOnly': schema.readOnly === true,
    'recursiveAnchor': schema.$recursiveAnchor === true,
    'reflexive': schema.reflexive === true,
    'symmetric': schema.symmetric === true,
    'transitive': schema.transitive === true,
    'uniqueItems': schema.uniqueItems === true,
    'writeOnly': schema.writeOnly === true
  };
}

// ---------------------------------------------------------------------------
// validateGraphStructure helpers
// ---------------------------------------------------------------------------

/** Build the full SchemaGraphSemanticsType from a validated schema record. */
function buildSemantics(ctx: SemanticsBuildContextType): SchemaGraphSemanticsType {
  const {
    graph,
    node,
    ref,
    resolveLocalRef,
    schema
  } = ctx;

  const jtConfig = extractJtConfig(schema);
  const additional = resolveAdditionalNodes(graph, node);
  const flags = extractBooleanFlags(schema, jtConfig);
  const scalar = extractScalarFields(schema);
  const discriminator = DataType.isRecord(schema.discriminator) ? schema.discriminator : undefined;

  return {
    'additionalItemsNode': additional.additionalItemsNode,
    'additionalPropertiesNode': additional.additionalPropertiesNode,
    'aliases': normalizeAliases(schema),
    'allOf': graph.indexedChildren(node, 'allOf'),
    'annotatedEdge': extractAnnotatedEdgeDescriptor(schema),
    'anyOf': graph.indexedChildren(node, 'anyOf'),
    'asymmetric': flags.asymmetric,
    'comment': scalar.comment,
    'complementNode': graph.child(node, 'not'),
    'computed': flags.computed,
    'constValue': 'const' in schema ? schema.const : undefined,
    'containsNode': graph.child(node, 'contains'),
    'contentEncoding': scalar.contentEncoding,
    'contentMediaType': scalar.contentMediaType,
    'defaultValue': 'default' in schema ? schema.default : undefined,
    'definitions': graph.entries(node, 'definitions'),
    'dependentRequired': normalizeDependentRequired(schema),
    'dependentSchemaEntries': graph.entries(node, 'dependentSchemas'),
    'deprecated': flags.deprecated,
    'description': scalar.description,
    'discriminatorMapping': discriminator !== undefined && DataType.isRecord(discriminator.mapping)
      ? discriminator.mapping as Record<string, string>
      : undefined,
    'discriminatorPropertyName': discriminator !== undefined && typeof discriminator.propertyName === 'string'
      ? discriminator.propertyName
      : undefined,
    'disjointWith': scalar.disjointWith,
    'dynamicAnchor': normalizeDynamicAnchor(schema),
    'dynamicRef': scalar.dynamicRef,
    'elseNode': graph.child(node, 'else'),
    'enumValues': Array.isArray(schema.enum) ? schema.enum : undefined,
    'equivalentTo': scalar.equivalentTo,
    'examples': Array.isArray(schema.examples) ? schema.examples : undefined,
    'exclusiveMaximum': scalar.exclusiveMaximum,
    'exclusiveMinimum': scalar.exclusiveMinimum,
    'extensions': collectSchemaExtensions(schema),
    'format': scalar.format,
    'functional': flags.functional,
    'hasConst': flags.hasConst,
    'hasDefault': flags.hasDefault,
    'ifNode': graph.child(node, 'if'),
    'inverseFunctional': flags.inverseFunctional,
    'inverseOf': scalar.inverseOf,
    'iriRef': flags.iriRef,
    'irreflexive': flags.irreflexive,
    'itemsNode': graph.child(node, 'items'),
    jtConfig,
    'jtFrozen': flags.jtFrozen,
    'jtStrict': typeof schema['jt:strict'] === 'boolean' ? schema['jt:strict'] : undefined,
    'language': normalizeLanguageTag(schema['x-jt-language']),
    'maxContains': scalar.maxContains,
    'maximum': scalar.maximum,
    'maxItems': scalar.maxItems,
    'maxLength': scalar.maxLength,
    'maxProperties': scalar.maxProperties,
    'minContains': scalar.minContains,
    'minimum': scalar.minimum,
    'minItems': scalar.minItems,
    'minLength': scalar.minLength,
    'minProperties': scalar.minProperties,
    'multipleOf': scalar.multipleOf,
    'oneOf': graph.indexedChildren(node, 'oneOf'),
    'pattern': scalar.pattern,
    'patternPropertyEntries': graph.entries(node, 'patternProperties'),
    'prefixItems': graph.indexedChildren(node, 'prefixItems'),
    'properties': propertiesMap(graph.entries(node, 'properties')),
    'propertyNamesNode': graph.child(node, 'propertyNames'),
    'rdfsDomain': (typeof schema['rdfs:domain'] === 'string' ? schema['rdfs:domain'] : undefined)
      ?? (typeof schema[RDFS.domain] === 'string' ? (schema[RDFS.domain] as string) : undefined),
    'rdfsRange': (typeof schema['rdfs:range'] === 'string' ? schema['rdfs:range'] : undefined)
      ?? (typeof schema[RDFS.range] === 'string' ? (schema[RDFS.range] as string) : undefined),
    'readOnly': flags.readOnly,
    'recursiveAnchor': flags.recursiveAnchor,
    'recursiveRef': scalar.recursiveRef,
    ref,
    'reflexive': flags.reflexive,
    'refTargetNode': ref?.startsWith('#') === true ? resolveLocalRef(ref) : undefined,
    'required': Array.isArray(schema.required)
      ? schema.required.filter((entry: unknown): boolean => {
        return isString(entry);
      }) as string[]
      : [],
    'restrictions': extractRestrictions(schema),
    'schemaAnchor': scalar.schemaAnchor,
    'schemaDialect': scalar.schemaDialect,
    'schemaId': scalar.schemaId,
    'schemaTypes': normalizeSchemaTypes(schema),
    'schemaVocabulary': scalar.schemaVocabulary,
    'symmetric': flags.symmetric,
    'thenNode': graph.child(node, 'then'),
    'title': scalar.title,
    'transitive': flags.transitive,
    'unevaluatedItemsNode': graph.child(node, 'unevaluatedItems'),
    'unevaluatedPropertiesNode': graph.child(node, 'unevaluatedProperties'),
    'uniqueItems': flags.uniqueItems,
    'writeOnly': flags.writeOnly
  };
}

/** Check for inline nested object violations and push a warning if found. */
function checkInlineObject(
  schema: Record<string, unknown>,
  pointer: string,
  warnings: StructureWarningType[]
): void {
  const rawType = schema.type;
  const hasObjectType = rawType === 'object'
    || (Array.isArray(rawType) && rawType.includes('object'));

  if (hasObjectType && typeof schema.$id !== 'string') {
    warnings.push({
      'message': `Inline nested object at "${pointer}" must be extracted to its own schema with a $id and referenced via $ref.`,
      'path': pointer,
      'rule': 'inline-object'
    });
  }
}

/** Check for inline primitive with constraints and push a warning if found. */
function checkInlinePrimitive(
  schema: Record<string, unknown>,
  pointer: string,
  warnings: StructureWarningType[]
): void {
  const rawType = schema.type;
  const isPrimitive = typeof rawType === 'string' && PRIMITIVE_TYPES.has(rawType);

  if (!isPrimitive || typeof schema.$id === 'string') {
    return;
  }

  const constraintKeywords = constraintKeywordsOf(schema);

  if (constraintKeywords.length > 0) {
    warnings.push({
      'message': `Inline primitive at "${pointer}" with constraints ${constraintKeywords.join(', ')} should be extracted to its own schema with a $id and referenced via $ref. Defining the same shape inline in multiple places creates divergent type entities in the canonical graph.`,
      'path': pointer,
      'rule': 'inline-primitive'
    });
  }
}

/** Check for inline array items with constraints and push a warning if found. */
function checkInlineArrayItems(
  schema: Record<string, unknown>,
  pointer: string,
  warnings: StructureWarningType[]
): void {
  if (schema.type !== 'array' || !DataType.isRecord(schema.items)) {
    return;
  }

  const items = schema.items;

  if (typeof items.$id === 'string' || '$ref' in items) {
    return;
  }

  const itemConstraints = constraintKeywordsOf(items);

  if (itemConstraints.length > 0) {
    warnings.push({
      'message': `Inline array items at "${pointer}/items" with constraints ${itemConstraints.join(', ')} should be extracted to their own schema with a $id and referenced via $ref.`,
      'path': `${pointer}/items`,
      'rule': 'inline-array-items'
    });
  }
}

/** Validate a single node and append any warnings. */
function validateNode(
  node: SchemaGraphNodeType,
  warnings: StructureWarningType[]
): void {
  if (node.pointer === '' || !DataType.isRecord(node.schema)) {
    return;
  }
  const schema = node.schema;
  const pointer = node.pointer;

  if (isInDefs(pointer) || '$ref' in schema || isInAllOfExtensionBlock(pointer)) {
    return;
  }

  if ('properties' in schema) {
    checkInlineObject(schema, pointer, warnings);
  } else {
    checkInlinePrimitive(schema, pointer, warnings);
  }

  checkInlineArrayItems(schema, pointer, warnings);
}

/**
 * SchemaGraphSupport — utility module for schema graph operations.
 *
 * @remarks
 * Provides pure functions for normalizing schema keywords, extracting
 * semantics from schema nodes, and validating graph structure. All functions
 * operate on `SchemaGraphNodeType` objects and the plain schema records
 * they carry.
 *
 * @example
 * ```ts
 * const semantics = SchemaGraphSupport.extractSemantics(graph, node, resolveRef);
 * ```
 *
 * @defaultValue Exported as a frozen `as const` object.
 * @category Graph
 * @since 0.1.0
 * @see {@link SchemaGraphNodeType}
 * @group Graph
 */
export const SchemaGraphSupport = {
  escapeJsonPointerSegment(segment: string): string {
    return segment.replaceAll('~', '~0').replaceAll('/', '~1');
  },

  extractSemantics(
    graph: GraphAccessorInterface,
    node: SchemaGraphNodeType,
    resolveLocalRef: (ref: string) => SchemaGraphNodeType
  ): SchemaGraphSemanticsType {
    if (!DataType.isRecord(node.schema)) {
      return EMPTY_SEMANTICS;
    }

    return buildSemantics({
      graph,
      node,
      'ref': strOrUndef(node.schema.$ref),
      resolveLocalRef,
      'schema': node.schema
    });
  },

  isDefsEntryPointer(pointer: string): boolean {
    const parts = pointer.split('/');

    return parts.length === DEFS_POINTER_PARTS_LENGTH && parts[1] === '$defs';
  },

  isPropertyPointer(pointer: string): boolean {
    const parts = pointer.split('/');

    return parts.length >= MIN_PROPERTY_POINTER_PARTS && parts.at(-2) === 'properties';
  },

  nodeIdFromPointer(rootSchema: JsonSchemaType, pointer: string, schema: JsonSchemaType): string {
    if (!DataType.isRecord(schema)) {
      return pointerId(rootSchema, pointer);
    }

    if (typeof schema.$id === 'string') {
      return schema.$id;
    }

    return pointerId(rootSchema, pointer);
  },

  parentPropertiesPointer(pointer: string): OptionalStringType {
    const result = SchemaIri.splitAtProperties(pointer);

    if (result === undefined) {
      return undefined;
    }

    return result.parent || '';
  },

  propertyNameFromPointer(pointer: string): OptionalStringType {
    const parts = pointer.split('/');

    if (parts.length < MIN_PROPERTY_POINTER_PARTS || parts.at(-2) !== 'properties') {
      return undefined;
    }

    return parts.at(-1);
  },

  resolveSchemaAtPointer(rootSchema: JsonSchemaType, pointer: string): JsonSchemaType {
    if (pointer === '') {
      return rootSchema;
    }
    if (!pointer.startsWith('/')) {
      throw new GraphError(`Invalid JSON Pointer: ${pointer}`, {
        'code': GraphErrorCode.POINTER_INVALID,
        pointer
      });
    }

    let current: unknown = rootSchema;

    const segments = pointer.slice(1).split('/')
      .map((segment: string): string => {
        return unescapeJsonPointerSegment(segment);
      });

    for (const segment of segments) {
      if (!DataType.isRecord(current) && !Array.isArray(current)) {
        throw new GraphError(`Pointer not found: ${pointer}`, {
          'code': GraphErrorCode.POINTER_NOT_FOUND,
          pointer
        });
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current !== 'boolean' && !DataType.isRecord(current)) {
      throw new GraphError(`Pointer does not resolve to a schema: ${pointer}`, {
        'code': GraphErrorCode.POINTER_NOT_SCHEMA,
        pointer
      });
    }

    return current;
  },

  validateGraphStructure(nodeMap: Map<string, SchemaGraphNodeType>): StructureWarningType[] {
    const warnings: StructureWarningType[] = [];

    for (const node of nodeMap.values()) {
      validateNode(node, warnings);
    }

    return warnings;
  }
} as const;
