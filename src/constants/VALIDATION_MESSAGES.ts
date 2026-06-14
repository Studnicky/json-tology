/**
 * Canonical validation error message table.
 *
 * Single source of truth for every human-readable validation message emitted by
 * the interpreter ({@link GraphEngine} / {@link GraphEngineScalars}) and the
 * compiler ({@link SchemaCompiler} / `exec/` helpers). Fixed messages are
 * string literals; parameterized messages are builder functions whose argument
 * carries the constraint value(s).
 *
 * @remarks
 * Fields that hold functions are data — function-valued properties of a plain
 * object, not methods of a class — so this constant lives in `src/constants/`
 * per the project's type/location rules.
 *
 * Error params (limit, missingProperty, additionalProperty, etc.) remain at the
 * call sites; only the human-readable `message` string comes from this table.
 *
 * @category Constants
 * @since 0.22.0
 * @group Constants
 *
 * @example
 * ```ts
 * import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';
 *
 * errors.push(BaseError.validationError(path, 'minItems', VALIDATION_MESSAGES.minItems(3)));
 * errors.push(BaseError.validationError(path, 'uniqueItems', VALIDATION_MESSAGES.uniqueItems));
 * ```
 */
export const VALIDATION_MESSAGES = {
  /** `additionalProperties: false` — the key is included at the call site. */
  'additionalProperties': (key: string): string => {
    return `must NOT have additional property '${key}'`;
  },

  /** `anyOf` — value did not match any schema in the list. */
  'anyOf': 'must match at least one schema',

  /** `const` — value did not equal the required constant. */
  'const': (constValue: unknown): string => {
    return `must be ${JSON.stringify(constValue)}`;
  },

  /** `contains` (min) — fewer than minContains items matched the contains schema. */
  'contains': (minContains: number): string => {
    return `must contain at least ${minContains} matching items`;
  },

  /** `contains` — no items matched and neither minContains nor maxContains is set. */
  'containsOne': 'must contain at least one matching item',

  /** `contentEncoding` — string did not decode under the named encoding. */
  'contentEncoding': (encoding: string): string => {
    return `must be valid ${encoding}-encoded content`;
  },

  /** `contentMediaType` — decoded content did not parse as the named media type. */
  'contentMediaType': (mediaType: string): string => {
    return `must be valid ${mediaType} content`;
  },

  /** `dependentRequired` — a dependency property is missing. */
  'dependentRequired': (dependency: string, key: string): string => {
    return `must have property '${dependency}' when '${key}' is present`;
  },

  /** `enum` — value was not in the allowed set. */
  'enum': 'must be one of the allowed values',

  /** `exclusiveMaximum` — value equals or exceeds the exclusive upper bound. */
  'exclusiveMaximum': (limit: number): string => {
    return `must be < ${limit}`;
  },

  /** `exclusiveMinimum` — value equals or goes below the exclusive lower bound. */
  'exclusiveMinimum': (limit: number): string => {
    return `must be > ${limit}`;
  },

  /** `false` schema — the schema is the literal `false`. */
  'falseSchema': 'must not match false schema',

  /** `format` — value did not satisfy the registered format validator. */
  'format': (format: string): string => {
    return `must match format "${format}"`;
  },

  /** `items: false` after prefixItems — extra items beyond the tuple are forbidden. */
  'items': 'must NOT have items beyond prefixItems',

  /** Custom keyword — value failed a user-defined keyword validator. */
  'keyword': (kw: string): string => {
    return `must pass "${kw}" validation`;
  },

  /** `maxContains` — more than maxContains items matched the contains schema. */
  'maxContains': (maxContains: number): string => {
    return `must contain at most ${maxContains} matching items`;
  },

  /** `maximum` — value exceeds the inclusive upper bound. */
  'maximum': (limit: number): string => {
    return `must be <= ${limit}`;
  },

  /** `maxItems` — array length exceeds the upper bound. */
  'maxItems': (limit: number): string => {
    return `must have at most ${limit} items`;
  },

  /** `maxLength` — string length exceeds the upper bound. */
  'maxLength': (limit: number): string => {
    return `must NOT have more than ${limit} characters`;
  },

  /** `maxProperties` — object has more properties than allowed. */
  'maxProperties': (limit: number): string => {
    return `must NOT have more than ${limit} properties`;
  },

  /** `minimum` — value is below the inclusive lower bound. */
  'minimum': (limit: number): string => {
    return `must be >= ${limit}`;
  },

  /** `minItems` — array length is below the lower bound. */
  'minItems': (limit: number): string => {
    return `must have at least ${limit} items`;
  },

  /** `minLength` — string length is below the lower bound. */
  'minLength': (limit: number): string => {
    return `must NOT have fewer than ${limit} characters`;
  },

  /** `minProperties` — object has fewer properties than required. */
  'minProperties': (limit: number): string => {
    return `must NOT have fewer than ${limit} properties`;
  },

  /** `multipleOf` — value is not a multiple of the divisor. */
  'multipleOf': (divisor: number): string => {
    return `must be a multiple of ${divisor}`;
  },

  /** `not` — value matched the negated schema. */
  'not': 'must not match schema',

  /** `oneOf` — value did not match exactly one schema. */
  'oneOf': 'must match exactly one schema',

  /** `pattern` — string did not satisfy the regular expression. */
  'pattern': (pattern: string): string => {
    return `must match pattern "${pattern}"`;
  },

  /** `required` — a required property is absent. */
  'required': (key: string): string => {
    return `must have required property '${key}'`;
  },

  /**
   * `type` — value did not match the allowed type(s).
   * Single type: `"must be string"`. Multiple: `"must be one of: string, number"`.
   */
  'type': (types: string[]): string => {
    return types.length === 1 ? `must be ${types[0]}` : `must be one of: ${types.join(', ')}`;
  },

  /** `unevaluatedItems: false` — array element was not covered by any schema. */
  'unevaluatedItems': 'must NOT have unevaluated items',

  /** `unevaluatedProperties: false` — object property was not covered by any schema. */
  'unevaluatedProperties': 'must NOT have unevaluated properties',

  /** `uniqueItems: true` — array contains duplicate items. */
  'uniqueItems': 'must NOT have duplicate items'
} as const;
