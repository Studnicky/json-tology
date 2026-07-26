import type { StructureWarningEntity } from '../../entities/StructureWarningEntity.js';
import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { RDFS } from '../../constants/IRI.js';
import { ALLOF_EXTENSION_RE } from '../../constants/GRAPH_REGEXES.js';
import { EMPTY_SEMANTICS } from '../../constants/EMPTY_SEMANTICS.js';
import {
  BCP47_INVALID_TAG_PREFIX, BCP47_TAG_RE
} from '../../constants/BCP47.js';
import { EMPTY_PROPERTY_MAP } from '../../constants/EMPTY_PROPERTY_MAP.js';
import {
  DEFS_POINTER_PARTS_LENGTH, KNOWN_SCHEMA_KEYWORDS,
  MINIMUM_PROPERTY_POINTER_PARTS,
  PRIMITIVE_CONSTRAINT_KEYWORDS,
  PRIMITIVE_TYPES
} from '../../constants/SCHEMA_KEYWORDS.js';
import { DataType } from '../data/DataType.js';
import { SchemaIri } from './SchemaIri.js';
import type { JsonSchemaType } from '../../types/Schema.js';
import type { GraphAccessorInterface } from '../../interfaces/GraphAccessorInterface.js';
import type { JtConfigEntity } from '../../entities/JtConfigEntity.js';
import { RESTRICTIONS_KEY } from '../../constants/COMPOSITION.js';
import type { RawRestrictionDescriptorEntity } from '../../entities/RawRestrictionDescriptorEntity.js';
import type { AnnotatedEdgeDescriptorEntity } from '../../entities/AnnotatedEdgeDescriptorEntity.js';
import type { AdditionalNodesResultInterface } from '../../interfaces/AdditionalNodesResultInterface.js';
import type { BooleanFlagsEntity } from '../../entities/BooleanFlagsEntity.js';
import type { PropertyMapInterface } from '../../interfaces/PropertyMapInterface.js';
import type { ScalarFieldsInterface } from '../../interfaces/ScalarFieldsInterface.js';
import type { SemanticsBuildContextInterface } from '../../interfaces/SemanticsBuildContextInterface.js';

/** Scalar type-guard and safe-coercion helpers shared across schema-field extraction. */
class SchemaScalarCoercion {
  /** Type guard for string values; used in array filters. */
  static isString(entry: unknown): boolean {
    return typeof entry === 'string';
  }

  /** Coerce a schema property to number or undefined. */
  static numberOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  /** Coerce a schema property to string or undefined. */
  static stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}

/** JSON Pointer helpers used during semantics extraction and structure validation. */
class SchemaPointerSupport {
  static isInAllOfExtensionBlock(pointer: string): boolean {
    // Skip direct allOf members (/allOf/0, /allOf/1, etc.) and their properties
    // These are produced by Compose.extend and are structural, not inline definitions
    const result = ALLOF_EXTENSION_RE.test(pointer);

    return result;
  }

  static isInDefs(pointer: string): boolean {
    const result = pointer.includes('/$defs/');

    return result;
  }

  static pointerId(rootSchema: JsonSchemaType, pointer: string): string {
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

  static unescapeSegment(segment: string): string {
    const result = segment.replaceAll('~1', '/').replaceAll('~0', '~');

    return result;
  }
}

/** Schema-field normalization helpers. */
class SchemaFieldNormalizer {
  static aliases(schema: Record<string, unknown>): string[] {
    const raw = schema['jt:alias'];

    if (typeof raw === 'string') {
      return [raw];
    }
    if (Array.isArray(raw)) {
      return raw.filter((entry: unknown): boolean => {
        const result = SchemaScalarCoercion.isString(entry);

        return result;
      }) as string[];
    }

    return [];
  }

