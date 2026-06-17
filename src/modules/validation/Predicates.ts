/**
 * Predicates — single source of truth for all validation logic.
 *
 * Both the interpreted path (GraphEngine) and compiled path (SchemaCompiler)
 * call these static methods. This eliminates parity bugs by ensuring both
 * paths use identical logic for type matching, constraint checking, and coercion.
 *
 * @remarks
 * All methods are static. No instances are created. The class groups
 * pure predicate functions that operate on unknown values and
 * return boolean or coerced results.
 *
 * @category Validation
 * @since 0.1.0
 */

import { deepEqual } from '../data/DataTypes.js';
import { MULTIPLE_OF_EPSILON_FACTOR } from '../../constants/NUMERIC.js';
import {
  SUPPORTED_CONTENT_ENCODINGS, SUPPORTED_CONTENT_MEDIA_TYPES
} from '../../constants/CONTENT_VALIDATION.js';
import type {
  CoerceToBooleanResultType, CoerceToNumberResultType
} from '../../types/Validation.js';

/**
 * Predicates — static predicate library for JSON Schema validation.
 *
 * @remarks
 * Both the interpreted path (GraphEngine) and compiled path (SchemaCompiler)
 * call these static methods to guarantee parity between execution paths.
 *
 * @example
 * ```ts
 * // Type-check a value against a JSON Schema type name
 * Predicates.matchesType('integer', 42); // true
 * Predicates.matchesType('string', 42);  // false
 *
 * // Coerce a string into the appropriate type
 * Predicates.coerceValue(['boolean'], 'true'); // true
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link https://json-schema.org/understanding-json-schema/reference/type}
 * @group Validation
 */
