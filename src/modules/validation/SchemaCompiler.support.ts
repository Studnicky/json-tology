import type { ValidationErrorType } from '../../types/validation.js';

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

    return JSON.stringify(sorted, (_key, nested) => {
      if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
        const nestedSorted: Record<string, unknown> = {};

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const nestedKey of Object.keys(nested).sort()) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          nestedSorted[nestedKey] = nested[nestedKey];
        }

        return nestedSorted;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return nested;
    });
  }

  return JSON.stringify(value);
}

export function makeValidationError(
  path: string,
  keyword: string,
  message: string,
  params: Record<string, unknown> = {}
): ValidationErrorType {
  return {
    keyword,
    message,
    params,
    path
  };
}
