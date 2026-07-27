/**
 * Schema Compiler — compiles JSON Schema into optimized closure validators.
 *
 * Each schema node becomes a captured closure with all constants pre-resolved.
 * Falls back to GraphEngine for unsupported constructs.
 *
 * All field reads come from graph semantics — never from schema[key].
 */

import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import type { ValidationErrorEntity } from '../../entities/ValidationErrorEntity.js';
import type { ExecContextInterface } from '../../interfaces/ExecContextInterface.js';
import type { CompiledValidateOptionsEntity } from '../../entities/CompiledValidateOptionsEntity.js';
import type { CompiledValidationResultEntity } from '../../entities/CompiledValidationResultEntity.js';
import type { CompiledValidatorInterface } from '../../interfaces/CompiledValidatorInterface.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerInterface.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistryInterface.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { KeywordDefinitionInterface } from '../../interfaces/KeywordDefinitionInterface.js';
import { DataType } from '../data/DataType.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import { LogScope } from '../data/LogScope.js';
import { ExecContext } from './ExecContext.js';
import { SchemaCompilerSupport } from './SchemaCompilerSupport.js';
import { BaseError } from '../../errors/BaseError.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { SchemaCompilerDefaults } from './SchemaCompilerDefaults.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import type { ValidateWithErrorsFunctionInterface } from '../../interfaces/ValidateWithErrorsFunctionInterface.js';
import type { ValidateWithErrorsResultEntity } from '../../entities/ValidateWithErrorsResultEntity.js';
import { VOCABULARY_FORMAT_ASSERTION } from '../../constants/DIALECT.js';
import type { CompiledNodeValidationPlanInterface } from '../../interfaces/CompiledNodeValidationPlanInterface.js';
import { Arrays } from './exec/Arrays.js';
import { Composition } from './exec/Composition.js';
import { Objects } from './exec/Objects.js';
import { Scalars } from './exec/Scalars.js';
import { SchemaCompilerPlan } from './SchemaCompilerPlan.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

