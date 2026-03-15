import type { FormatRegistryInterface } from '../../interfaces/format-registry.js';
import type { SchemaGraphSemanticsInterface } from '../../interfaces/schema-graph.js';

type CheckFnType = (value: unknown) => boolean;

export function hasFormatAssertions(sem: SchemaGraphSemanticsInterface): boolean {
  const rootVocabulary = sem.schemaVocabulary;

  if (rootVocabulary !== undefined && rootVocabulary !== null && typeof rootVocabulary === 'object') {
    return (rootVocabulary as Record<string, unknown>)['https://json-schema.org/draft/2020-12/vocab/format-assertion'] === true;
  }

  const schemaUri = sem.schemaDialect;

  if (schemaUri === 'https://json-schema.org/draft/2020-12/schema') {
    return false;
  }

  return true;
}

export function compileNumberCheck(
  minimum: number | undefined,
  maximum: number | undefined,
  exclusiveMinimum: number | undefined,
  exclusiveMaximum: number | undefined,
  multipleOf: number | undefined
): CheckFnType | undefined {
  const checks: Array<(num: number) => boolean> = [];

  if (minimum !== undefined) {
    checks.push((num) => {
      return num >= minimum;
    });
  }
  if (maximum !== undefined) {
    checks.push((num) => {
      return num <= maximum;
    });
  }
  if (exclusiveMinimum !== undefined) {
    checks.push((num) => {
      return num > exclusiveMinimum;
    });
  }
  if (exclusiveMaximum !== undefined) {
    checks.push((num) => {
      return num < exclusiveMaximum;
    });
  }
  if (multipleOf !== undefined) {
    checks.push((num) => {
      return num % multipleOf === 0;
    });
  }

  if (checks.length === 0) {
    return undefined;
  }

  return (value) => {
    if (typeof value !== 'number') {
      return true;
    }

    for (const check of checks) {
      if (!check(value)) {
        return false;
      }
    }

    return true;
  };
}

export function compileStringCheck(
  minLength: number | undefined,
  maxLength: number | undefined,
  pattern: string | undefined,
  format: string | undefined,
  formatRegistry: FormatRegistryInterface,
  sem: SchemaGraphSemanticsInterface
): CheckFnType | undefined {
  const checks: Array<(str: string) => boolean> = [];

  if (minLength !== undefined) {
    checks.push((str) => {
      return [...str].length >= minLength;
    });
  }
  if (maxLength !== undefined) {
    checks.push((str) => {
      return [...str].length <= maxLength;
    });
  }
  if (pattern !== undefined) {
    const regex = new RegExp(pattern, 'u');

    checks.push((str) => {
      return regex.test(str);
    });
  }
  let formatCheck: CheckFnType | undefined;

  if (format !== undefined && hasFormatAssertions(sem)) {
    const formatValidator = formatRegistry.get(format);

    if (formatValidator !== undefined) {
      formatCheck = (value) => {
        return formatValidator(value);
      };
    }
  }

  if (checks.length === 0 && formatCheck === undefined) {
    return undefined;
  }
  if (checks.length === 0 && formatCheck !== undefined) {
    return formatCheck;
  }

  const stringChecks = [...checks];

  return (value) => {
    if (typeof value === 'string') {
      for (const check of stringChecks) {
        if (!check(value)) {
          return false;
        }
      }
    }

    if (formatCheck !== undefined && !formatCheck(value)) {
      return false;
    }

    return true;
  };
}

export function compileTypeCheck(types: string[]): CheckFnType {
  if (types.length === 1) {
    switch (types[0]) {
      case 'array': return (value) => {
        return Array.isArray(value);
      };
      case 'boolean': return (value) => {
        return typeof value === 'boolean';
      };
      case 'integer': return (value) => {
        return typeof value === 'number' && Number.isInteger(value);
      };
      case 'null': return (value) => {
        return value === null;
      };
      case 'number': return (value) => {
        return typeof value === 'number';
      };
      case 'object': return (value) => {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      };
      case 'string': return (value) => {
        return typeof value === 'string';
      };
    }
  }

  const typeSet = new Set(types);
  const hasNull = typeSet.has('null');
  const hasInteger = typeSet.has('integer');

  return (value) => {
    if (value === null) {
      return hasNull;
    }
    if (Array.isArray(value)) {
      return typeSet.has('array');
    }
    const valueType = typeof value;

    if (valueType === 'number') {
      return typeSet.has('number') || (hasInteger && Number.isInteger(value));
    }

    return typeSet.has(valueType);
  };
}
