import type { ScalarResultInterface } from '../../../interfaces/ScalarResult.js';
import type { ValidationErrorType } from '../../../types/Validation.js';
import { BaseError } from '../../../errors/BaseError.js';
import { Predicates } from '../Predicates.js';

export class Scalars {
  static validateConst(
    path: string,
    value: unknown,
    hasConst: boolean,
    constVal: unknown
  ): ScalarResultInterface {
    if (!hasConst) {
      return {
        'errors': [],
        'valid': true
      };
    }

    if (Predicates.satisfiesConst(value, constVal)) {
      return {
        'errors': [],
        'valid': true
      };
    }

    return {
      'errors': [BaseError.validationError(path, 'const', `must be ${JSON.stringify(constVal)}`)],
      'valid': false
    };
  }

  static validateEnum(
    path: string,
    value: unknown,
    enumValues: undefined | unknown[],
    enumSet: Set<boolean | null | number | string> | undefined
  ): ScalarResultInterface {
    if (enumValues === undefined) {
      return {
        'errors': [],
        'valid': true
      };
    }

    const matched = enumSet === undefined
      ? Predicates.satisfiesEnum(value, enumValues)
      : enumSet.has(value as boolean | null | number | string);

    if (matched) {
      return {
        'errors': [],
        'valid': true
      };
    }

    return {
      'errors': [BaseError.validationError(path, 'enum', 'must be one of the allowed values')],
      'valid': false
    };
  }

  static validateFormat(
    path: string,
    value: unknown,
    format: string | undefined,
    formatValidator: ((v: unknown) => boolean) | undefined
  ): ScalarResultInterface {
    if (formatValidator === undefined) {
      return {
        'errors': [],
        'valid': true
      };
    }

    if (Predicates.satisfiesFormat(value, formatValidator)) {
      return {
        'errors': [],
        'valid': true
      };
    }

    return {
      'errors': [BaseError.validationError(path, 'format', `must match format "${format}"`)],
      'valid': false
    };
  }

  static validateNumber(
    path: string,
    value: number,
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ): ScalarResultInterface {
    const errors: ValidationErrorType[] = [];

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
    if (multipleOf !== undefined && !Predicates.satisfiesMultipleOf(value, multipleOf)) {
      errors.push(BaseError.validationError(path, 'multipleOf', `must be a multiple of ${multipleOf}`));
    }

    return {
      errors,
      'valid': errors.length === 0
    };
  }

  static validateString(
    path: string,
    value: string,
    minLength: number | undefined,
    maxLength: number | undefined,
    patternRegex: RegExp | undefined,
    pattern: string | undefined
  ): ScalarResultInterface {
    const errors: ValidationErrorType[] = [];

    if (minLength !== undefined && !Predicates.satisfiesMinLength(value, minLength)) {
      errors.push(BaseError.validationError(path, 'minLength', `must be at least ${minLength} characters`));
    }
    if (maxLength !== undefined && !Predicates.satisfiesMaxLength(value, maxLength)) {
      errors.push(BaseError.validationError(path, 'maxLength', `must be at most ${maxLength} characters`));
    }
    if (patternRegex !== undefined && !Predicates.satisfiesPattern(value, patternRegex)) {
      errors.push(BaseError.validationError(path, 'pattern', `must match pattern "${pattern}"`));
    }

    return {
      errors,
      'valid': errors.length === 0
    };
  }

  static validateType(
    path: string,
    types: string[],
    value: unknown
  ): ScalarResultInterface {
    if (types.length === 0) {
      return {
        'errors': [],
        'valid': true
      };
    }

    for (const typeName of types) {
      if (Predicates.matchesType(typeName, value)) {
        return {
          'errors': [],
          'valid': true
        };
      }
    }

    return {
      'errors': [BaseError.validationError(
        path,
        'type',
        types.length === 1 ? `must be ${types[0]}` : `must be one of: ${types.join(', ')}`,
        { 'type': types }
      )],
      'valid': false
    };
  }
}
