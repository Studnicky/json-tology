import type { ValidationErrorType } from '../../types/Validation.js';

export function coerceCompiledValue(types: string[], value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  for (const type of types) {
    switch (type) {
      case 'array':
        if (!Array.isArray(value) && typeof value !== 'object') {
          return [value];
        }
        break;
      case 'boolean':
        if (value === 'true' || value === '1' || value === 1) {
          return true;
        }
        if (value === 'false' || value === '0' || value === 0) {
          return false;
        }
        break;
      case 'integer':
      case 'number':
        if (typeof value === 'string') {
          const n = Number(value);

          if (!Number.isNaN(n)) {
            return type === 'integer' ? Math.trunc(n) : n;
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
    }
  }

  return value;
}

export function jsonSortedKeys(value: unknown): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      sorted[key] = (value as Record<string, unknown>)[key];
    }

    return JSON.stringify(sorted, (_: string, nested: unknown): unknown => {
      if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
        const nestedSorted: Record<string, unknown> = {};
        const nestedRecord = nested as Record<string, unknown>;

        for (const nestedKey of Object.keys(nestedRecord).sort()) {
          nestedSorted[nestedKey] = nestedRecord[nestedKey];
        }

        return nestedSorted;
      }

      return nested;
    });
  }

  return JSON.stringify(value);
}

const EMPTY_PARAMS: Record<string, unknown> = Object.freeze({});

export function makeValidationError(
  path: string,
  keyword: string,
  message: string,
  params?: Record<string, unknown>
): ValidationErrorType {
  return {
    keyword,
    message,
    'params': params ?? EMPTY_PARAMS,
    path
  };
}

/**
 * Count Unicode code points in a string without allocating an intermediate array.
 * Equivalent to `[...str].length` but allocation-free.
 */
export function codePointLength(str: string): number {
  let length = 0;

  for (let index = 0; index < str.length; index++) {
    length++;
    // Skip low surrogate of a surrogate pair (code point above BMP uses two UTF-16 units)
    const code = str.codePointAt(index);

    if (code !== undefined && code > 0xFF_FF) {
      index++;
    }
  }

  return length;
}
