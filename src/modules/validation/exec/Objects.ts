import type { ValidateWithErrorsFunctionType } from '../../../types/Validation.js';
import type { ExecContextType } from '../../../types/ExecContextType.js';
import { BaseError } from '../../../errors/BaseError.js';
import { DataType } from '../../data/DataType.js';
import { GraphEngineSupport } from '../../graph/GraphEngineSupport.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

export class Objects {
  static applyAliases(
    object: Record<string, unknown>,
    propertyAliases: Map<string, string>
  ): void {
    for (const [
      alias,
      canonicalKey
    ] of propertyAliases) {
      if (alias in object) {
        if (!(canonicalKey in object)) {
          object[canonicalKey] = object[alias];
        }
        // Reflect.deleteProperty removes the key from the same object reference
        // (identity must be preserved — this object is threaded through the rest
        // of the validate chain) without the `delete object[x]` operator syntax.
        Reflect.deleteProperty(object, alias);
      }
    }
  }

  static applyDefaults(
    object: Record<string, unknown>,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>
  ): void {
    for (const [
      key,
      propDefault
    ] of propertyDefaults) {
      if (!(key in object) && propDefault.hasDefault) {
        object[key] = GraphEngineSupport.cloneDefault(propDefault.defaultValue);
      }
    }
  }

