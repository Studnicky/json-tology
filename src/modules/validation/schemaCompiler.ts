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
import { SchemaGraph } from '../graph/schemaGraph.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
// isRecord and deepEqual are used by executor modules, imported from DataTypes directly there
import {
  codePointLength, coerceCompiledValue, makeValidationError
} from './schemaCompilerSupport.js';
import { resolveImplicitDefaultValue } from './schemaCompilerDefaults.js';
import { buildNodeCheckExecution } from './schemaCompilerCheckExec.js';
import { buildValidateWithErrorsExecution } from './schemaCompilerValidateExec.js';
import {
  buildNodeValidationPlan
} from './schemaCompilerValidatePlan.js';
import type { ValidateWithErrorsFnType } from '../../types/Validation.js';
import {
  compileArrayCheck, compileObjectCheck, compileRefCheck,
  nodeSupportsCompilation, tryCompileFlatObjectCheck
} from './schemaCompilerGraph.js';
import {
  DEFAULT_DIALECT_URI, VOCABULARY_FORMAT_ASSERTION
} from '../../constants/DIALECT.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

import type { CheckFnType } from '../../types/Validation.js';

// ---------------------------------------------------------------------------
// SchemaCompiler
// ---------------------------------------------------------------------------

export class SchemaCompiler implements SchemaCompilerInterface {
  private activeCustomKeywords: KeywordDefinitionInterface[] = [];
  private readonly compilingNodes = new Set<SchemaGraphNodeInterface>();
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;

