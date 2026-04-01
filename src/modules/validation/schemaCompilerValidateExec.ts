import type { ValidationErrorType } from '../../types/Validation.js';
import type { KeywordContextInterface } from '../../interfaces/GraphEngine.js';
import {
  deepEqual, isRecord
} from '../data/dataTypes.js';
import {
  codePointLength, coerceCompiledValue, jsonSortedKeys, makeValidationError
} from './schemaCompilerSupport.js';
import type {
  CompiledNodeValidationPlanInterface
} from './schemaCompilerValidatePlan.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';

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
      workingValue = structuredClone(defaultValue);
    }

    if (doCoerce && types.length > 0) {
      workingValue = coerceCompiledValue(types, workingValue);
    }

    let valid = true;

    if (refValidator !== undefined) {
      const refResult = refValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

      if (!refResult.valid) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': refResult.value
          };
        }
        valid = false;
      }
      workingValue = refResult.value;
    }

    if (types.length > 0) {
      let typeValid = false;

      for (const typeName of types) {
        switch (typeName) {
          case 'array': if (Array.isArray(workingValue)) {
            typeValid = true;
          } break;
          case 'boolean': if (typeof workingValue === 'boolean') {
            typeValid = true;
          } break;
          case 'integer': if (typeof workingValue === 'number' && Number.isInteger(workingValue)) {
            typeValid = true;
          } break;
          case 'null': if (workingValue === null) {
            typeValid = true;
          } break;
          case 'number': if (typeof workingValue === 'number' && Number.isFinite(workingValue)) {
            typeValid = true;
          } break;
          case 'object': if (typeof workingValue === 'object' && workingValue !== null && !Array.isArray(workingValue)) {
            typeValid = true;
          } break;
          case 'string': if (typeof workingValue === 'string') {
            typeValid = true;
          } break;
        }
      }
      if (!typeValid) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'type', types.length === 1 ? `must be ${types[0]}` : `must be one of: ${types.join(', ')}`, { 'type': types }));
        valid = false;
      }
    }

    if (enumValues !== undefined) {
      const matched = enumSet === undefined
        ? enumValues.some((ev) => {
          return deepEqual(ev, workingValue);
        })
        : enumSet.has(workingValue as boolean | null | number | string);

      if (!matched) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'enum', 'must be one of the allowed values'));
        valid = false;
      }
    }

    if (hasConst && !deepEqual(constVal, workingValue)) {
      if (!collectErrors) {
        return {
          'valid': false,
          'value': workingValue
        };
      }
      errors.push(makeValidationError(path, 'const', `must be ${JSON.stringify(constVal)}`));
      valid = false;
    }

    if (typeof workingValue === 'string') {
      if (minLength !== undefined || maxLength !== undefined) {
        const cpLen = codePointLength(workingValue);

        if (minLength !== undefined && cpLen < minLength) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'minLength', `must be at least ${minLength} characters`));
          valid = false;
        }
        if (maxLength !== undefined && cpLen > maxLength) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'maxLength', `must be at most ${maxLength} characters`));
          valid = false;
        }
      }
      if (patternRegex !== undefined && !patternRegex.test(workingValue)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'pattern', `must match pattern "${pattern}"`));
        valid = false;
      }
    }

    if (formatValidator !== undefined) {
      let formatPassed: boolean;

      try {
        formatPassed = formatValidator(workingValue);
      } catch {
        formatPassed = false;
      }
      if (!formatPassed) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'format', `must match format "${format}"`));
        valid = false;
      }
    }

    if (typeof workingValue === 'number') {
      if (minimum !== undefined && workingValue < minimum) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'minimum', `must be >= ${minimum}`));
        valid = false;
      }
      if (maximum !== undefined && workingValue > maximum) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'maximum', `must be <= ${maximum}`));
        valid = false;
      }
      if (exclusiveMinimum !== undefined && workingValue <= exclusiveMinimum) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`));
        valid = false;
      }
      if (exclusiveMaximum !== undefined && workingValue >= exclusiveMaximum) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`));
        valid = false;
      }
      if (
        multipleOf !== undefined
        && (multipleOf === 0
          || Math.abs(workingValue / multipleOf - Math.round(workingValue / multipleOf)) > Number.EPSILON * 10)
      ) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'multipleOf', `must be a multiple of ${multipleOf}`));
        valid = false;
      }
    }

    if (isRecord(workingValue)) {
      const obj = workingValue;

      if (applyDefaults) {
        for (const [
          key,
          propDefault
        ] of propertyDefaults) {
          if (!(key in obj) && propDefault.hasDefault) {
            obj[key] = structuredClone(propDefault.defaultValue);
          }
        }
      }

      if (required !== undefined) {
        for (const key of required) {
          if (!(key in obj)) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            errors.push(makeValidationError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
            valid = false;
          }
        }
      }

      for (const key of Object.keys(obj)) {
        const propValidator = propValidators.get(key);
        const childPath = path === '' ? `/${key}` : `${path}/${key}`;

        if (propValidator === undefined) {
          let matchedPattern = false;

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
                      'valid': false,
                      'value': workingValue
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
                  'valid': false,
                  'value': workingValue
                };
              }
              errors.push(makeValidationError(childPath, 'additionalProperties', `must NOT have additional property '${key}'`));
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
                    'valid': false,
                    'value': workingValue
                  };
                }
                valid = false;
              }
              if (addResult.value !== obj[key]) {
                obj[key] = addResult.value;
              }
            }
          }
        } else {
          let propValue = obj[key];

          if (applyDefaults && propValue === undefined) {
            const propDefault = propertyDefaults.get(key);

            if (propDefault?.hasDefault === true) {
              propValue = structuredClone(propDefault.defaultValue);
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
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
          if (propResult.value !== propValue) {
            obj[key] = propResult.value;
          }
        }
      }

      if (minProperties !== undefined || maxProperties !== undefined) {
        const count = Object.keys(obj).length;

        if (minProperties !== undefined && count < minProperties) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'minProperties', `must have at least ${minProperties} properties`));
          valid = false;
        }
        if (maxProperties !== undefined && count > maxProperties) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'maxProperties', `must have at most ${maxProperties} properties`));
          valid = false;
        }
      }
    }

    if (Array.isArray(workingValue)) {
      const arr = workingValue;

      if (minItems !== undefined && arr.length < minItems) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'minItems', `must have at least ${minItems} items`));
        valid = false;
      }
      if (maxItems !== undefined && arr.length > maxItems) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'maxItems', `must have at most ${maxItems} items`));
        valid = false;
      }
      if (uniqueItems) {
        const seen = new Set<unknown>();
        let hasDup = false;

        for (const item of arr) {
          const key: string | unknown = typeof item === 'object' && item !== null
            ? jsonSortedKeys(item)
            : item;

          if (seen.has(key)) {
            hasDup = true;
            break;
          }
          seen.add(key);
        }
        if (hasDup) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'uniqueItems', 'must have unique items'));
          valid = false;
        }
      }

      if (prefixValidators !== undefined) {
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
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
          if (prefixResult.value !== arr[i]) {
            arr[i] = prefixResult.value;
          }
        }
      }

      if (itemValidator !== undefined) {
        const startIndex = prefixValidators === undefined ? 0 : prefixValidators.length;

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
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
          if (itemResult.value !== arr[i]) {
            arr[i] = itemResult.value;
          }
        }
      }

      if (containsCheck !== undefined) {
        let count = 0;

        for (const item of arr) {
          if (containsCheck(item)) {
            count++;
          }
        }
        if (minContains !== undefined && count < minContains) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'contains', `must contain at least ${minContains} matching items`));
          valid = false;
        } else if (maxContains !== undefined && count > maxContains) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'contains', `must contain at most ${maxContains} matching items`));
          valid = false;
        } else if (minContains === undefined && maxContains === undefined && count === 0) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, 'contains', 'must contain at least one matching item'));
          valid = false;
        }
      }
    }

    if (allOfValidators !== undefined) {
      for (const allOfValidator of allOfValidators) {
        const allOfResult = allOfValidator(
          workingValue,
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
              'valid': false,
              'value': allOfResult.value
            };
          }
          valid = false;
        }
        workingValue = allOfResult.value;
      }
    }

    if (anyOfChecks !== undefined) {
      const matched = anyOfChecks.some((check) => {
        return check(workingValue);
      });

      if (!matched) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        errors.push(makeValidationError(path, 'anyOf', 'must match at least one schema in anyOf'));
        valid = false;
      }
    }

    if (oneOfChecks !== undefined) {
      let count = 0;

      for (const check of oneOfChecks) {
        if (check(workingValue)) {
          count++;
          if (count > 1) {
            break;
          }
        }
      }

      if (count !== 1) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        const msg = count === 0
          ? 'must match exactly one schema in oneOf (matched none)'
          : 'must match exactly one schema in oneOf (matched multiple)';

        errors.push(makeValidationError(path, 'oneOf', msg, { 'matchCount': count }));
        valid = false;
      }
    }

    if (complementCheck?.(workingValue) === true) {
      if (!collectErrors) {
        return {
          'valid': false,
          'value': workingValue
        };
      }
      errors.push(makeValidationError(path, 'not', 'must not match schema'));
      valid = false;
    }

    if (ifCheck !== undefined) {
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
                'valid': false,
                'value': thenResult.value
              };
            }
            valid = false;
          }
          workingValue = thenResult.value;
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
              'valid': false,
              'value': elseResult.value
            };
          }
          valid = false;
        }
        workingValue = elseResult.value;
      }
    }

    if (depRequiredEntries.length > 0 && isRecord(workingValue)) {
      const obj = workingValue;

      for (const [
        trigger,
        deps
      ] of depRequiredEntries) {
        if (trigger in obj) {
          for (const dep of deps) {
            if (!(dep in obj)) {
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': workingValue
                };
              }
              errors.push(makeValidationError(path, 'dependentRequired', `property '${trigger}' requires property '${dep}'`, {
                'missingProperty': dep,
                'property': trigger
              }));
              valid = false;
            }
          }
        }
      }
    }

    if (depSchemaValidators !== undefined && isRecord(workingValue)) {
      const obj = workingValue;

      for (const dep of depSchemaValidators) {
        if (dep.trigger in obj) {
          const depResult = dep.validator(
            workingValue,
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
                'valid': false,
                'value': depResult.value
              };
            }
            valid = false;
          }
          workingValue = depResult.value;
        }
      }
    }

    if (propertyNamesValidator !== undefined && isRecord(workingValue)) {
      for (const key of Object.keys(workingValue)) {
        const pnResult = propertyNamesValidator(key, path === '' ? `/${key}` : `${path}/${key}`, errors, collectErrors, false, false, false);

        if (!pnResult.valid) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }
    }

    if (customKeywordEntries !== undefined) {
      let dataType: string;

      if (workingValue === null) {
        dataType = 'null';
      } else if (Array.isArray(workingValue)) {
        dataType = 'array';
      } else {
        dataType = typeof workingValue;
      }

      for (const entry of customKeywordEntries) {
        if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
          continue;
        }

        const ctx: KeywordContextInterface = {
          'parentData': undefined,
          'parentKey': '',
          path,
          'rootData': workingValue
        };
        const kwResult = entry.validate(entry.schemaValue, workingValue, ctx);

        if (kwResult === false) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(makeValidationError(path, entry.keyword, `must pass "${entry.keyword}" validation`));
          valid = false;
        } else if (Array.isArray(kwResult) && kwResult.length > 0) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          errors.push(...kwResult);
          valid = false;
        }
      }
    }

    return {
      valid,
      'value': workingValue
    };
  };
}
