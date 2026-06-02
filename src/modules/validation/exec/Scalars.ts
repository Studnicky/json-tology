import type { ValidationErrorType } from '../../../types/Validation.js';
import { BaseError } from '../../../errors/BaseError.js';
import { Predicates } from '../Predicates.js';

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

    errors.push(BaseError.validationError(path, 'const', `must be ${JSON.stringify(constVal)}`));

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

    errors.push(BaseError.validationError(path, 'enum', 'must be one of the allowed values'));

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

    try {
      if (formatValidator(value)) {
        return true;
      }
    } catch {
      // user-supplied validator threw — treat as format failure
    }

    errors.push(BaseError.validationError(path, 'format', `must match format "${format}"`));

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
      errors.push(BaseError.validationError(path, 'multipleOf', `must be a multiple of ${multipleOf}`));
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
      errors.push(BaseError.validationError(path, 'minLength', `must be at least ${minLength} characters`));
    }
    if (maxLength !== undefined && !Predicates.satisfiesMaxLength(value, maxLength)) {
      errors.push(BaseError.validationError(path, 'maxLength', `must be at most ${maxLength} characters`));
    }
    if (patternRegex !== undefined && !Predicates.satisfiesPattern(value, patternRegex)) {
      errors.push(BaseError.validationError(path, 'pattern', `must match pattern "${pattern}"`));
    }

    return errors.length === pre;
  }

  static validateType(
    path: string,
    types: string[],
    value: unknown,
    errors: ValidationErrorType[]
  ): boolean {
    if (types.length === 0) {
      return true;
    }

    for (const typeName of types) {
      if (Predicates.matchesType(typeName, value)) {
        return true;
      }
    }

    errors.push(BaseError.validationError(
      path,
      'type',
      types.length === 1 ? `must be ${types[0]}` : `must be one of: ${types.join(', ')}`,
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
    errors.push(BaseError.validationError(path, 'minimum', `must be >= ${minimum}`));
  }
  if (maximum !== undefined && !Predicates.satisfiesMaximum(value, maximum)) {
    errors.push(BaseError.validationError(path, 'maximum', `must be <= ${maximum}`));
  }
  if (exclusiveMinimum !== undefined && !Predicates.satisfiesExclusiveMinimum(value, exclusiveMinimum)) {
    errors.push(BaseError.validationError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`));
  }
  if (exclusiveMaximum !== undefined && !Predicates.satisfiesExclusiveMaximum(value, exclusiveMaximum)) {
    errors.push(BaseError.validationError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`));
  }
}
