/**
 * Expected number of path parts in a `$defs` JSON pointer (e.g. `#/$defs/Foo`).
 *
 * @remarks
 * Used when splitting a pointer string to verify it targets a `$defs` entry:
 * the split produces `['#', '$defs', '<name>']`.
 *
 * @example
 * ```ts
 * const parts = pointer.split('/');
 * if (parts.length === DEFS_POINTER_PARTS_LENGTH) { ... }
 * ```
 *
 * @category Schema keywords
 * @since 0.1.0
 * @see MIN_PROPERTY_POINTER_PARTS
 * @defaultValue `3`
 * @group Constants
 */
export const DEFS_POINTER_PARTS_LENGTH = 3;

/**
 * Minimum number of path parts for a valid property JSON pointer (e.g. `#/properties/name`).
 *
 * @remarks
 * Used when parsing property pointers: the split must yield at least
 * `['#', 'properties', '<name>']`.
 *
 * @example
 * ```ts
 * const parts = pointer.split('/');
 * if (parts.length >= MIN_PROPERTY_POINTER_PARTS) { ... }
 * ```
 *
 * @category Schema keywords
 * @since 0.1.0
 * @see DEFS_POINTER_PARTS_LENGTH
 * @defaultValue `3`
 * @group Constants
 */
export const MIN_PROPERTY_POINTER_PARTS = 3;

/**
 * Complete set of JSON Schema draft-2020-12 keywords recognized by json-tology.
 *
 * @remarks
 * Includes all standard JSON Schema keywords plus json-tology extensions (`jt:*`, `x-jt-*`)
 * and semantic web annotations (`rdfs:domain`, `rdfs:range`). Used to distinguish
 * schema structural keywords from application-defined property names.
 *
 * @example
 * ```ts
 * if (!KNOWN_SCHEMA_KEYWORDS.has(key)) {
 *   // key is a user-defined property, not a schema keyword
 * }
 * ```
 *
 * @category Schema keywords
 * @since 0.1.0
 * @see {@link https://json-schema.org/draft/2020-12/json-schema-core JSON Schema draft-2020-12}
 * @defaultValue `new Set([...])`
 * @group Constants
 */
export const KNOWN_SCHEMA_KEYWORDS = new Set([
  '$anchor',
  '$comment',
  '$defs',
  '$dynamicAnchor',
  '$dynamicRef',
  '$id',
  '$recursiveAnchor',
  '$recursiveRef',
  '$ref',
  '$schema',
  '$vocabulary',
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'asymmetric',
  'const',
  'contains',
  'contentEncoding',
  'contentMediaType',
  'default',
  'definitions',
  'dependentRequired',
  'dependentSchemas',
  'deprecated',
  'description',
  'discriminator',
  'disjointWith',
  'else',
  'enum',
  'equivalentTo',
  'examples',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'functional',
  'if',
  'inverseFunctional',
  'inverseOf',
  'irreflexive',
  'items',
  'jt:alias',
  'jt:annotatedEdge',
  'jt:computed',
  'jt:config',
  'jt:frozen',
  'jt:strict',
  'maxContains',
  'maximum',
  'maxItems',
  'maxLength',
  'maxProperties',
  'minContains',
  'minimum',
  'minItems',
  'minLength',
  'minProperties',
  'multipleOf',
  'not',
  'oneOf',
  'pattern',
  'patternProperties',
  'prefixItems',
  'properties',
  'propertyNames',
  'rdfs:domain',
  'rdfs:range',
  'readOnly',
  'reflexive',
  'required',
  'symmetric',
  'then',
  'title',
  'transitive',
  'type',
  'unevaluatedItems',
  'unevaluatedProperties',
  'uniqueItems',
  'writeOnly',
  'x-jt-iriRef',
  'x-jt-language',
  'x-jt-predicate'
]);

/**
 * Set of JSON Schema keywords that express primitive value constraints.
 *
 * @remarks
 * Used to identify keywords that restrict the acceptable values of a primitive
 * (string, number, boolean) property rather than its shape or composition.
 *
 * @example
 * ```ts
 * for (const key of Object.keys(schema)) {
 *   if (PRIMITIVE_CONSTRAINT_KEYWORDS.has(key)) {
 *     // apply constraint: key = schema[key]
 *   }
 * }
 * ```
 *
 * @category Schema keywords
 * @since 0.1.0
 * @see PRIMITIVE_TYPES
 * @defaultValue `new Set<string>([...])`
 * @group Constants
 */
export const PRIMITIVE_CONSTRAINT_KEYWORDS = new Set<string>([
  'const',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'maximum',
  'maxLength',
  'minimum',
  'minLength',
  'multipleOf',
  'pattern'
]);

/**
 * Set of JSON Schema primitive type names.
 *
 * @remarks
 * Represents the subset of JSON Schema `type` values that map to scalar (non-composite)
 * values. Used to distinguish primitive properties from object or array properties.
 *
 * @example
 * ```ts
 * if (PRIMITIVE_TYPES.has(schema.type)) {
 *   // schema describes a primitive value
 * }
 * ```
 *
 * @category Schema keywords
 * @since 0.1.0
 * @see PRIMITIVE_CONSTRAINT_KEYWORDS
 * @defaultValue `new Set<string>([...])`
 * @group Constants
 */
export const PRIMITIVE_TYPES = new Set<string>([
  'boolean',
  'integer',
  'number',
  'string'
]);