  static dependentRequired(schema: Record<string, unknown>): Record<string, string[]> {
    if (!DataType.isRecord(schema.dependentRequired)) {
      return {};
    }

    const result: Record<string, string[]> = {};

    for (const [
      key,
      value
    ] of Object.entries(schema.dependentRequired)) {
      if (!Array.isArray(value)) {
        continue;
      }
      const entries = value.filter((entry: unknown): boolean => {
        const isEntryString = SchemaScalarCoercion.isString(entry);

        return isEntryString;
      }) as string[];

      result[key] = entries;
    }

    return result;
  }

  static dynamicAnchor(schema: Record<string, unknown>): string | undefined {
    if (typeof schema.$dynamicAnchor === 'string') {
      return schema.$dynamicAnchor;
    }

    if (schema.$recursiveAnchor === true) {
      return '';
    }

    return undefined;
  }

  /**
   * Validate and normalize the `x-jt-language` annotation. Returns the tag when it
   * matches the BCP-47 shape, `undefined` when absent, and throws a GraphError for
   * a malformed tag (e.g. `"\n"`, `"INVALID!!!"`).
   */
  static languageTag(rawLang: unknown): string | undefined {
    if (typeof rawLang !== 'string') {
      return undefined;
    }

    if (!BCP47_TAG_RE.test(rawLang)) {
      throw new GraphError(
        `${BCP47_INVALID_TAG_PREFIX}${JSON.stringify(rawLang)}`,
        { 'code': GRAPH_ERROR_CODE.INVALID_LANGUAGE_TAG }
      );
    }

    return rawLang;
  }

  static schemaTypes(schema: Record<string, unknown>): string[] {
    const rawType = schema.type;

    if (typeof rawType === 'string') {
      return [rawType];
    }

    if (Array.isArray(rawType)) {
      return rawType.filter((entry: unknown): boolean => {
        const result = SchemaScalarCoercion.isString(entry);

        return result;
      }) as string[];
    }

    return [];
  }
}

/** Schema-field extraction helpers. */
class SchemaFieldExtractor {
  static annotatedEdgeDescriptor(schema: Record<string, unknown>): AnnotatedEdgeDescriptorEntity.Type | undefined {
    const raw = schema['jt:annotatedEdge'];

    if (!DataType.isRecord(raw)) {
      return undefined;
    }

    const predicate = typeof raw.predicate === 'string' ? raw.predicate : undefined;
    const targetReference = typeof raw.targetRef === 'string' ? raw.targetRef : undefined;

    if (predicate === undefined || targetReference === undefined) {
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
      'targetRef': targetReference
    };
  }

  /** Extract all boolean flag fields from the schema. */
  static booleanFlags(
    schema: Record<string, unknown>,
    jtConfig: JtConfigEntity.Type | undefined
  ): BooleanFlagsEntity.Type {
    const {
      'jt:computed': jtComputed,
      'jt:frozen': jtFrozen,
      'x-jt-iriRef': xJtIriReference
    } = schema;

    return {
      'asymmetric': schema.asymmetric === true,
      'computed': jtComputed === true,
      'deprecated': schema.deprecated === true,
      'functional': schema.functional === true,
      'hasConst': 'const' in schema,
      'hasDefault': 'default' in schema,
      'inverseFunctional': schema.inverseFunctional === true,
      'iriRef': xJtIriReference === true
        || (typeof schema.format === 'string' && schema.format === 'iri'),
      'irreflexive': schema.irreflexive === true,
      'jtFrozen': jtFrozen === true || jtConfig?.frozen === true,
      'readOnly': schema.readOnly === true,
      'recursiveAnchor': schema.$recursiveAnchor === true,
      'reflexive': schema.reflexive === true,
      'symmetric': schema.symmetric === true,
      'transitive': schema.transitive === true,
      'uniqueItems': schema.uniqueItems === true,
      'writeOnly': schema.writeOnly === true
    };
  }

