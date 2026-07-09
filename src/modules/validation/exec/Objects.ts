import type { ValidateWithErrorsFnType } from '../../../types/Validation.js';
import type { ExecContextType } from '../../../types/ExecContextType.js';
import { BaseError } from '../../../errors/BaseError.js';
import { DataType } from '../../data/DataType.js';
import { GraphEngineSupport } from '../../graph/GraphEngineSupport.js';
import { VALIDATION_MESSAGES } from '../../../constants/VALIDATION_MESSAGES.js';

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
        // Reflect.deleteProperty removes the key from the same object reference
        // (identity must be preserved — this object is threaded through the rest
        // of the validate chain) without the `delete obj[x]` operator syntax.
        Reflect.deleteProperty(obj, alias);
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
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    if (depRequiredEntries.length === 0 || !DataType.isRecord(value)) {
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
            if (!ctx.collectErrors) {
              return {
                'earlyExit': true,
                'valid': false
              };
            }
            ctx.errors.push(BaseError.validationError(path, 'dependentRequired', VALIDATION_MESSAGES.dependentRequired(dep, trigger), {
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
    ctx: ExecContextType,
    key: string,
    obj: Record<string, unknown>,
    propertyDefaults: Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean }>,
    propValidator: ValidateWithErrorsFnType
  ): boolean {
    let propValue = obj[key];

    if (ctx.applyDefaults && propValue === undefined) {
      const propDefault = propertyDefaults.get(key);

      if (propDefault?.hasDefault === true) {
        propValue = GraphEngineSupport.cloneDefault(propDefault.defaultValue);
        obj[key] = propValue;
      }
    }

    const propResult = propValidator(propValue, childPath, ctx);

    if (!propResult.valid) {
      return false;
    }
    if (propResult.value !== propValue) {
      obj[key] = propResult.value;
    }

    return true;
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
    ctx: ExecContextType,
    allowedKeysForStrip?: Set<string>
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean } {
    let valid = true;
    const pathPrefix = path === '' ? '/' : `${path}/`;
    const keys = Object.keys(obj);

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
          ctx,
          obj,
          patternPropValidators,
          stripUnknown
        )
        : Objects.validateKnownProperty(pathPrefix + key, ctx, key, obj, propertyDefaults, propValidator);

      if (!propOk) {
        if (!ctx.collectErrors) {
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
    obj: Record<string, unknown>,
    minProperties: number | undefined,
    maxProperties: number | undefined,
    errors: Array<ReturnType<typeof BaseError.validationError>>,
    precomputedCount?: number
  ): boolean {
    if (minProperties === undefined && maxProperties === undefined) {
      return true;
    }

    const count = precomputedCount ?? Object.keys(obj).length;
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
    propertyNamesValidator: undefined | ValidateWithErrorsFnType,
    ctx: ExecContextType
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
      const pnResult = propertyNamesValidator(key, pathPrefix + key, ctx);

      if (!pnResult.valid) {
        if (!ctx.collectErrors) {
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
    errors: Array<ReturnType<typeof BaseError.validationError>>
  ): boolean {
    if (required === undefined) {
      return true;
    }

    const pre = errors.length;

    for (const key of required) {
      if (!(key in obj)) {
        errors.push(BaseError.validationError(path, 'required', VALIDATION_MESSAGES.required(key), { 'missingProperty': key }));
      }
    }

    return errors.length === pre;
  }

  /** Validate one property not declared in `properties` (patternProperties/additionalProperties/strip). Returns whether it is valid. */
  private static validateUnknownProperty(
    additionalIsFalse: boolean,
    additionalValidator: undefined | ValidateWithErrorsFnType,
    allowedKeys: Set<string> | undefined,
    allowedKeysForStrip: Set<string> | undefined,
    pathPrefix: string,
    key: string,
    ctx: ExecContextType,
    obj: Record<string, unknown>,
    patternPropValidators: Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFnType }> | undefined,
    stripUnknown: boolean
  ): boolean {
    let matchedPattern = false;
    let valid = true;

    if (patternPropValidators !== undefined) {
      for (const pp of patternPropValidators) {
        if (pp.regex.test(key)) {
          matchedPattern = true;
          const childPath = pathPrefix + key;
          const ppResult = pp.validator(obj[key], childPath, ctx);

          if (!ppResult.valid) {
            if (!ctx.collectErrors) {
              return false;
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
        // Reflect.deleteProperty removes the key from the same object reference
        // (identity must be preserved — this object is threaded through the rest
        // of the validate chain) without the `delete obj[x]` operator syntax.
        Reflect.deleteProperty(obj, key);
      } else if (additionalIsFalse && allowedKeys?.has(key) !== true && !ctx.ignoreAdditionalProperties) {
        if (!ctx.collectErrors) {
          return false;
        }
        ctx.errors.push(BaseError.validationError(pathPrefix + key, 'additionalProperties', VALIDATION_MESSAGES.additionalProperties(key)));
        valid = false;
      } else if (additionalValidator !== undefined) {
        const childPath = pathPrefix + key;
        const addResult = additionalValidator(obj[key], childPath, ctx);

        if (!addResult.valid) {
          if (!ctx.collectErrors) {
            return false;
          }
          valid = false;
        }
        if (addResult.value !== obj[key]) {
          obj[key] = addResult.value;
        }
      }
    }

    return valid;
  }
}
