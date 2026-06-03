import type { ValidationErrorType } from '../../../types/Validation.js';
import type { ValidateWithErrorsFnType } from '../../../types/Validation.js';
import { BaseError } from '../../../errors/BaseError.js';
import {
  isRecord
} from '../../data/DataTypes.js';
import { GraphEngineSupport } from '../../graph/GraphEngineSupport.js';

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
        obj[key] = GraphEngineSupport.cloneDefault(propDefault.defaultValue);
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

  private static validateKnownProperty(opts: {
    'applyDefaults': boolean;
    'childPath': string;
    'collectErrors': boolean;
    'doCoerce': boolean;
    'errors': ValidationErrorType[];
    'key': string;
    'obj': Record<string, unknown>;
    'propertyDefaults': Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>;
    'propValidator': ValidateWithErrorsFnType;
    'stripUnknown': boolean;
  }): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
      applyDefaults, childPath, collectErrors, doCoerce, errors, key, obj, propertyDefaults, propValidator, stripUnknown
    } = opts;
    let propValue = obj[key];

    if (applyDefaults && propValue === undefined) {
      const propDefault = propertyDefaults.get(key);

      if (propDefault?.hasDefault === true) {
        propValue = GraphEngineSupport.cloneDefault(propDefault.defaultValue);
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
    doCoerce: boolean,
    allowedKeysForStrip?: Set<string>
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean } {
    let valid = true;
    const pathPrefix = path === '' ? '/' : `${path}/`;
    const keys = Object.keys(obj);

    for (const key of keys) {
      const propValidator = propValidators.get(key);
      const childPath = pathPrefix + key;

      if (propValidator === undefined) {
        const patternResult = Objects.validateUnknownProperty({
          'additionalIsFalse': additionalIsFalse,
          'additionalValidator': additionalValidator,
          'allowedKeys': allowedKeys,
          'allowedKeysForStrip': allowedKeysForStrip ?? allowedKeys,
          'applyDefaults': applyDefaults,
          'childPath': childPath,
          'collectErrors': collectErrors,
          'doCoerce': doCoerce,
          'errors': errors,
          'key': key,
          'obj': obj,
          'patternPropValidators': patternPropValidators,
          'stripUnknown': stripUnknown
        });

        if (patternResult.earlyExit) {
          return {
            'count': 0,
            'earlyExit': true,
            'valid': false
          };
        }
        if (!patternResult.valid) {
          valid = false;
        }
      } else {
        const knownResult = Objects.validateKnownProperty({
          'applyDefaults': applyDefaults,
          'childPath': childPath,
          'collectErrors': collectErrors,
          'doCoerce': doCoerce,
          'errors': errors,
          'key': key,
          'obj': obj,
          'propertyDefaults': propertyDefaults,
          'propValidator': propValidator,
          'stripUnknown': stripUnknown
        });

        if (knownResult.earlyExit) {
          return {
            'count': 0,
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
      'count': keys.length,
      'earlyExit': false,
      valid
    };
  }

  static validatePropertyCount(
    path: string,
    obj: Record<string, unknown>,
    minProperties: number | undefined,
    maxProperties: number | undefined,
    errors: ValidationErrorType[],
    precomputedCount?: number
  ): boolean {
    if (minProperties === undefined && maxProperties === undefined) {
      return true;
    }

    const count = precomputedCount ?? Object.keys(obj).length;
    const pre = errors.length;

    if (minProperties !== undefined && count < minProperties) {
      errors.push(BaseError.validationError(path, 'minProperties', `must have at least ${minProperties} properties`));
    }
    if (maxProperties !== undefined && count > maxProperties) {
      errors.push(BaseError.validationError(path, 'maxProperties', `must have at most ${maxProperties} properties`));
    }

    return errors.length === pre;
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
    const pathPrefix = path === '' ? '/' : `${path}/`;

    for (const key of Object.keys(value)) {
      const pnResult = propertyNamesValidator(key, pathPrefix + key, errors, collectErrors, false, false, false);

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
    required: string[] | undefined,
    errors: ValidationErrorType[]
  ): boolean {
    if (required === undefined) {
      return true;
    }

    const pre = errors.length;

    for (const key of required) {
      if (!(key in obj)) {
        errors.push(BaseError.validationError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
      }
    }

    return errors.length === pre;
  }

  private static validateUnknownProperty(opts: {
    'additionalIsFalse': boolean;
    'additionalValidator': undefined | ValidateWithErrorsFnType;
    'allowedKeys': Set<string> | undefined;
    'allowedKeysForStrip': Set<string> | undefined;
    'applyDefaults': boolean;
    'childPath': string;
    'collectErrors': boolean;
    'doCoerce': boolean;
    'errors': ValidationErrorType[];
    'key': string;
    'obj': Record<string, unknown>;
    'patternPropValidators': Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFnType }> | undefined;
    'stripUnknown': boolean;
  }): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip, applyDefaults, childPath, collectErrors, doCoerce, errors, key, obj, patternPropValidators, stripUnknown
    } = opts;
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
      // Strip uses the wider set (own + allOf-inherited) so coercion
      // doesn't delete parent fields supplied to a subclass schema.
      // The additionalProperties:false check uses the strict own-only
      // set per JSON Schema semantics.
      const stripAllowed = allowedKeysForStrip ?? allowedKeys;

      if (stripUnknown && stripAllowed !== undefined && !stripAllowed.has(key)) {
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