  static jtConfig(schema: Record<string, unknown>): JtConfigEntity.Type | undefined {
    const raw = schema['jt:config'];

    if (!DataType.isRecord(raw)) {
      return undefined;
    }

    const config: JtConfigEntity.Type = {};

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

  static restrictions(schema: Record<string, unknown>): RawRestrictionDescriptorEntity.Type[] {
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
    }) as RawRestrictionDescriptorEntity.Type[];
  }

  /** Extract all scalar (string, number, vocabulary) fields from the schema. */
  static scalarFields(schema: Record<string, unknown>): ScalarFieldsInterface {
    return {
      'comment': SchemaScalarCoercion.stringOrUndefined(schema.$comment),
      'contentEncoding': SchemaScalarCoercion.stringOrUndefined(schema.contentEncoding),
      'contentMediaType': SchemaScalarCoercion.stringOrUndefined(schema.contentMediaType),
      'description': SchemaScalarCoercion.stringOrUndefined(schema.description),
      'disjointWith': SchemaScalarCoercion.stringOrUndefined(schema.disjointWith),
      'dynamicRef': SchemaScalarCoercion.stringOrUndefined(schema.$dynamicRef),
      'equivalentTo': SchemaScalarCoercion.stringOrUndefined(schema.equivalentTo),
      'exclusiveMaximum': SchemaScalarCoercion.numberOrUndefined(schema.exclusiveMaximum),
      'exclusiveMinimum': SchemaScalarCoercion.numberOrUndefined(schema.exclusiveMinimum),
      'format': SchemaScalarCoercion.stringOrUndefined(schema.format),
      'inverseOf': SchemaScalarCoercion.stringOrUndefined(schema.inverseOf),
      'maxContains': SchemaScalarCoercion.numberOrUndefined(schema.maxContains),
      'maximum': SchemaScalarCoercion.numberOrUndefined(schema.maximum),
      'maxItems': SchemaScalarCoercion.numberOrUndefined(schema.maxItems),
      'maxLength': SchemaScalarCoercion.numberOrUndefined(schema.maxLength),
      'maxProperties': SchemaScalarCoercion.numberOrUndefined(schema.maxProperties),
      'minContains': SchemaScalarCoercion.numberOrUndefined(schema.minContains),
      'minimum': SchemaScalarCoercion.numberOrUndefined(schema.minimum),
      'minItems': SchemaScalarCoercion.numberOrUndefined(schema.minItems),
      'minLength': SchemaScalarCoercion.numberOrUndefined(schema.minLength),
      'minProperties': SchemaScalarCoercion.numberOrUndefined(schema.minProperties),
      'multipleOf': SchemaScalarCoercion.numberOrUndefined(schema.multipleOf),
      'pattern': SchemaScalarCoercion.stringOrUndefined(schema.pattern),
      'recursiveRef': SchemaScalarCoercion.stringOrUndefined(schema.$recursiveRef),
      'schemaAnchor': SchemaScalarCoercion.stringOrUndefined(schema.$anchor),
      'schemaDialect': SchemaScalarCoercion.stringOrUndefined(schema.$schema),
      'schemaId': SchemaScalarCoercion.stringOrUndefined(schema.$id),
      'schemaVocabulary': schema.$vocabulary,
      'title': SchemaScalarCoercion.stringOrUndefined(schema.title)
    };
  }
}

/** Property-map and extension-collection helpers for semantics extraction. */
class SchemaPropertyExtraction {
  static collectExtensions(schema: Record<string, unknown>): Record<string, unknown> {
    const extensions: Record<string, unknown> = {};

    for (const key of Object.keys(schema)) {
      if (!KNOWN_SCHEMA_KEYWORDS.has(key)) {
        extensions[key] = schema[key];
      }
    }

    return extensions;
  }

  static constraintKeywordsOf(schema: Record<string, unknown>): string[] {
    const result = Object.keys(schema).filter((key: string): boolean => {
      const matchesConstraint = PRIMITIVE_CONSTRAINT_KEYWORDS.has(key);

      return matchesConstraint;
    });

    return result;
  }

