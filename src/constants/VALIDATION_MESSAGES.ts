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
    const result = `must NOT have additional property '${key}'`;

    return result;
  },

  /** `anyOf` — value did not match any schema in the list. */
  'anyOf': 'must match at least one schema',

  /** `const` — value did not equal the required constant. */
  'const': (constValue: unknown): string => {
    const result = `must be ${JSON.stringify(constValue)}`;

    return result;
  },

  /** `contains` (min) — fewer than minContains items matched the contains schema. */
  'contains': (minContains: number): string => {
    const result = `must contain at least ${minContains} matching items`;

    return result;
  },

  /** `contains` — no items matched and neither minContains nor maxContains is set. */
  'containsOne': 'must contain at least one matching item',

  /** `contentEncoding` — string did not decode under the named encoding. */
  'contentEncoding': (encoding: string): string => {
    const result = `must be valid ${encoding}-encoded content`;

    return result;
  },

  /** `contentMediaType` — decoded content did not parse as the named media type. */
  'contentMediaType': (mediaType: string): string => {
    const result = `must be valid ${mediaType} content`;

    return result;
  },

  /** `dependentRequired` — a dependency property is missing. */
  'dependentRequired': (dependency: string, key: string): string => {
    const result = `must have property '${dependency}' when '${key}' is present`;

    return result;
  },

  /** `enum` — value was not in the allowed set. */
  'enum': 'must be one of the allowed values',

  /** `exclusiveMaximum` — value equals or exceeds the exclusive upper bound. */
  'exclusiveMaximum': (limit: number): string => {
    const result = `must be < ${limit}`;

    return result;
  },

  /** `exclusiveMinimum` — value equals or goes below the exclusive lower bound. */
  'exclusiveMinimum': (limit: number): string => {
    const result = `must be > ${limit}`;

    return result;
  },

  /** `false` schema — the schema is the literal `false`. */
  'falseSchema': 'must not match false schema',

  /** `format` — value did not satisfy the registered format validator. */
  'format': (format: string): string => {
    const result = `must match format "${format}"`;

    return result;
  },

  /** `items: false` after prefixItems — extra items beyond the tuple are forbidden. */
  'items': 'must NOT have items beyond prefixItems',

  /** Custom keyword — value failed a user-defined keyword validator. */
  'keyword': (kw: string): string => {
    const result = `must pass "${kw}" validation`;

    return result;
  },

  /** `maxContains` — more than maxContains items matched the contains schema. */
  'maxContains': (maxContains: number): string => {
    const result = `must contain at most ${maxContains} matching items`;

    return result;
  },

  /** `maximum` — value exceeds the inclusive upper bound. */
  'maximum': (limit: number): string => {
    const result = `must be <= ${limit}`;

    return result;
  },

  /** `maxItems` — array length exceeds the upper bound. */
  'maxItems': (limit: number): string => {
    const result = `must have at most ${limit} items`;

    return result;
  },

  /** `maxLength` — string length exceeds the upper bound. */
  'maxLength': (limit: number): string => {
    const result = `must NOT have more than ${limit} characters`;

    return result;
  },

  /** `maxProperties` — object has more properties than allowed. */
  'maxProperties': (limit: number): string => {
    const result = `must NOT have more than ${limit} properties`;

    return result;
  },

  /** `minimum` — value is below the inclusive lower bound. */
  'minimum': (limit: number): string => {
    const result = `must be >= ${limit}`;

    return result;
  },

  /** `minItems` — array length is below the lower bound. */
  'minItems': (limit: number): string => {
    const result = `must have at least ${limit} items`;

    return result;
  },

  /** `minLength` — string length is below the lower bound. */
  'minLength': (limit: number): string => {
    const result = `must NOT have fewer than ${limit} characters`;

    return result;
  },

  /** `minProperties` — object has fewer properties than required. */
  'minProperties': (limit: number): string => {
    const result = `must NOT have fewer than ${limit} properties`;

    return result;
  },

  /** `multipleOf` — value is not a multiple of the divisor. */
  'multipleOf': (divisor: number): string => {
    const result = `must be a multiple of ${divisor}`;

    return result;
  },

  /** `not` — value matched the negated schema. */
  'not': 'must not match schema',

  /** `oneOf` — value did not match exactly one schema. */
  'oneOf': 'must match exactly one schema',

  /** `pattern` — string did not satisfy the regular expression. */
  'pattern': (pattern: string): string => {
    const result = `must match pattern "${pattern}"`;

    return result;
  },

  /** `required` — a required property is absent. */
  'required': (key: string): string => {
    const result = `must have required property '${key}'`;

    return result;
  },

  /**
   * `type` — value did not match the allowed type(s).
   * Single type: `"must be string"`. Multiple: `"must be one of: string, number"`.
   */
  'type': (types: string[]): string => {
    return types.length === 1 ? `must be ${types.at(0)}` : `must be one of: ${types.join(', ')}`;
  },

  /** `unevaluatedItems: false` — array element was not covered by any schema. */
  'unevaluatedItems': 'must NOT have unevaluated items',

  /** `unevaluatedProperties: false` — object property was not covered by any schema. */
  'unevaluatedProperties': 'must NOT have unevaluated properties',

  /** `uniqueItems: true` — array contains duplicate items. */
  'uniqueItems': 'must NOT have duplicate items'
} as const;
