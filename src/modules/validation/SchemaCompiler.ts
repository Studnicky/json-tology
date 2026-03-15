/**
 * Schema Compiler — Phases 6.2-6.5
 *
 * Compiles JSON Schema into optimized closure validators. Each schema node
 * becomes a captured closure with all constants pre-resolved. Falls back to
 * GraphEngine for unsupported constructs.
 *
 * All field reads come from graph semantics — never from schema[key].
 */

import type { ValidationErrorType } from '../../types/validation.js';
import type {
  CompiledValidateOptionsInterface, CompiledValidationResultInterface, CompiledValidatorInterface
} from '../../interfaces/compiler.js';
import type { SchemaCompilerInterface } from '../../interfaces/schema-compiler-impl.js';
import type { FormatRegistryInterface } from '../../interfaces/format-registry.js';
import type { GraphEngineInterface } from '../../interfaces/graph-engine-impl.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import type { KeywordDefinitionInterface } from '../../interfaces/graph-engine.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';
// isRecord and deepEqual are used by executor modules, imported from DataTypes directly there
import {
  coerceCompiledValue, makeValidationError
} from './SchemaCompiler.support.js';
import { resolveImplicitDefaultValue } from './SchemaCompiler.defaults.js';
import { buildNodeCheckExecution } from './SchemaCompiler.check-exec.js';
import { buildValidateWithErrorsExecution } from './SchemaCompiler.validate-exec.js';
import {
  buildNodeValidationPlan
} from './SchemaCompiler.validate-plan.js';
import type { ValidateWithErrorsFnType } from './SchemaCompiler.validate-plan.js';
import {
  compileRefCheck, nodeHasUnsupportedFeatures, tryCompileFlatObjectCheck,
  compileArrayCheck, compileObjectCheck
} from './SchemaCompiler.graph.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type CheckFnType = (value: unknown) => boolean;

// ---------------------------------------------------------------------------
// SchemaCompiler
// ---------------------------------------------------------------------------

export class SchemaCompiler implements SchemaCompilerInterface {
  private activeCustomKeywords: KeywordDefinitionInterface[] = [];
  private readonly compilingNodes = new Set<SchemaGraphNodeInterface>();
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;