import type { SchemaCompilerValidatePlanContextInterface } from '../../interfaces/SchemaCompilerValidatePlanContextInterface.js';
import type { ArrayValidationOptionsInterface } from '../../interfaces/ArrayValidationOptionsInterface.js';
import type { ObjectValidationOptionsInterface } from '../../interfaces/ObjectValidationOptionsInterface.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';
import {
  VS_EARLY_EXIT, VS_INVALID, VS_VALID
} from '../../entities/ValidatorStatusEntity.js';
import type { ValidatorStatusEntity } from '../../entities/ValidatorStatusEntity.js';

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
  private static checkAlwaysFalse(_data: unknown): boolean {
    const result = false;

    return result;
  }
  private static checkAlwaysTrue(_data: unknown): boolean {
    const result = true;

    return result;
  }

  private static validateAlwaysFalse(data: unknown): CompiledValidationResultEntity.Type {
    return {
      'errors': [BaseError.validationError('', 'falseSchema', VALIDATION_MESSAGES.falseSchema)],
      'valid': false,
      'value': data
    };
  }

  private static validateAlwaysTrue(data: unknown): CompiledValidationResultEntity.Type {
    return {
      'errors': [],
      'valid': true,
      'value': data
    };
  }

  private activeCustomKeywords: KeywordDefinitionInterface[] = [];

  private activeLookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;

  private readonly appliesFormatAssertions = (sem: SchemaGraphSemanticsInterface): boolean => {
    const rootVocabulary = sem.schemaVocabulary;
    const formatAssertionValue = DataType.isRecord(rootVocabulary) ? rootVocabulary[VOCABULARY_FORMAT_ASSERTION] : undefined;

    // Explicit opt-out: $vocabulary with format-assertion: false disables checking.
    // Default: format assertions ON (strict-by-default posture).
    return typeof formatAssertionValue === 'boolean' ? formatAssertionValue : true;
  };

  private readonly compileNodeOrBooleanValidateWithErrors = (
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFunctionInterface => {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? (value: unknown): ValidateWithErrorsResultEntity.Type => {
          return {
            'valid': true,
            'value': value
          };
        }
        : (
          value: unknown,
          path: string,
          context: ExecContextInterface
        ): ValidateWithErrorsResultEntity.Type => {
          if (context.collectErrors) {
            context.errors.push(BaseError.validationError(path, 'falseSchema', VALIDATION_MESSAGES.falseSchema));
          }

          return {
            'valid': false,
            'value': value
          };
        };
    }

    return this.compileNodeValidateWithErrors(node, formatRegistry, graph, lookupSchema);
  };

  /**
   * Node-native validate-with-errors compilation. Accepts a SchemaGraphNodeInterface directly.
   *
   * Uses a forward-reference closure to break compile-time cycles: if this node is already
   * being compiled (e.g. a self-referential schema like Tree with items: { $ref: Tree }),
   * returns a deferred closure that resolves lazily once the outer compilation completes.
   */
  private readonly compileNodeValidateWithErrors = (
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFunctionInterface => {
    // If this node is currently being compiled, return a deferred closure to break the cycle.
    const inProgress = this.compilingValidateNodes.get(graphNode);

    if (inProgress !== undefined) {
      return inProgress;
    }

    // Create a forward-reference closure. `resolved` is set after compilation finishes.
    let resolved: undefined | ValidateWithErrorsFunctionInterface;
    const deferred: ValidateWithErrorsFunctionInterface = (
      value: unknown,
      path: string,
      context: ExecContextInterface
    ): ValidateWithErrorsResultEntity.Type => {
      if (resolved !== undefined) {
        return resolved(value, path, context);
      }

      // Still compiling — depth guard applies; return valid to avoid false errors during cycle.
      return {
        'valid': true,
        value
      };
    };

    this.compilingValidateNodes.set(graphNode, deferred);

    try {
      const plan = SchemaCompilerPlan.buildNodePlan(
        this.validatePlanContext,
        graphNode,
        formatRegistry,
        graph,
        {
          ...(this.activeLookupGraph !== undefined && { 'lookupGraph': this.activeLookupGraph }),
          ...(lookupSchema !== undefined && { lookupSchema })
        }
      );

      const baseExecutor = this.buildValidateWithErrorsExecution(plan);

      resolved = baseExecutor;

      return resolved;
    } finally {
      this.compilingValidateNodes.delete(graphNode);
    }
  };

  private readonly compilingValidateNodes = new Map<SchemaGraphNodeInterface, ValidateWithErrorsFunctionInterface>();
  private readonly logger: LoggerInterface;
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;

  private readonly resolveImplicitDefault = (
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ): unknown => {
    const lookupGraph = this.activeLookupGraph;

    return SchemaCompilerDefaults.resolveImplicitDefaultValue(node, graph, lookup, visited, lookupGraph);
  };

  private validatePlanContext: SchemaCompilerValidatePlanContextInterface;

  /**
   * Create a SchemaCompiler with an optional cross-schema lookup for compiled validators
   * and an optional logger for observability of compile-time failures.
   *
   * @param options - Optional cross-schema lookup and logger
   */
  public constructor(options?: {
    'logger'?: LoggerInterface;
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorInterface | undefined;
  }) {
    this.logger = options?.logger ?? SILENT_LOGGER;
    this.lookupCompiled = options?.lookupCompiled;
    this.validatePlanContext = this.buildValidatePlanContext();
  }

  /**
   * After array validation, accumulate evaluated item indices into `context.evaluatedItems`.
   *
   * An item is "evaluated" when:
   * - Its index is covered by `prefixValidators` (prefixItems), OR
   * - Its index is beyond the prefix and `itemValidator` is set (items keyword), OR
   * - It matches `containsValidator` in check-mode isolation (contains keyword).
   *
   * This mirrors the interpreter accumulation in GraphEngine.ts:749, :789, :712.
   */
  private accumulateEvaluatedItems(
    plan: CompiledNodeValidationPlanInterface,
    array: unknown[],
    context: ExecContextInterface
  ): void {
    const {
      containsValidator, itemValidator, prefixValidators
    } = plan;
    const prefixLength = prefixValidators === undefined ? 0 : prefixValidators.length;
    const arrayLength = array.length;

    // prefixItems: indices [0, min(prefixLength, array.length))
    for (let i = 0; i < prefixLength && i < arrayLength; i++) {
      (context.evaluatedItems ??= new Set()).add(i);
    }

    // items: indices [prefixLength, array.length)
    if (itemValidator !== undefined) {
      for (let i = prefixLength; i < arrayLength; i++) {
        (context.evaluatedItems ??= new Set()).add(i);
      }
    }

    // contains: indices where the contains validator passes in check mode
    if (containsValidator !== undefined) {
      // Hoist scratch context outside the per-element loop. check-mode (collectErrors:false)
      // means no errors are pushed, so the errors array is never mutated.
      const scratchContext: ExecContextInterface = {
        ...context,
        'applyDefaults': false,
        'coerce': false,
        'collectErrors': false,
        'errors': [],
        'evaluatedItems': undefined,
        'evaluatedProperties': undefined,
        'stripUnknown': false,
        'synthesizeDefaults': false
      };

      for (const [
        i,
        element
      ] of array.entries()) {
        scratchContext.evaluatedItems = undefined;
        scratchContext.evaluatedProperties = undefined;
        const result = containsValidator(element, `${i}`, scratchContext);

        if (result.valid) {
          (context.evaluatedItems ??= new Set()).add(i);
        }
      }
    }
  }

  /**
   * After object validation, accumulate evaluated property keys into `context.evaluatedProperties`.
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
    plan: CompiledNodeValidationPlanInterface,
    object: Record<string, unknown>,
    context: ExecContextInterface
  ): void {
    const {
      patternPropValidators, propValidators
    } = plan;
    const keys = Object.keys(object);

    for (const key of keys) {
      if (propValidators.has(key)) {
        (context.evaluatedProperties ??= new Set()).add(key);
      } else if (patternPropValidators !== undefined) {
        for (const pp of patternPropValidators) {
          if (pp.regex.test(key)) {
            (context.evaluatedProperties ??= new Set()).add(key);
            break;
          }
        }
      }
    }
  }

  private applyPlanDefaults(
    initialValue: unknown,
    plan: CompiledNodeValidationPlanInterface,
    context: ExecContextInterface
  ): unknown {
    let workingValue = initialValue;

    if (context.applyDefaults && workingValue === undefined && plan.hasDefault) {
      workingValue = GraphEngineSupport.cloneDefault(plan.defaultValue);
    }

    if (context.coerce && plan.types.length > 0) {
      workingValue = SchemaCompilerSupport.coerceCompiledValue(plan.types, workingValue);
    }

    return workingValue;
  }

  private applyRootCoercionAndDefaults(
    data: unknown,
    options: CompiledValidateOptionsEntity.Type | undefined,
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
   * Build a check function that delegates to a `ValidateWithErrorsFunctionInterface`.
   *
   * Used when the schema has `unevaluatedProperties`/`unevaluatedItems`: the cheap check
   * path cannot track evaluated sets across composition branches, so we run the full
   * validator and discard the errors. Mirrors what the interpreter does (GraphEngine has
   * a single path for both `check()` and `validate()`).
   */
  private buildCheckFromValidate(validateFunction: ValidateWithErrorsFunctionInterface): (data: unknown) => boolean {
    return (data: unknown): boolean => {
      const errors: ValidationErrorEntity.Type[] = [];
      // This path is only used for schemas that declare unevaluated*, so tracking is required.
      const context: ExecContextInterface = ExecContext.build({
        'collectErrors': false,
        errors,
        'trackEvaluated': true
      });
      const result = validateFunction(data, '', context);

      return result.valid;
    };
  }

  private buildValidatePlanContext(): SchemaCompilerValidatePlanContextInterface {
    const context: SchemaCompilerValidatePlanContextInterface = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'appliesFormatAssertions': this.appliesFormatAssertions,
      'compileNodeOrBooleanValidateWithErrors': this.compileNodeOrBooleanValidateWithErrors,
      'compileNodeValidateWithErrors': this.compileNodeValidateWithErrors,
      'resolveImplicitDefault': this.resolveImplicitDefault,
      'synthesizeZeroValue': SchemaCompilerDefaults.synthesizeZeroValue
    };

    return context;
  }

  private buildValidateWithErrorsExecution(plan: CompiledNodeValidationPlanInterface): ValidateWithErrorsFunctionInterface {
    const {
      allOfValidators, anyOfValidators, complementValidator,
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

    return this.wrapDepthGuard(plan, hasComposition);
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
  public compile(engine: GraphEngineInterface, graph: SchemaGraphInterface): CompiledValidatorInterface {
    const rootSchema = engine.rootSchema;

    if (typeof rootSchema === 'boolean') {
      return this.compileBooleanSchema(rootSchema);
    }

    if (!DataType.isRecord(rootSchema)) {
      return this.compileBooleanSchema(false);
    }

    const schema = rootSchema;
    const formatRegistry = engine.formatRegistry;
    const lookupSchema = engine.schemaLookup();
    const resolvedGraph = graph;

    this.activeCustomKeywords = engine.keywords();
    this.activeLookupGraph = engine.graphLookup();
    // Rebuild the plan context now that `activeCustomKeywords` reflects this
    // compile() call — the context built in the constructor captured the
    // (empty) value at construction time.
    this.validatePlanContext = this.buildValidatePlanContext();

    const validateWithErrorsFunction = this.compileValidateWithErrors(schema, formatRegistry, resolvedGraph, lookupSchema);
    const checkFunction = this.buildCheckFromValidate(validateWithErrorsFunction);
    const treeHasUnevaluated = resolvedGraph.nodes().some((graphNode: SchemaGraphNodeInterface): boolean => {
      const sem = resolvedGraph.semantics(graphNode);

      return sem.unevaluatedPropertiesNode !== undefined || sem.unevaluatedItemsNode !== undefined;
    });
    const validateFunction = this.compileValidateMutating(schema, resolvedGraph, validateWithErrorsFunction, checkFunction, treeHasUnevaluated);

    this.logger.info(LogScope.format('SchemaCompiler', 'compile', `compiled validator for ${typeof schema.$id === 'string' ? schema.$id : '<anonymous>'}`));

    function dispatchValidate(data: unknown, options?: CompiledValidateOptionsEntity.Type): CompiledValidationResultEntity.Type {
      if (options?.applyDefaults === true || options?.castTypes === true
        || options?.enforceSchemaProperties === true || options?.removeAdditionalProperties === true) {
        return validateFunction(data, options);
      }
      // Fast validate path — just check + collect errors
      if (options?.collectErrors === false) {
        return {
          'errors': [],
          'valid': checkFunction(data),
          'value': data
        };
      }

      const errors: ValidationErrorEntity.Type[] = [];
      const context: ExecContextInterface = ExecContext.build({
        errors,
        'trackEvaluated': treeHasUnevaluated
      });
      const result = validateWithErrorsFunction(data, '', context);

      return {
        errors,
        'valid': result.valid,
        'value': result.value
      };
    }

    return {
      'check': checkFunction,
      'compiled': true,
      'validate': dispatchValidate
    };
  }

  private compileBooleanSchema(schema: boolean): CompiledValidatorInterface {
    if (schema) {
      return {
        'check': SchemaCompiler.checkAlwaysTrue,
        'compiled': true,
        'validate': SchemaCompiler.validateAlwaysTrue
      };
    }

    return {
      'check': SchemaCompiler.checkAlwaysFalse,
      'compiled': true,
      'validate': SchemaCompiler.validateAlwaysFalse
    };
  }

  private compileValidateMutating(
    schema: Record<string, unknown>,
    graph: SchemaGraphInterface,
    validateWithErrors: ValidateWithErrorsFunctionInterface,
    checkFunction: (data: unknown) => boolean,
    trackEvaluated: boolean
  ): (data: unknown, options?: CompiledValidateOptionsEntity.Type) => CompiledValidationResultEntity.Type {
    const graphNode = graph.node(schema);
    const rootSem = graphNode === undefined ? undefined : graph.semantics(graphNode);
    const rootTypes = rootSem === undefined ? [] : rootSem.schemaTypes;
    const rootHasDefault = rootSem === undefined ? false : rootSem.hasDefault;
    const rootDefaultValue = rootSem === undefined ? undefined : rootSem.defaultValue;

    return (data: unknown, options?: CompiledValidateOptionsEntity.Type): CompiledValidationResultEntity.Type => {
      const result = this.executeMutatingValidate(
        data,
        options,
        validateWithErrors,
        checkFunction,
        rootTypes,
        rootHasDefault,
        rootDefaultValue,
        trackEvaluated
      );

      return result;
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
  ): ValidateWithErrorsFunctionInterface {
    const graphNode = graph.node(schema);

    if (graphNode === undefined) {
      this.logger.error(LogScope.format('SchemaCompiler', 'compileValidateWithErrors', 'Schema not found in graph — cannot compile validator'));
      throw new GraphError(
        'Schema not found in graph — cannot compile validator',
        { 'code': GRAPH_ERROR_CODE.REF_NOT_FOUND }
      );
    }

    return this.compileNodeValidateWithErrors(graphNode, formatRegistry, graph, lookupSchema);
  }

  private executeComposedAllOf(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { allOfValidators } = plan;

    return Composition.validateAllOf(workingValue, path, allOfValidators, context);
  }

  private executeComposedAnyOneNot(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = context;
    let valid = true;
    let currentValue = workingValue;

    if (plan.anyOfValidators !== undefined) {
      const anyResult = Composition.validateAnyOf(path, currentValue, plan.anyOfValidators, context);

      if (anyResult.earlyExit) {
        return anyResult;
      }
      if (!anyResult.valid) {
        valid = false;
      }
      currentValue = anyResult.value;
    }

    if (plan.oneOfValidators !== undefined) {
      const oneResult = Composition.validateOneOf(path, currentValue, plan.oneOfValidators, context);

      if (oneResult.earlyExit) {
        return oneResult;
      }
      if (!oneResult.valid) {
        valid = false;
      }
      currentValue = oneResult.value;
    }

    if (!Composition.validateNot(path, currentValue, plan.complementValidator, context)) {
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
    plan: CompiledNodeValidationPlanInterface,
    initialValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const allOfResult = this.executeComposedAllOf(plan, initialValue, path, context);

    if (allOfResult.earlyExit) {
      return allOfResult;
    }

    const workingValue = allOfResult.value;
    const anyOneNotResult = this.executeComposedAnyOneNot(plan, workingValue, path, context);

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
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface,
    initialValid: boolean
  ): ValidateWithErrorsResultEntity.Type {
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
      context
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
    options: CompiledValidateOptionsEntity.Type,
    validateWithErrors: ValidateWithErrorsFunctionInterface,
    trackEvaluated: boolean
  ): CompiledValidationResultEntity.Type {
    const errors: ValidationErrorEntity.Type[] = [];
    const stripUnk = (options.enforceSchemaProperties ?? false) || (options.removeAdditionalProperties ?? false);
    const context: ExecContextInterface = ExecContext.build({
      'applyDefaults': options.applyDefaults ?? false,
      'coerce': options.castTypes ?? false,
      'collectErrors': options.collectErrors ?? true,
      errors,
      'ignoreAdditionalProperties': options.ignoreAdditionalProperties ?? false,
      'stripUnknown': stripUnk,
      'synthesizeDefaults': options.synthesizeDefaults ?? false,
      'trackEvaluated': trackEvaluated
    });
    const result = validateWithErrors(workingValue, '', context);

    return {
      errors,
      'valid': result.valid,
      'value': result.value
    };
  }

  private executeMutatingValidate(
    data: unknown,
    options: CompiledValidateOptionsEntity.Type | undefined,
    validateWithErrors: ValidateWithErrorsFunctionInterface,
    checkFunction: (data: unknown) => boolean,
    rootTypes: string[],
    rootHasDefault: boolean,
    rootDefaultValue: unknown,
    trackEvaluated: boolean
  ): CompiledValidationResultEntity.Type {
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
        'valid': checkFunction(workingValue),
        'value': workingValue
      };
    }

    const errors: ValidationErrorEntity.Type[] = [];
    const context: ExecContextInterface = ExecContext.build({
      errors,
      'ignoreAdditionalProperties': options?.ignoreAdditionalProperties ?? false,
      'synthesizeDefaults': options?.synthesizeDefaults ?? false,
      'trackEvaluated': trackEvaluated
    });
    const result = validateWithErrors(workingValue, '', context);

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
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface,
    priorValid: boolean
  ): ValidateWithErrorsResultEntity.Type {
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
        context
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
    if (DataType.isRecord(currentValue) && unevaluatedPropertiesValidator !== undefined) {
      const upResult = this.executeUnevaluatedProperties(
        unevaluatedPropertiesValidator,
        currentValue,
        path,
        context
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
      const rdfsResult = rdfsRangeValidator(currentValue, path, context);

      if (!rdfsResult.valid) {
        if (!context.collectErrors) {
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
    unevaluatedItemsValidator: ValidateWithErrorsFunctionInterface,
    array: unknown[],
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const alreadyEvaluated = context.evaluatedItems ?? new Set<number>();
    let valid = true;
    const arrayLength = array.length;

    for (let index = 0; index < arrayLength; index++) {
      if (alreadyEvaluated.has(index)) {
        continue;
      }

      const itemResult = unevaluatedItemsValidator(array[index], `${path}/${index}`, context);

      if (itemResult.valid) {
        array[index] = itemResult.value;
        (context.evaluatedItems ??= new Set()).add(index);
      } else {
        if (!context.collectErrors) {
          return {
            'earlyExit': true,
            'valid': false,
            'value': array
          };
        }
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid,
      'value': array
    };
  }

  /**
   * Execute unevaluatedProperties post-pass over residual (non-evaluated) object keys.
   * Mirrors GraphEngine.applyUnevaluatedProperties (GraphEngine.ts:257-306).
   */
  private executeUnevaluatedProperties(
    unevaluatedPropertiesValidator: ValidateWithErrorsFunctionInterface,
    object: Record<string, unknown>,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const alreadyEvaluated = context.evaluatedProperties ?? new Set<string>();
    const pathPrefix = path === '' ? '/' : `${path}/`;
    let valid = true;

    for (const key of Object.keys(object)) {
      if (alreadyEvaluated.has(key)) {
        continue;
      }

      const propResult = unevaluatedPropertiesValidator(object[key], `${pathPrefix}${key}`, context);

      if (propResult.valid) {
        object[key] = propResult.value;
        (context.evaluatedProperties ??= new Set()).add(key);
      } else {
        if (!context.collectErrors) {
          return {
            'earlyExit': true,
            'valid': false,
            'value': object
          };
        }
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid,
      'value': object
    };
  }

  private executeValidateComposed(
    plan: CompiledNodeValidationPlanInterface,
    value: unknown,
    path: string,
    context: ExecContextInterface
  ): ValidateWithErrorsResultEntity.Type {
    const baseResult = this.validatePlanBase(plan, value, path, context);

    if (baseResult.earlyExit) {
      return {
        'valid': false,
        'value': baseResult.value
      };
    }

    const boolResult = this.executeComposedBoolLogic(plan, baseResult.value, path, context);

    if (boolResult.earlyExit) {
      return {
        'valid': false,
        'value': boolResult.value
      };
    }

    const composed = baseResult.valid && boolResult.valid;
    const ifResult = this.executeComposedIfThenElse(plan, boolResult.value, path, context, composed);

    // --- Unevaluated items / properties post-pass ---
    // Runs AFTER all composition (allOf/anyOf/oneOf/not/if-then-else), exactly as
    // the interpreter does (GraphEngineVisit.ts:403-449). context.evaluatedItems and
    // context.evaluatedProperties have been accumulated by runPlanStructure +
    // composition branches above.
    const postResult = this.executeUnevaluatedAndRdfs(plan, ifResult.value, path, context, ifResult.valid);

    return postResult;
  }

  private executeValidateSimple(
    plan: CompiledNodeValidationPlanInterface,
    value: unknown,
    path: string,
    context: ExecContextInterface
  ): ValidateWithErrorsResultEntity.Type {
    const baseResult = this.validatePlanBase(plan, value, path, context);

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

  private runPlanDynamicReferenceValidatorFunction(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = context;

    if (plan.dynamicRefValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const dynResult = plan.dynamicRefValidator(workingValue, path, context);

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
  private runPlanReferenceAndScalarsFunction(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const {
      collectErrors, errors
    } = context;

    const referenceValidatorResult = this.runPlanReferenceValidatorFunction(plan, workingValue, path, context);

    if (referenceValidatorResult.earlyExit) {
      return referenceValidatorResult;
    }

    const scalarStatus = this.validatePlanScalars(plan, referenceValidatorResult.value, path, errors, collectErrors);

    if (scalarStatus === VS_EARLY_EXIT) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': referenceValidatorResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': referenceValidatorResult.valid && scalarStatus === VS_VALID,
      'value': referenceValidatorResult.value
    };
  }

  private runPlanReferenceValidatorFunction(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = context;

    if (plan.refValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const { 'refValidator': referenceValidatorFunction } = plan;
    // Use the same context so refStack and depth are preserved across $ref boundaries,
    // preventing infinite recursion on cyclic data.
    const referenceValidatorResult = referenceValidatorFunction(workingValue, path, context);

    if (!referenceValidatorResult.valid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': referenceValidatorResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': referenceValidatorResult.valid,
      'value': referenceValidatorResult.value
    };
  }

  private runPlanStructure(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
  ): ValidatorStatusEntity.Type {
    let valid = true;

    if (DataType.isRecord(workingValue)) {
      const objectResult = this.validateObjectPlan(plan, workingValue, path, context);

      if (objectResult.earlyExit) {
        return VS_EARLY_EXIT;
      }
      if (!objectResult.valid) {
        valid = false;
      }
      if (context.trackEvaluated) {
        this.accumulateEvaluatedProperties(plan, workingValue, context);
      }
    }

    if (Array.isArray(workingValue)) {
      const arrayResult = this.validateArrayPlan(plan, workingValue, path, context);

      if (arrayResult.earlyExit) {
        return VS_EARLY_EXIT;
      }
      if (!arrayResult.valid) {
        valid = false;
      }
      if (context.trackEvaluated) {
        this.accumulateEvaluatedItems(plan, workingValue, context);
      }
    }

    return valid ? VS_VALID : VS_INVALID;
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private runPlanStructureAndTail(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface,
    initialValid: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    let valid = initialValid;
    const structStatus = this.runPlanStructure(plan, workingValue, path, context);

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

    const tailResult = this.validatePlanTail(plan, workingValue, path, context);

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
    array: unknown[],
    path: string,
    context: ExecContextInterface,
    arrayOptions: ArrayValidationOptionsInterface
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const {
      collectErrors, errors
    } = context;
    const {
      containsValidator,
      'maxContains': maximumContains,
      'maxItems': maximumItems,
      'minContains': minimumContains,
      'minItems': minimumItems,
      uniqueItems
    } = arrayOptions;

    if (!Arrays.validateBounds(path, array, minimumItems, maximumItems, uniqueItems, errors) && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    const itemsResult = this.validateArrayItemsAndPrefix(array, path, context, arrayOptions);

    if (itemsResult.earlyExit) {
      return itemsResult;
    }

    if (!Arrays.validateContains(path, array, containsValidator, minimumContains, maximumContains, context, errors) && !collectErrors) {
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
    array: unknown[],
    path: string,
    context: ExecContextInterface,
    arrayOptions: ArrayValidationOptionsInterface
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const { stripUnknown } = context;
    const {
      itemValidator, prefixValidators
    } = arrayOptions;

    // Mutate-and-restore context in place — avoids per-value child-context allocation.
    // Use a fresh refStack for item validation so ref-cycle detection is scoped per item path.
    const savedReferenceStack = context.refStack;
    const savedEvalItems = context.evaluatedItems;
    const savedEvalProps = context.evaluatedProperties;
    const savedStrip = stripUnknown;

    context.refStack = new Set();
    context.evaluatedItems = undefined;
    context.evaluatedProperties = undefined;
    context.stripUnknown = stripUnknown;

    let prefixValid = true;
    let itemsValid = true;
    let earlyExit = false;

    try {
      const prefixResult = Arrays.validatePrefixItems(path, array, prefixValidators, context);

      if (prefixResult.earlyExit) {
        earlyExit = true;
      } else {
        prefixValid = prefixResult.valid;
        const itemsResult = Arrays.validateItems(path, array, itemValidator, prefixValidators, context);

        if (itemsResult.earlyExit) {
          earlyExit = true;
        } else {
          itemsValid = itemsResult.valid;
        }
      }
    } finally {
      context.refStack = savedReferenceStack;
      context.evaluatedItems = savedEvalItems;
      context.evaluatedProperties = savedEvalProps;
      context.stripUnknown = savedStrip;
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
    plan: CompiledNodeValidationPlanInterface,
    array: unknown[],
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const result = this.validateArrayFields(array, path, context, plan.arrOpts);

    return result;
  }

  private validateForbidExtra(
    object: Record<string, unknown>,
    path: string,
    allowedKeys: Set<string>,
    errors: ValidationErrorEntity.Type[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    let valid = true;

    for (const key of Object.keys(object)) {
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
    object: Record<string, unknown>,
    path: string,
    errors: ValidationErrorEntity.Type[],
    collectErrors: boolean,
    count: number,
    initialValid: boolean,
    objectOptions: ObjectValidationOptionsInterface
  ): ValidatorStatusEntity.Type {
    const {
      allowedKeys, jtExtra,
      'maxProperties': maximumProperties,
      'minProperties': minimumProperties
    } = objectOptions;
    let valid = initialValid;

    if (jtExtra === 'forbid' && allowedKeys !== undefined) {
      const forbidResult = this.validateForbidExtra(object, path, allowedKeys, errors, collectErrors);

      if (forbidResult.earlyExit) {
        return VS_EARLY_EXIT;
      }
      if (!forbidResult.valid) {
        valid = false;
      }
    }

    if (!Objects.validatePropertyCount(path, object, minimumProperties, maximumProperties, errors, count)) {
      if (!collectErrors) {
        return VS_EARLY_EXIT;
      }
      valid = false;
    }

    return valid ? VS_VALID : VS_INVALID;
  }

  private validateObjectFields(
    object: Record<string, unknown>,
    path: string,
    context: ExecContextInterface,
    objectOptions: ObjectValidationOptionsInterface
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const { stripUnknown } = context;
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip,
      jtExtra, patternPropValidators, propertyDefaults, propValidators
    } = objectOptions;

    const prelude = this.validateObjectPrelude(object, path, context, objectOptions);

    if (prelude.earlyExit) {
      return {
        'count': 0,
        'earlyExit': true,
        'valid': false
      };
    }

    const effectiveStrip = jtExtra === 'allow' || jtExtra === 'forbid' ? false : stripUnknown;
    // Mutate-and-restore context in place — avoids per-value child-context allocation.
    // Save the four fields that change for property validation.
    const savedReferenceStack = context.refStack;
    const savedEvalItems = context.evaluatedItems;
    const savedEvalProps = context.evaluatedProperties;
    const savedStrip = stripUnknown;

    context.refStack = new Set();
    context.evaluatedItems = undefined;
    context.evaluatedProperties = undefined;
    context.stripUnknown = effectiveStrip;

    let propsResult: { 'count': number;
      'earlyExit': boolean;
      'valid': boolean };

    try {
      propsResult = Objects.validateProperties(
        path,
        object,
        propValidators,
        patternPropValidators,
        additionalIsFalse,
        additionalValidator,
        allowedKeys,
        effectiveStrip,
        propertyDefaults,
        context,
        allowedKeysForStrip
      );
    } finally {
      context.refStack = savedReferenceStack;
      context.evaluatedItems = savedEvalItems;
      context.evaluatedProperties = savedEvalProps;
      context.stripUnknown = savedStrip;
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
    } = context;
    const extraStatus = this.validateObjectCountAndExtra(object, path, errors, collectErrors, count, baseValid, objectOptions);

    return {
      count,
      'earlyExit': extraStatus === VS_EARLY_EXIT,
      'valid': extraStatus === VS_VALID
    };
  }

  private validateObjectPlan(
    plan: CompiledNodeValidationPlanInterface,
    object: Record<string, unknown>,
    path: string,
    context: ExecContextInterface
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const result = this.validateObjectFields(object, path, context, plan.objOpts);

    return result;
  }

  private validateObjectPrelude(
    object: Record<string, unknown>,
    path: string,
    context: ExecContextInterface,
    objectOptions: ObjectValidationOptionsInterface
  ): { 'earlyExit': boolean;
    'requiredValid': boolean } {
    const {
      applyDefaults, collectErrors, errors
    } = context;
    const {
      propertyAliases, propertyDefaults, propertyZeroValueSynthesizers, required
    } = objectOptions;

    if (propertyAliases.size > 0) {
      Objects.applyAliases(object, propertyAliases);
    }

    if (applyDefaults) {
      Objects.applyDefaults(object, propertyDefaults);
    }

    if (context.synthesizeDefaults && required !== undefined) {
      for (const key of required) {
        if (!(key in object)) {
          const synthesizer = propertyZeroValueSynthesizers.get(key);

          object[key] = synthesizer === undefined ? null : synthesizer();
        }
      }
    }

    if (!Objects.validateRequired(path, object, required, errors)) {
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
    plan: CompiledNodeValidationPlanInterface,
    initialValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown; } {
    const workingValue = this.applyPlanDefaults(initialValue, plan, context);

    // NOTE: $dynamicAnchor scope push happens in buildValidateWithErrorsExecution, which
    // builds childCtx with the updated dynamicScope BEFORE calling executeValidateSimple or
    // executeValidateComposed. That means context.dynamicScope already contains any entries added
    // by this node's $dynamicAnchor when validatePlanBase is called. Do not push/restore here
    // — the scope must persist through executeComposedBoolLogic (allOf/anyOf etc.) which runs
    // AFTER validatePlanBase returns.
    const earlyResult = this.runPlanReferenceAndScalarsFunction(plan, workingValue, path, context);

    if (earlyResult.earlyExit) {
      return earlyResult;
    }

    // Run $dynamicRef after $ref (matching interpreter order in GraphEngineVisit.ts:153-171).
    const dynamicReferenceValidatorResult = this.runPlanDynamicReferenceValidatorFunction(plan, earlyResult.value, path, context);

    if (dynamicReferenceValidatorResult.earlyExit) {
      return dynamicReferenceValidatorResult;
    }

    const baseValid = earlyResult.valid && dynamicReferenceValidatorResult.valid;

    return this.runPlanStructureAndTail(plan, dynamicReferenceValidatorResult.value, path, context, baseValid);
  }

  private validatePlanDependent(
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    context: ExecContextInterface
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

    const dependencyContext: ExecContextInterface = {
      ...context,
      'depth': 0,
      'dynamicScope': [],
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': false,
      'maxDepth': 100,
      'refStack': new Set(),
      'synthesizeDefaults': false,
      'trackEvaluated': true
    };

    const { depRequiredEntries } = plan;
    const validateDepReq = Objects.validateDependentRequired;
    const depReqResult = validateDepReq(path, workingValue, depRequiredEntries, dependencyContext);

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
      dependencyContext
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
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorEntity.Type[],
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

    const propertyNamesContext: ExecContextInterface = ExecContext.build({
      'collectErrors': collectErrors,
      errors,
      'trackEvaluated': true
    });
    const pnResult = Objects.validatePropertyNames(path, workingValue, propertyNamesValidator, propertyNamesContext);

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
    plan: CompiledNodeValidationPlanInterface,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorEntity.Type[],
    collectErrors: boolean
  ): ValidatorStatusEntity.Type {
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
    plan: CompiledNodeValidationPlanInterface,
    initialValue: unknown,
    path: string,
    context: ExecContextInterface
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown; } {
    const depResult = this.validatePlanDependent(plan, initialValue, path, context);

    if (depResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': initialValue
      };
    }

    const workingValue = depResult.value;
    const tailValid = depResult.valid;
    const pnKwResult = this.validatePlanPropNamesAndKeywords(plan, workingValue, path, context.errors, context.collectErrors);

    return {
      'earlyExit': pnKwResult.earlyExit,
      'valid': tailValid && pnKwResult.valid,
      'value': workingValue
    };
  }

  private validateStringNumberFormat(
    plan: CompiledNodeValidationPlanInterface,
    value: unknown,
    path: string,
    errors: ValidationErrorEntity.Type[],
    collectErrors: boolean
  ): ValidatorStatusEntity.Type {
    const statusString = this.validateStringPart(plan, value, path, errors, collectErrors);

    if (statusString === VS_EARLY_EXIT) {
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

    return statusString;
  }

  // ---------------------------------------------------------------------------
  // Check execution (inlined from SchemaCompilerCheckExec)
  // ---------------------------------------------------------------------------

  private validateStringPart(
    plan: CompiledNodeValidationPlanInterface,
    value: unknown,
    path: string,
    errors: ValidationErrorEntity.Type[],
    collectErrors: boolean
  ): ValidatorStatusEntity.Type {
    const {
      contentAssertionsEnabled, contentEncoding, contentMediaType,
      format, formatValidator,
      'maxLength': maximumLength,
      'minLength': minimumLength,
      pattern, patternRegex
    } = plan;

    if (typeof value === 'string'
      && !Scalars.validateString(path, value, minimumLength, maximumLength, patternRegex, pattern, errors)) {
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
    plan: CompiledNodeValidationPlanInterface,
    value: unknown,
    path: string,
    errors: ValidationErrorEntity.Type[],
    collectErrors: boolean
  ): ValidatorStatusEntity.Type {
    const {
      'constVal': constValue, enumSet, enumValues, hasConst, typePredicate, types
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

    if (!Scalars.validateConst(path, value, hasConst, constValue, errors)) {
      if (!collectErrors) {
        return VS_EARLY_EXIT;
      }
      valid = false;
    }

    return valid ? VS_VALID : VS_INVALID;
  }

  /**
   * Shared depth guard and `$dynamicAnchor` scope push/pop wrapping every compiled node
   * validator, regardless of whether it executes the simple or composed path. Mutates
   * `context.depth`/`context.dynamicScope` in place — no allocation — and restores both
   * in `finally` so they are correct even if `executor` throws.
   */
  private wrapDepthGuard(
    plan: CompiledNodeValidationPlanInterface,
    composed: boolean
  ): ValidateWithErrorsFunctionInterface {
    const { dynamicScopeEntry } = plan;

    return (
      value: unknown,
      path: string,
      context: ExecContextInterface
    ): ValidateWithErrorsResultEntity.Type => {
      if (context.depth >= context.maxDepth) {
        return {
          'valid': true,
          value
        };
      }
      context.depth++;

      // Push $dynamicAnchor into scope only when this node declares one (rare).
      // Save and restore the array reference; the common path skips this entirely.
      const savedDynamicScope = dynamicScopeEntry === undefined ? undefined : context.dynamicScope;

      if (dynamicScopeEntry !== undefined) {
        context.dynamicScope = [
          ...context.dynamicScope,
          dynamicScopeEntry
        ];
      }

      try {
        return composed
          ? this.executeValidateComposed(plan, value, path, context)
          : this.executeValidateSimple(plan, value, path, context);
      } finally {
        context.depth--;

        if (savedDynamicScope !== undefined) {
          context.dynamicScope = savedDynamicScope;
        }
      }
    };
  }
}