  static validateDependentRequired(
    path: string,
    value: unknown,
    depRequiredEntries: Array<[string, string[]]>,
    context: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (depRequiredEntries.length === 0 || !DataType.isRecord(value)) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    const object = value;
    let valid = true;

    for (const [
      trigger,
      deps
    ] of depRequiredEntries) {
      if (trigger in object) {
        for (const dep of deps) {
          if (!(dep in object)) {
            if (!context.collectErrors) {
              return {
                'earlyExit': true,
                'valid': false
              };
            }
            context.errors.push(BaseError.validationError(path, 'dependentRequired', VALIDATION_MESSAGES.dependentRequired(dep, trigger), {
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

  /** Validate one property declared in `properties`. Returns whether it is valid. */
  private static validateKnownProperty(
    childPath: string,
    context: ExecContextType,
    key: string,
    object: Record<string, unknown>,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>,
    propValidator: ValidateWithErrorsFunctionType
  ): boolean {
    let propValue = object[key];

    if (context.applyDefaults && propValue === undefined) {
      const propDefault = propertyDefaults.get(key);

      if (propDefault?.hasDefault === true) {
        propValue = GraphEngineSupport.cloneDefault(propDefault.defaultValue);
        object[key] = propValue;
      }
    }

    const propResult = propValidator(propValue, childPath, context);

    if (!propResult.valid) {
      return false;
    }
    if (propResult.value !== propValue) {
      object[key] = propResult.value;
    }

    return true;
  }

  static validateProperties(
    path: string,
    object: Record<string, unknown>,
    propValidators: Map<string, ValidateWithErrorsFunctionType>,
    patternPropValidators: Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFunctionType }> | undefined,
    additionalIsFalse: boolean,
    additionalValidator: undefined | ValidateWithErrorsFunctionType,
    allowedKeys: Set<string> | undefined,
    stripUnknown: boolean,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>,
    context: ExecContextType,
    allowedKeysForStrip?: Set<string>
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean } {
    let valid = true;
    const pathPrefix = path === '' ? '/' : `${path}/`;
    const keys = Object.keys(object);

    for (const key of keys) {
      const propValidator = propValidators.get(key);

      // childPath is constructed lazily — only at the call site where it is needed.
      // On the all-valid path (no errors) this avoids one string concatenation per property.
      const propOk = propValidator === undefined
        ? Objects.validateUnknownProperty(
          additionalIsFalse,
          additionalValidator,
          allowedKeys,
          allowedKeysForStrip ?? allowedKeys,
          pathPrefix,
          key,
          context,
          object,
          patternPropValidators,
          stripUnknown
        )
        : Objects.validateKnownProperty(pathPrefix + key, context, key, object, propertyDefaults, propValidator);

      if (!propOk) {
        if (!context.collectErrors) {
          return {
            'count': 0,
            'earlyExit': true,
            'valid': false
          };
        }
        valid = false;
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
    object: Record<string, unknown>,
    minProperties: number | undefined,
    maxProperties: number | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>,
    precomputedCount?: number
  ): boolean {
    if (minProperties === undefined && maxProperties === undefined) {
      return true;
    }

    const count = precomputedCount ?? Object.keys(object).length;
    const pre = errors.length;

    if (minProperties !== undefined && count < minProperties) {
      errors.push(BaseError.validationError(path, 'minProperties', VALIDATION_MESSAGES.minProperties(minProperties)));
    }
    if (maxProperties !== undefined && count > maxProperties) {
      errors.push(BaseError.validationError(path, 'maxProperties', VALIDATION_MESSAGES.maxProperties(maxProperties)));
    }

    return errors.length === pre;
  }

  static validatePropertyNames(
    path: string,
    value: unknown,
    propertyNamesValidator: undefined | ValidateWithErrorsFunctionType,
    context: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (propertyNamesValidator === undefined || !DataType.isRecord(value)) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    let valid = true;
    const pathPrefix = path === '' ? '/' : `${path}/`;

    for (const key of Object.keys(value)) {
      const pnResult = propertyNamesValidator(key, pathPrefix + key, context);

      if (!pnResult.valid) {
        if (!context.collectErrors) {
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
    object: Record<string, unknown>,
    required: string[] | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (required === undefined) {
      return true;
    }

    const pre = errors.length;

    for (const key of required) {
      if (!(key in object)) {
        errors.push(BaseError.validationError(path, 'required', VALIDATION_MESSAGES.required(key), { 'missingProperty': key }));
      }
    }

    return errors.length === pre;
  }

  /** Validate one property not declared in `properties` (patternProperties/additionalProperties/strip). Returns whether it is valid. */
  private static validateUnknownProperty(
    additionalIsFalse: boolean,
    additionalValidator: undefined | ValidateWithErrorsFunctionType,
    allowedKeys: Set<string> | undefined,
    allowedKeysForStrip: Set<string> | undefined,
    pathPrefix: string,
    key: string,
    context: ExecContextType,
    object: Record<string, unknown>,
    patternPropValidators: Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFunctionType }> | undefined,
    stripUnknown: boolean
  ): boolean {
    let matchedPattern = false;
    let valid = true;

    if (patternPropValidators !== undefined) {
      for (const pp of patternPropValidators) {
        if (pp.regex.test(key)) {
          matchedPattern = true;
          const childPath = pathPrefix + key;
          const ppResult = pp.validator(object[key], childPath, context);

          if (!ppResult.valid) {
            if (!context.collectErrors) {
              return false;
            }
            valid = false;
          }
          if (ppResult.value !== object[key]) {
            object[key] = ppResult.value;
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
        // Reflect.deleteProperty removes the key from the same object reference
        // (identity must be preserved — this object is threaded through the rest
        // of the validate chain) without the `delete object[x]` operator syntax.
        Reflect.deleteProperty(object, key);
      } else if (additionalIsFalse && allowedKeys?.has(key) !== true && !context.ignoreAdditionalProperties) {
        if (!context.collectErrors) {
          return false;
        }
        context.errors.push(BaseError.validationError(pathPrefix + key, 'additionalProperties', VALIDATION_MESSAGES.additionalProperties(key)));
        valid = false;
      } else if (additionalValidator !== undefined) {
        const childPath = pathPrefix + key;
        const addResult = additionalValidator(object[key], childPath, context);

        if (!addResult.valid) {
          if (!context.collectErrors) {
            return false;
          }
          valid = false;
        }
        if (addResult.value !== object[key]) {
          object[key] = addResult.value;
        }
      }
    }

    return valid;
  }
}
