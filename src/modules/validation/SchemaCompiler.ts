/**
 * Schema Compiler — compiles JSON Schema into optimized closure validators.
 *
 * Each schema node becomes a captured closure with all constants pre-resolved.
 * Falls back to GraphEngine for unsupported constructs.
 *
 * All field reads come from graph semantics — never from schema[key].
 */

import type { ValidationErrorType } from '../../types/Validation.js';
import type { ExecContextType } from '../../types/ExecContext.js';
import type {
  CompiledValidateOptionsType, CompiledValidationResultType, CompiledValidatorType
} from '../../types/Compiler.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerImpl.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { KeywordDefinitionType } from '../../types/GraphEngine.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { BaseError } from '../../errors/BaseError.js';
import { SchemaCompilerDefaults } from './SchemaCompilerDefaults.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import type {
  ValidateWithErrorsFnType, ValidateWithErrorsResultType
} from '../../types/Validation.js';
import { VOCABULARY_FORMAT_ASSERTION } from '../../constants/DIALECT.js';
import type { CompiledNodeValidationPlanType } from '../../types/CompiledNodeValidationPlan.js';
import { Arrays } from './exec/Arrays.js';
import { Composition } from './exec/Composition.js';
import { Objects } from './exec/Objects.js';
import { Scalars } from './exec/Scalars.js';
import { buildNodePlan } from './SchemaCompilerPlan.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

import type { SchemaCompilerValidatePlanContextType } from '../../types/SchemaCompilerValidatePlanContext.js';
import type { ArrayValidationOptionsType } from '../../types/ArrayValidationOptionsType.js';
import type { ObjectValidationOptionsType } from '../../types/ObjectValidationOptionsType.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';
import {
  VS_EARLY_EXIT, VS_INVALID, VS_VALID
} from '../../types/ValidatorStatusType.js';
import type { ValidatorStatusType } from '../../types/ValidatorStatusType.js';

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SchemaCompiler
// ---------------------------------------------------------------------------

/**
 * Compiles JSON Schema into optimized closure validators.
 *
 * Each schema node becomes a captured closure with all constants pre-resolved
 * at compile time. Falls back to `GraphEngine` for schema constructs that
 * cannot be expressed as statically-bound closures.
 *
 * @remarks
 * The compiler operates in two phases. First, it walks the schema graph to
 * determine whether the fast compilation path is supported. If supported, it
 * builds check closures and validate-with-errors closures capturing plan-time
 * constants. If unsupported (e.g. dynamic `$ref` resolution, unsupported
 * keywords), it falls back to the `GraphEngine` interpreter.
 *
 * @example
 * ```ts
 * const compiler = new SchemaCompiler({ lookupCompiled: registry.getCompiled });
 * const compiled = compiler.compile(engine, graph);
 * const result = compiled.validate(data);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link SchemaCompilerInterface}
 * @group SchemaCompiler
 */
