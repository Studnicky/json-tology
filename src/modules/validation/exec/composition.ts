import type { ValidationErrorType } from '../../../types/Validation.js';
import type { KeywordContextInterface } from '../../../interfaces/GraphEngine.js';
import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../../../types/Validation.js';
import type { CustomKeywordEntryInterface } from '../../../interfaces/CustomKeywordEntry.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/dataTypes.js';
import { Predicates } from '../predicates.js';

export class Composition {
  static validateAllOf(
    workingValue: unknown,
    path: string,
    allOfValidators: undefined | ValidateWithErrorsFnType[],
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (allOfValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    let valid = true;
    let current = workingValue;

    for (const allOfValidator of allOfValidators) {
      const allOfResult = allOfValidator(
        current,
        path,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        stripUnknown
      );

      if (!allOfResult.valid) {
        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false,
            'value': allOfResult.value
          };
        }
        valid = false;
      }
      current = allOfResult.value;
    }

    return {
      'earlyExit': false,
      valid,
      'value': current
    };
  }

  static validateAnyOf(
    path: string,
    value: unknown,
    anyOfChecks: CheckFnType[] | undefined
  ): { 'error': undefined | ValidationErrorType;
    'valid': boolean } {
    if (anyOfChecks === undefined) {
      return {
        'error': undefined,
        'valid': true
      };
    }

    const matched = anyOfChecks.some((check) => {
      return check(value);
    });

    if (matched) {
      return {
        'error': undefined,
        'valid': true
      };
    }

    return {
      'error': BaseError.validationError(path, 'anyOf', 'must match at least one schema in anyOf'),
      'valid': false
    };
  }

  static validateCustomKeywords(
    path: string,
    value: unknown,
    customKeywordEntries: CustomKeywordEntryInterface[] | undefined
  ): { 'errors': ValidationErrorType[];
    'valid': boolean } {
    if (customKeywordEntries === undefined) {
      return {
        'errors': [],
        'valid': true
      };
    }

    const dataType = Predicates.inferValueType(value);
    const errors: ValidationErrorType[] = [];

    for (const entry of customKeywordEntries) {
      if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
        continue;
      }

      const ctx: KeywordContextInterface = {
        'parentData': undefined,
        'parentKey': '',
        path,
        'rootData': value
      };
      const kwResult = entry.validate(entry.schemaValue, value, ctx);

      if (kwResult === false) {
        errors.push(BaseError.validationError(path, entry.keyword, `must pass "${entry.keyword}" validation`));
      } else if (Array.isArray(kwResult) && kwResult.length > 0) {
        errors.push(...kwResult);
      }
    }

    return {
      errors,
      'valid': errors.length === 0
    };
  }

  static validateDependentSchemas(
    workingValue: unknown,
    path: string,
    depSchemaValidators: Array<{ 'trigger': string;
      'validator': ValidateWithErrorsFnType }> | undefined,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (depSchemaValidators === undefined || !isRecord(workingValue)) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const obj = workingValue;
    let valid = true;
    let current = workingValue as unknown;

    for (const dep of depSchemaValidators) {
      if (dep.trigger in obj) {
        const depResult = dep.validator(
          current,
          path,
          errors,
          collectErrors,
          applyDefaults,
          doCoerce,
          stripUnknown
        );

        if (!depResult.valid) {
          if (!collectErrors) {
            return {
              'earlyExit': true,
              'valid': false,
              'value': depResult.value
            };
          }
          valid = false;
        }
        current = depResult.value;
      }
    }

    return {
      'earlyExit': false,
      valid,
      'value': current
    };
  }

  static validateIfThenElse(
    workingValue: unknown,
    path: string,
    ifCheck: CheckFnType | undefined,
    thenValidator: undefined | ValidateWithErrorsFnType,
    elseValidator: undefined | ValidateWithErrorsFnType,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (ifCheck === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    if (ifCheck(workingValue)) {
      if (thenValidator !== undefined) {
        const thenResult = thenValidator(
          workingValue,
          path,
          errors,
          collectErrors,
          applyDefaults,
          doCoerce,
          stripUnknown
        );

        if (!thenResult.valid) {
          if (!collectErrors) {
            return {
              'earlyExit': true,
              'valid': false,
              'value': thenResult.value
            };
          }

          return {
            'earlyExit': false,
            'valid': false,
            'value': thenResult.value
          };
        }

        return {
          'earlyExit': false,
          'valid': true,
          'value': thenResult.value
        };
      }
    } else if (elseValidator !== undefined) {
      const elseResult = elseValidator(
        workingValue,
        path,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        stripUnknown
      );

      if (!elseResult.valid) {
        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false,
            'value': elseResult.value
          };
        }

        return {
          'earlyExit': false,
          'valid': false,
          'value': elseResult.value
        };
      }

      return {
        'earlyExit': false,
        'valid': true,
        'value': elseResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': true,
      'value': workingValue
    };
  }

  static validateNot(
    path: string,
    value: unknown,
    complementCheck: CheckFnType | undefined
  ): { 'error': undefined | ValidationErrorType;
    'valid': boolean } {
    if (complementCheck?.(value) !== true) {
      return {
        'error': undefined,
        'valid': true
      };
    }

    return {
      'error': BaseError.validationError(path, 'not', 'must not match schema'),
      'valid': false
    };
  }

  static validateOneOf(
    path: string,
    value: unknown,
    oneOfChecks: CheckFnType[] | undefined
  ): { 'error': undefined | ValidationErrorType;
    'valid': boolean } {
    if (oneOfChecks === undefined) {
      return {
        'error': undefined,
        'valid': true
      };
    }

    let count = 0;

    for (const check of oneOfChecks) {
      if (check(value)) {
        count++;
        if (count > 1) {
          break;
        }
      }
    }

    if (count === 1) {
      return {
        'error': undefined,
        'valid': true
      };
    }

    const msg = count === 0
      ? 'must match exactly one schema in oneOf (matched none)'
      : 'must match exactly one schema in oneOf (matched multiple)';

    return {
      'error': BaseError.validationError(path, 'oneOf', msg, { 'matchCount': count }),
      'valid': false
    };
  }
}
