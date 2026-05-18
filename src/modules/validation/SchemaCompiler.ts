/**
 * Schema Compiler — Phases 6.2-6.5
 *
 * Compiles JSON Schema into optimized closure validators. Each schema node
 * becomes a captured closure with all constants pre-resolved. Falls back to
 * GraphEngine for unsupported constructs.
 *
 * All field reads come from graph semantics — never from schema[key].
 */

import type { ValidationErrorType } from '../../types/Validation.js';
import type {
  CompiledValidateOptionsInterface, CompiledValidationResultInterface, CompiledValidatorInterface
} from '../../interfaces/Compiler.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerImpl.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { KeywordDefinitionInterface } from '../../interfaces/GraphEngine.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { BaseError } from '../../errors/BaseError.js';
import { Predicates } from './Predicates.js';
import { SchemaCompilerDefaults } from './SchemaCompilerDefaults.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';
import {
  DEFAULT_DIALECT_URI, VOCABULARY_FORMAT_ASSERTION
} from '../../constants/DIALECT.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import type { CompiledNodeValidationPlanInterface } from '../../interfaces/CompiledNodeValidationPlan.js';
import { Arrays } from './exec/Arrays.js';
import { Composition } from './exec/Composition.js';
import { Objects } from './exec/Objects.js';
import { Scalars } from './exec/Scalars.js';
import {
  buildNodePlan,
  compileArrayCheck,
  compileConstCheck,
  compileEnumCheck,
  compileObjectCheck,
  compileRefCheck,
  nodeSupportsCompilation,
  tryCompileFlatObjectCheck
} from './SchemaCompilerPlan.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

import type { CheckFnType } from '../../types/Validation.js';
import type { SchemaCompilerCheckExecutionContextInterface } from '../../interfaces/SchemaCompilerCheckExecutionContext.js';
import type { SchemaCompilerGraphContextInterface } from '../../interfaces/SchemaCompilerGraphContext.js';
import type { SchemaCompilerValidatePlanContextInterface } from '../../interfaces/SchemaCompilerValidatePlanContext.js';

// ---------------------------------------------------------------------------
// SchemaCompiler
// ---------------------------------------------------------------------------

export class SchemaCompiler implements SchemaCompilerInterface {
  private activeCustomKeywords: KeywordDefinitionInterface[] = [];
  private activeLookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  private readonly checkExecContext: SchemaCompilerCheckExecutionContextInterface;
  private readonly compilingNodes = new Set<SchemaGraphNodeInterface>();
  private readonly graphContext: SchemaCompilerGraphContextInterface;
  private readonly logger: LoggerInterface;
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;
  private readonly regexCache = new Map<string, RegExp>();
  private readonly validatePlanContext: SchemaCompilerValidatePlanContextInterface;

  /**
   * Create a SchemaCompiler with an optional cross-schema lookup for compiled validators.
   *
   * @param options - Optional lookup function and logger for resolving already-compiled validators by schema ID
   */
  public constructor(options?: {
    'logger'?: LoggerInterface;
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorInterface | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
    this.logger = options?.logger ?? SILENT_LOGGER;

    this.graphContext = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'compileNodeCheck': (node, fmt, graph, lookup) => {
        return this.compileNodeCheck(node, fmt, graph, lookup);
      },
      'compileNodeOrBooleanCheck': (node, fmt, graph, lookup) => {
        return this.compileNodeOrBooleanCheck(node, fmt, graph, lookup);
      },
      'compilingNodes': this.compilingNodes,
      'lookupCompiled': this.lookupCompiled
    };

    Object.defineProperty(this.graphContext, 'activeCustomKeywords', {
      'enumerable': true,
      'get': () => {
        return this.activeCustomKeywords;
      }
    });

    this.checkExecContext = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'compileNodeArrayCheck': (node, fmtReg, graph, lookup) => {
        return compileArrayCheck(this.graphContext, node, fmtReg, graph, lookup);
      },
      'compileNodeCheck': (node, fmtReg, graph, lookup) => {
        return this.compileNodeCheck(node, fmtReg, graph, lookup);
      },
      'compileNodeObjectCheck': (node, fmtReg, graph, lookup) => {
        return compileObjectCheck(this.graphContext, node, fmtReg, graph, lookup);
      },
      'compileNodeOrBooleanCheck': (node, fmtReg, graph, lookup) => {
        return this.compileNodeOrBooleanCheck(node, fmtReg, graph, lookup);
      },
      'compileNumberCheck': (min, max, exMin, exMax, mult) => {
        return this.compileNumberCheck(min, max, exMin, exMax, mult);
      },
      'compileRefCheck': (ref, fmtReg, graph, lookup) => {
        const lookupGraph = this.activeLookupGraph;

        return compileRefCheck(this.graphContext, ref, fmtReg, graph, lookup, lookupGraph);
      },
      'compileStringCheck': (minLen, maxLen, pat, fmt, fmtReg, sem) => {
        return this.compileStringCheck(minLen, maxLen, pat, fmt, fmtReg, sem);
      },
      'compileTypeCheck': (types) => {
        return this.compileTypeCheck(types);
      },
      'tryCompileNodeFlatObjectCheck': (node, fmtReg, graph, lookup) => {
        return tryCompileFlatObjectCheck(this.graphContext, node, fmtReg, graph, lookup);
      }
    };