export class SchemaCompiler implements SchemaCompilerInterface {
  private activeCustomKeywords: KeywordDefinitionType[] = [];
  private activeLookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  private readonly compilingValidateNodes = new Map<SchemaGraphNodeType, ValidateWithErrorsFnType>();
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorType | undefined) | undefined;

  private readonly validatePlanContext: SchemaCompilerValidatePlanContextType;

  /**
   * Create a SchemaCompiler with an optional cross-schema lookup for compiled validators.
   *
   * @param options - Optional cross-schema lookup for resolving already-compiled validators by schema ID
   */
  public constructor(options?: {
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorType | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
    this.validatePlanContext = this.buildValidatePlanContext();
  }

  /**
   * After array validation, accumulate evaluated item indices into `ctx.evaluatedItems`.
   *
   * An item is "evaluated" when:
   * - Its index is covered by `prefixValidators` (prefixItems), OR
   * - Its index is beyond the prefix and `itemValidator` is set (items keyword), OR
   * - It matches `containsValidator` in check-mode isolation (contains keyword).
   *
   * This mirrors the interpreter accumulation in GraphEngine.ts:749, :789, :712.
   */
  private accumulateEvaluatedItems(
    plan: CompiledNodeValidationPlanType,
    arr: unknown[],
    ctx: ExecContextType
  ): void {
    const {
      containsValidator, itemValidator, prefixValidators
    } = plan;
    const prefixLen = prefixValidators === undefined ? 0 : prefixValidators.length;

    // prefixItems: indices [0, min(prefixLen, arr.length))
    for (let i = 0; i < prefixLen && i < arr.length; i++) {
      (ctx.evaluatedItems ??= new Set()).add(i);
    }

    // items: indices [prefixLen, arr.length)
    if (itemValidator !== undefined) {
      for (let i = prefixLen; i < arr.length; i++) {
        (ctx.evaluatedItems ??= new Set()).add(i);
      }
    }

    // contains: indices where the contains validator passes in check mode
    if (containsValidator !== undefined) {
      // Hoist scratch ctx outside the per-element loop. check-mode (collectErrors:false)
      // means no errors are pushed, so the errors array is never mutated.
      const scratchCtx: ExecContextType = {
        'applyDefaults': false,
        'collectErrors': false,
        'depth': ctx.depth,
        'doCoerce': false,
        'dynamicScope': ctx.dynamicScope,
        'errors': [],
        'evaluatedItems': undefined,
        'evaluatedProperties': undefined,
        'ignoreAdditionalProperties': ctx.ignoreAdditionalProperties,
        'maxDepth': ctx.maxDepth,
        'refStack': ctx.refStack,
        'stripUnknown': false,
        'synthesizeDefaults': false,
        'trackEvaluated': ctx.trackEvaluated
      };

      for (const [
        i,
        element
      ] of arr.entries()) {
        scratchCtx.evaluatedItems = undefined;
        scratchCtx.evaluatedProperties = undefined;
        const result = containsValidator(element, `${i}`, scratchCtx);

        if (result.valid) {
          (ctx.evaluatedItems ??= new Set()).add(i);
        }
      }
    }
  }

  /**
   * After object validation, accumulate evaluated property keys into `ctx.evaluatedProperties`.
   *
   * A property is "evaluated" by this node when:
   * - It exists in the object AND is covered by `propValidators` (properties keyword), OR
   * - It exists in the object AND matches a `patternPropValidators` pattern (patternProperties).
   *
   * This mirrors the interpreter accumulation in GraphEngine.ts:1126 and :1177.
   * Keys handled only by `additionalProperties` are tracked when they PASS validation;
   * since we cannot distinguish pass/fail per-key here without re-running, we conservatively
   * omit them — for unevaluated semantics, additionalProperties does not evaluate residuals
   * for unevaluatedProperties purposes per JSON Schema 2020-12 (§11.3).
   */
  private accumulateEvaluatedProperties(
    plan: CompiledNodeValidationPlanType,
    obj: Record<string, unknown>,
    ctx: ExecContextType
  ): void {
    const {
      patternPropValidators, propValidators
    } = plan;
    const keys = Object.keys(obj);

    for (const key of keys) {
      if (propValidators.has(key)) {
        (ctx.evaluatedProperties ??= new Set()).add(key);
      } else if (patternPropValidators !== undefined) {
        for (const pp of patternPropValidators) {
          if (pp.regex.test(key)) {
            (ctx.evaluatedProperties ??= new Set()).add(key);
            break;
          }
        }
      }
    }
  }

  private appliesFormatAssertions(sem: SchemaGraphSemanticsType): boolean {
    const rootVocabulary = sem.schemaVocabulary;
    const formatAssertionValue = isRecord(rootVocabulary) ? rootVocabulary[VOCABULARY_FORMAT_ASSERTION] : undefined;

    // Explicit opt-out: $vocabulary with format-assertion: false disables checking.
    // Default: format assertions ON (strict-by-default posture).
    return typeof formatAssertionValue === 'boolean' ? formatAssertionValue : true;
  }

  private applyPlanDefaults(
    initialValue: unknown,
    plan: CompiledNodeValidationPlanType,
    ctx: ExecContextType
  ): unknown {
    let workingValue = initialValue;

    if (ctx.applyDefaults && workingValue === undefined && plan.hasDefault) {
      workingValue = GraphEngineSupport.cloneDefault(plan.defaultValue);
    }

    if (ctx.doCoerce && plan.types.length > 0) {
      workingValue = SchemaCompilerSupport.coerceCompiledValue(plan.types, workingValue);
    }

    return workingValue;
  }

  private applyRootCoercionAndDefaults(
    data: unknown,
    options: CompiledValidateOptionsType | undefined,
    rootTypes: string[],
    rootHasDefault: boolean,
    rootDefaultValue: unknown
  ): unknown {
    let workingValue = data;

    if (options?.castTypes === true && rootTypes.length > 0) {
      workingValue = SchemaCompilerSupport.coerceCompiledValue(rootTypes, workingValue);
    }

    if (options?.applyDefaults === true && workingValue === undefined && rootHasDefault) {
      workingValue = GraphEngineSupport.cloneDefault(rootDefaultValue);
    }

    return workingValue;
  }

  /**
   * Build a check function that delegates to a `ValidateWithErrorsFnType`.
   *
   * Used when the schema has `unevaluatedProperties`/`unevaluatedItems`: the cheap check
   * path cannot track evaluated sets across composition branches, so we run the full
   * validator and discard the errors. Mirrors what the interpreter does (GraphEngine has
   * a single path for both `check()` and `validate()`).
   */
  private buildCheckFromValidate(validateFn: ValidateWithErrorsFnType): (data: unknown) => boolean {
    return (data: unknown): boolean => {
      const errors: ValidationErrorType[] = [];
      const ctx: ExecContextType = {
        'applyDefaults': false,
        'collectErrors': false,
        'depth': 0,
        'doCoerce': false,
        'dynamicScope': [],
        errors,
        'evaluatedItems': undefined,
        'evaluatedProperties': undefined,
        'ignoreAdditionalProperties': false,
        'maxDepth': 100,
        'refStack': new Set(),
        'stripUnknown': false,
        'synthesizeDefaults': false,
        // This path is only used for schemas that declare unevaluated*, so tracking is required.
        'trackEvaluated': true
      };
      const result = validateFn(data, '', ctx);

      return result.valid;
    };
  }

  private buildValidatePlanContext(): SchemaCompilerValidatePlanContextType {
    const ctx: SchemaCompilerValidatePlanContextType = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'appliesFormatAssertions': (semantics: SchemaGraphSemanticsType): boolean => {
        return this.appliesFormatAssertions(semantics);
      },
      'compileNodeOrBooleanValidateWithErrors': (
        targetNode: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        schemaGraph: SchemaGraphInterface,
        schemaLookup?: (id: string) => Record<string, unknown> | undefined
      ): ValidateWithErrorsFnType => {
        return this.compileNodeOrBooleanValidateWithErrors(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'compileNodeValidateWithErrors': (
        targetNode: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        schemaGraph: SchemaGraphInterface,
        schemaLookup?: (id: string) => Record<string, unknown> | undefined
      ): ValidateWithErrorsFnType => {
        return this.compileNodeValidateWithErrors(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'resolveImplicitDefault': (
        node: SchemaGraphNodeType,
        graph: SchemaGraphInterface,
        lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
        visited: Set<unknown>
      ): unknown => {
        const lookupGraph = this.activeLookupGraph;

        return SchemaCompilerDefaults.resolveImplicitDefaultValue(node, graph, lookup, visited, lookupGraph);
      },
      'synthesizeZeroValue': (
        node: SchemaGraphNodeType,
        graph: SchemaGraphInterface,
        lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
        lookupGraph: ((id: string) => SchemaGraphInterface | undefined) | undefined
      ): unknown => {
        return SchemaCompilerDefaults.synthesizeZeroValue(node, graph, lookup, lookupGraph);
      }
    };

    Object.defineProperty(ctx, 'activeCustomKeywords', {
      'enumerable': true,
      'get': (): KeywordDefinitionType[] => {
        return this.activeCustomKeywords;
      }
    });

    return ctx;
  }

  private buildValidateWithErrorsExecution(plan: CompiledNodeValidationPlanType): ValidateWithErrorsFnType {
    const {
      allOfValidators, anyOfValidators, complementValidator, dynamicScopeEntry,
      ifValidator, oneOfValidators,
      rdfsRangeValidator, unevaluatedItemsValidator, unevaluatedPropertiesValidator
    } = plan;

    const hasComposition
      = (allOfValidators !== undefined && allOfValidators.length > 0)
      || (anyOfValidators !== undefined && anyOfValidators.length > 0)
      || (oneOfValidators !== undefined && oneOfValidators.length > 0)
      || complementValidator !== undefined
      || ifValidator !== undefined
      // Unevaluated* and rdfsRange must run after all composition — route through composed path.
      || unevaluatedPropertiesValidator !== undefined
      || unevaluatedItemsValidator !== undefined
      || rdfsRangeValidator !== undefined;

    if (!hasComposition) {
      return (
        value: unknown,
        path: string,
        ctx: ExecContextType
      ): ValidateWithErrorsResultType => {
        if (ctx.depth >= ctx.maxDepth) {
          return {
            'valid': true,
            value
          };
        }
        // Mutate depth on the shared ctx — no allocation. Restore in finally so the
        // depth is correct even if executeValidateSimple throws.
        ctx.depth++;

        // Push $dynamicAnchor into scope only when this node declares one (rare).
        // Save and restore the array reference; the common path skips this entirely.
        const savedDynamicScope = dynamicScopeEntry === undefined ? undefined : ctx.dynamicScope;

        if (dynamicScopeEntry !== undefined) {
          ctx.dynamicScope = [
            ...ctx.dynamicScope,
            dynamicScopeEntry
          ];
        }

        try {
          return this.executeValidateSimple(plan, value, path, ctx);
        } finally {
          ctx.depth--;

          if (savedDynamicScope !== undefined) {
            ctx.dynamicScope = savedDynamicScope;
          }
        }
      };
    }

    return (
      value: unknown,
      path: string,
      ctx: ExecContextType
    ): ValidateWithErrorsResultType => {
      if (ctx.depth >= ctx.maxDepth) {
        return {
          'valid': true,
          value
        };
      }
      // Mutate depth on the shared ctx — no allocation. Restore in finally.
      ctx.depth++;

      // Push $dynamicAnchor into scope only when this node declares one (rare).
      const savedDynamicScope = dynamicScopeEntry === undefined ? undefined : ctx.dynamicScope;

      if (dynamicScopeEntry !== undefined) {
        ctx.dynamicScope = [
          ...ctx.dynamicScope,
          dynamicScopeEntry
        ];
      }

      try {
        return this.executeValidateComposed(plan, value, path, ctx);
      } finally {
        ctx.depth--;

        if (savedDynamicScope !== undefined) {
          ctx.dynamicScope = savedDynamicScope;
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Shared object/array sub-validators
  // ---------------------------------------------------------------------------

  /**
   * Compile a schema from a GraphEngine into an optimized closure validator.
   *
   * @param engine - Graph engine holding the schema to compile
   * @param graph - Pre-built schema graph for the engine's root schema
   * @returns Compiled validator with check and validate functions
   */
  public compile(engine: GraphEngineInterface, graph: SchemaGraphInterface): CompiledValidatorType {
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
    const resolvedGraph = graph;

    this.activeCustomKeywords = engine.keywords();
    this.activeLookupGraph = engine.graphLookup();

    const validateWithErrorsFn = this.compileValidateWithErrors(schema, formatRegistry, resolvedGraph, lookupSchema);
    const checkFn = this.buildCheckFromValidate(validateWithErrorsFn);
    const treeHasUnevaluated = resolvedGraph.nodes().some((graphNode: SchemaGraphNodeType): boolean => {
      const sem = resolvedGraph.semantics(graphNode);

      return sem.unevaluatedPropertiesNode !== undefined || sem.unevaluatedItemsNode !== undefined;
    });
    const validateFn = this.compileValidateMutating(schema, resolvedGraph, validateWithErrorsFn, checkFn, treeHasUnevaluated);

    return {
      'check': checkFn,
      'compiled': true,
      'validate': (data: unknown, options?: CompiledValidateOptionsType): CompiledValidationResultType => {
        return this.dispatchValidate(data, options, validateFn, checkFn, validateWithErrorsFn, treeHasUnevaluated);
      }
    };
  }

  private compileBooleanSchema(schema: boolean): CompiledValidatorType {
    if (schema) {
      return {
        'check': (_data: unknown): boolean => {
          return true;
        },
        'compiled': true,
        'validate': (data: unknown): CompiledValidationResultType => {
          return {
            'errors': [],
            'valid': true,
            'value': data
          };
        }
      };
    }

    return {
      'check': (_data: unknown): boolean => {
        return false;
      },
      'compiled': true,
      'validate': (data: unknown): CompiledValidationResultType => {
        return {
          'errors': [BaseError.validationError('', 'falseSchema', VALIDATION_MESSAGES.falseSchema)],
          'valid': false,
          'value': data
        };
      }
    };
  }

  private compileNodeOrBooleanValidateWithErrors(
    node: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? (value: unknown): ValidateWithErrorsResultType => {
          return {
            'valid': true,
            'value': value
          };
        }
        : (
          value: unknown,
          path: string,
          ctx: ExecContextType
        ): ValidateWithErrorsResultType => {
          if (ctx.collectErrors) {
            ctx.errors.push(BaseError.validationError(path, 'falseSchema', VALIDATION_MESSAGES.falseSchema));
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
   * Node-native validate-with-errors compilation. Accepts a SchemaGraphNodeType directly.
   *
   * Uses a forward-reference closure to break compile-time cycles: if this node is already
   * being compiled (e.g. a self-referential schema like Tree with items: { $ref: Tree }),
   * returns a deferred closure that resolves lazily once the outer compilation completes.
   */
  private compileNodeValidateWithErrors(
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    // If this node is currently being compiled, return a deferred closure to break the cycle.
    const inProgress = this.compilingValidateNodes.get(graphNode);

    if (inProgress !== undefined) {
      return inProgress;
    }

    // Create a forward-reference closure. `resolved` is set after compilation finishes.
    let resolved: undefined | ValidateWithErrorsFnType;
    const deferred: ValidateWithErrorsFnType = (
      value: unknown,
      path: string,
      ctx: ExecContextType
    ): ValidateWithErrorsResultType => {
      if (resolved !== undefined) {
        return resolved(value, path, ctx);
      }

      // Still compiling — depth guard applies; return valid to avoid false errors during cycle.
      return {
        'valid': true,
        value
      };
    };

    this.compilingValidateNodes.set(graphNode, deferred);

    try {
      const plan = buildNodePlan(
        this.validatePlanContext,
        graphNode,
        formatRegistry,
        graph,
        lookupSchema,
        this.activeLookupGraph
      );

      const baseExecutor = this.buildValidateWithErrorsExecution(plan);

      resolved = baseExecutor;

      return resolved;
    } finally {
      this.compilingValidateNodes.delete(graphNode);
    }
  }

  private compileValidateMutating(
    schema: Record<string, unknown>,
    graph: SchemaGraphInterface,
    validateWithErrors: ValidateWithErrorsFnType,
    checkFn: (data: unknown) => boolean,
    trackEvaluated: boolean
  ): (data: unknown, options?: CompiledValidateOptionsType) => CompiledValidationResultType {
    const graphNode = graph.node(schema);
    const rootSem = graphNode === undefined ? undefined : graph.semantics(graphNode);
    const rootTypes = rootSem === undefined ? [] : rootSem.schemaTypes;
    const rootHasDefault = rootSem === undefined ? false : rootSem.hasDefault;
    const rootDefaultValue = rootSem === undefined ? undefined : rootSem.defaultValue;

    return (data: unknown, options?: CompiledValidateOptionsType): CompiledValidationResultType => {
      return this.executeMutatingValidate(
        data,
        options,
        validateWithErrors,
        checkFn,
        rootTypes,
        rootHasDefault,
        rootDefaultValue,
        trackEvaluated
      );
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
      return (_value: unknown, _path: string, _ctx: ExecContextType): ValidateWithErrorsResultType => {
        return {
          'valid': true,
          'value': _value
        };
      };
    }

    return this.compileNodeValidateWithErrors(graphNode, formatRegistry, graph, lookupSchema);
  }

  private dispatchValidate(
    data: unknown,
    options: CompiledValidateOptionsType | undefined,
    validateFn: (data: unknown, options?: CompiledValidateOptionsType) => CompiledValidationResultType,
    checkFn: (data: unknown) => boolean,
    validateWithErrorsFn: ValidateWithErrorsFnType,
    trackEvaluated: boolean
  ): CompiledValidationResultType {
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
    const ctx: ExecContextType = {
      'applyDefaults': false,
      'collectErrors': true,
      'depth': 0,
      'doCoerce': false,
      'dynamicScope': [],
      errors,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': false,
      'maxDepth': 100,
      'refStack': new Set(),
      'stripUnknown': false,
      'synthesizeDefaults': false,
      'trackEvaluated': trackEvaluated
    };
    const result = validateWithErrorsFn(data, '', ctx);

    return {
      errors,
      'valid': result.valid,
      'value': result.value
    };
  }

  private executeComposedAllOf(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { allOfValidators } = plan;

    return Composition.validateAllOf(workingValue, path, allOfValidators, ctx);
  }

  private executeComposedAnyOneNot(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = ctx;
    let valid = true;
    let currentValue = workingValue;

    if (plan.anyOfValidators !== undefined) {
      const anyResult = Composition.validateAnyOf(path, currentValue, plan.anyOfValidators, ctx);

      if (anyResult.earlyExit) {
        return anyResult;
      }
      if (!anyResult.valid) {
        valid = false;
      }
      currentValue = anyResult.value;
    }

    if (plan.oneOfValidators !== undefined) {
      const oneResult = Composition.validateOneOf(path, currentValue, plan.oneOfValidators, ctx);

      if (oneResult.earlyExit) {
        return oneResult;
      }
      if (!oneResult.valid) {
        valid = false;
      }
      currentValue = oneResult.value;
    }

    if (!Composition.validateNot(path, currentValue, plan.complementValidator, ctx)) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'valid': false,
          'value': currentValue
        };
      }
      valid = false;
    }

    return {
      'earlyExit': false,
      valid,
      'value': currentValue
    };
  }

  private executeComposedBoolLogic(
    plan: CompiledNodeValidationPlanType,
    initialValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const allOfResult = this.executeComposedAllOf(plan, initialValue, path, ctx);

    if (allOfResult.earlyExit) {
      return allOfResult;
    }

    const workingValue = allOfResult.value;
    const anyOneNotResult = this.executeComposedAnyOneNot(plan, workingValue, path, ctx);

    if (anyOneNotResult.earlyExit) {
      return anyOneNotResult;
    }

    return {
      'earlyExit': false,
      'valid': allOfResult.valid && anyOneNotResult.valid,
      'value': anyOneNotResult.value
    };
  }

  private executeComposedIfThenElse(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType,
    initialValid: boolean
  ): ValidateWithErrorsResultType {
    const {
      elseValidator, ifValidator, thenValidator
    } = plan;
    const validateIfThenElse = Composition.validateIfThenElse;
    const ifResult = validateIfThenElse(
      workingValue,
      path,
      ifValidator,
      thenValidator,
      elseValidator,
      ctx
    );

    if (ifResult.earlyExit) {
      return {
        'valid': false,
        'value': ifResult.value
      };
    }

    return {
      'valid': initialValid && ifResult.valid,
      'value': ifResult.value
    };
  }

  private executeMutatingFullValidation(
    workingValue: unknown,
    options: CompiledValidateOptionsType,
    validateWithErrors: ValidateWithErrorsFnType,
    trackEvaluated: boolean
  ): CompiledValidationResultType {
    const errors: ValidationErrorType[] = [];
    const stripUnk = (options.enforceSchemaProperties ?? false) || (options.removeAdditionalProperties ?? false);
    const ctx: ExecContextType = {
      'applyDefaults': options.applyDefaults ?? false,
      'collectErrors': options.collectErrors ?? true,
      'depth': 0,
      'doCoerce': options.castTypes ?? false,
      'dynamicScope': [],
      errors,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': options.ignoreAdditionalProperties ?? false,
      'maxDepth': 100,
      'refStack': new Set(),
      'stripUnknown': stripUnk,
      'synthesizeDefaults': options.synthesizeDefaults ?? false,
      'trackEvaluated': trackEvaluated
    };
    const result = validateWithErrors(workingValue, '', ctx);

    return {
      errors,
      'valid': result.valid,
      'value': result.value
    };
  }

  private executeMutatingValidate(
    data: unknown,
    options: CompiledValidateOptionsType | undefined,
    validateWithErrors: ValidateWithErrorsFnType,
    checkFn: (data: unknown) => boolean,
    rootTypes: string[],
    rootHasDefault: boolean,
    rootDefaultValue: unknown,
    trackEvaluated: boolean
  ): CompiledValidationResultType {
    const workingValue = this.applyRootCoercionAndDefaults(data, options, rootTypes, rootHasDefault, rootDefaultValue);

    if (options !== undefined
      && (options.applyDefaults === true || options.castTypes === true
        || options.enforceSchemaProperties === true || options.removeAdditionalProperties === true
        || options.synthesizeDefaults === true || options.ignoreAdditionalProperties === true)) {
      return this.executeMutatingFullValidation(workingValue, options, validateWithErrors, trackEvaluated);
    }

    if (options?.collectErrors === false) {
      return {
        'errors': [],
        'valid': checkFn(workingValue),
        'value': workingValue
      };
    }

    const errors: ValidationErrorType[] = [];
    const ctx: ExecContextType = {
      'applyDefaults': false,
      'collectErrors': true,
      'depth': 0,
      'doCoerce': false,
      'dynamicScope': [],
      errors,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': options?.ignoreAdditionalProperties ?? false,
      'maxDepth': 100,
      'refStack': new Set(),
      'stripUnknown': false,
      'synthesizeDefaults': options?.synthesizeDefaults ?? false,
      'trackEvaluated': trackEvaluated
    };
    const result = validateWithErrors(workingValue, '', ctx);

    return {
      errors,
      'valid': result.valid,
      'value': result.value
    };
  }

  /**
   * Unevaluated items/properties post-pass + rdfs:range validation.
   *
   * Runs after all composition. Mirrors GraphEngineVisit.ts:403-473.
   */
  private executeUnevaluatedAndRdfs(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType,
    priorValid: boolean
  ): ValidateWithErrorsResultType {
    const {
      rdfsRangeValidator, unevaluatedItemsValidator, unevaluatedPropertiesValidator
    } = plan;
    let valid = priorValid;
    let currentValue = workingValue;

    // unevaluatedItems — array post-pass
    if (Array.isArray(currentValue) && unevaluatedItemsValidator !== undefined) {
      const uiResult = this.executeUnevaluatedItems(
        unevaluatedItemsValidator,
        currentValue,
        path,
        ctx
      );

      if (uiResult.earlyExit) {
        return {
          'valid': false,
          'value': uiResult.value
        };
      }
      if (!uiResult.valid) {
        valid = false;
      }
      currentValue = uiResult.value;
    }

    // unevaluatedProperties — object post-pass
    if (isRecord(currentValue) && unevaluatedPropertiesValidator !== undefined) {
      const upResult = this.executeUnevaluatedProperties(
        unevaluatedPropertiesValidator,
        currentValue,
        path,
        ctx
      );

      if (upResult.earlyExit) {
        return {
          'valid': false,
          'value': upResult.value
        };
      }
      if (!upResult.valid) {
        valid = false;
      }
      currentValue = upResult.value;
    }

    // rdfs:range validation — mirrors GraphEngineVisit.ts:469-473
    if (rdfsRangeValidator !== undefined) {
      const rdfsResult = rdfsRangeValidator(currentValue, path, ctx);

      if (!rdfsResult.valid) {
        if (!ctx.collectErrors) {
          return {
            'valid': false,
            'value': rdfsResult.value
          };
        }
        valid = false;
      }
      currentValue = rdfsResult.value;
    }

    return {
      valid,
      'value': currentValue
    };
  }

  /**
   * Execute unevaluatedItems post-pass over residual (non-evaluated) array indices.
   * Mirrors GraphEngine.applyUnevaluatedItems (GraphEngine.ts:206-255).
   */
  private executeUnevaluatedItems(
    unevaluatedItemsValidator: false | ValidateWithErrorsFnType,
    arr: unknown[],
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const alreadyEvaluated = ctx.evaluatedItems ?? new Set<number>();
    let valid = true;

    for (let index = 0; index < arr.length; index++) {
      if (alreadyEvaluated.has(index)) {
        continue;
      }

      if (unevaluatedItemsValidator === false) {
        if (ctx.collectErrors) {
          ctx.errors.push(BaseError.validationError(
            `${path}/${index}`,
            'unevaluatedItems',
            VALIDATION_MESSAGES.unevaluatedItems
          ));
          valid = false;
        } else {
          return {
            'earlyExit': true,
            'valid': false,
            'value': arr
          };
        }
      } else {
        const itemResult = unevaluatedItemsValidator(arr[index], `${path}/${index}`, ctx);

        if (itemResult.valid) {
          arr[index] = itemResult.value;
          (ctx.evaluatedItems ??= new Set()).add(index);
        } else {
          if (!ctx.collectErrors) {
            return {
              'earlyExit': true,
              'valid': false,
              'value': arr
            };
          }
          valid = false;
        }
      }
    }

    return {
      'earlyExit': false,
      valid,
      'value': arr
    };
  }

  /**
   * Execute unevaluatedProperties post-pass over residual (non-evaluated) object keys.
   * Mirrors GraphEngine.applyUnevaluatedProperties (GraphEngine.ts:257-306).
   */
  private executeUnevaluatedProperties(
    unevaluatedPropertiesValidator: false | ValidateWithErrorsFnType,
    obj: Record<string, unknown>,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const alreadyEvaluated = ctx.evaluatedProperties ?? new Set<string>();
    const pathPrefix = path === '' ? '/' : `${path}/`;
    let valid = true;

    for (const key of Object.keys(obj)) {
      if (alreadyEvaluated.has(key)) {
        continue;
      }

      if (unevaluatedPropertiesValidator === false) {
        if (ctx.collectErrors) {
          ctx.errors.push(BaseError.validationError(
            `${pathPrefix}${key}`,
            'unevaluatedProperties',
            VALIDATION_MESSAGES.unevaluatedProperties
          ));
          valid = false;
        } else {
          return {
            'earlyExit': true,
            'valid': false,
            'value': obj
          };
        }
      } else {
        const propResult = unevaluatedPropertiesValidator(obj[key], `${pathPrefix}${key}`, ctx);

        if (propResult.valid) {
          obj[key] = propResult.value;
          (ctx.evaluatedProperties ??= new Set()).add(key);
        } else {
          if (!ctx.collectErrors) {
            return {
              'earlyExit': true,
              'valid': false,
              'value': obj
            };
          }
          valid = false;
        }
      }
    }

    return {
      'earlyExit': false,
      valid,
      'value': obj
    };
  }

  private executeValidateComposed(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType {
    const baseResult = this.validatePlanBase(plan, value, path, ctx);

    if (baseResult.earlyExit) {
      return {
        'valid': false,
        'value': baseResult.value
      };
    }

    const boolResult = this.executeComposedBoolLogic(plan, baseResult.value, path, ctx);

    if (boolResult.earlyExit) {
      return {
        'valid': false,
        'value': boolResult.value
      };
    }

    const composed = baseResult.valid && boolResult.valid;
    const ifResult = this.executeComposedIfThenElse(plan, boolResult.value, path, ctx, composed);

    // --- Unevaluated items / properties post-pass ---
    // Runs AFTER all composition (allOf/anyOf/oneOf/not/if-then-else), exactly as
    // the interpreter does (GraphEngineVisit.ts:403-449). ctx.evaluatedItems and
    // ctx.evaluatedProperties have been accumulated by runPlanStructure +
    // composition branches above.
    const postResult = this.executeUnevaluatedAndRdfs(plan, ifResult.value, path, ctx, ifResult.valid);

    return postResult;
  }

  private executeValidateSimple(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    ctx: ExecContextType
  ): ValidateWithErrorsResultType {
    const baseResult = this.validatePlanBase(plan, value, path, ctx);

    if (baseResult.earlyExit) {
      return {
        'valid': false,
        'value': baseResult.value
      };
    }

    return {
      'valid': baseResult.valid,
      'value': baseResult.value
    };
  }

  private runPlanDynamicRefValidator(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = ctx;

    if (plan.dynamicRefValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const dynResult = plan.dynamicRefValidator(workingValue, path, ctx);

    if (!dynResult.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': dynResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': dynResult.valid,
      'value': dynResult.value
    };
  }

  /**
   * Internal result type for the shared plan-base validation step.
   * earlyExit signals callers to return immediately with `valid: false`.
   */
  private runPlanRefAndScalars(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const {
      collectErrors, errors
    } = ctx;

    const refResult = this.runPlanRefValidator(plan, workingValue, path, ctx);

    if (refResult.earlyExit) {
      return refResult;
    }

    const scalarStatus = this.validatePlanScalars(plan, refResult.value, path, errors, collectErrors);

    if (scalarStatus === VS_EARLY_EXIT) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': refResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': refResult.valid && scalarStatus === VS_VALID,
      'value': refResult.value
    };
  }

  private runPlanRefValidator(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = ctx;

    if (plan.refValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const { refValidator } = plan;
    // Use the same ctx so refStack and depth are preserved across $ref boundaries,
    // preventing infinite recursion on cyclic data.
    const refResult = refValidator(workingValue, path, ctx);

    if (!refResult.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': refResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': refResult.valid,
      'value': refResult.value
    };
  }

  private runPlanStructure(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): ValidatorStatusType {
    let valid = true;

    if (isRecord(workingValue)) {
      const objResult = this.validateObjectPlan(plan, workingValue, path, ctx);

      if (objResult.earlyExit) {
        return VS_EARLY_EXIT;
      }
      if (!objResult.valid) {
        valid = false;
      }
      if (ctx.trackEvaluated) {
        this.accumulateEvaluatedProperties(plan, workingValue, ctx);
      }
    }

    if (Array.isArray(workingValue)) {
      const arrResult = this.validateArrayPlan(plan, workingValue, path, ctx);

      if (arrResult.earlyExit) {
        return VS_EARLY_EXIT;
      }
      if (!arrResult.valid) {
        valid = false;
      }
      if (ctx.trackEvaluated) {
        this.accumulateEvaluatedItems(plan, workingValue, ctx);
      }
    }

    return valid ? VS_VALID : VS_INVALID;
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private runPlanStructureAndTail(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType,
    initialValid: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    let valid = initialValid;
    const structStatus = this.runPlanStructure(plan, workingValue, path, ctx);

    if (structStatus === VS_EARLY_EXIT) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': workingValue
      };
    }
    if (structStatus === VS_INVALID) {
      valid = false;
    }

    const tailResult = this.validatePlanTail(plan, workingValue, path, ctx);

    if (tailResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': tailResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': valid && tailResult.valid,
      'value': tailResult.value
    };
  }

  private validateArrayFields(
    arr: unknown[],
    path: string,
    ctx: ExecContextType,
    arrOpts: ArrayValidationOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const {
      collectErrors, errors
    } = ctx;
    const {
      containsValidator, maxContains, maxItems, minContains, minItems, uniqueItems
    } = arrOpts;

    if (!Arrays.validateBounds(path, arr, minItems, maxItems, uniqueItems, errors) && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    const itemsResult = this.validateArrayItemsAndPrefix(arr, path, ctx, arrOpts);

    if (itemsResult.earlyExit) {
      return itemsResult;
    }

    if (!Arrays.validateContains(path, arr, containsValidator, minContains, maxContains, ctx, errors) && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    return {
      'earlyExit': false,
      'valid': itemsResult.valid
    };
  }

  private validateArrayItemsAndPrefix(
    arr: unknown[],
    path: string,
    ctx: ExecContextType,
    arrOpts: ArrayValidationOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const { stripUnknown } = ctx;
    const {
      itemValidator, prefixValidators
    } = arrOpts;

    // Mutate-and-restore ctx in place — avoids per-value child-ctx allocation.
    // Use a fresh refStack for item validation so ref-cycle detection is scoped per item path.
    const savedRefStack = ctx.refStack;
    const savedEvalItems = ctx.evaluatedItems;
    const savedEvalProps = ctx.evaluatedProperties;
    const savedStrip = stripUnknown;

    ctx.refStack = new Set();
    ctx.evaluatedItems = undefined;
    ctx.evaluatedProperties = undefined;
    ctx.stripUnknown = stripUnknown;

    let prefixValid = true;
    let itemsValid = true;
    let earlyExit = false;

    try {
      const prefixResult = Arrays.validatePrefixItems(path, arr, prefixValidators, ctx);

      if (prefixResult.earlyExit) {
        earlyExit = true;
      } else {
        prefixValid = prefixResult.valid;
        const itemsResult = Arrays.validateItems(path, arr, itemValidator, prefixValidators, ctx);

        if (itemsResult.earlyExit) {
          earlyExit = true;
        } else {
          itemsValid = itemsResult.valid;
        }
      }
    } finally {
      ctx.refStack = savedRefStack;
      ctx.evaluatedItems = savedEvalItems;
      ctx.evaluatedProperties = savedEvalProps;
      ctx.stripUnknown = savedStrip;
    }

    if (earlyExit) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    return {
      'earlyExit': false,
      'valid': prefixValid && itemsValid
    };
  }

  private validateArrayPlan(
    plan: CompiledNodeValidationPlanType,
    arr: unknown[],
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    return this.validateArrayFields(arr, path, ctx, plan.arrOpts);
  }

  private validateForbidExtra(
    obj: Record<string, unknown>,
    path: string,
    allowedKeys: Set<string>,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    let valid = true;

    for (const key of Object.keys(obj)) {
      if (!allowedKeys.has(key)) {
        const childPath = path === '' ? `/${key}` : `${path}/${key}`;

        if (!collectErrors) {
          return {
            'earlyExit': true,
            'valid': false
          };
        }
        errors.push(BaseError.validationError(childPath, 'EXTRA_FORBIDDEN', VALIDATION_MESSAGES.additionalProperties(key)));
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  private validateObjectCountAndExtra(
    obj: Record<string, unknown>,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean,
    count: number,
    initialValid: boolean,
    objOpts: ObjectValidationOptionsType
  ): ValidatorStatusType {
    const {
      allowedKeys, jtExtra, maxProperties, minProperties
    } = objOpts;
    let valid = initialValid;

    if (jtExtra === 'forbid' && allowedKeys !== undefined) {
      const forbidResult = this.validateForbidExtra(obj, path, allowedKeys, errors, collectErrors);

      if (forbidResult.earlyExit) {
        return VS_EARLY_EXIT;
      }
      if (!forbidResult.valid) {
        valid = false;
      }
    }

    if (!Objects.validatePropertyCount(path, obj, minProperties, maxProperties, errors, count)) {
      if (!collectErrors) {
        return VS_EARLY_EXIT;
      }
      valid = false;
    }

    return valid ? VS_VALID : VS_INVALID;
  }

  private validateObjectFields(
    obj: Record<string, unknown>,
    path: string,
    ctx: ExecContextType,
    objOpts: ObjectValidationOptionsType
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const { stripUnknown } = ctx;
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip,
      jtExtra, patternPropValidators, propertyDefaults, propValidators
    } = objOpts;

    const prelude = this.validateObjectPrelude(obj, path, ctx, objOpts);

    if (prelude.earlyExit) {
      return {
        'count': 0,
        'earlyExit': true,
        'valid': false
      };
    }

    const effectiveStrip = jtExtra === 'allow' || jtExtra === 'forbid' ? false : stripUnknown;
    // Mutate-and-restore ctx in place — avoids per-value child-ctx allocation.
    // Save the four fields that change for property validation.
    const savedRefStack = ctx.refStack;
    const savedEvalItems = ctx.evaluatedItems;
    const savedEvalProps = ctx.evaluatedProperties;
    const savedStrip = stripUnknown;

    ctx.refStack = new Set();
    ctx.evaluatedItems = undefined;
    ctx.evaluatedProperties = undefined;
    ctx.stripUnknown = effectiveStrip;

    let propsResult: { 'count': number;
      'earlyExit': boolean;
      'valid': boolean };

    try {
      propsResult = Objects.validateProperties(
        path,
        obj,
        propValidators,
        patternPropValidators,
        additionalIsFalse,
        additionalValidator,
        allowedKeys,
        effectiveStrip,
        propertyDefaults,
        ctx,
        allowedKeysForStrip
      );
    } finally {
      ctx.refStack = savedRefStack;
      ctx.evaluatedItems = savedEvalItems;
      ctx.evaluatedProperties = savedEvalProps;
      ctx.stripUnknown = savedStrip;
    }

    if (propsResult.earlyExit) {
      return {
        'count': propsResult.count,
        'earlyExit': true,
        'valid': false
      };
    }

    const baseValid = propsResult.valid && prelude.requiredValid;
    const { count } = propsResult;
    const {
      collectErrors, errors
    } = ctx;
    const extraStatus = this.validateObjectCountAndExtra(obj, path, errors, collectErrors, count, baseValid, objOpts);

    return {
      count,
      'earlyExit': extraStatus === VS_EARLY_EXIT,
      'valid': extraStatus === VS_VALID
    };
  }

  private validateObjectPlan(
    plan: CompiledNodeValidationPlanType,
    obj: Record<string, unknown>,
    path: string,
    ctx: ExecContextType
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    return this.validateObjectFields(obj, path, ctx, plan.objOpts);
  }

  private validateObjectPrelude(
    obj: Record<string, unknown>,
    path: string,
    ctx: ExecContextType,
    objOpts: ObjectValidationOptionsType
  ): { 'earlyExit': boolean;
    'requiredValid': boolean } {
    const {
      applyDefaults, collectErrors, errors
    } = ctx;
    const {
      propertyAliases, propertyDefaults, propertyZeroValueSynthesizers, required
    } = objOpts;

    if (propertyAliases.size > 0) {
      Objects.applyAliases(obj, propertyAliases);
    }

    if (applyDefaults) {
      Objects.applyDefaults(obj, propertyDefaults);
    }

    if (ctx.synthesizeDefaults && required !== undefined) {
      for (const key of required) {
        if (!(key in obj)) {
          const synthesizer = propertyZeroValueSynthesizers.get(key);

          obj[key] = synthesizer === undefined ? null : synthesizer();
        }
      }
    }

    if (!Objects.validateRequired(path, obj, required, errors)) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'requiredValid': false
        };
      }

      return {
        'earlyExit': false,
        'requiredValid': false
      };
    }

    return {
      'earlyExit': false,
      'requiredValid': true
    };
  }

  /** Runs ref + scalar checks, then structure + tail checks, returning an early-exit result. */
  private validatePlanBase(
    plan: CompiledNodeValidationPlanType,
    initialValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown; } {
    const workingValue = this.applyPlanDefaults(initialValue, plan, ctx);

    // NOTE: $dynamicAnchor scope push happens in buildValidateWithErrorsExecution, which
    // builds childCtx with the updated dynamicScope BEFORE calling executeValidateSimple or
    // executeValidateComposed. That means ctx.dynamicScope already contains any entries added
    // by this node's $dynamicAnchor when validatePlanBase is called. Do not push/restore here
    // — the scope must persist through executeComposedBoolLogic (allOf/anyOf etc.) which runs
    // AFTER validatePlanBase returns.
    const earlyResult = this.runPlanRefAndScalars(plan, workingValue, path, ctx);

    if (earlyResult.earlyExit) {
      return earlyResult;
    }

    // Run $dynamicRef after $ref (matching interpreter order in GraphEngineVisit.ts:153-171).
    const dynRefResult = this.runPlanDynamicRefValidator(plan, earlyResult.value, path, ctx);

    if (dynRefResult.earlyExit) {
      return dynRefResult;
    }

    const baseValid = earlyResult.valid && dynRefResult.valid;

    return this.runPlanStructureAndTail(plan, dynRefResult.value, path, ctx, baseValid);
  }

  private validatePlanDependent(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    if (plan.depRequiredEntries.length === 0 && plan.depSchemaValidators === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const depCtx: ExecContextType = {
      'applyDefaults': ctx.applyDefaults,
      'collectErrors': ctx.collectErrors,
      'depth': 0,
      'doCoerce': ctx.doCoerce,
      'dynamicScope': [],
      'errors': ctx.errors,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': false,
      'maxDepth': 100,
      'refStack': new Set(),
      'stripUnknown': ctx.stripUnknown,
      'synthesizeDefaults': false,
      'trackEvaluated': true
    };

    const { depRequiredEntries } = plan;
    const validateDepReq = Objects.validateDependentRequired;
    const depReqResult = validateDepReq(path, workingValue, depRequiredEntries, depCtx);

    if (depReqResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': workingValue
      };
    }

    const { depSchemaValidators } = plan;
    const validateDepSchemas = Composition.validateDependentSchemas;
    const depSchemaResult = validateDepSchemas(
      workingValue,
      path,
      depSchemaValidators,
      depCtx
    );

    if (depSchemaResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': depSchemaResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': depReqResult.valid && depSchemaResult.valid,
      'value': depSchemaResult.value
    };
  }


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validatePlanPropNamesAndKeywords(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
      customKeywordEntries, propertyNamesValidator
    } = plan;

    if (propertyNamesValidator === undefined
      && (customKeywordEntries === undefined || customKeywordEntries.length === 0)) {
      return {
        'earlyExit': false,
        'valid': true
      };
    }

    const pnCtx: ExecContextType = {
      'applyDefaults': false,
      'collectErrors': collectErrors,
      'depth': 0,
      'doCoerce': false,
      'dynamicScope': [],
      errors,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': false,
      'maxDepth': 100,
      'refStack': new Set(),
      'stripUnknown': false,
      'synthesizeDefaults': false,
      'trackEvaluated': true
    };
    const pnResult = Objects.validatePropertyNames(path, workingValue, propertyNamesValidator, pnCtx);

    if (pnResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    if (!Composition.validateCustomKeywords(path, workingValue, customKeywordEntries, errors)) {
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

    return {
      'earlyExit': false,
      'valid': pnResult.valid
    };
  }

  private validatePlanScalars(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): ValidatorStatusType {
    const tecStatus = this.validateTypeEnumConst(plan, workingValue, path, errors, collectErrors);

    if (tecStatus === VS_EARLY_EXIT) {
      return VS_EARLY_EXIT;
    }

    const snStatus = this.validateStringNumberFormat(plan, workingValue, path, errors, collectErrors);

    if (snStatus === VS_EARLY_EXIT) {
      return VS_EARLY_EXIT;
    }

    return tecStatus === VS_INVALID || snStatus === VS_INVALID ? VS_INVALID : VS_VALID;
  }

  private validatePlanTail(
    plan: CompiledNodeValidationPlanType,
    initialValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown; } {
    const depResult = this.validatePlanDependent(plan, initialValue, path, ctx);

    if (depResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': initialValue
      };
    }

    const workingValue = depResult.value;
    const tailValid = depResult.valid;
    const pnKwResult = this.validatePlanPropNamesAndKeywords(plan, workingValue, path, ctx.errors, ctx.collectErrors);

    return {
      'earlyExit': pnKwResult.earlyExit,
      'valid': tailValid && pnKwResult.valid,
      'value': workingValue
    };
  }

  private validateStringNumberFormat(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): ValidatorStatusType {
    const strStatus = this.validateStringPart(plan, value, path, errors, collectErrors);

    if (strStatus === VS_EARLY_EXIT) {
      return VS_EARLY_EXIT;
    }

    const {
      exclusiveMaximum, exclusiveMinimum, maximum, minimum, multipleOf
    } = plan;

    const numberInvalid = typeof value === 'number'
      && !Scalars.validateNumber(path, value, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, errors);

    if (numberInvalid) {
      return collectErrors ? VS_INVALID : VS_EARLY_EXIT;
    }

    return strStatus;
  }

  // ---------------------------------------------------------------------------
  // Check execution (inlined from SchemaCompilerCheckExec)
  // ---------------------------------------------------------------------------

  private validateStringPart(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): ValidatorStatusType {
    const {
      contentAssertionsEnabled, contentEncoding, contentMediaType,
      format, formatValidator, maxLength, minLength, pattern, patternRegex
    } = plan;

    if (typeof value === 'string'
      && !Scalars.validateString(path, value, minLength, maxLength, patternRegex, pattern, errors)) {
      return collectErrors ? VS_INVALID : VS_EARLY_EXIT;
    }

    if (!Scalars.validateFormat(path, value, format, formatValidator, errors)) {
      return collectErrors ? VS_INVALID : VS_EARLY_EXIT;
    }

    if (contentAssertionsEnabled && typeof value === 'string') {
      if (!Scalars.validateContentEncoding(path, value, contentEncoding, errors)) {
        return collectErrors ? VS_INVALID : VS_EARLY_EXIT;
      }

      if (!Scalars.validateContentMediaType(path, value, contentMediaType, contentEncoding, errors)) {
        return collectErrors ? VS_INVALID : VS_EARLY_EXIT;
      }
    }

    return VS_VALID;
  }

  private validateTypeEnumConst(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): ValidatorStatusType {
    const {
      constVal, enumSet, enumValues, hasConst, typePredicate, types
    } = plan;
    let valid = true;

    if (!Scalars.validateType(path, types, value, errors, typePredicate)) {
      if (!collectErrors) {
        return VS_EARLY_EXIT;
      }
      valid = false;
    }

    if (!Scalars.validateEnum(path, value, enumValues, enumSet, errors)) {
      if (!collectErrors) {
        return VS_EARLY_EXIT;
      }
      valid = false;
    }

    if (!Scalars.validateConst(path, value, hasConst, constVal, errors)) {
      if (!collectErrors) {
        return VS_EARLY_EXIT;
      }
      valid = false;
    }

    return valid ? VS_VALID : VS_INVALID;
  }
}