  /**
   * Create a SchemaCompiler with an optional cross-schema lookup for compiled validators.
   *
   * @param options - Optional lookup function for resolving already-compiled validators by schema ID
   */
  public constructor(options?: {
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorInterface | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
  }

  private appliesFormatAssertions(sem: SchemaGraphSemanticsInterface): boolean {
    const rootVocabulary = sem.schemaVocabulary;

    if (rootVocabulary !== undefined && rootVocabulary !== null && typeof rootVocabulary === 'object') {
      return (rootVocabulary as Record<string, unknown>)[VOCABULARY_FORMAT_ASSERTION] === true;
    }

    const schemaUri = sem.schemaDialect;

    // 2020-12 without explicit format-assertion vocabulary → annotation only
    if (schemaUri === DEFAULT_DIALECT_URI) {
      return false;
    }

    // No $schema or other dialect → default to enabled
    return true;
  }

  /**
   * Compile a schema from a GraphEngine into an optimized closure validator.
   *
   * @param engine - Graph engine holding the schema to compile
   * @returns Compiled validator with check and validate functions
   */
  public compile(engine: GraphEngineInterface): CompiledValidatorInterface {
    const rootSchema = engine.rootSchema;

    if (typeof rootSchema === 'boolean') {
      return this.compileBooleanSchema(rootSchema);
    }

    const schema = rootSchema as Record<string, unknown>;
    const formatRegistry = engine.formatRegistry;
    const lookupSchema = engine.schemaLookup();
    const graph = new SchemaGraph(schema);

    this.activeCustomKeywords = engine.keywords();

    // Check for unsupported features that require engine fallback
    if (!this.supportsCompilationPath(graph, lookupSchema)) {
      this.activeCustomKeywords = [];

      return this.engineFallback(engine);
    }

    try {
      const checkFn = this.compileCheck(schema, formatRegistry, graph, lookupSchema);
      const validateWithErrorsFn = this.compileValidateWithErrors(schema, formatRegistry, graph, lookupSchema);
      const validateFn = this.compileValidateMutating(schema, graph, validateWithErrorsFn, checkFn);

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
    } catch {
      // Fallback to engine if compilation fails
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
          'errors': [makeValidationError('', 'falseSchema', 'must not match false schema')],
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
      return buildNodeCheckExecution(
        {
          'activeCustomKeywords': this.activeCustomKeywords,
          'compileNodeArrayCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
            return compileArrayCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compileNodeOrBooleanCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeOrBooleanCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              targetNode,
              fmtReg,
              schemaGraph,
              schemaLookup
            );
          },
          'compileNodeCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
            return this.compileNodeCheck(targetNode, fmtReg, schemaGraph, schemaLookup);
          },
          'compileNodeObjectCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
            return compileObjectCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compileNodeOrBooleanCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeOrBooleanCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              targetNode,
              fmtReg,
              schemaGraph,
              schemaLookup
            );
          },
          'compileNodeOrBooleanCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
            return this.compileNodeOrBooleanCheck(targetNode, fmtReg, schemaGraph, schemaLookup);
          },
          'compileNumberCheck': (min, max, exMin, exMax, mult) => {
            return this.compileNumberCheck(min, max, exMin, exMax, mult);
          },
          'compileRefCheck': (ref, fmtReg, schemaGraph, schemaLookup) => {
            return compileRefCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compileNodeOrBooleanCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeOrBooleanCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              ref,
              fmtReg,
              schemaGraph,
              schemaLookup
            );
          },
          'compileStringCheck': (minLen, maxLen, pat, fmt, fmtReg, sem) => {
            return this.compileStringCheck(minLen, maxLen, pat, fmt, fmtReg, sem);
          },
          'compileTypeCheck': (types) => {
            return this.compileTypeCheck(types);
          },
          'tryCompileNodeFlatObjectCheck': (targetNode, fmtReg, schemaGraph, schemaLookup) => {
            return tryCompileFlatObjectCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compileNodeOrBooleanCheck': (innerNode, innerFmt, innerGraph, innerLookup) => {
                  return this.compileNodeOrBooleanCheck(innerNode, innerFmt, innerGraph, innerLookup);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              targetNode,
              fmtReg,
              schemaGraph,
              schemaLookup
            );
          }
        },
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
            errors.push(makeValidationError(path, 'falseSchema', 'must not match false schema'));
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
    const plan = buildNodeValidationPlan(
      {
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
        'resolveImplicitDefault': (targetNode, schemaGraph, schemaLookup, visited) => {
          return resolveImplicitDefaultValue(targetNode, schemaGraph, schemaLookup, visited);
        }
      },
      graphNode,
      formatRegistry,
      graph,
      lookupSchema
    );

    return buildValidateWithErrorsExecution(plan);
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
        return num >= minimum;
      });
    }
    if (maximum !== undefined) {
      checks.push((num) => {
        return num <= maximum;
      });
    }
    if (exclusiveMinimum !== undefined) {
      checks.push((num) => {
        return num > exclusiveMinimum;
      });
    }
    if (exclusiveMaximum !== undefined) {
      checks.push((num) => {
        return num < exclusiveMaximum;
      });
    }
    if (multipleOf !== undefined) {
      checks.push((num) => {
        return num % multipleOf === 0;
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
        return codePointLength(str) >= minLength;
      });
    }
    if (maxLength !== undefined) {
      checks.push((str) => {
        return codePointLength(str) <= maxLength;
      });
    }
    if (pattern !== undefined) {
      const regex = new RegExp(pattern, 'u');

      checks.push((str) => {
        return regex.test(str);
      });
    }
    // Format check is separate — it may apply to non-string types (e.g. int32, float)
    let formatCheck: CheckFnType | undefined;

    if (format !== undefined) {
      const hasFormatAssertion = this.appliesFormatAssertions(sem);

      if (hasFormatAssertion) {
        const formatValidator = formatRegistry.get(format);

        if (formatValidator !== undefined) {
          formatCheck = (value) => {
            return formatValidator(value);
          };
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

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private compileTypeCheck(types: string[]): CheckFnType {
    if (types.length === 1) {
      switch (types[0]) {
        case 'array': return (value) => {
          return Array.isArray(value);
        };
        case 'boolean': return (value) => {
          return typeof value === 'boolean';
        };
        case 'integer': return (value) => {
          return typeof value === 'number' && Number.isInteger(value);
        };
        case 'null': return (value) => {
          return value === null;
        };
        case 'number': return (value) => {
          return typeof value === 'number';
        };
        case 'object': return (value) => {
          return typeof value === 'object' && value !== null && !Array.isArray(value);
        };
        case 'string': return (value) => {
          return typeof value === 'string';
        };
      }
    }

    const typeSet = new Set(types);
    const hasNull = typeSet.has('null');
    const hasInteger = typeSet.has('integer');

    return (value) => {
      if (value === null) {
        return hasNull;
      }
      if (Array.isArray(value)) {
        return typeSet.has('array');
      }
      const jsType = typeof value;

      if (jsType === 'number') {
        return typeSet.has('number') || (hasInteger && Number.isInteger(value));
      }

      return typeSet.has(jsType);
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
        workingValue = coerceCompiledValue(rootTypes, workingValue);
      }

      // Apply defaults at root level
      if (options?.applyDefaults === true && workingValue === undefined && rootHasDefault) {
        workingValue = structuredClone(rootDefaultValue);
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


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private engineFallback(engine: GraphEngineInterface): CompiledValidatorInterface {
    return {
      'check': (data: unknown): boolean => {
        return engine.execute(data, '', { 'collectErrors': false }).valid;
      },
      'compiled': false,
      'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
        const result = engine.execute(data, '', {
          'applyDefaults': options?.applyDefaults ?? false,
          'castTypes': options?.castTypes ?? false,
          'collectErrors': options?.collectErrors ?? true,
          'enforceSchemaProperties': options?.enforceSchemaProperties ?? false,
          'removeAdditionalProperties': options?.removeAdditionalProperties ?? false
        });

        return {
          'errors': result.errors,
          'valid': result.valid,
          'value': result.value
        };
      }
    };
  }

  private supportsCompilationPath(
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): boolean {
    return nodeSupportsCompilation(graph.rootNode, graph, lookupSchema, new Set());
  }
}
