import type { ValidationErrorType } from '../../../types/Validation.js';
import type { KeywordContextInterface } from '../../../interfaces/GraphEngine.js';
import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../../../types/Validation.js';
import type { CustomKeywordEntryInterface } from '../../../interfaces/CustomKeywordEntry.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { Predicates } from '../Predicates.js';

export class Composition {
  static validateAllOf(
    workingValue: unknown,
    path: string,
    allOfValidators: undefined | ValidateWithErrorsFnType[],
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean
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

    // allOf members run with stripUnknown forced false: each member
    // sees only its own properties as "known" but the value carries
    // fields from all members, so per-member stripping would erase
    // legitimate values from sibling members. The top-level node's
    // validator performs the final strip against `allowedKeysForStrip`,
    // which is the union of own + allOf-inherited property names.
    for (const allOfValidator of allOfValidators) {
      const allOfResult = allOfValidator(
        current,
        path,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        false
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
    anyOfChecks: CheckFnType[] | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (anyOfChecks === undefined) {
      return true;
    }

    const matched = anyOfChecks.some((check) => {
      return check(value);
    });

    if (matched) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'anyOf', 'must match at least one schema in anyOf'));

    return false;
  }

  static validateCustomKeywords(
    path: string,
    value: unknown,
    customKeywordEntries: CustomKeywordEntryInterface[] | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (customKeywordEntries === undefined) {
      return true;
    }

    const dataType = Predicates.inferValueType(value);
    const pre = errors.length;

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

    return errors.length === pre;
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
    complementCheck: CheckFnType | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (complementCheck?.(value) !== true) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'not', 'must not match schema'));

    return false;
  }

  static validateOneOf(
    path: string,
    value: unknown,
    oneOfChecks: CheckFnType[] | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (oneOfChecks === undefined) {
      return true;
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
      return true;
    }

    const msg = count === 0
      ? 'must match exactly one schema in oneOf (matched none)'
      : 'must match exactly one schema in oneOf (matched multiple)';

    errors.push(BaseError.validationError(path, 'oneOf', msg, { 'matchCount': count }));

    return false;
  }
}
