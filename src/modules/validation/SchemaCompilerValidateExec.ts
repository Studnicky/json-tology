import type { CompiledNodeValidationPlanInterface } from '../../interfaces/CompiledNodeValidationPlan.js';
import type {
  ValidateWithErrorsFnType, ValidationErrorType
} from '../../types/Validation.js';
import { BaseError } from '../../errors/BaseError.js';
import { isRecord } from '../data/DataTypes.js';
import { cloneDefault } from '../graph/GraphEngineSupport.js';
import { coerceCompiledValue } from './SchemaCompilerSupport.js';
import { Arrays } from './exec/Arrays.js';
import { Composition } from './exec/Composition.js';
import { Objects } from './exec/Objects.js';
import { Scalars } from './exec/Scalars.js';

function fail(workingValue: unknown): {
  'valid': false;
  'value': unknown;
} {
  return {
    'valid': false,
    'value': workingValue
  };
}

export function buildValidateWithErrorsExecution(plan: CompiledNodeValidationPlanInterface): ValidateWithErrorsFnType {
  const {
    additionalIsFalse,
    additionalValidator,
    allOfValidators,
    allowedKeys,
    anyOfChecks,
    complementCheck,
    constVal,
    containsCheck,
    customKeywordEntries,
    defaultValue,
    depRequiredEntries,
    depSchemaValidators,
    elseValidator,
    enumSet,
    enumValues,
    exclusiveMaximum,
    exclusiveMinimum,
    format,
    formatValidator,
    hasConst,
    hasDefault,
    ifCheck,
    itemValidator,
    jtExtra,
    maxContains,
    maximum,
    maxItems,
    maxLength,
    maxProperties,
    minContains,
    minimum,
    minItems,
    minLength,
    minProperties,
    multipleOf,
    oneOfChecks,
    pattern,
    patternPropValidators,
    patternRegex,
    prefixValidators,
    propertyAliases,
    propertyDefaults,
    propertyNamesValidator,
    propValidators,
    refValidator,
    required,
    thenValidator,
    types,
    uniqueItems
  } = plan;

  return (
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ): { 'valid': boolean;
    'value': unknown; } => {
    let workingValue = value;

    if (applyDefaults && workingValue === undefined && hasDefault) {
      workingValue = cloneDefault(defaultValue);
    }

    if (doCoerce && types.length > 0) {
      workingValue = coerceCompiledValue(types, workingValue);
    }

    let valid = true;

    // --- $ref ---
    if (refValidator !== undefined) {
      const refResult = refValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

      if (!refResult.valid) {
        if (!collectErrors) {
          return fail(refResult.value);
        }
        valid = false;
      }
      workingValue = refResult.value;
    }

    // --- Scalar: type, enum, const ---
    const typeResult = Scalars.validateType(path, types, workingValue);

    if (!typeResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      errors.push(...typeResult.errors);
      valid = false;
    }

    const enumResult = Scalars.validateEnum(path, workingValue, enumValues, enumSet);

    if (!enumResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      errors.push(...enumResult.errors);
      valid = false;
    }

    const constResult = Scalars.validateConst(path, workingValue, hasConst, constVal);

    if (!constResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      errors.push(...constResult.errors);
      valid = false;
    }

    // --- Scalar: string constraints ---
    if (typeof workingValue === 'string') {
      const stringResult = Scalars.validateString(path, workingValue, minLength, maxLength, patternRegex, pattern);

      if (!stringResult.valid) {
        if (!collectErrors) {
          return fail(workingValue);
        }
        errors.push(...stringResult.errors);
        valid = false;
      }
    }

    // --- Scalar: format ---
    const formatResult = Scalars.validateFormat(path, workingValue, format, formatValidator);

    if (!formatResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      errors.push(...formatResult.errors);
      valid = false;
    }

    // --- Scalar: number constraints ---
    if (typeof workingValue === 'number') {
      const numberResult = Scalars.validateNumber(
        path,
        workingValue,
        minimum,
        maximum,
        exclusiveMinimum,
        exclusiveMaximum,
        multipleOf
      );

      if (!numberResult.valid) {
        if (!collectErrors) {
          return fail(workingValue);
        }
        errors.push(...numberResult.errors);
        valid = false;
      }
    }

    // --- Object validation ---
    if (isRecord(workingValue)) {
      const obj = workingValue;

      if (propertyAliases.size > 0) {
        Objects.applyAliases(obj, propertyAliases);
      }

      if (applyDefaults) {
        Objects.applyDefaults(obj, propertyDefaults);
      }

      const requiredResult = Objects.validateRequired(path, obj, required);

      if (!requiredResult.valid) {
        if (!collectErrors) {
          return fail(workingValue);
        }
        errors.push(...requiredResult.errors);
        valid = false;
      }

      // jt:config extra: 'allow' keeps unknowns; 'forbid' defers stripping to post-check
      const effectiveStrip = jtExtra === 'allow' || jtExtra === 'forbid' ? false : stripUnknown;

      const propsResult = Objects.validateProperties(
        path,
        obj,
        propValidators,
        patternPropValidators,
        additionalIsFalse,
        additionalValidator,
        allowedKeys,
        effectiveStrip,
        propertyDefaults,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce
      );

      if (propsResult.earlyExit) {
        return fail(workingValue);
      }
      if (!propsResult.valid) {
        valid = false;
      }

      // jt:config extra: 'forbid' — error on unknown properties
      if (jtExtra === 'forbid' && allowedKeys !== undefined) {
        for (const key of Object.keys(obj)) {
          if (!allowedKeys.has(key)) {
            const childPath = path === '' ? `/${key}` : `${path}/${key}`;

            if (!collectErrors) {
              return fail(workingValue);
            }
            errors.push(BaseError.validationError(childPath, 'EXTRA_FORBIDDEN', `must NOT have additional property '${key}'`));
            valid = false;
          }
        }
      }

      const countResult = Objects.validatePropertyCount(path, obj, minProperties, maxProperties);

      if (!countResult.valid) {
        if (!collectErrors) {
          return fail(workingValue);
        }
        errors.push(...countResult.errors);
        valid = false;
      }
    }

    // --- Array validation ---
    if (Array.isArray(workingValue)) {
      const arr = workingValue;

      const boundsResult = Arrays.validateBounds(path, arr, minItems, maxItems, uniqueItems);

      if (!boundsResult.valid) {
        if (!collectErrors) {
          return fail(workingValue);
        }
        errors.push(...boundsResult.errors);
        valid = false;
      }

      const prefixResult = Arrays.validatePrefixItems(
        path,
        arr,
        prefixValidators,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        stripUnknown
      );

      if (prefixResult.earlyExit) {
        return fail(workingValue);
      }
      if (!prefixResult.valid) {
        valid = false;
      }

      const itemsResult = Arrays.validateItems(
        path,
        arr,
        itemValidator,
        prefixValidators,
        errors,
        collectErrors,
        applyDefaults,
        doCoerce,
        stripUnknown
      );

      if (itemsResult.earlyExit) {
        return fail(workingValue);
      }
      if (!itemsResult.valid) {
        valid = false;
      }

      const containsResult = Arrays.validateContains(path, arr, containsCheck, minContains, maxContains);

      if (!containsResult.valid) {
        if (!collectErrors) {
          return fail(workingValue);
        }
        errors.push(...containsResult.errors);
        valid = false;
      }
    }

    // --- Composition: allOf ---
    const allOfResult = Composition.validateAllOf(
      workingValue,
      path,
      allOfValidators,
      errors,
      collectErrors,
      applyDefaults,
      doCoerce,
      stripUnknown
    );

    if (allOfResult.earlyExit) {
      return fail(allOfResult.value);
    }
    if (!allOfResult.valid) {
      valid = false;
    }
    workingValue = allOfResult.value;

    // --- Composition: anyOf ---
    const anyOfResult = Composition.validateAnyOf(path, workingValue, anyOfChecks);

    if (!anyOfResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      if (anyOfResult.error !== undefined) {
        errors.push(anyOfResult.error);
      }
      valid = false;
    }

    // --- Composition: oneOf ---
    const oneOfResult = Composition.validateOneOf(path, workingValue, oneOfChecks);

    if (!oneOfResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      if (oneOfResult.error !== undefined) {
        errors.push(oneOfResult.error);
      }
      valid = false;
    }

    // --- Composition: not ---
    const notResult = Composition.validateNot(path, workingValue, complementCheck);

    if (!notResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      if (notResult.error !== undefined) {
        errors.push(notResult.error);
      }
      valid = false;
    }

    // --- Composition: if/then/else ---
    const ifResult = Composition.validateIfThenElse(
      workingValue,
      path,
      ifCheck,
      thenValidator,
      elseValidator,
      errors,
      collectErrors,
      applyDefaults,
      doCoerce,
      stripUnknown
    );

    if (ifResult.earlyExit) {
      return fail(ifResult.value);
    }
    if (!ifResult.valid) {
      valid = false;
    }
    workingValue = ifResult.value;

    // --- Object: dependentRequired ---
    const depReqResult = Objects.validateDependentRequired(
      path,
      workingValue,
      depRequiredEntries,
      errors,
      collectErrors
    );

    if (depReqResult.earlyExit) {
      return fail(workingValue);
    }
    if (!depReqResult.valid) {
      valid = false;
    }

    // --- Composition: dependentSchemas ---
    const depSchemaResult = Composition.validateDependentSchemas(
      workingValue,
      path,
      depSchemaValidators,
      errors,
      collectErrors,
      applyDefaults,
      doCoerce,
      stripUnknown
    );

    if (depSchemaResult.earlyExit) {
      return fail(depSchemaResult.value);
    }
    if (!depSchemaResult.valid) {
      valid = false;
    }
    workingValue = depSchemaResult.value;

    // --- Object: propertyNames ---
    const pnResult = Objects.validatePropertyNames(path, workingValue, propertyNamesValidator, errors, collectErrors);

    if (pnResult.earlyExit) {
      return fail(workingValue);
    }
    if (!pnResult.valid) {
      valid = false;
    }

    // --- Custom keywords ---
    const kwResult = Composition.validateCustomKeywords(path, workingValue, customKeywordEntries);

    if (!kwResult.valid) {
      if (!collectErrors) {
        return fail(workingValue);
      }
      errors.push(...kwResult.errors);
      valid = false;
    }

    return {
      valid,
      'value': workingValue
    };
  };
}