    Object.defineProperty(this.checkExecContext, 'activeCustomKeywords', {
      'enumerable': true,
      'get': () => {
        return this.activeCustomKeywords;
      }
    });

    this.validatePlanContext = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'appliesFormatAssertions': (semantics) => {
        return this.appliesFormatAssertions(semantics);
      },
      'compileNodeCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
        return this.compileNodeCheck(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'compileNodeOrBooleanCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
        return this.compileNodeOrBooleanCheck(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'compileNodeOrBooleanValidateWithErrors': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
        return this.compileNodeOrBooleanValidateWithErrors(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'compileNodeValidateWithErrors': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
        return this.compileNodeValidateWithErrors(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'resolveImplicitDefault': (node, graph, lookup, visited) => {
        const lookupGraph = this.activeLookupGraph;

        return SchemaCompilerDefaults.resolveImplicitDefaultValue(node, graph, lookup, visited, lookupGraph);
      }
    };

    Object.defineProperty(this.validatePlanContext, 'activeCustomKeywords', {
      'enumerable': true,
      'get': () => {
        return this.activeCustomKeywords;
      }
    });
  }

  private appliesFormatAssertions(sem: SchemaGraphSemanticsInterface): boolean {
    const rootVocabulary = sem.schemaVocabulary;

    if (isRecord(rootVocabulary)) {
      return rootVocabulary[VOCABULARY_FORMAT_ASSERTION] === true;
    }

    const schemaUri = sem.schemaDialect;

    // 2020-12 without explicit format-assertion vocabulary → annotation only
    if (schemaUri === DEFAULT_DIALECT_URI) {
      return false;
    }

    // No $schema or other dialect → default to enabled
    return true;
  }

  private buildNodeCheckExecution(
    context: SchemaCompilerCheckExecutionContextInterface,
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    const fastPath = context.tryCompileNodeFlatObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

    if (fastPath !== undefined) {
      return fastPath;
    }

    const checks: CheckFnType[] = [];
    const sem = graph.semantics(graphNode);
    const types = sem.schemaTypes;

    if (types.length > 0) {
      checks.push(context.compileTypeCheck(types));
    }

    if (sem.hasConst) {
      checks.push(compileConstCheck(sem.constValue));
    }

    if (sem.enumValues !== undefined) {
      checks.push(compileEnumCheck(sem.enumValues));
    }

    if (sem.minLength !== undefined || sem.maxLength !== undefined
    || sem.pattern !== undefined || sem.format !== undefined) {
      const stringCheck = context.compileStringCheck(
        sem.minLength,
        sem.maxLength,
        sem.pattern,
        sem.format,
        formatRegistry,
        sem
      );

      if (stringCheck !== undefined) {
        checks.push(stringCheck);
      }
    }

    if (sem.minimum !== undefined || sem.maximum !== undefined || sem.exclusiveMinimum !== undefined
    || sem.exclusiveMaximum !== undefined || sem.multipleOf !== undefined) {
      const numCheck = context.compileNumberCheck(
        sem.minimum,
        sem.maximum,
        sem.exclusiveMinimum,
        sem.exclusiveMaximum,
        sem.multipleOf
      );

      if (numCheck !== undefined) {
        checks.push(numCheck);
      }
    }

    if (typeof sem.ref === 'string') {
      const refCheck = context.compileRefCheck(sem.ref, formatRegistry, graph, lookupSchema);

      if (refCheck !== undefined) {
        checks.push(refCheck);
      }
    }

    if (sem.schemaTypes.includes('object') || sem.properties.size > 0 || sem.required.length > 0) {
      const objCheck = context.compileNodeObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

      if (objCheck !== undefined) {
        checks.push(objCheck);
      }
    }

    if (Object.keys(sem.dependentRequired).length > 0) {
      const depEntries = Object.entries(sem.dependentRequired);

      checks.push((value) => {
        if (!isRecord(value)) {
          return true;
        }
        const obj = value;

        for (const [
          trigger,
          required
        ] of depEntries) {
          if (trigger in obj) {
            for (const req of required) {
              if (!(req in obj)) {
                return false;
              }
            }
          }
        }

        return true;
      });
    }

    if (sem.dependentSchemaEntries.length > 0) {
      const depSchemaChecks: Array<{ 'check': CheckFnType;
        'trigger': string; }> = [];

      for (const [
        trigger,
        node
      ] of sem.dependentSchemaEntries) {
        let depCheck: CheckFnType;

        if (typeof node.schema === 'boolean') {
          depCheck = node.schema
            ? () => {
              return true;
            }
            : () => {
              return false;
            };
        } else {
          depCheck = context.compileNodeCheck(node, formatRegistry, graph, lookupSchema);
        }
        depSchemaChecks.push({
          'check': depCheck,
          'trigger': trigger
        });
      }

      if (depSchemaChecks.length > 0) {
        checks.push((value) => {
          if (!isRecord(value)) {
            return true;
          }
          const obj = value;

          for (const dep of depSchemaChecks) {
            if (dep.trigger in obj && !dep.check(value)) {
              return false;
            }
          }

          return true;
        });
      }
    }

    if (sem.propertyNamesNode !== undefined) {
      const pnCheck = context.compileNodeOrBooleanCheck(sem.propertyNamesNode, formatRegistry, graph, lookupSchema);

      checks.push((value) => {
        if (!isRecord(value)) {
          return true;
        }

        for (const key of Object.keys(value)) {
          if (!pnCheck(key)) {
            return false;
          }
        }

        return true;
      });
    }

    if (sem.schemaTypes.includes('array') || sem.itemsNode !== undefined || sem.prefixItems.length > 0) {
      const arrCheck = context.compileNodeArrayCheck(graphNode, formatRegistry, graph, lookupSchema);

      if (arrCheck !== undefined) {
        checks.push(arrCheck);
      }
    }

    if (sem.allOf.length > 0) {
      const allOfChecks = sem.allOf.map((node) => {
        return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push((value) => {
        return allOfChecks.every((check) => {
          return check(value);
        });
      });
    }

    if (sem.anyOf.length > 0) {
      const anyOfChecks = sem.anyOf.map((node) => {
        return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push((value) => {
        return anyOfChecks.some((check) => {
          return check(value);
        });
      });
    }

    if (sem.oneOf.length > 0) {
      const oneOfChecks = sem.oneOf.map((node) => {
        return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push((value) => {
        let count = 0;

        for (const check of oneOfChecks) {
          if (check(value)) {
            count++;
            if (count > 1) {
              return false;
            }
          }
        }

        return count === 1;
      });
    }

    if (sem.complementNode !== undefined) {
      const { complementNode } = sem;
      const complementCheck = context.compileNodeOrBooleanCheck(complementNode, formatRegistry, graph, lookupSchema);

      checks.push((value) => {
        return !complementCheck(value);
      });
    }

    if (sem.ifNode !== undefined) {
      const ifCheck = context.compileNodeOrBooleanCheck(sem.ifNode, formatRegistry, graph, lookupSchema);
      const thenCheck = sem.thenNode === undefined
        ? undefined
        : context.compileNodeOrBooleanCheck(sem.thenNode, formatRegistry, graph, lookupSchema);
      const elseCheck = sem.elseNode === undefined
        ? undefined
        : context.compileNodeOrBooleanCheck(sem.elseNode, formatRegistry, graph, lookupSchema);

      checks.push((value) => {
        if (ifCheck(value)) {
          return thenCheck === undefined || thenCheck(value);
        }

        return elseCheck === undefined || elseCheck(value);
      });
    }

    if (context.activeCustomKeywords.length > 0) {
      const extensionEntries: Array<{ 'allowedTypes': string[] | undefined;
        'keyword': string;
        'schemaValue': unknown;
        'validate': KeywordDefinitionInterface['validate']; }> = [];

      for (const kw of context.activeCustomKeywords) {
        if (kw.keyword in sem.extensions) {
          extensionEntries.push({
            'allowedTypes': SchemaCompilerSupport.normalizeKeywordTypes(kw.type),
            'keyword': kw.keyword,
            'schemaValue': sem.extensions[kw.keyword],
            'validate': kw.validate
          });
        }
      }

      if (extensionEntries.length > 0) {
        checks.push((value) => {
          let dataType: string;

          if (value === null) {
            dataType = 'null';
          } else if (Array.isArray(value)) {
            dataType = 'array';
          } else {
            dataType = typeof value;
          }

          for (const entry of extensionEntries) {
            if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
              continue;
            }

            const ctx = {
              'parentData': undefined as unknown,
              'parentKey': '',
              'path': '',
              'rootData': value
            };
            const result = entry.validate(entry.schemaValue, value, ctx);

            if (result === false) {
              return false;
            }
            if (Array.isArray(result) && result.length > 0) {
              return false;
            }
          }

          return true;
        });
      }
    }

    if (checks.length === 0) {
      return () => {
        return true;
      };
    }
    if (checks.length === 1) {
      return checks[0];
    }

    return (value) => {
      for (const check of checks) {
        if (!check(value)) {
          return false;
        }
      }

      return true;
    };
  }

  private buildValidateWithErrorsExecution(plan: CompiledNodeValidationPlanInterface): ValidateWithErrorsFnType {
    const {
      additionalIsFalse,
      additionalValidator,
      allOfValidators,
      allowedKeys,
      allowedKeysForStrip,
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

    const hasComposition
      = (allOfValidators !== undefined && allOfValidators.length > 0)
      || (anyOfChecks !== undefined && anyOfChecks.length > 0)
      || (oneOfChecks !== undefined && oneOfChecks.length > 0)
      || complementCheck !== undefined
      || ifCheck !== undefined;

    if (!hasComposition) {
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
          workingValue = GraphEngineSupport.cloneDefault(defaultValue);
        }

        if (doCoerce && types.length > 0) {
          workingValue = SchemaCompilerSupport.coerceCompiledValue(types, workingValue);
        }

        let valid = true;

        // --- $ref ---
        if (refValidator !== undefined) {
          const refResult = refValidator(
            workingValue,
            path,
            errors,
            collectErrors,
            applyDefaults,
            doCoerce,
            stripUnknown
          );

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

        // --- Scalar: type, enum, const ---
        if (!Scalars.validateType(path, types, workingValue, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }

        if (!Scalars.validateEnum(path, workingValue, enumValues, enumSet, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }

        if (!Scalars.validateConst(path, workingValue, hasConst, constVal, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }

        // --- Scalar: string constraints ---
        if (typeof workingValue === 'string'
          && !Scalars.validateString(path, workingValue, minLength, maxLength, patternRegex, pattern, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }

        // --- Scalar: format ---
        if (!Scalars.validateFormat(path, workingValue, format, formatValidator, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }

        // --- Scalar: number constraints ---
        if (typeof workingValue === 'number'
          && !Scalars.validateNumber(
            path,
            workingValue,
            minimum,
            maximum,
            exclusiveMinimum,
            exclusiveMaximum,
            multipleOf,
            errors
          )) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
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

          if (!Objects.validateRequired(path, obj, required, errors)) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
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
            doCoerce,
            allowedKeysForStrip
          );

          if (propsResult.earlyExit) {
            return {
              'valid': false,
              'value': workingValue
            };
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
                  return {
                    'valid': false,
                    'value': workingValue
                  };
                }
                errors.push(BaseError.validationError(childPath, 'EXTRA_FORBIDDEN', `must NOT have additional property '${key}'`));
                valid = false;
              }
            }
          }

          if (!Objects.validatePropertyCount(path, obj, minProperties, maxProperties, errors, propsResult.count)) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }

        // --- Array validation ---
        if (Array.isArray(workingValue)) {
          const arr = workingValue;

          if (!Arrays.validateBounds(path, arr, minItems, maxItems, uniqueItems, errors)) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
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
            return {
              'valid': false,
              'value': workingValue
            };
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
            return {
              'valid': false,
              'value': workingValue
            };
          }
          if (!itemsResult.valid) {
            valid = false;
          }

          if (!Arrays.validateContains(path, arr, containsCheck, minContains, maxContains, errors)) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }

        // --- Object: dependentRequired ---
        const depReqResult = Objects.validateDependentRequired(
          path,
          workingValue,
          depRequiredEntries,
          errors,
          collectErrors
        );

        if (depReqResult.earlyExit) {
          return {
            'valid': false,
            'value': workingValue
          };
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
          return {
            'valid': false,
            'value': depSchemaResult.value
          };
        }
        if (!depSchemaResult.valid) {
          valid = false;
        }
        workingValue = depSchemaResult.value;

        // --- Object: propertyNames ---
        const pnResult = Objects.validatePropertyNames(
          path,
          workingValue,
          propertyNamesValidator,
          errors,
          collectErrors
        );

        if (pnResult.earlyExit) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        if (!pnResult.valid) {
          valid = false;
        }

        // --- Custom keywords ---
        if (!Composition.validateCustomKeywords(path, workingValue, customKeywordEntries, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }

        return {
          valid,
          'value': workingValue
        };
      };
    }

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
        workingValue = GraphEngineSupport.cloneDefault(defaultValue);
      }

      if (doCoerce && types.length > 0) {
        workingValue = SchemaCompilerSupport.coerceCompiledValue(types, workingValue);
      }

      let valid = true;

      // --- $ref ---
      if (refValidator !== undefined) {
        const refResult = refValidator(
          workingValue,
          path,
          errors,
          collectErrors,
          applyDefaults,
          doCoerce,
          stripUnknown
        );

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

      // --- Scalar: type, enum, const ---
      if (!Scalars.validateType(path, types, workingValue, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      if (!Scalars.validateEnum(path, workingValue, enumValues, enumSet, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      if (!Scalars.validateConst(path, workingValue, hasConst, constVal, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // --- Scalar: string constraints ---
      if (typeof workingValue === 'string'
        && !Scalars.validateString(path, workingValue, minLength, maxLength, patternRegex, pattern, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // --- Scalar: format ---
      if (!Scalars.validateFormat(path, workingValue, format, formatValidator, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // --- Scalar: number constraints ---
      if (typeof workingValue === 'number') {
        const numValid = Scalars.validateNumber(
          path,
          workingValue,
          minimum,
          maximum,
          exclusiveMinimum,
          exclusiveMaximum,
          multipleOf,
          errors
        );

        if (!numValid) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
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

        if (!Objects.validateRequired(path, obj, required, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
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
          doCoerce,
          allowedKeysForStrip
        );

        if (propsResult.earlyExit) {
          return {
            'valid': false,
            'value': workingValue
          };
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
                return {
                  'valid': false,
                  'value': workingValue
                };
              }
              errors.push(BaseError.validationError(childPath, 'EXTRA_FORBIDDEN', `must NOT have additional property '${key}'`));
              valid = false;
            }
          }
        }

        if (!Objects.validatePropertyCount(path, obj, minProperties, maxProperties, errors, propsResult.count)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // --- Array validation ---
      if (Array.isArray(workingValue)) {
        const arr = workingValue;

        if (!Arrays.validateBounds(path, arr, minItems, maxItems, uniqueItems, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
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
          return {
            'valid': false,
            'value': workingValue
          };
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
          return {
            'valid': false,
            'value': workingValue
          };
        }
        if (!itemsResult.valid) {
          valid = false;
        }

        if (!Arrays.validateContains(path, arr, containsCheck, minContains, maxContains, errors)) {
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
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
        doCoerce
      );

      if (allOfResult.earlyExit) {
        return {
          'valid': false,
          'value': allOfResult.value
        };
      }
      if (!allOfResult.valid) {
        valid = false;
      }
      workingValue = allOfResult.value;

      // --- Composition: anyOf ---
      if (!Composition.validateAnyOf(path, workingValue, anyOfChecks, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // --- Composition: oneOf ---
      if (!Composition.validateOneOf(path, workingValue, oneOfChecks, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // --- Composition: not ---
      if (!Composition.validateNot(path, workingValue, complementCheck, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
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
        return {
          'valid': false,
          'value': ifResult.value
        };
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
        return {
          'valid': false,
          'value': workingValue
        };
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
        return {
          'valid': false,
          'value': depSchemaResult.value
        };
      }
      if (!depSchemaResult.valid) {
        valid = false;
      }
      workingValue = depSchemaResult.value;

      // --- Object: propertyNames ---
      const pnResult = Objects.validatePropertyNames(path, workingValue, propertyNamesValidator, errors, collectErrors);

      if (pnResult.earlyExit) {
        return {
          'valid': false,
          'value': workingValue
        };
      }
      if (!pnResult.valid) {
        valid = false;
      }

      // --- Custom keywords ---
      if (!Composition.validateCustomKeywords(path, workingValue, customKeywordEntries, errors)) {
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      return {
        valid,
        'value': workingValue
      };
    };
  }

  /**
   * Compile a schema from a GraphEngine into an optimized closure validator.
   *
   * @param engine - Graph engine holding the schema to compile
   * @returns Compiled validator with check and validate functions
   */
  public compile(engine: GraphEngineInterface, graph?: SchemaGraphInterface): CompiledValidatorInterface {
    const rootSchema = engine.rootSchema;

    if (typeof rootSchema === 'boolean') {
      return this.compileBooleanSchema(rootSchema);
    }

    if (!isRecord(rootSchema)) {
      return this.compileBooleanSchema(false);
    }

    const schema = rootSchema;
    const formatRegistry = engine.formatRegistry;
    const lookupSchema = engine.schemaLookup();
    const resolvedGraph = graph ?? new SchemaGraph(schema);

    this.activeCustomKeywords = engine.keywords();
    this.activeLookupGraph = engine.graphLookup();

    // Check for unsupported features that require engine fallback
    if (!this.supportsCompilationPath(resolvedGraph, lookupSchema)) {
      this.activeCustomKeywords = [];

      return this.engineFallback(engine);
    }

    try {
      const checkFn = this.compileCheck(schema, formatRegistry, resolvedGraph, lookupSchema);
      const validateWithErrorsFn = this.compileValidateWithErrors(schema, formatRegistry, resolvedGraph, lookupSchema);
      const validateFn = this.compileValidateMutating(schema, resolvedGraph, validateWithErrorsFn, checkFn);

      return {
        'check': checkFn,
        'compiled': true,
        'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
          if (options?.applyDefaults === true || options?.castTypes === true
            || options?.enforceSchemaProperties === true || options?.removeAdditionalProperties === true) {
            return validateFn(data, options);
          }
          // Fast validate path — just check + collect errors
          if (options?.collectErrors === false) {
            return {
              'errors': [],
              'valid': checkFn(data),
              'value': data
            };
          }

          const errors: ValidationErrorType[] = [];
          const result = validateWithErrorsFn(data, '', errors, true, false, false, false);

          return {
            errors,
            'valid': result.valid,
            'value': result.value
          };
        }
      };
    } catch (error: unknown) {
      this.logger.warn(
        'SchemaCompiler',
        `compilation failed, falling back to interpreter: ${error instanceof Error ? error.message : String(error)}`
      );

      return this.engineFallback(engine);
    }
  }

  private compileBooleanSchema(schema: boolean): CompiledValidatorInterface {
    if (schema) {
      return {
        'check': () => {
          return true;
        },
        'compiled': true,
        'validate': (data) => {
          return {
            'errors': [],
            'valid': true,
            'value': data
          };
        }
      };
    }

    return {
      'check': () => {
        return false;
      },
      'compiled': true,
      'validate': (data) => {
        return {
          'errors': [BaseError.validationError('', 'falseSchema', 'must not match false schema')],
          'valid': false,
          'value': data
        };
      }
    };
  }

  /**
   * Entry point: compiles a schema object into a check function.
   * Thin wrapper that resolves the graph node, then delegates to compileNodeCheck.
   */
  private compileCheck(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    const graphNode = graph.node(schema);

    if (graphNode === undefined) {
      return () => {
        return true;
      };
    }

    return this.compileNodeCheck(graphNode, formatRegistry, graph, lookupSchema);
  }

  /**
   * Node-native check compilation. Accepts a SchemaGraphNodeInterface directly.
   */
  private compileNodeCheck(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    this.compilingNodes.add(graphNode);

    try {
      return this.buildNodeCheckExecution(
        this.checkExecContext,
        graphNode,
        formatRegistry,
        graph,
        lookupSchema
      );
    } finally {
      this.compilingNodes.delete(graphNode);
    }
  }

  private compileNodeOrBooleanCheck(
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? () => {
          return true;
        }
        : () => {
          return false;
        };
    }

    return this.compileNodeCheck(node, formatRegistry, graph, lookupSchema);
  }

  private compileNodeOrBooleanValidateWithErrors(
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? (value) => {
          return {
            'valid': true,
            'value': value
          };
        }
        : (value, path, errors, collect) => {
          if (collect) {
            errors.push(BaseError.validationError(path, 'falseSchema', 'must not match false schema'));
          }

          return {
            'valid': false,
            'value': value
          };
        };
    }

    return this.compileNodeValidateWithErrors(node, formatRegistry, graph, lookupSchema);
  }

  /**
   * Node-native validate-with-errors compilation. Accepts a SchemaGraphNodeInterface directly.
   */
  private compileNodeValidateWithErrors(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    const plan = buildNodePlan(
      this.validatePlanContext,
      graphNode,
      formatRegistry,
      graph,
      lookupSchema,
      this.activeLookupGraph
    );

    return this.buildValidateWithErrorsExecution(plan);
  }

  private compileNumberCheck(
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ): CheckFnType | undefined {
    const checks: Array<(num: number) => boolean> = [];

    if (minimum !== undefined) {
      checks.push((num) => {
        return Predicates.satisfiesMinimum(num, minimum);
      });
    }
    if (maximum !== undefined) {
      checks.push((num) => {
        return Predicates.satisfiesMaximum(num, maximum);
      });
    }
    if (exclusiveMinimum !== undefined) {
      checks.push((num) => {
        return Predicates.satisfiesExclusiveMinimum(num, exclusiveMinimum);
      });
    }
    if (exclusiveMaximum !== undefined) {
      checks.push((num) => {
        return Predicates.satisfiesExclusiveMaximum(num, exclusiveMaximum);
      });
    }
    if (multipleOf !== undefined) {
      checks.push((num) => {
        return Predicates.satisfiesMultipleOf(num, multipleOf);
      });
    }

    if (checks.length === 0) {
      return undefined;
    }

    return (value) => {
      if (typeof value !== 'number') {
        return true;
      }

      for (const check of checks) {
        if (!check(value)) {
          return false;
        }
      }

      return true;
    };
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private compileStringCheck(
    minLength: number | undefined,
    maxLength: number | undefined,
    pattern: string | undefined,
    format: string | undefined,
    formatRegistry: FormatRegistryInterface,
    sem: SchemaGraphSemanticsInterface
  ): CheckFnType | undefined {
    const checks: Array<(str: string) => boolean> = [];

    if (minLength !== undefined) {
      checks.push((str) => {
        return Predicates.satisfiesMinLength(str, minLength);
      });
    }
    if (maxLength !== undefined) {
      checks.push((str) => {
        return Predicates.satisfiesMaxLength(str, maxLength);
      });
    }
    if (pattern !== undefined) {
      const regex = this.regexFor(pattern);

      checks.push((str) => {
        return Predicates.satisfiesPattern(str, regex);
      });
    }
    // Format check is separate — it may apply to non-string types (e.g. int32, float)
    let formatCheck: CheckFnType | undefined;

    if (format !== undefined) {
      const hasFormatAssertion = this.appliesFormatAssertions(sem);

      if (hasFormatAssertion) {
        const formatValidator = formatRegistry.get(format);

        if (formatValidator !== undefined) {
          formatCheck = formatValidator;
        }
      }
    }

    if (checks.length === 0 && formatCheck === undefined) {
      return undefined;
    }

    // If only format check and no string checks, return format check directly
    // (it handles its own type checking)
    if (checks.length === 0 && formatCheck !== undefined) {
      return formatCheck;
    }

    return (value) => {
      if (typeof value === 'string') {
        for (const check of checks) {
          if (!check(value)) {
            return false;
          }
        }
      }

      if (formatCheck !== undefined && !formatCheck(value)) {
        return false;
      }

      return true;
    };
  }

  private compileTypeCheck(types: string[]): CheckFnType {
    if (types.length === 1) {
      const singleType = types[0];

      return (value) => {
        return Predicates.matchesType(singleType, value);
      };
    }

    return (value) => {
      return Predicates.matchesAnyType(types, value);
    };
  }

  private compileValidateMutating(
    schema: Record<string, unknown>,
    graph: SchemaGraphInterface,
    validateWithErrors: ValidateWithErrorsFnType,
    checkFn: CheckFnType
  ): (data: unknown, options?: CompiledValidateOptionsInterface) => CompiledValidationResultInterface {
    // Get types from graph semantics for root coercion
    const graphNode = graph.node(schema);
    const rootSem = graphNode === undefined ? undefined : graph.semantics(graphNode);
    const rootTypes = rootSem === undefined ? [] : rootSem.schemaTypes;
    const rootHasDefault = rootSem === undefined ? false : rootSem.hasDefault;
    const rootDefaultValue = rootSem === undefined ? undefined : rootSem.defaultValue;

    return (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
      let workingValue = data;

      // Apply coercion at root level
      if (options?.castTypes === true && rootTypes.length > 0) {
        workingValue = SchemaCompilerSupport.coerceCompiledValue(rootTypes, workingValue);
      }

      // Apply defaults at root level
      if (options?.applyDefaults === true && workingValue === undefined && rootHasDefault) {
        workingValue = GraphEngineSupport.cloneDefault(rootDefaultValue);
      }

      // For full mutation modes, delegate to validateWithErrors
      if (options?.applyDefaults === true || options?.castTypes === true
        || options?.enforceSchemaProperties === true || options?.removeAdditionalProperties === true) {
        const errors: ValidationErrorType[] = [];
        const stripUnk = (options.enforceSchemaProperties ?? false) || (options.removeAdditionalProperties ?? false);
        const result = validateWithErrors(workingValue, '', errors, options.collectErrors ?? true, options.applyDefaults ?? false, options.castTypes ?? false, stripUnk);

        return {
          errors,
          'valid': result.valid,
          'value': result.value
        };
      }

      // Fast path — no mutations
      if (options?.collectErrors === false) {
        return {
          'errors': [],
          'valid': checkFn(workingValue),
          'value': workingValue
        };
      }

      const errors: ValidationErrorType[] = [];
      const result = validateWithErrors(workingValue, '', errors, true, false, false, false);

      return {
        errors,
        'valid': result.valid,
        'value': result.value
      };
    };
  }


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Entry point: compiles a schema object into a validate-with-errors function.
   * Thin wrapper that resolves the graph node, then delegates to compileNodeValidateWithErrors.
   */
  private compileValidateWithErrors(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    const graphNode = graph.node(schema);

    if (graphNode === undefined) {
      return (value) => {
        return {
          'valid': true,
          'value': value
        };
      };
    }

    return this.compileNodeValidateWithErrors(graphNode, formatRegistry, graph, lookupSchema);
  }

  private engineFallback(engine: GraphEngineInterface): CompiledValidatorInterface {
    return {
      'check': (data: unknown): boolean => {
        return engine.execute(data, { 'overrides': { 'collectErrors': false } }).valid;
      },
      'compiled': false,
      'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
        const result = engine.execute(data, {
          'overrides': {
            'applyDefaults': options?.applyDefaults ?? false,
            'castTypes': options?.castTypes ?? false,
            'collectErrors': options?.collectErrors ?? true,
            'enforceSchemaProperties': options?.enforceSchemaProperties ?? false,
            'removeAdditionalProperties': options?.removeAdditionalProperties ?? false
          }
        });

        return {
          'errors': result.errors,
          'valid': result.valid,
          'value': result.value
        };
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Check execution (inlined from SchemaCompilerCheckExec)
  // ---------------------------------------------------------------------------

  private regexFor(pattern: string): RegExp {
    let cached = this.regexCache.get(pattern);

    if (cached === undefined) {
      cached = new RegExp(pattern, 'u');
      this.regexCache.set(pattern, cached);
    }

    return cached;
  }

  // ---------------------------------------------------------------------------
  // Validate execution (inlined from SchemaCompilerValidateExec)
  // ---------------------------------------------------------------------------

  private supportsCompilationPath(
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): boolean {
    return nodeSupportsCompilation(
      graph.rootNode,
      graph,
      lookupSchema,
      new Set(),
      this.activeLookupGraph
    );
  }
}