export class Predicates {
  private static readonly coercionHandlers = new Map<string, (value: unknown) => unknown>([
    [
      'array',
      (value: unknown): unknown => {
        return !Array.isArray(value) && typeof value !== 'object' ? [value] : value;
      }
    ],
    [
      'boolean',
      (value: unknown): unknown => {
        if (typeof value === 'string') {
          return Predicates.coerceToBoolean(value) ?? value;
        }
        if (value === 1) {
          return true;
        }
        if (value === 0) {
          return false;
        }

        return value;
      }
    ],
    [
      'integer',
      (value: unknown): unknown => {
        if (typeof value === 'string') {
          const coerced = Predicates.coerceToNumber(value);

          return coerced === undefined ? value : Math.trunc(coerced);
        }
        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }

        return value;
      }
    ],
    [
      'null',
      (value: unknown): unknown => {
        return value === '' || value === 'null' ? null : value;
      }
    ],
    [
      'number',
      (value: unknown): unknown => {
        if (typeof value === 'string') {
          return Predicates.coerceToNumber(value) ?? value;
        }
        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }

        return value;
      }
    ],
    [
      'string',
      (value: unknown): unknown => {
        return typeof value === 'string' ? value : String(value);
      }
    ]
  ]);

  private static readonly typeMatchers = new Map<string, (value: unknown) => boolean>([
    [
      'array',
      (value: unknown): boolean => {
        return Array.isArray(value);
      }
    ],
    [
      'integer',
      (value: unknown): boolean => {
        return Predicates.isIntegerValue(value);
      }
    ],
    [
      'null',
      (value: unknown): boolean => {
        return value === null;
      }
    ],
    [
      'number',
      (value: unknown): boolean => {
        return Predicates.isFiniteNumber(value);
      }
    ],
    [
      'object',
      (value: unknown): boolean => {
        return Predicates.inferValueType(value) === 'object';
      }
    ]
  ]);

  /**
   * Count Unicode code points without allocating an intermediate array.
   * Equivalent to `[...str].length` but allocation-free.
   *
   * @param str - The string to measure.
   * @returns The number of Unicode code points in the string.
   *
   * @remarks
   * Surrogate pairs (code points above U+FFFF) each count as one code point.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt}
   * @group String
   */
  static codePointLength(str: string): number {
    let length = 0;

    for (let index = 0; index < str.length; index++) {
      length++;
      const code = str.codePointAt(index);

      if (code !== undefined && code > 0xFF_FF) {
        index++;
      }
    }

    return length;
  }

  /**
   * Attempt to coerce a string to a boolean value.
   *
   * @param value - The string to coerce.
   * @returns `true` or `false` when the string is a recognised truthy/falsy literal, `undefined` otherwise.
   *
   * @remarks
   * Recognised truthy literals: `"true"`, `"1"`. Recognised falsy literals: `"false"`, `"0"`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link CoerceToBooleanResultType}
   * @group Coercion
   */
  static coerceToBoolean(value: string): CoerceToBooleanResultType {
    if (value === 'true' || value === '1') {
      return true;
    }
    if (value === 'false' || value === '0') {
      return false;
    }

    return undefined;
  }

  /**
   * Attempt to coerce a string to a finite number.
   *
   * @param value - The string to coerce.
   * @returns The numeric value when the string is a finite number, `undefined` otherwise.
   *
   * @remarks
   * Returns `undefined` for `"Infinity"`, `"NaN"`, and any non-numeric string.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link CoerceToNumberResultType}
   * @group Coercion
   */
  static coerceToNumber(value: string): CoerceToNumberResultType {
    const coerced = Number(value);

    return Number.isFinite(coerced) ? coerced : undefined;
  }

  /**
   * Unified type coercion — single source of truth for both interpreted
   * (GraphEngine) and compiled (SchemaCompiler) validation paths.
   *
   * @param schemaTypes - The ordered list of schema type names to attempt coercion against.
   * @param value - The value to coerce.
   * @returns The first successful coercion result, or the original value when none applies.
   *
   * @remarks
   * Attempts coercion in schema-type declaration order. Returns the first
   * successful coercion or the original value when none applies.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link coercionHandlers}
   * @group Coercion
   */
  static coerceValue(schemaTypes: string[], value: unknown): unknown {
    if (value === undefined || value === null || schemaTypes.length === 0) {
      return value;
    }

    for (const type of schemaTypes) {
      const coercer = Predicates.coercionHandlers.get(type);

      if (coercer !== undefined) {
        const result = coercer(value);

        if (result !== value) {
          return result;
        }
      }
    }

    return value;
  }

  /**
   * Check that all required property keys are present in the object.
   *
   * @param value - The record to check.
   * @param required - The list of required property names.
   * @returns `true` when every required key is present.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/object#required}
   * @group Object
   */
  static hasAllRequiredProperties(value: Record<string, unknown>, required: string[]): boolean {
    return required.every((key: string): boolean => {
      return key in value;
    });
  }

  /**
   * Check that no properties exist on the object outside the allowed set.
   *
   * @param value - The record to check.
   * @param allowedKeys - The set of allowed property names.
   * @returns `true` when every key in the object is in `allowedKeys`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/object#additionalproperties}
   * @group Object
   */
  static hasNoAdditionalProperties(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
    return Object.keys(value).every((key: string): boolean => {
      return allowedKeys.has(key);
    });
  }

  /**
   * Infer the JSON Schema type name of a value.
   *
   * @param value - The value to classify.
   * @returns One of `"null"`, `"array"`, or any `typeof` string.
   *
   * @category Validation
   * @since 0.1.0
   * @group Type
   */
  static inferValueType(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }

    return typeof value;
  }

  /**
   * Check that a value is a finite number.
   *
   * @param value - The value to check.
   * @returns `true` when the value is a `number` and is finite.
   *
   * @category Validation
   * @since 0.1.0
   * @group Type
   */
  static isFiniteNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  /**
   * Check that a value is an integer.
   *
   * @param value - The value to check.
   * @returns `true` when the value is a `number` and is an integer.
   *
   * @category Validation
   * @since 0.1.0
   * @group Type
   */
  static isIntegerValue(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value);
  }

  /**
   * Check that a value matches at least one of the given schema types.
   *
   * @param schemaTypes - The list of type names from the schema.
   * @param value - The value to test.
   * @returns `true` when the value matches any type in the list.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link matchesType}
   * @group Type
   */
  static matchesAnyType(schemaTypes: string[], value: unknown): boolean {
    return schemaTypes.some((schemaType: string): boolean => {
      return Predicates.matchesType(schemaType, value);
    });
  }

  /**
   * Check that a value matches a specific JSON Schema type name.
   *
   * @param schemaType - The type name (e.g. `"string"`, `"integer"`, `"null"`).
   * @param value - The value to test.
   * @returns `true` when the value conforms to the named type.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link typeMatchers}
   * @group Type
   */
  static matchesType(schemaType: string, value: unknown): boolean {
    const matcher = Predicates.typeMatchers.get(schemaType);

    return matcher === undefined ? Predicates.inferValueType(value) === schemaType : matcher(value);
  }

  /**
   * Deep-equality check against a `const` schema value.
   *
   * @param value - The instance value to test.
   * @param constValue - The expected constant from the schema.
   * @returns `true` when the value is deeply equal to `constValue`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/const}
   * @group Const
   */
  static satisfiesConst(value: unknown, constValue: unknown): boolean {
    return deepEqual(value, constValue);
  }

  /**
   * Check that a `contains` match count satisfies `minContains` and `maxContains`.
   *
   * @param matchCount - The number of array items that matched the `contains` schema.
   * @param minContains - Minimum number of matches required (defaults to 1 when `maxContains` is also absent).
   * @param maxContains - Maximum number of matches allowed.
   * @returns `true` when the match count is within the allowed range.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/array#contains}
   * @group Array
   */
  static satisfiesContains(
    matchCount: number,
    minContains: number | undefined,
    maxContains: number | undefined
  ): boolean {
    const minimum = minContains ?? (maxContains === undefined ? 1 : 0);

    if (matchCount < minimum) {
      return false;
    }
    if (maxContains !== undefined && matchCount > maxContains) {
      return false;
    }

    return true;
  }

  /**
   * Check that a string decodes successfully under the named `contentEncoding`.
   *
   * @param value - The string to test.
   * @param encoding - The encoding name from the schema (e.g. `"base64"`).
   * @returns `true` when the encoding is unsupported (unconstrained per spec) or
   * the string decodes without error under the named encoding.
   *
   * @remarks
   * Only encodings in {@link SUPPORTED_CONTENT_ENCODINGS} are actively checked.
   * Unknown encodings return `true` (pass) per the JSON Schema specification.
   *
   * Supported encodings:
   * - `base64` — standard Base64 (RFC 4648 §4); padding required.
   * - `base64url` — URL-safe Base64 (RFC 4648 §5); no padding required.
   *
   * @category Validation
   * @since 0.22.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/non_json_data#contentencoding}
   * @group String
   */
  static satisfiesContentEncoding(value: string, encoding: string): boolean {
    if (!SUPPORTED_CONTENT_ENCODINGS.has(encoding)) {
      return true;
    }

    return decodeBase64Safe(value, encoding === 'base64url') !== null;
  }

  /**
   * Check that a string's content parses as the named `contentMediaType`.
   *
   * @param value - The raw string to test (before any encoding decode).
   * @param mediaType - The media type from the schema (e.g. `"application/json"`).
   * @param encoding - Optional `contentEncoding` to decode `value` before parsing.
   * @returns `true` when the media type is unsupported (unconstrained per spec) or
   * the content (after optional decode) is valid for the named media type.
   *
   * @remarks
   * Only media types in {@link SUPPORTED_CONTENT_MEDIA_TYPES} are actively checked.
   * Unknown media types return `true` (pass) per the JSON Schema specification.
   * When `encoding` is provided and supported, `value` is decoded first.
   * If decoding fails, the check returns `false`.
   *
   * Supported media types:
   * - `application/json` — content must be valid JSON (`JSON.parse` succeeds).
   *
   * @category Validation
   * @since 0.22.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/non_json_data#contentmediatype}
   * @group String
   */
  static satisfiesContentMediaType(value: string, mediaType: string, encoding?: string): boolean {
    if (!SUPPORTED_CONTENT_MEDIA_TYPES.has(mediaType)) {
      return true;
    }

    let content = value;

    if (encoding !== undefined && SUPPORTED_CONTENT_ENCODINGS.has(encoding)) {
      const decoded = decodeBase64Safe(value, encoding === 'base64url');

      if (decoded === null) {
        return false;
      }

      content = decoded;
    }

    if (mediaType === 'application/json') {
      return isValidJson(content);
    }

    return true;
  }

  /**
   * Check that a value is present in an `enum` array (deep equality).
   *
   * @param value - The instance value to test.
   * @param enumValues - The allowed values from the schema.
   * @returns `true` when the value deeply equals any entry in `enumValues`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/enum}
   * @group Enum
   */
  static satisfiesEnum(value: unknown, enumValues: unknown[]): boolean {
    return enumValues.some((enumValue: unknown): boolean => {
      return deepEqual(value, enumValue);
    });
  }

  /**
   * Check that a number is strictly less than `limit`.
   *
   * @param value - The numeric value to test.
   * @param limit - The exclusive upper bound.
   * @returns `true` when `value < limit`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/numeric#range}
   * @group Numeric
   */
  static satisfiesExclusiveMaximum(value: number, limit: number): boolean {
    return value < limit;
  }

  /**
   * Check that a number is strictly greater than `limit`.
   *
   * @param value - The numeric value to test.
   * @param limit - The exclusive lower bound.
   * @returns `true` when `value > limit`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/numeric#range}
   * @group Numeric
   */
  static satisfiesExclusiveMinimum(value: number, limit: number): boolean {
    return value > limit;
  }

  /**
   * Check that a number is less than or equal to `maximum`.
   *
   * @param value - The numeric value to test.
   * @param maximum - The inclusive upper bound.
   * @returns `true` when `value <= maximum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/numeric#range}
   * @group Numeric
   */
  static satisfiesMaximum(value: number, maximum: number): boolean {
    return value <= maximum;
  }

  /**
   * Check that an array has at most `maximum` items.
   *
   * @param value - The array to test.
   * @param maximum - The maximum allowed length.
   * @returns `true` when `value.length <= maximum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/array#length}
   * @group Array
   */
  static satisfiesMaxItems(value: unknown[], maximum: number): boolean {
    return value.length <= maximum;
  }

  /**
   * Check that a string has at most `maximum` Unicode code points.
   *
   * @param value - The string to test.
   * @param maximum - The maximum allowed code point length.
   * @returns `true` when the code point length is at most `maximum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/string#length}
   * @group String
   */
  static satisfiesMaxLength(value: string, maximum: number): boolean {
    return Predicates.codePointLength(value) <= maximum;
  }

  /**
   * Check that an object has at most `maximum` properties.
   *
   * @param value - The object to test.
   * @param maximum - The maximum number of own keys allowed.
   * @returns `true` when the number of own keys is at most `maximum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/object#size}
   * @group Object
   */
  static satisfiesMaxProperties(value: Record<string, unknown>, maximum: number): boolean {
    return Object.keys(value).length <= maximum;
  }

  /**
   * Check that a number is greater than or equal to `minimum`.
   *
   * @param value - The numeric value to test.
   * @param minimum - The inclusive lower bound.
   * @returns `true` when `value >= minimum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/numeric#range}
   * @group Numeric
   */
  static satisfiesMinimum(value: number, minimum: number): boolean {
    return value >= minimum;
  }

  /**
   * Check that an array has at least `minimum` items.
   *
   * @param value - The array to test.
   * @param minimum - The minimum required length.
   * @returns `true` when `value.length >= minimum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/array#length}
   * @group Array
   */
  static satisfiesMinItems(value: unknown[], minimum: number): boolean {
    return value.length >= minimum;
  }

  /**
   * Check that a string has at least `minimum` Unicode code points.
   *
   * @param value - The string to test.
   * @param minimum - The minimum required code point length.
   * @returns `true` when the code point length is at least `minimum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/string#length}
   * @group String
   */
  static satisfiesMinLength(value: string, minimum: number): boolean {
    return Predicates.codePointLength(value) >= minimum;
  }

  /**
   * Check that an object has at least `minimum` properties.
   *
   * @param value - The object to test.
   * @param minimum - The minimum number of own keys required.
   * @returns `true` when the number of own keys is at least `minimum`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/object#size}
   * @group Object
   */
  static satisfiesMinProperties(value: Record<string, unknown>, minimum: number): boolean {
    return Object.keys(value).length >= minimum;
  }

  /**
   * Check that a number is a multiple of `divisor` within floating-point tolerance.
   *
   * @param value - The numeric value to test.
   * @param divisor - The divisor from the schema.
   * @returns `true` when `value` is a multiple of `divisor`.
   *
   * @remarks
   * Uses `Number.EPSILON * MULTIPLE_OF_EPSILON_FACTOR` as tolerance for
   * floating-point rounding errors.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/numeric#multiples}
   * @group Numeric
   */
  static satisfiesMultipleOf(value: number, divisor: number): boolean {
    if (divisor === 0) {
      return false;
    }
    const quotient = value / divisor;

    return Math.abs(quotient - Math.round(quotient)) <= Number.EPSILON * MULTIPLE_OF_EPSILON_FACTOR;
  }

  /**
   * Check that a string matches a compiled regular expression.
   *
   * @param value - The string to test.
   * @param regex - The compiled regular expression from the schema `pattern`.
   * @returns `true` when the regex matches `value`.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/string#pattern}
   * @group String
   */
  static satisfiesPattern(value: string, regex: RegExp): boolean {
    return regex.test(value);
  }

  /**
   * Check that all items in an array are unique (deep equality).
   *
   * @param value - The array to test.
   * @returns `true` when no two items in the array are deeply equal.
   *
   * @category Validation
   * @since 0.1.0
   * @see {@link https://json-schema.org/understanding-json-schema/reference/array#uniqueItems}
   * @group Array
   */
  static satisfiesUniqueItems(value: unknown[]): boolean {
    for (let index = 0; index < value.length; index++) {
      for (let other = index + 1; other < value.length; other++) {
        if (deepEqual(value[index], value[other])) {
          return false;
        }
      }
    }

    return true;
  }
}

function decodeBase64Safe(value: string, urlSafe: boolean): null | string {
  try {
    // Normalise url-safe alphabet to standard before decoding
    const normalised = urlSafe
      ? value.replaceAll('-', '+').replaceAll('_', '/')
      : value;

    // atob is available in Node 16+ and all browsers
    const decoded = atob(normalised);

    return decoded;
  } catch {
    return null;
  }
}

function isValidJson(content: string): boolean {
  try {
    JSON.parse(content);

    return true;
  } catch {
    return false;
  }
}
