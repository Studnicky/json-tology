import type {
  SchemaGraphNodeInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from '../../interfaces/SchemaGraph.js';
import { GraphError } from '../../errors/GraphError.js';
import { RDFS } from '../../constants/IRI.js';
import { ALLOF_EXTENSION_RE } from '../../constants/GRAPH_REGEXES.js';
import {
  DEFS_POINTER_PARTS_LENGTH, KNOWN_SCHEMA_KEYWORDS,
  MIN_PROPERTY_POINTER_PARTS,
  PRIMITIVE_CONSTRAINT_KEYWORDS,
  PRIMITIVE_TYPES
} from '../../constants/SCHEMA_KEYWORDS.js';
import { isRecord } from '../data/DataTypes.js';
import type { JsonSchemaType } from '../../types/Schema.js';
import type { GraphAccessorInterface } from '../../interfaces/GraphAccessor.js';
import type { JtConfigType } from '../../types/JtConfig.js';
import { RESTRICTIONS_KEY } from '../../constants/COMPOSITION.js';
import type { RawRestrictionDescriptorType } from '../../types/RawRestrictionDescriptor.js';
import type { AnnotatedEdgeDescriptorInterface } from '../../interfaces/AnnotatedEdgeDescriptorInterface.js';

// BCP-47 shape: one or more subtags of 1–8 ASCII alpha/alphanum chars, hyphen-separated.
const BCP47_TAG_RE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/u;

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

/**
 * Validate and normalize the `x-jt-language` annotation. Returns the tag when it
 * matches the BCP-47 shape, `undefined` when absent, and throws a GraphError for
 * a malformed tag (e.g. `"\n"`, `"INVALID!!!"`).
 */
function normalizeLanguageTag(rawLang: unknown): string | undefined {
  if (typeof rawLang !== 'string') {
    return undefined;
  }

  if (!BCP47_TAG_RE.test(rawLang)) {
    throw new GraphError(
      'INVALID_LANGUAGE_TAG',
      `x-jt-language value is not a valid BCP-47 language tag: ${JSON.stringify(rawLang)}`
    );
  }

  return rawLang;
}

function normalizeAliases(schema: Record<string, unknown>): readonly string[] {
  const raw = schema['jt:alias'];

  if (typeof raw === 'string') {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => {
      return typeof entry === 'string';
    });
  }

  return [];
}

function extractRestrictions(schema: Record<string, unknown>): readonly RawRestrictionDescriptorType[] {
  const raw = schema[RESTRICTIONS_KEY];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((entry): entry is RawRestrictionDescriptorType => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }
    const rec = entry as Record<string, unknown>;

    return typeof rec.kind === 'string' && typeof rec.onProperty === 'string' && 'value' in rec;
  });
}

function extractAnnotatedEdgeDescriptor(schema: Record<string, unknown>): AnnotatedEdgeDescriptorInterface | undefined {
  const raw = schema['jt:annotatedEdge'];

  if (!isRecord(raw)) {
    return undefined;
  }

  const predicate = typeof raw.predicate === 'string' ? raw.predicate : undefined;
  const targetRef = typeof raw.targetRef === 'string' ? raw.targetRef : undefined;

  if (predicate === undefined || targetRef === undefined) {
    return undefined;
  }

  const annotations: Record<string, { readonly '$ref': string }> = {};

  if (isRecord(raw.annotations)) {
    for (const [
      propName,
      propSchema
    ] of Object.entries(raw.annotations)) {
      if (isRecord(propSchema) && typeof propSchema.$ref === 'string') {
        annotations[propName] = { '$ref': propSchema.$ref };
      }
    }
  }

  return {
    annotations,
    predicate,
    targetRef
  };
}