  public constructor(options?: {
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorInterface | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
  }

  public compile(engine: GraphEngineInterface): CompiledValidatorInterface {
    const rootSchema = engine.rootSchema;

    if (typeof rootSchema === 'boolean') {
      return this.compileBooleanSchema(rootSchema, engine);
    }

    const schema = rootSchema as Record<string, unknown>;
    const formatRegistry = engine.formatRegistry;
    const lookupSchema = engine.schemaLookup();
    const graph = new SchemaGraph(schema);

    this.activeCustomKeywords = engine.keywords();

    // Check for unsupported features that require engine fallback
    if (this.needsEngineFallback(graph, lookupSchema)) {
      this.activeCustomKeywords = [];

      return this.engineFallback(engine);
    }

    try {
      const checkFn = this.compileCheck(schema, formatRegistry, graph, lookupSchema);
      const validateFn = this.compileValidate(schema, formatRegistry, graph, lookupSchema);

      return {
        'check': checkFn,
        'compiled': true,
        'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
          if (options?.applyDefaults || options?.coerce || options?.stripUnknownProperties || options?.removeAdditional) {
            // Use the full validate path for mutation modes
            const result = validateFn(data, options);

            return result;
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
          const result = this.compileValidateWithErrors(schema, formatRegistry, graph, lookupSchema)(data, '', errors, true, false, false, false);

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

  private compileBooleanSchema(schema: boolean, _engine: GraphEngineInterface): CompiledValidatorInterface {
    if (schema) {
      return {
        'check': () => {
          return true;
        },
        'compiled': true,
        'validate': (_data, _options) => {
          return {
            'errors': [],
            'valid': true,
            'value': _data
          };
        }
      };
    }

    return {
      'check': () => {
        return false;
      },
      'compiled': true,
      'validate': (_data, _options) => {
        return {
          'errors': [makeValidationError('', 'falseSchema', 'must not match false schema')],
          'valid': false,
          'value': _data
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
          'compileNodeArrayCheck': (node, fr, g, ls) => {
            return compileArrayCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (n, f, gr, l) => {
                  return this.compileNodeCheck(n, f, gr, l);
                },
                'compileNodeOrBooleanCheck': (n, f, gr, l) => {
                  return this.compileNodeOrBooleanCheck(n, f, gr, l);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              node, fr, g, ls
            );
          },
          'compileNodeCheck': (node, fr, g, ls) => {
            return this.compileNodeCheck(node, fr, g, ls);
          },
          'compileNodeObjectCheck': (node, fr, g, ls) => {
            return compileObjectCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (n, f, gr, l) => {
                  return this.compileNodeCheck(n, f, gr, l);
                },
                'compileNodeOrBooleanCheck': (n, f, gr, l) => {
                  return this.compileNodeOrBooleanCheck(n, f, gr, l);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              node, fr, g, ls
            );
          },
          'compileNodeOrBooleanCheck': (node, fr, g, ls) => {
            return this.compileNodeOrBooleanCheck(node, fr, g, ls);
          },
          'compileNumberCheck': (min, max, exMin, exMax, mult) => {
            return this.compileNumberCheck(min, max, exMin, exMax, mult);
          },
          'compileRefCheck': (ref, fr, g, ls) => {
            return compileRefCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (n, f, gr, l) => {
                  return this.compileNodeCheck(n, f, gr, l);
                },
                'compileNodeOrBooleanCheck': (n, f, gr, l) => {
                  return this.compileNodeOrBooleanCheck(n, f, gr, l);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              ref, fr, g, ls
            );
          },
          'compileStringCheck': (minLen, maxLen, pat, fmt, fr, s) => {
            return this.compileStringCheck(minLen, maxLen, pat, fmt, fr, s);
          },
          'compileTypeCheck': (types) => {
            return this.compileTypeCheck(types);
          },
          'tryCompileNodeFlatObjectCheck': (node, fr, g, ls) => {
            return tryCompileFlatObjectCheck(
              {
                'activeCustomKeywords': this.activeCustomKeywords,
                'compileNodeCheck': (n, f, gr, l) => {
                  return this.compileNodeCheck(n, f, gr, l);
                },
                'compileNodeOrBooleanCheck': (n, f, gr, l) => {
                  return this.compileNodeOrBooleanCheck(n, f, gr, l);
                },
                'compilingNodes': this.compilingNodes,
                'lookupCompiled': this.lookupCompiled
              },
              node, fr, g, ls
            );
          }
        },
        graphNode, formatRegistry, graph, lookupSchema
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
        ? (v, _p, _e, _c, _ad, _dc, _su) => {
          return {
            'valid': true,
            'value': v
          };
        }
        : (v, p, e, c) => {
          if (c) {
            e.push(makeValidationError(p, 'falseSchema', 'must not match false schema'));
          }

          return {
            'valid': false,
            'value': v
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
        'compileNodeCheck': (node, fr, g, ls) => {
          return this.compileNodeCheck(node, fr, g, ls);
        },
        'compileNodeOrBooleanCheck': (node, fr, g, ls) => {
          return this.compileNodeOrBooleanCheck(node, fr, g, ls);
        },
        'compileNodeOrBooleanValidateWithErrors': (node, fr, g, ls) => {
          return this.compileNodeOrBooleanValidateWithErrors(node, fr, g, ls);
        },
        'compileNodeValidateWithErrors': (node, fr, g, ls) => {
          return this.compileNodeValidateWithErrors(node, fr, g, ls);
        },
        'hasFormatAssertions': (sem) => {
          return this.hasFormatAssertions(sem);
        },
        'resolveImplicitDefault': (node, g, ls, visited) => {
          return resolveImplicitDefaultValue(node, g, ls, visited);
        }
      },
      graphNode, formatRegistry, graph, lookupSchema
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
    const checks: Array<(v: number) => boolean> = [];

    if (minimum !== undefined) {
      checks.push((v) => {
        return v >= minimum;
      });
    }
    if (maximum !== undefined) {
      checks.push((v) => {
        return v <= maximum;
      });
    }
    if (exclusiveMinimum !== undefined) {
      checks.push((v) => {
        return v > exclusiveMinimum;
      });
    }
    if (exclusiveMaximum !== undefined) {
      checks.push((v) => {
        return v < exclusiveMaximum;
      });
    }
    if (multipleOf !== undefined) {
      checks.push((v) => {
        return v % multipleOf === 0;
      });
    }

    if (checks.length === 0) {
      return undefined;
    }

    return (v) => {
      if (typeof v !== 'number') {
        return true;
      }

      for (const check of checks) {
        if (!check(v)) {
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
    const checks: Array<(v: string) => boolean> = [];

    if (minLength !== undefined) {
      checks.push((v) => {
        return [...v].length >= minLength;
      });
    }
    if (maxLength !== undefined) {
      checks.push((v) => {
        return [...v].length <= maxLength;
      });
    }
    if (pattern !== undefined) {
      const regex = new RegExp(pattern, 'u');

      checks.push((v) => {
        return regex.test(v);
      });
    }
    // Format check is separate — it may apply to non-string types (e.g. int32, float)
    let formatCheck: CheckFnType | undefined;

    if (format !== undefined) {
      const hasFormatAssertion = this.hasFormatAssertions(sem);

      if (hasFormatAssertion) {
        const formatValidator = formatRegistry.get(format);

        if (formatValidator !== undefined) {
          formatCheck = (v) => {
            return formatValidator(v);
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

    const stringChecks = [...checks];

    return (v) => {
      if (typeof v === 'string') {
        for (const check of stringChecks) {
          if (!check(v)) {
            return false;
          }
        }
      }

      if (formatCheck !== undefined && !formatCheck(v)) {
        return false;
      }

      return true;
    };
  }

  private compileTypeCheck(types: string[]): CheckFnType {
    if (types.length === 1) {
      switch (types[0]) {
        case 'array': return (v) => {
          return Array.isArray(v);
        };
        case 'boolean': return (v) => {
          return typeof v === 'boolean';
        };
        case 'integer': return (v) => {
          return typeof v === 'number' && Number.isInteger(v);
        };
        case 'null': return (v) => {
          return v === null;
        };
        case 'number': return (v) => {
          return typeof v === 'number';
        };
        case 'object': return (v) => {
          return typeof v === 'object' && v !== null && !Array.isArray(v);
        };
        case 'string': return (v) => {
          return typeof v === 'string';
        };
      }
    }

    const typeSet = new Set(types);
    const hasNull = typeSet.has('null');
    const hasInteger = typeSet.has('integer');

    return (v) => {
      if (v === null) {
        return hasNull;
      }
      if (Array.isArray(v)) {
        return typeSet.has('array');
      }
      const t = typeof v;

      if (t === 'number') {
        return typeSet.has('number') || (hasInteger && Number.isInteger(v));
      }

      return typeSet.has(t);
    };
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private compileValidate(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): (data: unknown, options?: CompiledValidateOptionsInterface) => CompiledValidationResultInterface {
    const validateWithErrors = this.compileValidateWithErrors(schema, formatRegistry, graph, lookupSchema);
    const checkFn = this.compileCheck(schema, formatRegistry, graph, lookupSchema);

    // Get types from graph semantics for root coercion
    const graphNode = graph.node(schema);
    const rootSem = graphNode === undefined ? undefined : graph.semantics(graphNode);
    const rootTypes = rootSem === undefined ? [] : rootSem.schemaTypes;
    const rootHasDefault = rootSem === undefined ? false : rootSem.hasDefault;
    const rootDefaultValue = rootSem === undefined ? undefined : rootSem.defaultValue;

    return (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
      let workingValue = data;

      // Apply coercion at root level
      if (options?.coerce && rootTypes.length > 0) {
        workingValue = coerceCompiledValue(rootTypes, workingValue);
      }

      // Apply defaults at root level
      if (options?.applyDefaults && workingValue === undefined && rootHasDefault) {
        workingValue = structuredClone(rootDefaultValue);
      }

      // For full mutation modes, delegate to validateWithErrors
      if (options?.applyDefaults || options?.coerce || options?.stripUnknownProperties) {
        const errors: ValidationErrorType[] = [];
        const result = validateWithErrors(workingValue, '', errors, options?.collectErrors ?? true, options?.applyDefaults ?? false, options?.coerce ?? false, options?.stripUnknownProperties ?? false);

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
      return (value, _path, _errors, _collectErrors, _applyDefaults, _doCoerce, _stripUnknown) => {
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
        return engine.execute(data, '', { 'collectErrors': false }).valid;
      },
      'compiled': false,
      'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
        const result = engine.execute(data, '', {
          'applyDefaults': options?.applyDefaults ?? false,
          'coerce': options?.coerce ?? false,
          'collectErrors': options?.collectErrors ?? true,
          'removeAdditional': options?.removeAdditional ?? false,
          'stripUnknownProperties': options?.stripUnknownProperties ?? false
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
  // Helpers
  // ---------------------------------------------------------------------------

  private hasFormatAssertions(sem: SchemaGraphSemanticsInterface): boolean {
    const rootVocabulary = sem.schemaVocabulary;

    if (rootVocabulary !== undefined && rootVocabulary !== null && typeof rootVocabulary === 'object') {
      return (rootVocabulary as Record<string, unknown>)['https://json-schema.org/draft/2020-12/vocab/format-assertion'] === true;
    }

    const schemaUri = sem.schemaDialect;

    // 2020-12 without explicit format-assertion vocabulary → annotation only
    if (schemaUri === 'https://json-schema.org/draft/2020-12/schema') {
      return false;
    }

    // No $schema or other dialect → default to enabled
    return true;
  }

  private needsEngineFallback(
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): boolean {
    return nodeHasUnsupportedFeatures(graph.rootNode, graph, lookupSchema, new Set());
  }
}
