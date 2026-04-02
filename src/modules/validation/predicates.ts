/**
 * Predicates — single source of truth for all validation logic.
 *
 * Both the interpreted path (GraphEngine) and compiled path (SchemaCompiler)
 * call these static methods. This eliminates parity bugs by ensuring both
 * paths use identical logic for type matching, constraint checking, and coercion.
 */

import { deepEqual } from '../data/dataTypes.js';

const MULTIPLE_OF_EPSILON_FACTOR = 10;

export class Predicates {
  /**
   * Count Unicode code points without allocating an intermediate array.
   * Equivalent to `[...str].length` but allocation-free.
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

  static coerceToBoolean(value: string): boolean | undefined {
    if (value === 'true' || value === '1') {
      return true;
    }
    if (value === 'false' || value === '0') {
      return false;
    }

    return undefined;
  }

  static coerceToNumber(value: string): number | undefined {
    const coerced = Number(value);

    return Number.isFinite(coerced) ? coerced : undefined;
  }

  /**
   * Unified type coercion — single source of truth for both interpreted
   * (GraphEngine) and compiled (SchemaCompiler) validation paths.
   *
   * Attempts coercion in schema-type declaration order. Returns the first
   * successful coercion or the original value when none applies.
   */
  static coerceValue(schemaTypes: string[], value: unknown): unknown {
    if (value === undefined || value === null || schemaTypes.length === 0) {
      return value;
    }

    for (const type of schemaTypes) {
      switch (type) {
        case 'array':
          if (!Array.isArray(value) && typeof value !== 'object') {
            return [value];
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            const coerced = Predicates.coerceToBoolean(value);

            if (coerced !== undefined) {
              return coerced;
            }
          }
          if (value === 1) {
            return true;
          }
          if (value === 0) {
            return false;
          }
          break;

        case 'integer':
        case 'number':
          if (typeof value === 'string') {
            const coerced = Predicates.coerceToNumber(value);

            if (coerced !== undefined) {
              return type === 'integer' ? Math.trunc(coerced) : coerced;
            }
          }
          if (typeof value === 'boolean') {
            return value ? 1 : 0;
          }
          break;

        case 'null':
          if (value === '' || value === 'null') {
            return null;
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            return String(value);
          }
          break;

        default:
          break;
      }
    }

    return value;
  }

  static hasAllRequiredProperties(value: Record<string, unknown>, required: string[]): boolean {
    return required.every((key) => {
      return key in value;
    });
  }

  static hasNoAdditionalProperties(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
    return Object.keys(value).every((key) => {
      return allowedKeys.has(key);
    });
  }

  static inferValueType(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }

    return typeof value;
  }

  static isFiniteNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }


  static isIntegerValue(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value);
  }

  static matchesAnyType(schemaTypes: string[], value: unknown): boolean {
    return schemaTypes.some((schemaType) => {
      return Predicates.matchesType(schemaType, value);
    });
  }

  static matchesType(schemaType: string, value: unknown): boolean {
    switch (schemaType) {
      case 'array':
        return Array.isArray(value);
      case 'integer':
        return Predicates.isIntegerValue(value);
      case 'null':
        return value === null;
      case 'number':
        return Predicates.isFiniteNumber(value);
      case 'object':
        return Predicates.inferValueType(value) === 'object';
      default:
        return Predicates.inferValueType(value) === schemaType;
    }
  }

  static satisfiesConst(value: unknown, constValue: unknown): boolean {
    return deepEqual(value, constValue);
  }

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


  static satisfiesEnum(value: unknown, enumValues: unknown[]): boolean {
    return enumValues.some((enumValue) => {
      return deepEqual(value, enumValue);
    });
  }

  static satisfiesExclusiveMaximum(value: number, limit: number): boolean {
    return value < limit;
  }

  static satisfiesExclusiveMinimum(value: number, limit: number): boolean {
    return value > limit;
  }

  static satisfiesFormat(value: unknown, validator: (v: unknown) => boolean): boolean {
    try {
      return validator(value);
    } catch {
      return false;
    }
  }


  static satisfiesMaximum(value: number, maximum: number): boolean {
    return value <= maximum;
  }


  static satisfiesMaxItems(value: unknown[], maximum: number): boolean {
    return value.length <= maximum;
  }

  static satisfiesMaxLength(value: string, maximum: number): boolean {
    return Predicates.codePointLength(value) <= maximum;
  }


  static satisfiesMaxProperties(value: Record<string, unknown>, maximum: number): boolean {
    return Object.keys(value).length <= maximum;
  }

  static satisfiesMinimum(value: number, minimum: number): boolean {
    return value >= minimum;
  }

  static satisfiesMinItems(value: unknown[], minimum: number): boolean {
    return value.length >= minimum;
  }

  static satisfiesMinLength(value: string, minimum: number): boolean {
    return Predicates.codePointLength(value) >= minimum;
  }


  static satisfiesMinProperties(value: Record<string, unknown>, minimum: number): boolean {
    return Object.keys(value).length >= minimum;
  }

  static satisfiesMultipleOf(value: number, divisor: number): boolean {
    if (divisor === 0) {
      return false;
    }
    const quotient = value / divisor;

    return Math.abs(quotient - Math.round(quotient)) <= Number.EPSILON * MULTIPLE_OF_EPSILON_FACTOR;
  }

  static satisfiesPattern(value: string, regex: RegExp): boolean {
    return regex.test(value);
  }

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
