import type { ValidationErrorType } from '../../types/validation.js';
import type { FormatRegistryInterface } from '../../interfaces/format-registry.js';
import type { SchemaGraphSemanticsInterface } from '../../interfaces/schema-graph.js';
import {
  inferValueType,
  isIntegerValue
} from './GraphEngine.support.js';

export function coerceGraphValue(schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown {
  if (value === undefined || value === null || schemaTypes.length === 0) {
    if (!materializeContainers || value !== null) {
      return value;
    }
    if (schemaTypes.includes('object')) {
      return {};
    }
    if (schemaTypes.includes('array')) {
      return [];
    }

    return value;
  }

  if ((schemaTypes.includes('number') || schemaTypes.includes('integer')) && typeof value === 'string') {
    const coerced = Number(value);

    if (!Number.isNaN(coerced)) {
      return schemaTypes.includes('integer') ? Math.trunc(coerced) : coerced;
    }
  }

  if (schemaTypes.includes('boolean') && typeof value === 'string') {
    if (value === 'true' || value === '1') {
      return true;
    }
    if (value === 'false' || value === '0') {
      return false;
    }
  }

  if (schemaTypes.includes('null') && value === 'null') {
    return null;
  }

  if (schemaTypes.includes('string') && typeof value !== 'string') {
    return String(value);
  }

  if (materializeContainers) {
    if (schemaTypes.includes('object') && inferValueType(value) !== 'object') {
      return {};
    }
    if (schemaTypes.includes('array') && !Array.isArray(value)) {
      return [];
    }
  }

  return value;
}

export function createValidationError(
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

export function matchesSchemaTypes(schemaTypes: string[], value: unknown): boolean {
  return schemaTypes.some((schemaType) => {
    switch (schemaType) {
      case 'array':
        return Array.isArray(value);
      case 'integer':
        return isIntegerValue(value);
      case 'null':
        return value === null;
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value);
      case 'object':
        return inferValueType(value) === 'object';
      default:
        return inferValueType(value) === schemaType;
    }
  });
}

export function validateNumberConstraints(
  path: string,
  value: number,
  sem: SchemaGraphSemanticsInterface,
  formatRegistry: FormatRegistryInterface,
  formatAssertions: boolean
): ValidationErrorType[] {
  const errors: ValidationErrorType[] = [];
  const {
    'exclusiveMaximum': exclusiveMaximum,
    'exclusiveMinimum': exclusiveMinimum,
    format,
    maximum,
    minimum,
    multipleOf
  } = sem;

  if (minimum !== undefined && value < minimum) {
    errors.push(createValidationError(path, 'minimum', `must be >= ${minimum}`, { 'limit': minimum }));
  }
  if (maximum !== undefined && value > maximum) {
    errors.push(createValidationError(path, 'maximum', `must be <= ${maximum}`, { 'limit': maximum }));
  }
  if (exclusiveMinimum !== undefined && value <= exclusiveMinimum) {
    errors.push(createValidationError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`, { 'limit': exclusiveMinimum }));
  }
  if (exclusiveMaximum !== undefined && value >= exclusiveMaximum) {
    errors.push(createValidationError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`, { 'limit': exclusiveMaximum }));
  }
  if (multipleOf !== undefined) {
    const quotient = value / multipleOf;

    if (Math.abs(quotient - Math.round(quotient)) > Number.EPSILON * 10) {
      errors.push(createValidationError(path, 'multipleOf', `must be multiple of ${multipleOf}`, { multipleOf }));
    }
  }
  if (format !== undefined) {
    const validator = formatRegistry.get(format);

    if (validator !== undefined && formatAssertions && !validator(value)) {
      errors.push(createValidationError(path, 'format', `must match format "${format}"`, { format }));
    }
  }

  return errors;
}

export function validateStringConstraints(
  path: string,
  value: string,
  sem: SchemaGraphSemanticsInterface,
  regexFor: (pattern: string) => RegExp,
  formatRegistry: FormatRegistryInterface,
  formatAssertions: boolean
): ValidationErrorType[] {
  const errors: ValidationErrorType[] = [];
  const {
    format,
    'maxLength': maximum,
    'minLength': minimum,
    pattern
  } = sem;
  const valueLength = [...value].length;

  if (minimum !== undefined && valueLength < minimum) {
    errors.push(createValidationError(path, 'minLength', `must NOT have fewer than ${minimum} characters`, { 'limit': minimum }));
  }
  if (maximum !== undefined && valueLength > maximum) {
    errors.push(createValidationError(path, 'maxLength', `must NOT have more than ${maximum} characters`, { 'limit': maximum }));
  }
  if (pattern !== undefined && !regexFor(pattern).test(value)) {
    errors.push(createValidationError(path, 'pattern', 'must match pattern', { pattern }));
  }
  if (format !== undefined) {
    const validator = formatRegistry.get(format);

    if (validator !== undefined && formatAssertions && !validator(value)) {
      errors.push(createValidationError(path, 'format', `must match format "${format}"`, { format }));
    }
  }

  return errors;
}
