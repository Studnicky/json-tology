import type { ValidationErrorType } from '../../../types/Validation.js';
import { BaseError } from '../../../errors/BaseError.js';
import { FormatRegistry } from '../../format/FormatRegistry.js';
import { Predicates } from '../../data/Predicates.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

/**
 * Compiled scalar-keyword validators used by the hot-path schema executor.
 *
 * All methods mutate the caller-supplied `errors` array in place and return
 * a boolean indicating whether validation passed. This avoids per-call
 * allocations on the hot validation path.
 *
 * @remarks
 * Called directly from closures compiled by {@link SchemaCompiler}. Signatures
 * are intentionally flat (no options objects) to keep V8 call-site shapes
 * monomorphic and avoid hidden-class transitions.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link SchemaCompiler}
 * @group Internal
 * @example
 * ```ts
 * const ok = Scalars.validateType('/age', ['number'], 42, errors);
 * ```
 */
export class Scalars {
  static validateConst(
    path: string,
    value: unknown,
    hasConst: boolean,
    constVal: unknown,
    errors: ValidationErrorType[]
  ): boolean {
    if (!hasConst || Predicates.satisfiesConst(value, constVal)) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'const', VALIDATION_MESSAGES.const(constVal)));

    return false;
  }

  static validateContentEncoding(
    path: string,
    value: string,
    contentEncoding: string | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (contentEncoding === undefined) {
      return true;
    }

    if (Predicates.satisfiesContentEncoding(value, contentEncoding)) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'contentEncoding', VALIDATION_MESSAGES.contentEncoding(contentEncoding), { 'contentEncoding': contentEncoding }));

    return false;
  }

  static validateContentMediaType(
    path: string,
    value: string,
    contentMediaType: string | undefined,
    contentEncoding: string | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (contentMediaType === undefined) {
      return true;
    }

    if (Predicates.satisfiesContentMediaType(value, contentMediaType, contentEncoding)) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'contentMediaType', VALIDATION_MESSAGES.contentMediaType(contentMediaType), { 'contentMediaType': contentMediaType }));

    return false;
  }

  static validateEnum(
    path: string,
    value: unknown,
    enumValues: undefined | unknown[],
    enumSet: Set<boolean | null | number | string> | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (enumValues === undefined) {
      return true;
    }

    const matched = enumSet === undefined
      ? Predicates.satisfiesEnum(value, enumValues)
      : enumSet.has(value as boolean | null | number | string);

    if (matched) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'enum', VALIDATION_MESSAGES.enum));

    return false;
  }

  static validateFormat(
    path: string,
    value: unknown,
    format: string | undefined,
    formatValidator: ((v: unknown) => boolean) | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (formatValidator === undefined) {
      return true;
    }

    let passed: boolean;

    if (FormatRegistry.isTrustedFormatPredicate(formatValidator)) {
      // Built-in validators are total functions — skip the try/catch on the hot path.
      passed = formatValidator(value);
    } else {
      // User-supplied validators may throw — treat a throw as format failure.
      try {
        passed = formatValidator(value);
      } catch {
        passed = false;
      }
    }

    if (passed) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'format', VALIDATION_MESSAGES.format(format ?? '')));

    return false;
  }

  static validateNumber(
    path: string,
    value: number,
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    const pre = errors.length;

    pushNumberBoundErrors(path, value, minimum, maximum, exclusiveMinimum, exclusiveMaximum, errors);

    if (multipleOf !== undefined && !Predicates.satisfiesMultipleOf(value, multipleOf)) {
      errors.push(BaseError.validationError(path, 'multipleOf', VALIDATION_MESSAGES.multipleOf(multipleOf)));
    }

    return errors.length === pre;
  }

  static validateString(
    path: string,
    value: string,
    minLength: number | undefined,
    maxLength: number | undefined,
    patternRegex: RegExp | undefined,
    pattern: string | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    const pre = errors.length;

    if (minLength !== undefined && !Predicates.satisfiesMinLength(value, minLength)) {
      errors.push(BaseError.validationError(path, 'minLength', VALIDATION_MESSAGES.minLength(minLength)));
    }
    if (maxLength !== undefined && !Predicates.satisfiesMaxLength(value, maxLength)) {
      errors.push(BaseError.validationError(path, 'maxLength', VALIDATION_MESSAGES.maxLength(maxLength)));
    }
    if (patternRegex !== undefined && !Predicates.satisfiesPattern(value, patternRegex)) {
      errors.push(BaseError.validationError(path, 'pattern', VALIDATION_MESSAGES.pattern(pattern ?? '')));
    }

    return errors.length === pre;
  }

  static validateType(
    path: string,
    types: string[],
    value: unknown,
    errors: ValidationErrorType[],
    typePredicate?: (v: unknown) => boolean
  ): boolean {
    if (types.length === 0) {
      return true;
    }

    const passes = typePredicate === undefined
      ? types.some((typeName: string): boolean => {
        return Predicates.matchesType(typeName, value);
      })
      : typePredicate(value);

    if (passes) {
      return true;
    }

    errors.push(BaseError.validationError(
      path,
      'type',
      VALIDATION_MESSAGES.type(types),
      { 'type': types }
    ));

    return false;
  }
}

function pushNumberBoundErrors(
  path: string,
  value: number,
  minimum: number | undefined,
  maximum: number | undefined,
  exclusiveMinimum: number | undefined,
  exclusiveMaximum: number | undefined,
  errors: ValidationErrorType[]
): void {
  if (minimum !== undefined && !Predicates.satisfiesMinimum(value, minimum)) {
    errors.push(BaseError.validationError(path, 'minimum', VALIDATION_MESSAGES.minimum(minimum)));
  }
  if (maximum !== undefined && !Predicates.satisfiesMaximum(value, maximum)) {
    errors.push(BaseError.validationError(path, 'maximum', VALIDATION_MESSAGES.maximum(maximum)));
  }
  if (exclusiveMinimum !== undefined && !Predicates.satisfiesExclusiveMinimum(value, exclusiveMinimum)) {
    errors.push(BaseError.validationError(path, 'exclusiveMinimum', VALIDATION_MESSAGES.exclusiveMinimum(exclusiveMinimum)));
  }
  if (exclusiveMaximum !== undefined && !Predicates.satisfiesExclusiveMaximum(value, exclusiveMaximum)) {
    errors.push(BaseError.validationError(path, 'exclusiveMaximum', VALIDATION_MESSAGES.exclusiveMaximum(exclusiveMaximum)));
  }
}