function extractJtConfig(schema: Record<string, unknown>): JtConfigType | undefined {
  const raw = schema['jt:config'];

  if (!isRecord(raw)) {
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

type PropertyEntry = [string, SchemaGraphNodeInterface];
type PropertyMap = ReadonlyMap<string, SchemaGraphNodeInterface>;

const EMPTY_MAP: PropertyMap = new Map();

function propertiesMap(entries: PropertyEntry[]): PropertyMap {
  return entries.length === 0 ? EMPTY_MAP : new Map(entries);
}

const EMPTY_SEMANTICS: SchemaGraphSemanticsInterface = Object.freeze({
  'additionalItemsNode': undefined,
  'additionalPropertiesNode': undefined,
  'aliases': [],
  'allOf': [],
  'annotatedEdge': undefined,
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
  'iriRef': false,
  'irreflexive': false,
  'itemsNode': undefined,
  'jtConfig': undefined,
  'jtFrozen': false,
  'jtStrict': undefined,
  'language': undefined,
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
  'properties': EMPTY_MAP,
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
  'restrictions': [],
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

function normalizeSchemaTypes(schema: Record<string, unknown>): string[] {
  const rawType = schema.type;

  if (typeof rawType === 'string') {
    return [rawType];
  }

  if (Array.isArray(rawType)) {
    return rawType.filter((entry): entry is string => {
      return typeof entry === 'string';
    });
  }

  return [];
}

function normalizeDynamicAnchor(schema: Record<string, unknown>): string | undefined {
  if (typeof schema.$dynamicAnchor === 'string') {
    return schema.$dynamicAnchor;
  }

  if (schema.$recursiveAnchor === true) {
    return '';
  }

  return undefined;
}

function normalizeDependentRequired(schema: Record<string, unknown>): Record<string, string[]> {
  return isRecord(schema.dependentRequired)
    ? Object.fromEntries(Object.entries(schema.dependentRequired).flatMap(([
      key,
      value
    ]) => {
      if (!Array.isArray(value)) {
        return [];
      }

      const entries = value.filter((entry): entry is string => {
        return typeof entry === 'string';
      });

      return [[
        key,
        entries
      ] as [string, string[]]];
    }))
    : {};
}

function collectSchemaExtensions(schema: Record<string, unknown>): Record<string, unknown> {
  const extensions: Record<string, unknown> = {};

  for (const key of Object.keys(schema)) {
    if (!KNOWN_SCHEMA_KEYWORDS.has(key)) {
      extensions[key] = schema[key];
    }
  }

  return extensions;
}

function resolveAdditionalSchemaNode(
  node: SchemaGraphNodeInterface,
  child: (node: SchemaGraphNodeInterface, key: string) => SchemaGraphNodeInterface | undefined,
  key: 'additionalItems' | 'additionalProperties'
): boolean | SchemaGraphNodeInterface | undefined {
  if (!isRecord(node.schema) || !(key in node.schema)) {
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
  return Object.keys(schema).filter((key) => {
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

export const SchemaGraphSupport = {
  escapeJsonPointerSegment(segment: string): string {
    return segment.replaceAll('~', '~0').replaceAll('/', '~1');
  },

  extractSemantics(
    graph: GraphAccessorInterface,
    node: SchemaGraphNodeInterface,
    resolveLocalRef: (ref: string) => SchemaGraphNodeInterface
  ): SchemaGraphSemanticsInterface {
    if (!isRecord(node.schema)) {
      return EMPTY_SEMANTICS;
    }

    const schemaTypes = normalizeSchemaTypes(node.schema);
    const dynamicAnchor = normalizeDynamicAnchor(node.schema);
    const dependentRequired = normalizeDependentRequired(node.schema);
    const ref = typeof node.schema.$ref === 'string' ? node.schema.$ref : undefined;
    const discriminator = isRecord(node.schema.discriminator) ? node.schema.discriminator : undefined;
    const extensions = collectSchemaExtensions(node.schema);
    const aliases = normalizeAliases(node.schema);
    const jtConfig = extractJtConfig(node.schema);
    const jtFrozen = node.schema['jt:frozen'] === true || jtConfig?.frozen === true;
    const jtStrict = typeof node.schema['jt:strict'] === 'boolean' ? node.schema['jt:strict'] : undefined;

    return {
      'additionalItemsNode': resolveAdditionalSchemaNode(node, (parent, key) => {
        return graph.child(parent, key);
      }, 'additionalItems'),
      'additionalPropertiesNode': resolveAdditionalSchemaNode(node, (parent, key) => {
        return graph.child(parent, key);
      }, 'additionalProperties'),
      aliases,
      'allOf': graph.indexedChildren(node, 'allOf'),
      'annotatedEdge': extractAnnotatedEdgeDescriptor(node.schema),
      'anyOf': graph.indexedChildren(node, 'anyOf'),
      'asymmetric': node.schema.asymmetric === true,
      'comment': typeof node.schema.$comment === 'string' ? node.schema.$comment : undefined,
      'complementNode': graph.child(node, 'not'),
      'computed': node.schema['jt:computed'] === true,
      'constValue': 'const' in node.schema ? node.schema.const : undefined,
      'containsNode': graph.child(node, 'contains'),
      'contentEncoding': typeof node.schema.contentEncoding === 'string' ? node.schema.contentEncoding : undefined,
      'contentMediaType': typeof node.schema.contentMediaType === 'string' ? node.schema.contentMediaType : undefined,
      'defaultValue': 'default' in node.schema ? node.schema.default : undefined,
      'definitions': graph.entries(node, 'definitions'),
      dependentRequired,
      'dependentSchemaEntries': graph.entries(node, 'dependentSchemas'),
      'deprecated': node.schema.deprecated === true,
      'description': typeof node.schema.description === 'string' ? node.schema.description : undefined,
      'discriminatorMapping': discriminator !== undefined && isRecord(discriminator.mapping) ? discriminator.mapping as Record<string, string> : undefined,
      'discriminatorPropertyName': discriminator !== undefined && typeof discriminator.propertyName === 'string' ? discriminator.propertyName : undefined,
      'disjointWith': typeof node.schema.disjointWith === 'string' ? node.schema.disjointWith : undefined,
      dynamicAnchor,
      'dynamicRef': typeof node.schema.$dynamicRef === 'string' ? node.schema.$dynamicRef : undefined,
      'elseNode': graph.child(node, 'else'),
      'enumValues': Array.isArray(node.schema.enum) ? node.schema.enum : undefined,
      'equivalentTo': typeof node.schema.equivalentTo === 'string' ? node.schema.equivalentTo : undefined,
      'examples': Array.isArray(node.schema.examples) ? node.schema.examples : undefined,
      'exclusiveMaximum': typeof node.schema.exclusiveMaximum === 'number' ? node.schema.exclusiveMaximum : undefined,
      'exclusiveMinimum': typeof node.schema.exclusiveMinimum === 'number' ? node.schema.exclusiveMinimum : undefined,
      extensions,
      'format': typeof node.schema.format === 'string' ? node.schema.format : undefined,
      'functional': node.schema.functional === true,
      'hasConst': 'const' in node.schema,
      'hasDefault': 'default' in node.schema,
      'ifNode': graph.child(node, 'if'),
      'inverseFunctional': node.schema.inverseFunctional === true,
      'inverseOf': typeof node.schema.inverseOf === 'string' ? node.schema.inverseOf : undefined,
      'iriRef': node.schema['x-jt-iriRef'] === true || (typeof node.schema.format === 'string' && node.schema.format === 'iri'),
      'irreflexive': node.schema.irreflexive === true,
      'itemsNode': graph.child(node, 'items'),
      jtConfig,
      'jtFrozen': jtFrozen,
      'jtStrict': jtStrict,
      'language': normalizeLanguageTag(node.schema['x-jt-language']),
      'maxContains': typeof node.schema.maxContains === 'number' ? node.schema.maxContains : undefined,
      'maximum': typeof node.schema.maximum === 'number' ? node.schema.maximum : undefined,
      'maxItems': typeof node.schema.maxItems === 'number' ? node.schema.maxItems : undefined,
      'maxLength': typeof node.schema.maxLength === 'number' ? node.schema.maxLength : undefined,
      'maxProperties': typeof node.schema.maxProperties === 'number' ? node.schema.maxProperties : undefined,
      'minContains': typeof node.schema.minContains === 'number' ? node.schema.minContains : undefined,
      'minimum': typeof node.schema.minimum === 'number' ? node.schema.minimum : undefined,
      'minItems': typeof node.schema.minItems === 'number' ? node.schema.minItems : undefined,
      'minLength': typeof node.schema.minLength === 'number' ? node.schema.minLength : undefined,
      'minProperties': typeof node.schema.minProperties === 'number' ? node.schema.minProperties : undefined,
      'multipleOf': typeof node.schema.multipleOf === 'number' ? node.schema.multipleOf : undefined,
      'oneOf': graph.indexedChildren(node, 'oneOf'),
      'pattern': typeof node.schema.pattern === 'string' ? node.schema.pattern : undefined,
      'patternPropertyEntries': graph.entries(node, 'patternProperties'),
      'prefixItems': graph.indexedChildren(node, 'prefixItems'),
      'properties': propertiesMap(graph.entries(node, 'properties')),
      'propertyNamesNode': graph.child(node, 'propertyNames'),
      'rdfsDomain': (typeof node.schema['rdfs:domain'] === 'string' ? node.schema['rdfs:domain'] : undefined) ?? (typeof node.schema[RDFS.domain] === 'string' ? (node.schema[RDFS.domain] as string) : undefined),
      'rdfsRange': (typeof node.schema['rdfs:range'] === 'string' ? node.schema['rdfs:range'] : undefined) ?? (typeof node.schema[RDFS.range] === 'string' ? (node.schema[RDFS.range] as string) : undefined),
      'readOnly': node.schema.readOnly === true,
      'recursiveAnchor': node.schema.$recursiveAnchor === true,
      'recursiveRef': typeof node.schema.$recursiveRef === 'string' ? node.schema.$recursiveRef : undefined,
      ref,
      'reflexive': node.schema.reflexive === true,
      'refTargetNode': ref?.startsWith('#') === true ? resolveLocalRef(ref) : undefined,
      'required': Array.isArray(node.schema.required)
        ? node.schema.required.filter((entry): entry is string => {
          return typeof entry === 'string';
        })
        : [],
      'restrictions': typeof node.schema === 'object' ? extractRestrictions(node.schema) : [],
      'schemaAnchor': typeof node.schema.$anchor === 'string' ? node.schema.$anchor : undefined,
      'schemaDialect': typeof node.schema.$schema === 'string' ? node.schema.$schema : undefined,
      'schemaId': typeof node.schema.$id === 'string' ? node.schema.$id : undefined,
      schemaTypes,
      'schemaVocabulary': node.schema.$vocabulary,
      'symmetric': node.schema.symmetric === true,
      'thenNode': graph.child(node, 'then'),
      'title': typeof node.schema.title === 'string' ? node.schema.title : undefined,
      'transitive': node.schema.transitive === true,
      'unevaluatedItemsNode': graph.child(node, 'unevaluatedItems'),
      'unevaluatedPropertiesNode': graph.child(node, 'unevaluatedProperties'),
      'uniqueItems': node.schema.uniqueItems === true,
      'writeOnly': node.schema.writeOnly === true
    };
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
    if (!isRecord(schema)) {
      return pointerId(rootSchema, pointer);
    }

    if (typeof schema.$id === 'string') {
      return schema.$id;
    }

    return pointerId(rootSchema, pointer);
  },

  parentPropertiesPointer(pointer: string): string | undefined {
    const idx = pointer.lastIndexOf('/properties/');

    if (idx === -1) {
      return undefined;
    }

    return pointer.slice(0, idx) || '';
  },

  propertyNameFromPointer(pointer: string): string | undefined {
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
      throw new GraphError('POINTER_INVALID', `Invalid JSON Pointer: ${pointer}`, { pointer });
    }

    let current: unknown = rootSchema;

    const segments = pointer.slice(1).split('/')
      .map((segment) => {
        return unescapeJsonPointerSegment(segment);
      });

    for (const segment of segments) {
      if (!isRecord(current) && !Array.isArray(current)) {
        throw new GraphError('POINTER_NOT_FOUND', `Pointer not found: ${pointer}`, { pointer });
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current !== 'boolean' && !isRecord(current)) {
      throw new GraphError('POINTER_NOT_SCHEMA', `Pointer does not resolve to a schema: ${pointer}`, { pointer });
    }

    return current;
  },

  validateGraphStructure(nodeMap: Map<string, SchemaGraphNodeInterface>): StructureWarningInterface[] {
    const warnings: StructureWarningInterface[] = [];

    for (const node of nodeMap.values()) {
      if (node.pointer === '') {
        continue;
      }
      if (!isRecord(node.schema)) {
        continue;
      }
      const schema = node.schema;
      const pointer = node.pointer;

      if (isInDefs(pointer)) {
        continue;
      }

      if ('$ref' in schema) {
        continue;
      }

      if (isInAllOfExtensionBlock(pointer)) {
        continue;
      }

      if ('properties' in schema) {
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

      if (!('properties' in schema)) {
        const rawType = schema.type;
        const isPrimitive = typeof rawType === 'string' && PRIMITIVE_TYPES.has(rawType);

        if (isPrimitive && typeof schema.$id !== 'string') {
          const constraintKeywords = constraintKeywordsOf(schema);

          if (constraintKeywords.length > 0) {
            warnings.push({
              'message': `Inline primitive at "${pointer}" with constraints ${constraintKeywords.join(', ')} should be extracted to its own schema with a $id and referenced via $ref. Defining the same shape inline in multiple places creates divergent type entities in the canonical graph.`,
              'path': pointer,
              'rule': 'inline-primitive'
            });
          }
        }
      }

      if (schema.type === 'array' && isRecord(schema.items)) {
        const items = schema.items;

        if (typeof items.$id !== 'string' && !('$ref' in items)) {
          const itemConstraints = constraintKeywordsOf(items);

          if (itemConstraints.length > 0) {
            warnings.push({
              'message': `Inline array items at "${pointer}/items" with constraints ${itemConstraints.join(', ')} should be extracted to their own schema with a $id and referenced via $ref.`,
              'path': `${pointer}/items`,
              'rule': 'inline-array-items'
            });
          }
        }
      }
    }

    return warnings;
  }
} as const;
