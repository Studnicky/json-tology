import type { ValidationErrorType } from '../../types/Validation.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { SchemaGraphSemanticsType } from '../../types/SchemaGraph.js';
import { Predicates } from '../validation/Predicates.js';
import { BaseError } from '../../errors/BaseError.js';

/**
 * Scalar and numeric validation helpers used by the graph execution engine.
 *
 * All methods are pure functions with no side effects. They operate on
 * already-resolved semantic nodes and push errors into a caller-supplied
 * array so that the engine controls error collection strategy.
 *
 * @remarks
 * These helpers are extracted from the main engine to keep cyclomatic
 * complexity per function within the project threshold and to allow
 * independent unit testing of scalar constraint evaluation.
 *
 * @defaultValue Immutable singleton — no default value applies.
 * @category Validation
 * @since 0.1.0
 * @see {@link GraphEngine}
 * @group Internal
 * @example
 * ```ts
 * const errors = GraphEngineScalars.validateNumberConstraints(
 *   '/price', 42, semantics, formatRegistry, false
 * );
 * ```
 */
export const GraphEngineScalars = {
  coerceGraphValue(schemaTypes: string[], value: unknown, materializeContainers: boolean): unknown {
    if (value === null && materializeContainers && schemaTypes.length > 0) {
      return coerceNullContainer(schemaTypes);
    }

    const coerced = Predicates.coerceValue(schemaTypes, value);

    if (materializeContainers) {
      return coerceContainerFallback(schemaTypes, coerced);
    }

    return coerced;
  },

  matchesSchemaTypes(schemaTypes: string[], value: unknown): boolean {
    return Predicates.matchesAnyType(schemaTypes, value);
  },

  validateNumberConstraints(
    path: string,
    value: number,
    sem: SchemaGraphSemanticsType,
    formatRegistry: FormatRegistryInterface,
    formatAssertions: boolean
  ): ValidationErrorType[] {
    const errors: ValidationErrorType[] = [];

    pushNumberRangeErrors(path, value, sem, errors);
    pushNumberFormatError(path, value, sem.format, formatRegistry, formatAssertions, errors);

    return errors;
  },

  validateStringConstraints(
    path: string,
    value: string,
    sem: SchemaGraphSemanticsType,
    regexFor: (pattern: string) => RegExp,
    formatRegistry: FormatRegistryInterface,
    formatAssertions: boolean
  ): ValidationErrorType[] {
    const errors: ValidationErrorType[] = [];

    pushStringLengthErrors(path, value, sem, errors);
    pushStringPatternError(path, value, sem.pattern, regexFor, errors);
    pushStringFormatError(path, value, sem.format, formatRegistry, formatAssertions, errors);

    return errors;
  }
} as const;

function coerceNullContainer(schemaTypes: string[]): unknown {
  if (schemaTypes.includes('object')) {
    return {};
  }
  if (schemaTypes.includes('array')) {
    return [];
  }

  return null;
}

function coerceContainerFallback(schemaTypes: string[], coerced: unknown): unknown {
  if (schemaTypes.includes('object') && Predicates.inferValueType(coerced) !== 'object') {
    return {};
  }
  if (schemaTypes.includes('array') && !Array.isArray(coerced)) {
    return [];
  }

  return coerced;
}

function pushNumberRangeErrors(
  path: string,
  value: number,
  sem: SchemaGraphSemanticsType,
  errors: ValidationErrorType[]
): void {
  const {
    exclusiveMaximum, exclusiveMinimum, maximum, minimum, multipleOf
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
  pushMultipleOfError(path, value, multipleOf, errors);
}

function pushMultipleOfError(
  path: string,
  value: number,
  multipleOf: number | undefined,
  errors: ValidationErrorType[]
): void {
  if (multipleOf !== undefined && !Predicates.satisfiesMultipleOf(value, multipleOf)) {
    errors.push(BaseError.validationError(path, 'multipleOf', `must be multiple of ${multipleOf}`, { multipleOf }));
  }
}

function pushNumberFormatError(
  path: string,
  value: number,
  format: string | undefined,
  formatRegistry: FormatRegistryInterface,
  formatAssertions: boolean,
  errors: ValidationErrorType[]
): void {
  if (format === undefined) {
    return;
  }
  const validator = formatRegistry.get(format);

  if (validator !== undefined && formatAssertions && !validator(value)) {
    errors.push(BaseError.validationError(path, 'format', `must match format "${format}"`, { format }));
  }
}

function pushStringLengthErrors(
  path: string,
  value: string,
  sem: SchemaGraphSemanticsType,
  errors: ValidationErrorType[]
): void {
  const minimum = sem.minLength;
  const maximum = sem.maxLength;

  if (minimum !== undefined && !Predicates.satisfiesMinLength(value, minimum)) {
    errors.push(BaseError.validationError(path, 'minLength', `must NOT have fewer than ${minimum} characters`, { 'limit': minimum }));
  }
  if (maximum !== undefined && !Predicates.satisfiesMaxLength(value, maximum)) {
    errors.push(BaseError.validationError(path, 'maxLength', `must NOT have more than ${maximum} characters`, { 'limit': maximum }));
  }
}

function pushStringPatternError(
  path: string,
  value: string,
  pattern: string | undefined,
  regexFor: (pattern: string) => RegExp,
  errors: ValidationErrorType[]
): void {
  if (pattern !== undefined && !Predicates.satisfiesPattern(value, regexFor(pattern))) {
    errors.push(BaseError.validationError(path, 'pattern', 'must match pattern', { pattern }));
  }
}

function pushStringFormatError(
  path: string,
  value: string,
  format: string | undefined,
  formatRegistry: FormatRegistryInterface,
  formatAssertions: boolean,
  errors: ValidationErrorType[]
): void {
  if (format === undefined) {
    return;
  }
  const validator = formatRegistry.get(format);

  if (validator !== undefined && formatAssertions && !validator(value)) {
    errors.push(BaseError.validationError(path, 'format', `must match format "${format}"`, { format }));
  }
}