  static propertiesMap(entries: Array<[string, SchemaGraphNodeInterface]>): PropertyMapInterface {
    return entries.length === 0 ? EMPTY_PROPERTY_MAP : new Map(entries);
  }
}

/** additionalItems/additionalProperties node resolution. */
class AdditionalSchemaNode {
  static resolve(
    node: SchemaGraphNodeInterface,
    child: (node: SchemaGraphNodeInterface, key: string) => SchemaGraphNodeInterface | undefined,
    key: 'additionalItems' | 'additionalProperties'
  ): boolean | SchemaGraphNodeInterface | undefined {
    if (!DataType.isRecord(node.schema) || !(key in node.schema)) {
      return undefined;
    }

    const rawValue = node.schema[key];

    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    return child(node, key);
  }

  static resolveAll(
    graph: GraphAccessorInterface,
    node: SchemaGraphNodeInterface
  ): AdditionalNodesResultInterface {
    return {
      'additionalItemsNode': AdditionalSchemaNode.resolve(node, (parent: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined => {
        const result = graph.child(parent, key);

        return result;
      }, 'additionalItems'),
      'additionalPropertiesNode': AdditionalSchemaNode.resolve(node, (parent: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined => {
        const result = graph.child(parent, key);

        return result;
      }, 'additionalProperties')
    };
  }
}

// ---------------------------------------------------------------------------
// extractSemantics — broken into focused helpers to meet the complexity limit
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// validateGraphStructure helpers
// ---------------------------------------------------------------------------

/** Build the full SchemaGraphSemanticsInterface from a validated schema record. */
class Semantics {
  static build(context: SemanticsBuildContextInterface): SchemaGraphSemanticsInterface {
    const {
      graph,
      node,
      'ref': reference,
      'resolveLocalRef': resolveLocalReference,
      schema
    } = context;

    const jtConfig = SchemaFieldExtractor.jtConfig(schema);
    const additional = AdditionalSchemaNode.resolveAll(graph, node);
    const flags = SchemaFieldExtractor.booleanFlags(schema, jtConfig);
    const scalar = SchemaFieldExtractor.scalarFields(schema);
    const discriminator = DataType.isRecord(schema.discriminator) ? schema.discriminator : undefined;
    const {
      'jt:strict': jtStrictRaw,
      'rdfs:domain': rdfsDomainCurie,
      'rdfs:range': rdfsRangeCurie,
      'x-jt-language': xJtLanguage
    } = schema;
    const rdfsDomainFull = Reflect.get(schema, RDFS.domain);
    const rdfsRangeFull = Reflect.get(schema, RDFS.range);

    return {
      'additionalItemsNode': additional.additionalItemsNode,
      'additionalPropertiesNode': additional.additionalPropertiesNode,
      'aliases': SchemaFieldNormalizer.aliases(schema),
      'allOf': graph.indexedChildren(node, 'allOf'),
      'annotatedEdge': SchemaFieldExtractor.annotatedEdgeDescriptor(schema),
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
      'dependentRequired': SchemaFieldNormalizer.dependentRequired(schema),
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
      'dynamicAnchor': SchemaFieldNormalizer.dynamicAnchor(schema),
      'dynamicRef': scalar.dynamicRef,
      'elseNode': graph.child(node, 'else'),
      'enumValues': Array.isArray(schema.enum) ? schema.enum : undefined,
      'equivalentTo': scalar.equivalentTo,
      'examples': Array.isArray(schema.examples) ? schema.examples : undefined,
      'exclusiveMaximum': scalar.exclusiveMaximum,
      'exclusiveMinimum': scalar.exclusiveMinimum,
      'extensions': SchemaPropertyExtraction.collectExtensions(schema),
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
      'jtStrict': typeof jtStrictRaw === 'boolean' ? jtStrictRaw : undefined,
      'language': SchemaFieldNormalizer.languageTag(xJtLanguage),
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
      'properties': SchemaPropertyExtraction.propertiesMap(graph.entries(node, 'properties')),
      'propertyNamesNode': graph.child(node, 'propertyNames'),
      'rdfsDomain': (typeof rdfsDomainCurie === 'string' ? rdfsDomainCurie : undefined)
      ?? (typeof rdfsDomainFull === 'string' ? rdfsDomainFull : undefined),
      'rdfsRange': (typeof rdfsRangeCurie === 'string' ? rdfsRangeCurie : undefined)
      ?? (typeof rdfsRangeFull === 'string' ? rdfsRangeFull : undefined),
      'readOnly': flags.readOnly,
      'recursiveAnchor': flags.recursiveAnchor,
      'recursiveRef': scalar.recursiveRef,
      'ref': reference,
      'reflexive': flags.reflexive,
      'refTargetNode': reference?.startsWith('#') === true ? resolveLocalReference(reference) : undefined,
      'required': Array.isArray(schema.required)
        ? schema.required.filter((entry: unknown): boolean => {
          const result = SchemaScalarCoercion.isString(entry);

          return result;
        }) as string[]
        : [],
      'restrictions': SchemaFieldExtractor.restrictions(schema),
      'schemaAnchor': scalar.schemaAnchor,
      'schemaDialect': scalar.schemaDialect,
      'schemaId': scalar.schemaId,
      'schemaTypes': SchemaFieldNormalizer.schemaTypes(schema),
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
}

/** Structure-validation checks. */
class NodeStructureCheck {
  /** Check for inline array items with constraints and push a warning if found. */
  static inlineArrayItems(
    schema: Record<string, unknown>,
    pointer: string,
    warnings: StructureWarningEntity.Type[]
  ): void {
    if (schema.type !== 'array' || !DataType.isRecord(schema.items)) {
      return;
    }

    const items = schema.items;

    if (typeof items.$id === 'string' || '$ref' in items) {
      return;
    }

    const itemConstraints = SchemaPropertyExtraction.constraintKeywordsOf(items);

    if (itemConstraints.length > 0) {
      warnings.push({
        'message': `Inline array items at "${pointer}/items" with constraints ${itemConstraints.join(', ')} should be extracted to their own schema with a $id and referenced via $ref.`,
        'path': `${pointer}/items`,
        'rule': 'inline-array-items'
      });
    }
  }

  /** Check for inline nested object violations and push a warning if found. */
  static inlineObject(
    schema: Record<string, unknown>,
    pointer: string,
    warnings: StructureWarningEntity.Type[]
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
  static inlinePrimitive(
    schema: Record<string, unknown>,
    pointer: string,
    warnings: StructureWarningEntity.Type[]
  ): void {
    const rawType = schema.type;
    const isPrimitive = typeof rawType === 'string' && PRIMITIVE_TYPES.has(rawType);

    if (!isPrimitive || typeof schema.$id === 'string') {
      return;
    }

    const constraintKeywords = SchemaPropertyExtraction.constraintKeywordsOf(schema);

    if (constraintKeywords.length > 0) {
      warnings.push({
        'message': `Inline primitive at "${pointer}" with constraints ${constraintKeywords.join(', ')} should be extracted to its own schema with a $id and referenced via $ref. Defining the same shape inline in multiple places creates divergent type entities in the canonical graph.`,
        'path': pointer,
        'rule': 'inline-primitive'
      });
    }
  }

  /** Validate a single node and append any warnings. */
  static node(
    node: SchemaGraphNodeInterface,
    warnings: StructureWarningEntity.Type[]
  ): void {
    if (node.pointer === '' || !DataType.isRecord(node.schema)) {
      return;
    }
    const schema = node.schema;
    const pointer = node.pointer;

    if (SchemaPointerSupport.isInDefs(pointer) || '$ref' in schema || SchemaPointerSupport.isInAllOfExtensionBlock(pointer)) {
      return;
    }

    if ('properties' in schema) {
      NodeStructureCheck.inlineObject(schema, pointer, warnings);
    } else {
      NodeStructureCheck.inlinePrimitive(schema, pointer, warnings);
    }

    NodeStructureCheck.inlineArrayItems(schema, pointer, warnings);
  }
}

/**
 * SchemaGraphSupport — utility module for schema graph operations.
 *
 * @remarks
 * Provides pure functions for normalizing schema keywords, extracting
 * semantics from schema nodes, and validating graph structure. All functions
 * operate on `SchemaGraphNodeInterface` objects and the plain schema records
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
 * @see {@link SchemaGraphNodeInterface}
 * @group Graph
 */
export const SchemaGraphSupport = {
  escapeJsonPointerSegment(segment: string): string {
    const result = segment.replaceAll('~', '~0').replaceAll('/', '~1');

    return result;
  },

  extractSemantics(
    graph: GraphAccessorInterface,
    node: SchemaGraphNodeInterface,
    resolveLocalReference: (reference: string) => SchemaGraphNodeInterface
  ): SchemaGraphSemanticsInterface {
    if (!DataType.isRecord(node.schema)) {
      return EMPTY_SEMANTICS;
    }

    return Semantics.build({
      graph,
      node,
      'ref': SchemaScalarCoercion.stringOrUndefined(node.schema.$ref),
      'resolveLocalRef': resolveLocalReference,
      'schema': node.schema
    });
  },

  isDefsEntryPointer(pointer: string): boolean {
    const parts = pointer.split('/');

    return parts.length === DEFS_POINTER_PARTS_LENGTH && parts.at(1) === '$defs';
  },

  isPropertyPointer(pointer: string): boolean {
    const parts = pointer.split('/');

    return parts.length >= MINIMUM_PROPERTY_POINTER_PARTS && parts.at(-2) === 'properties';
  },

  nodeIdFromPointer(rootSchema: JsonSchemaType, pointer: string, schema: JsonSchemaType): string {
    if (!DataType.isRecord(schema)) {
      return SchemaPointerSupport.pointerId(rootSchema, pointer);
    }

    if (typeof schema.$id === 'string') {
      return schema.$id;
    }

    return SchemaPointerSupport.pointerId(rootSchema, pointer);
  },

  parentPropertiesPointer(pointer: string): string | undefined {
    const result = SchemaIri.splitAtProperties(pointer);

    if (result === undefined) {
      return undefined;
    }

    return result.parent || '';
  },

  propertyNameFromPointer(pointer: string): string | undefined {
    const parts = pointer.split('/');

    if (parts.length < MINIMUM_PROPERTY_POINTER_PARTS || parts.at(-2) !== 'properties') {
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
        'code': GRAPH_ERROR_CODE.POINTER_INVALID,
        pointer
      });
    }

    let current: unknown = rootSchema;

    const segments = pointer.slice(1).split('/')
      .map((segment: string): string => {
        const result = SchemaPointerSupport.unescapeSegment(segment);

        return result;
      });

    for (const segment of segments) {
      if (!DataType.isRecord(current) && !Array.isArray(current)) {
        throw new GraphError(`Pointer not found: ${pointer}`, {
          'code': GRAPH_ERROR_CODE.POINTER_NOT_FOUND,
          pointer
        });
      }
      current = Reflect.get(current as Record<string, unknown>, segment);
    }
    if (typeof current !== 'boolean' && !DataType.isRecord(current)) {
      throw new GraphError(`Pointer does not resolve to a schema: ${pointer}`, {
        'code': GRAPH_ERROR_CODE.POINTER_NOT_SCHEMA,
        pointer
      });
    }

    return current;
  },

  validateGraphStructure(nodeMap: Map<string, SchemaGraphNodeInterface>): StructureWarningEntity.Type[] {
    const warnings: StructureWarningEntity.Type[] = [];

    for (const node of nodeMap.values()) {
      NodeStructureCheck.node(node, warnings);
    }

    return warnings;
  }
} as const;
