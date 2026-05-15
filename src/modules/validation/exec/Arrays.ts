import type { ValidationErrorType } from '../../../types/Validation.js';
import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../../../types/Validation.js';
import { BaseError } from '../../../errors/BaseError.js';
import { Predicates } from '../Predicates.js';

export class Arrays {
  static validateBounds(
    path: string,
    arr: unknown[],
    minItems: number | undefined,
    maxItems: number | undefined,
    uniqueItems: boolean,
    errors: ValidationErrorType[]
  ): boolean {
    const pre = errors.length;

    if (minItems !== undefined && arr.length < minItems) {
      errors.push(BaseError.validationError(path, 'minItems', `must have at least ${minItems} items`));
    }
    if (maxItems !== undefined && arr.length > maxItems) {
      errors.push(BaseError.validationError(path, 'maxItems', `must have at most ${maxItems} items`));
    }
    if (uniqueItems && !Predicates.satisfiesUniqueItems(arr)) {
      errors.push(BaseError.validationError(path, 'uniqueItems', 'must have unique items'));
    }

    return errors.length === pre;
  }

  static validateContains(
    path: string,
    arr: unknown[],
    containsCheck: CheckFnType | undefined,
    minContains: number | undefined,
    maxContains: number | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (containsCheck === undefined) {
      return true;
    }

    let count = 0;

    for (const item of arr) {
      if (containsCheck(item)) {
        count++;
      }
    }

    const pre = errors.length;

    if (minContains !== undefined && count < minContains) {
      errors.push(BaseError.validationError(path, 'contains', `must contain at least ${minContains} matching items`));
    } else if (maxContains !== undefined && count > maxContains) {
      errors.push(BaseError.validationError(path, 'contains', `must contain at most ${maxContains} matching items`));
    } else if (minContains === undefined && maxContains === undefined && count === 0) {
      errors.push(BaseError.validationError(path, 'contains', 'must contain at least one matching item'));
    }

    return errors.length === pre;
  }

  static validateItems(
    path: string,
    arr: unknown[],
    itemValidator: undefined | ValidateWithErrorsFnType,
    prefixValidators: undefined | ValidateWithErrorsFnType[],
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (itemValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    const startIndex = prefixValidators === undefined ? 0 : prefixValidators.length;
    let valid = true;

    for (let i = startIndex; i < arr.length; i++) {
      const childPath = `${path}/${i}`;
      const itemResult = itemValidator(
        arr[i],
        childPath,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        stripUnknown
      );

      if (!itemResult.valid) {
        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        valid = false;
      }
      if (itemResult.value !== arr[i]) {
        arr[i] = itemResult.value;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  static validatePrefixItems(
    path: string,
    arr: unknown[],
    prefixValidators: undefined | ValidateWithErrorsFnType[],
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (prefixValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    let valid = true;

    for (let i = 0; i < prefixValidators.length && i < arr.length; i++) {
      const childPath = `${path}/${i}`;
      const prefixResult = prefixValidators[i](
        arr[i],
        childPath,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        stripUnknown
      );

      if (!prefixResult.valid) {
        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        valid = false;
      }
      if (prefixResult.value !== arr[i]) {
        arr[i] = prefixResult.value;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }
}
