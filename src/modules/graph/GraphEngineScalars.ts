import type { ValidationErrorType } from '../../types/Validation.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraph.js';
import { Predicates } from '../validation/Predicates.js';
import { BaseError } from '../../errors/BaseError.js';

export function coerceGraphValue(schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown {
  if (value === null && materializeContainers && schemaTypes.length > 0) {
    if (schemaTypes.includes('object')) {
      return {};
    }
    if (schemaTypes.includes('array')) {
      return [];
    }
  }

  const coerced = Predicates.coerceValue(schemaTypes, value);

  if (materializeContainers) {
    if (schemaTypes.includes('object') && Predicates.inferValueType(coerced) !== 'object') {
      return {};
    }
    if (schemaTypes.includes('array') && !Array.isArray(coerced)) {
      return [];
    }
  }

  return coerced;
}

export function matchesSchemaTypes(schemaTypes: string[], value: unknown): boolean {
  return Predicates.matchesAnyType(schemaTypes, value);
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

  if (minimum !== undefined && !Predicates.satisfiesMinimum(value, minimum)) {
    errors.push(BaseError.validationError(path, 'minimum', `must be >= ${minimum}`, { 'limit': minimum }));
  }
  if (maximum !== undefined && !Predicates.satisfiesMaximum(value, maximum)) {
    errors.push(BaseError.validationError(path, 'maximum', `must be <= ${maximum}`, { 'limit': maximum }));
  }
  if (exclusiveMinimum !== undefined && !Predicates.satisfiesExclusiveMinimum(value, exclusiveMinimum)) {
    errors.push(BaseError.validationError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`, { 'limit': exclusiveMinimum }));
  }
  if (exclusiveMaximum !== undefined && !Predicates.satisfiesExclusiveMaximum(value, exclusiveMaximum)) {
    errors.push(BaseError.validationError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`, { 'limit': exclusiveMaximum }));
  }
  if (multipleOf !== undefined && !Predicates.satisfiesMultipleOf(value, multipleOf)) {
    errors.push(BaseError.validationError(path, 'multipleOf', `must be multiple of ${multipleOf}`, { multipleOf }));
  }
  if (format !== undefined) {
    const validator = formatRegistry.get(format);

    if (validator !== undefined && formatAssertions && !Predicates.satisfiesFormat(value, validator)) {
      errors.push(BaseError.validationError(path, 'format', `must match format "${format}"`, { format }));
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

  if (minimum !== undefined && !Predicates.satisfiesMinLength(value, minimum)) {
    errors.push(BaseError.validationError(path, 'minLength', `must NOT have fewer than ${minimum} characters`, { 'limit': minimum }));
  }
  if (maximum !== undefined && !Predicates.satisfiesMaxLength(value, maximum)) {
    errors.push(BaseError.validationError(path, 'maxLength', `must NOT have more than ${maximum} characters`, { 'limit': maximum }));
  }
  if (pattern !== undefined && !Predicates.satisfiesPattern(value, regexFor(pattern))) {
    errors.push(BaseError.validationError(path, 'pattern', 'must match pattern', { pattern }));
  }
  if (format !== undefined) {
    const validator = formatRegistry.get(format);

    if (validator !== undefined && formatAssertions && !Predicates.satisfiesFormat(value, validator)) {
      errors.push(BaseError.validationError(path, 'format', `must match format "${format}"`, { format }));
    }
  }

  return errors;
}
