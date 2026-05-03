import type { ObjectResultInterface } from '../../../interfaces/ObjectResult.js';
import type { ValidationErrorType } from '../../../types/Validation.js';
import type { ValidateWithErrorsFnType } from '../../../types/Validation.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { cloneDefault } from '../../graph/GraphEngineSupport.js';

export class Objects {
  static applyAliases(
    obj: Record<string, unknown>,
    propertyAliases: Map<string, string>
  ): void {
    for (const [
      alias,
      canonicalKey
    ] of propertyAliases) {
      if (alias in obj) {
        if (!(canonicalKey in obj)) {
          obj[canonicalKey] = obj[alias];
        }
        delete obj[alias];
      }
    }
  }

  static applyDefaults(
    obj: Record<string, unknown>,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>
  ): void {
    for (const [
      key,
      propDefault
    ] of propertyDefaults) {
      if (!(key in obj) && propDefault.hasDefault) {
        obj[key] = cloneDefault(propDefault.defaultValue);
      }
    }
  }

  static validateDependentRequired(
    path: string,
    value: unknown,
    depRequiredEntries: Array<[string, string[]]>,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (depRequiredEntries.length === 0 || !isRecord(value)) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    const obj = value;
    let valid = true;

    for (const [
      trigger,
      deps
    ] of depRequiredEntries) {
      if (trigger in obj) {
        for (const dep of deps) {
          if (!(dep in obj)) {
            if (!collectErrors) {
              return {
                'earlyExit': true,
                'valid': false
              };
            }
            errors.push(BaseError.validationError(path, 'dependentRequired', `property '${trigger}' requires property '${dep}'`, {
              'missingProperty': dep,
              'property': trigger
            }));
            valid = false;
          }
        }
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  private static validateKnownProperty(
    childPath: string,
    key: string,
    obj: Record<string, unknown>,
    propValidator: ValidateWithErrorsFnType,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    let propValue = obj[key];

    if (applyDefaults && propValue === undefined) {
      const propDefault = propertyDefaults.get(key);

      if (propDefault?.hasDefault === true) {
        propValue = cloneDefault(propDefault.defaultValue);
        obj[key] = propValue;
      }
    }

    const propResult = propValidator(
      propValue,
      childPath,
      errors,
      collectErrors,
      applyDefaults,
      doCoerce,
      stripUnknown
    );

    if (!propResult.valid) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }

      return {
        'earlyExit': false,
        'valid': false
      };
    }
    if (propResult.value !== propValue) {
      obj[key] = propResult.value;
    }

    return {
      'earlyExit': false,
      'valid': true
    };
  }

  static validateProperties(
    path: string,
    obj: Record<string, unknown>,
    propValidators: Map<string, ValidateWithErrorsFnType>,
    patternPropValidators: Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFnType }> | undefined,
    additionalIsFalse: boolean,
    additionalValidator: undefined | ValidateWithErrorsFnType,
    allowedKeys: Set<string> | undefined,
    stripUnknown: boolean,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    let valid = true;

    for (const key of Object.keys(obj)) {
      const propValidator = propValidators.get(key);
      const childPath = path === '' ? `/${key}` : `${path}/${key}`;

      if (propValidator === undefined) {
        const patternResult = Objects.validateUnknownProperty(
          childPath,
          key,
          obj,
          patternPropValidators,
          additionalIsFalse,
          additionalValidator,
          allowedKeys,
          stripUnknown,
          errors,
          collectErrors,
          applyDefaults,
          doCoerce
        );

        if (patternResult.earlyExit) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        if (!patternResult.valid) {
          valid = false;
        }
      } else {
        const knownResult = Objects.validateKnownProperty(
          childPath,
          key,
          obj,
          propValidator,
          propertyDefaults,
          errors,
          collectErrors,
          applyDefaults,
          doCoerce,
          stripUnknown
        );

        if (knownResult.earlyExit) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        if (!knownResult.valid) {
          valid = false;
        }
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  static validatePropertyCount(
    path: string,
    obj: Record<string, unknown>,
    minProperties: number | undefined,
    maxProperties: number | undefined
  ): ObjectResultInterface {
    if (minProperties === undefined && maxProperties === undefined) {
      return {
        'errors': [],
        'valid': true,
        'value': obj
      };
    }

    const count = Object.keys(obj).length;
    const errors: ValidationErrorType[] = [];

    if (minProperties !== undefined && count < minProperties) {
      errors.push(BaseError.validationError(path, 'minProperties', `must have at least ${minProperties} properties`));
    }
    if (maxProperties !== undefined && count > maxProperties) {
      errors.push(BaseError.validationError(path, 'maxProperties', `must have at most ${maxProperties} properties`));
    }

    return {
      errors,
      'valid': errors.length === 0,
      'value': obj
    };
  }

  static validatePropertyNames(
    path: string,
    value: unknown,
    propertyNamesValidator: undefined | ValidateWithErrorsFnType,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (propertyNamesValidator === undefined || !isRecord(value)) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    let valid = true;

    for (const key of Object.keys(value)) {
      const pnResult = propertyNamesValidator(key, path === '' ? `/${key}` : `${path}/${key}`, errors, collectErrors, false, false, false);

      if (!pnResult.valid) {
        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  static validateRequired(
    path: string,
    obj: Record<string, unknown>,
    required: string[] | undefined
  ): ObjectResultInterface {
    if (required === undefined) {
      return {
        'errors': [],
        'valid': true,
        'value': obj
      };
    }

    const errors: ValidationErrorType[] = [];

    for (const key of required) {
      if (!(key in obj)) {
        errors.push(BaseError.validationError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
      }
    }

    return {
      errors,
      'valid': errors.length === 0,
      'value': obj
    };
  }

  private static validateUnknownProperty(
    childPath: string,
    key: string,
    obj: Record<string, unknown>,
    patternPropValidators: Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFnType }> | undefined,
    additionalIsFalse: boolean,
    additionalValidator: undefined | ValidateWithErrorsFnType,
    allowedKeys: Set<string> | undefined,
    stripUnknown: boolean,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    let matchedPattern = false;
    let valid = true;

    if (patternPropValidators !== undefined) {
      for (const pp of patternPropValidators) {
        if (pp.regex.test(key)) {
          matchedPattern = true;
          const ppResult = pp.validator(
            obj[key],
            childPath,
            errors,
            collectErrors,
            applyDefaults,
            doCoerce,
            stripUnknown
          );

          if (!ppResult.valid) {
            if (!collectErrors) {
              return {
                'earlyExit': true,
                'valid': false
              };
            }
            valid = false;
          }
          if (ppResult.value !== obj[key]) {
            obj[key] = ppResult.value;
          }
        }
      }
    }

    if (!matchedPattern) {
      if (stripUnknown && allowedKeys !== undefined && !allowedKeys.has(key)) {
        delete obj[key];
      } else if (additionalIsFalse && allowedKeys?.has(key) !== true) {
        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        errors.push(BaseError.validationError(childPath, 'additionalProperties', `must NOT have additional property '${key}'`));
        valid = false;
      } else if (additionalValidator !== undefined) {
        const addResult = additionalValidator(
          obj[key],
          childPath,
          errors,
          collectErrors,
          applyDefaults,
          doCoerce,
          stripUnknown
        );

        if (!addResult.valid) {
          if (!collectErrors) {
            return {
              'earlyExit': true,
              'valid': false
            };
          }
          valid = false;
        }
        if (addResult.value !== obj[key]) {
          obj[key] = addResult.value;
        }
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }
}
