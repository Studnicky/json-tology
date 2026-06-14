import type { ValidationErrorType } from '../../../types/Validation.js';
import type { KeywordContextType } from '../../../types/GraphEngine.js';
import type {
  CheckFnType, ValidateWithErrorsFnType, ValidateWithErrorsResultType
} from '../../../types/Validation.js';
import type { CustomKeywordEntryType } from '../../../types/CustomKeywordEntry.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { Predicates } from '../Predicates.js';

/**
 * Composition — validation helpers for JSON Schema composition keywords.
 *
 * Implements `allOf`, `anyOf`, `oneOf`, `not`, `if/then/else`,
 * `dependentSchemas`, and custom keyword dispatch. All methods are pure
 * static and allocation-free on the hot path.
 *
 * @remarks
 * Called directly from compiled validator closures. Methods accept positional
 * parameters rather than options objects so V8 can maintain monomorphic call
 * sites and inline cache entries across the hot validation path.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link Objects}
 * @group exec
 *
 * @example
 * ```ts
 * const result = Composition.validateAllOf(value, path, validators, errors, true, false, false);
 * ```
 */
export class Composition {
  private static applyAllOfMember(
    current: unknown,
    path: string,
    validator: ValidateWithErrorsFnType,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const result = validator(current, path, errors, collectErrors, applyDefaults, doCoerce, false);

    if (!result.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': result.value
      };
    }

    return {
      'earlyExit': false,
      'valid': result.valid,
      'value': result.value
    };
  }

  private static applyDependentSchemaMember(
    current: unknown,
    path: string,
    validator: ValidateWithErrorsFnType,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const result = validator(current, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

    if (!result.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': result.value
      };
    }

    return {
      'earlyExit': false,
      'valid': result.valid,
      'value': result.value
    };
  }

  private static applyElseBranch(
    workingValue: unknown,
    path: string,
    elseValidator: ValidateWithErrorsFnType,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const elseResult = elseValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

    if (!elseResult.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': elseResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': elseResult.valid,
      'value': elseResult.value
    };
  }

  private static applyThenBranch(
    workingValue: unknown,
    path: string,
    thenValidator: ValidateWithErrorsFnType,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): ValidateWithErrorsResultType & { 'earlyExit': boolean } {
    const thenResult = thenValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

    if (!thenResult.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': thenResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': thenResult.valid,
      'value': thenResult.value
    };
  }

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

    // Pre-pass: collect explicit property defaults from all branches before any
    // branch's required check runs. Mirrors the VisitComposition.allOf fix for
    // the graph engine path: a required field in branch N whose default lives in
    // branch N+1 would otherwise fail the required check in the compiled path.
    if (applyDefaults) {
      const preErrors: ValidationErrorType[] = [];

      for (const allOfValidator of allOfValidators) {
        current = allOfValidator(current, path, preErrors, true, true, doCoerce, false).value;
      }
    }

    // allOf members run with stripUnknown forced false: each member
    // sees only its own properties as "known" but the value carries
    // fields from all members, so per-member stripping would erase
    // legitimate values from sibling members. The top-level node's
    // validator performs the final strip against `allowedKeysForStrip`,
    // which is the union of own + allOf-inherited property names.
    for (const allOfValidator of allOfValidators) {
      const step = Composition.applyAllOfMember(current, path, allOfValidator, errors, collectErrors, applyDefaults, doCoerce);

      if (step.earlyExit) {
        return step;
      }
      if (!step.valid) {
        valid = false;
      }
      current = step.value;
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

    const matched = anyOfChecks.some((check: CheckFnType) => {
      return check(value);
    });

    if (matched) {
      return true;
    }

    errors.push(BaseError.validationError(path, 'anyOf', 'must match at least one schema in anyOf'));

    return false;
  }

  /**
   * Value-producing anyOf: runs full validators on cloned candidates, picks the first
   * winner's output value (matching VisitComposition.anyOf semantics).
   */
  static validateAnyOfWithValues(
    path: string,
    workingValue: unknown,
    anyOfValidators: ValidateWithErrorsFnType[],
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean,
    cloneCandidate: <T>(v: T) => T
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const branchErrors: ValidationErrorType[] = [];
    let winnerValue: unknown;
    let found = false;

    for (const validator of anyOfValidators) {
      const candidate = cloneCandidate(workingValue);
      const result = validator(candidate, path, branchErrors, true, applyDefaults, doCoerce, stripUnknown);

      if (result.valid && !found) {
        winnerValue = result.value;
        found = true;
      }
    }

    if (found) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    if (collectErrors) {
      errors.push(BaseError.validationError(path, 'anyOf', 'must match at least one schema in anyOf'));
    }

    return {
      'earlyExit': !collectErrors,
      'valid': false,
      'value': workingValue
    };
  }

  static validateCustomKeywords(
    path: string,
    value: unknown,
    customKeywordEntries: CustomKeywordEntryType[] | undefined,
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

      const ctx: KeywordContextType = {
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
        const step = Composition.applyDependentSchemaMember(current, path, dep.validator, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

        if (step.earlyExit) {
          return step;
        }
        if (!step.valid) {
          valid = false;
        }
        current = step.value;
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
        return Composition.applyThenBranch(workingValue, path, thenValidator, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);
      }
    } else if (elseValidator !== undefined) {
      return Composition.applyElseBranch(workingValue, path, elseValidator, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);
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

  /**
   * Value-producing oneOf: runs full validators on cloned candidates, ensures exactly
   * one wins, propagates that winner's output value (matching VisitComposition.oneOf semantics).
   */
  static validateOneOfWithValues(
    path: string,
    workingValue: unknown,
    oneOfValidators: ValidateWithErrorsFnType[],
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean,
    cloneCandidate: <T>(v: T) => T
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    let matches = 0;
    let winnerValue: unknown = workingValue;

    for (const validator of oneOfValidators) {
      const candidate = cloneCandidate(workingValue);
      const result = validator(candidate, path, [], true, applyDefaults, doCoerce, stripUnknown);

      if (result.valid) {
        matches++;
        if (matches === 1) {
          winnerValue = result.value;
        }
      }
    }

    if (matches === 1) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': winnerValue
      };
    }

    const msg = matches === 0
      ? 'must match exactly one schema in oneOf (matched none)'
      : 'must match exactly one schema in oneOf (matched multiple)';

    if (collectErrors) {
      errors.push(BaseError.validationError(path, 'oneOf', msg, { 'matchCount': matches }));
    }

    return {
      'earlyExit': !collectErrors,
      'valid': false,
      'value': workingValue
    };
  }
}
