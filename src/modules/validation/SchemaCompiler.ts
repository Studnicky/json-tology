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
import { Predicates } from './Predicates.js';
import { SchemaCompilerDefaults } from './SchemaCompilerDefaults.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import type {
  CheckFnType, ValidateWithErrorsFnType, ValidateWithErrorsResultType
} from '../../types/Validation.js';
import { VOCABULARY_FORMAT_ASSERTION } from '../../constants/DIALECT.js';
import type { CompiledNodeValidationPlanType } from '../../types/CompiledNodeValidationPlan.js';
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
  tryCompileFlatObjectCheck
} from './SchemaCompilerPlan.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

import type { SchemaCompilerCheckExecutionContextType } from '../../types/SchemaCompilerCheckExecutionContext.js';
import type { SchemaCompilerGraphContextType } from '../../types/SchemaCompilerGraphContext.js';
import type { SchemaCompilerValidatePlanContextType } from '../../types/SchemaCompilerValidatePlanContext.js';
import type { ArrayValidationOptionsType } from '../../types/ArrayValidationOptionsType.js';
import type { DepSchemaEntryType } from '../../types/DepSchemaEntryType.js';
import type { ExtensionEntryType } from '../../types/ExtensionEntryType.js';
import type { NodeCheckBuildContextType } from '../../types/NodeCheckBuildContextType.js';
import type { ObjectValidationOptionsType } from '../../types/ObjectValidationOptionsType.js';
import type { ValidationRunOptionsType } from '../../types/ValidationRunOptionsType.js';
import { VALIDATION_MESSAGES } from '../../constants/VALIDATION_MESSAGES.js';

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

/** Maximum allowable `oneOf` branch count before early-exit is applied. */
const ONEOF_EARLY_EXIT_THRESHOLD = 1;

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
  private static checkDependentRequiredTrigger(
    obj: Record<string, unknown>,
    required: string[]
  ): boolean {
    for (const req of required) {
      if (!(req in obj)) {
        return false;
      }
    }

    return true;
  }
  private activeCustomKeywords: KeywordDefinitionType[] = [];
  private activeLookupGraph: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  private readonly checkExecContext: SchemaCompilerCheckExecutionContextType;
  private readonly compilingNodes = new Set<SchemaGraphNodeType>();
  private readonly compilingValidateNodes = new Map<SchemaGraphNodeType, ValidateWithErrorsFnType>();
  private readonly graphContext: SchemaCompilerGraphContextType;
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorType | undefined) | undefined;
  private readonly regexCache = new Map<string, RegExp>();

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
    this.graphContext = this.buildGraphContext();
    this.checkExecContext = this.buildCheckExecContext();
    this.validatePlanContext = this.buildValidatePlanContext();
  }

  /**
   * After array validation, accumulate evaluated item indices into `ctx.evaluatedItems`.
   *
   * An item is "evaluated" when:
   * - Its index is covered by `prefixValidators` (prefixItems), OR
   * - Its index is beyond the prefix and `itemValidator` is set (items keyword), OR
   * - It matches `containsCheck` (contains keyword).
   *
   * This mirrors the interpreter accumulation in GraphEngine.ts:749, :789, :712.
   */
  private accumulateEvaluatedItems(
    plan: CompiledNodeValidationPlanType,
    arr: unknown[],
    ctx: ExecContextType
  ): void {
    const {
      containsCheck, itemValidator, prefixValidators
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

    // contains: indices where the contains check passes
    if (containsCheck !== undefined) {
      for (const [
        i,
        element
      ] of arr.entries()) {
        if (containsCheck(element)) {
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

  // ---------------------------------------------------------------------------
  // buildNodeCheckExecution helpers
  // ---------------------------------------------------------------------------

  private applyPlanDefaults(
    initialValue: unknown,
    plan: CompiledNodeValidationPlanType,
    runOpts: ValidationRunOptionsType
  ): unknown {
    const {
      applyDefaults, doCoerce
    } = runOpts;
    let workingValue = initialValue;

    if (applyDefaults && workingValue === undefined && plan.hasDefault) {
      workingValue = GraphEngineSupport.cloneDefault(plan.defaultValue);
    }

    if (doCoerce && plan.types.length > 0) {
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

  private buildAllOfCheck(allOfChecks: CheckFnType[]): CheckFnType {
    return (value: unknown): boolean => {
      return allOfChecks.every((check: CheckFnType): boolean => {
        return check(value);
      });
    };
  }

  private buildAnyOfCheck(anyOfChecks: CheckFnType[]): CheckFnType {
    return (value: unknown): boolean => {
      return anyOfChecks.some((check: CheckFnType): boolean => {
        return check(value);
      });
    };
  }

  private buildArrayStructureChecks(
    buildCtx: NodeCheckBuildContextType,
    graphNode: SchemaGraphNodeType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    const {
      context, formatRegistry, graph, lookupSchema
    } = buildCtx;
    const isArrayLike = sem.schemaTypes.includes('array') || sem.itemsNode !== undefined || sem.prefixItems.length > 0;

    if (!isArrayLike) {
      return [];
    }

    const arrCheck = context.compileNodeArrayCheck(graphNode, formatRegistry, graph, lookupSchema);

    return arrCheck === undefined ? [] : [arrCheck];
  }

  private buildBoolLogicChecks(
    buildCtx: NodeCheckBuildContextType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    const {
      context, formatRegistry, graph, lookupSchema
    } = buildCtx;
    const checks: CheckFnType[] = [];

    if (sem.allOf.length > 0) {
      const allOfChecks = sem.allOf.map((node: SchemaGraphNodeType): CheckFnType => {
        return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push(this.buildAllOfCheck(allOfChecks));
    }

    if (sem.anyOf.length > 0) {
      const anyOfChecks = sem.anyOf.map((node: SchemaGraphNodeType): CheckFnType => {
        return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push(this.buildAnyOfCheck(anyOfChecks));
    }

    if (sem.oneOf.length > 0) {
      const oneOfChecks = sem.oneOf.map((node: SchemaGraphNodeType): CheckFnType => {
        return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push(this.buildOneOfCheck(oneOfChecks));
    }

    return checks;
  }

  private buildCheckExecContext(): SchemaCompilerCheckExecutionContextType {
    const ctx: SchemaCompilerCheckExecutionContextType = {
      'activeCustomKeywords': this.activeCustomKeywords,
      ...this.buildCheckExecNodePart(),
      ...this.buildCheckExecScalarPart()
    };

    Object.defineProperty(ctx, 'activeCustomKeywords', {
      'enumerable': true,
      'get': (): KeywordDefinitionType[] => {
        return this.activeCustomKeywords;
      }
    });

    return ctx;
  }

  private buildCheckExecNodePart(): Pick<
    SchemaCompilerCheckExecutionContextType,
    'compileNodeArrayCheck' | 'compileNodeCheck' | 'compileNodeObjectCheck'
    | 'compileNodeOrBooleanCheck' | 'tryCompileNodeFlatObjectCheck'
  > {
    return {
      'compileNodeArrayCheck': (
        node: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType | undefined => {
        return compileArrayCheck(this.graphContext, node, fmtReg, graph, lookup);
      },
      'compileNodeCheck': (
        node: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType => {
        return this.compileNodeCheck(node, fmtReg, graph, lookup);
      },
      'compileNodeObjectCheck': (
        node: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType | undefined => {
        return compileObjectCheck(this.graphContext, node, fmtReg, graph, lookup);
      },
      'compileNodeOrBooleanCheck': (
        node: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType => {
        return this.compileNodeOrBooleanCheck(node, fmtReg, graph, lookup);
      },
      'tryCompileNodeFlatObjectCheck': (
        node: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType | undefined => {
        return tryCompileFlatObjectCheck(this.graphContext, node, fmtReg, graph, lookup);
      }
    };
  }

  private buildCheckExecScalarPart(): Pick<
    SchemaCompilerCheckExecutionContextType,
    'compileNumberCheck' | 'compileRefCheck' | 'compileStringCheck' | 'compileTypeCheck'
  > {
    return {
      'compileNumberCheck': (
        min: number | undefined,
        max: number | undefined,
        exMin: number | undefined,
        exMax: number | undefined,
        mult: number | undefined
      ): CheckFnType | undefined => {
        return this.compileNumberCheck(min, max, exMin, exMax, mult);
      },
      'compileRefCheck': (
        ref: string,
        fmtReg: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType | undefined => {
        const lookupGraph = this.activeLookupGraph;

        return compileRefCheck(this.graphContext, ref, fmtReg, graph, lookup, lookupGraph);
      },
      'compileStringCheck': (
        minLen: number | undefined,
        maxLen: number | undefined,
        pat: string | undefined,
        fmt: string | undefined,
        fmtReg: FormatRegistryInterface,
        sem: SchemaGraphSemanticsType
      ): CheckFnType | undefined => {
        return this.compileStringCheck(minLen, maxLen, pat, fmt, fmtReg, sem);
      },
      'compileTypeCheck': (types: string[]): CheckFnType => {
        return this.compileTypeCheck(types);
      }
    };
  }

  /**
   * Build a `CheckFnType` that delegates to a `ValidateWithErrorsFnType`.
   *
   * Used when the schema has `unevaluatedProperties`/`unevaluatedItems`: the cheap check
   * path cannot track evaluated sets across composition branches, so we run the full
   * validator and discard the errors. Mirrors what the interpreter does (GraphEngine has
   * a single path for both `check()` and `validate()`).
   */
  private buildCheckFromValidate(validateFn: ValidateWithErrorsFnType): CheckFnType {
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

  private buildComplementCheck(complementCheck: CheckFnType): CheckFnType {
    return (value: unknown): boolean => {
      return !complementCheck(value);
    };
  }

  private buildCompositeCheck(checks: CheckFnType[]): CheckFnType {
    if (checks.length === 0) {
      return (_value: unknown): boolean => {
        return true;
      };
    }
    if (checks.length === 1) {
      return checks[0];
    }

    return (value: unknown): boolean => {
      for (const check of checks) {
        if (!check(value)) {
          return false;
        }
      }

      return true;
    };
  }

  private buildCompositionChecks(
    buildCtx: NodeCheckBuildContextType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    return [
      ...this.buildBoolLogicChecks(buildCtx, sem),
      ...this.buildNotAndIfChecks(buildCtx, sem)
    ];
  }

  private buildCustomKeywordCheck(extensionEntries: ExtensionEntryType[]): CheckFnType {
    return (value: unknown): boolean => {
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
    };
  }

  private buildDependentRequiredCheck(depEntries: Array<[string, string[]]>): CheckFnType {
    return (value: unknown): boolean => {
      if (!isRecord(value)) {
        return true;
      }
      const obj = value;

      for (const [
        trigger,
        required
      ] of depEntries) {
        if (trigger in obj && !SchemaCompiler.checkDependentRequiredTrigger(obj, required)) {
          return false;
        }
      }

      return true;
    };
  }

  private buildDependentSchemaCheck(depSchemaChecks: DepSchemaEntryType[]): CheckFnType {
    return (value: unknown): boolean => {
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
    };
  }

  private buildGraphContext(): SchemaCompilerGraphContextType {
    const ctx: SchemaCompilerGraphContextType = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'compileNodeCheck': (
        node: SchemaGraphNodeType,
        fmt: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType => {
        return this.compileNodeCheck(node, fmt, graph, lookup);
      },
      'compileNodeOrBooleanCheck': (
        node: SchemaGraphNodeType,
        fmt: FormatRegistryInterface,
        graph: SchemaGraphInterface,
        lookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType => {
        return this.compileNodeOrBooleanCheck(node, fmt, graph, lookup);
      },
      'compilingNodes': this.compilingNodes,
      'lookupCompiled': this.lookupCompiled
    };

    Object.defineProperty(ctx, 'activeCustomKeywords', {
      'enumerable': true,
      'get': (): KeywordDefinitionType[] => {
        return this.activeCustomKeywords;
      }
    });

    return ctx;
  }

  private buildIfThenElseCheck(
    ifCheck: CheckFnType,
    thenCheck: CheckFnType | undefined,
    elseCheck: CheckFnType | undefined
  ): CheckFnType {
    return (value: unknown): boolean => {
      if (ifCheck(value)) {
        return thenCheck === undefined || thenCheck(value);
      }

      return elseCheck === undefined || elseCheck(value);
    };
  }

  private buildNodeCheckExecution(
    context: SchemaCompilerCheckExecutionContextType,
    graphNode: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    const fastPath = context.tryCompileNodeFlatObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

    if (fastPath !== undefined) {
      return fastPath;
    }

    const sem = graph.semantics(graphNode);
    const buildCtx: NodeCheckBuildContextType = {
      context,
      formatRegistry,
      graph,
      'lookupSchema': lookupSchema
    };
    const checks: CheckFnType[] = [
      ...this.buildScalarChecks(context, sem, formatRegistry),
      ...this.buildStructureChecks(buildCtx, graphNode, sem),
      ...this.buildCompositionChecks(buildCtx, sem)
    ];

    if (context.activeCustomKeywords.length > 0) {
      const extensionEntries: ExtensionEntryType[] = [];

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
        checks.push(this.buildCustomKeywordCheck(extensionEntries));
      }
    }

    return this.buildCompositeCheck(checks);
  }

  private buildNotAndIfChecks(
    buildCtx: NodeCheckBuildContextType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    const {
      context, formatRegistry, graph, lookupSchema
    } = buildCtx;
    const checks: CheckFnType[] = [];

    if (sem.complementNode !== undefined) {
      const complementCheck = context.compileNodeOrBooleanCheck(
        sem.complementNode,
        formatRegistry,
        graph,
        lookupSchema
      );

      checks.push(this.buildComplementCheck(complementCheck));
    }

    if (sem.ifNode !== undefined) {
      const ifCheck = context.compileNodeOrBooleanCheck(sem.ifNode, formatRegistry, graph, lookupSchema);
      const thenCheck = sem.thenNode === undefined
        ? undefined
        : context.compileNodeOrBooleanCheck(sem.thenNode, formatRegistry, graph, lookupSchema);
      const elseCheck = sem.elseNode === undefined
        ? undefined
        : context.compileNodeOrBooleanCheck(sem.elseNode, formatRegistry, graph, lookupSchema);

      checks.push(this.buildIfThenElseCheck(ifCheck, thenCheck, elseCheck));
    }

    return checks;
  }

  private buildNumberCheckFromSem(
    context: SchemaCompilerCheckExecutionContextType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType | undefined {
    const hasNumberConstraint = sem.minimum !== undefined || sem.maximum !== undefined
      || sem.exclusiveMinimum !== undefined || sem.exclusiveMaximum !== undefined
      || sem.multipleOf !== undefined;

    if (!hasNumberConstraint) {
      return undefined;
    }

    return context.compileNumberCheck(
      sem.minimum,
      sem.maximum,
      sem.exclusiveMinimum,
      sem.exclusiveMaximum,
      sem.multipleOf
    );
  }

  private buildNumericRangeChecks(
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ): Array<(num: number) => boolean> {
    const checks: Array<(num: number) => boolean> = [];

    if (minimum !== undefined) {
      checks.push((num: number): boolean => {
        return Predicates.satisfiesMinimum(num, minimum);
      });
    }
    if (maximum !== undefined) {
      checks.push((num: number): boolean => {
        return Predicates.satisfiesMaximum(num, maximum);
      });
    }
    if (exclusiveMinimum !== undefined) {
      checks.push((num: number): boolean => {
        return Predicates.satisfiesExclusiveMinimum(num, exclusiveMinimum);
      });
    }
    if (exclusiveMaximum !== undefined) {
      checks.push((num: number): boolean => {
        return Predicates.satisfiesExclusiveMaximum(num, exclusiveMaximum);
      });
    }
    if (multipleOf !== undefined) {
      checks.push((num: number): boolean => {
        return Predicates.satisfiesMultipleOf(num, multipleOf);
      });
    }

    return checks;
  }

  private buildObjectStructureChecks(
    buildCtx: NodeCheckBuildContextType,
    graphNode: SchemaGraphNodeType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    const {
      context, formatRegistry, graph, lookupSchema
    } = buildCtx;
    const checks: CheckFnType[] = [];
    const isObjectLike = sem.schemaTypes.includes('object') || sem.properties.size > 0 || sem.required.length > 0;

    if (isObjectLike) {
      const objCheck = context.compileNodeObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

      if (objCheck !== undefined) {
        checks.push(objCheck);
      }
    }

    if (Object.keys(sem.dependentRequired).length > 0) {
      checks.push(this.buildDependentRequiredCheck(Object.entries(sem.dependentRequired)));
    }

    if (sem.dependentSchemaEntries.length > 0) {
      const depSchemaChecks = this.compileDependentSchemaChecks(buildCtx, sem);

      if (depSchemaChecks.length > 0) {
        checks.push(this.buildDependentSchemaCheck(depSchemaChecks));
      }
    }

    if (sem.propertyNamesNode !== undefined) {
      const pnCheck = context.compileNodeOrBooleanCheck(sem.propertyNamesNode, formatRegistry, graph, lookupSchema);

      checks.push(this.buildPropertyNamesCheck(pnCheck));
    }

    return checks;
  }

  private buildOneOfCheck(oneOfChecks: CheckFnType[]): CheckFnType {
    return (value: unknown): boolean => {
      let count = 0;

      for (const check of oneOfChecks) {
        if (check(value)) {
          count++;
          if (count > ONEOF_EARLY_EXIT_THRESHOLD) {
            return false;
          }
        }
      }

      return count === ONEOF_EARLY_EXIT_THRESHOLD;
    };
  }

  private buildPropertyNamesCheck(pnCheck: CheckFnType): CheckFnType {
    return (value: unknown): boolean => {
      if (!isRecord(value)) {
        return true;
      }

      for (const key of Object.keys(value)) {
        if (!pnCheck(key)) {
          return false;
        }
      }

      return true;
    };
  }

  // ---------------------------------------------------------------------------
  // buildValidateWithErrorsExecution helpers
  // ---------------------------------------------------------------------------

  private buildScalarChecks(
    context: SchemaCompilerCheckExecutionContextType,
    sem: SchemaGraphSemanticsType,
    formatRegistry: FormatRegistryInterface
  ): CheckFnType[] {
    return [
      ...this.buildTypeEnumConstChecks(context, sem),
      ...this.buildStringNumberChecks(context, sem, formatRegistry)
    ];
  }

  private buildStringCheckClosure(
    checks: Array<(str: string) => boolean>,
    formatCheck: CheckFnType | undefined,
    contentEncoding?: string,
    contentMediaType?: string
  ): CheckFnType {
    return (value: unknown): boolean => {
      if (typeof value === 'string') {
        for (const check of checks) {
          if (!check(value)) {
            return false;
          }
        }

        if (contentEncoding !== undefined && !Predicates.satisfiesContentEncoding(value, contentEncoding)) {
          return false;
        }

        if (contentMediaType !== undefined && !Predicates.satisfiesContentMediaType(value, contentMediaType, contentEncoding)) {
          return false;
        }
      }

      if (formatCheck !== undefined && !formatCheck(value)) {
        return false;
      }

      return true;
    };
  }

  private buildStringCheckFromSem(
    context: SchemaCompilerCheckExecutionContextType,
    sem: SchemaGraphSemanticsType,
    formatRegistry: FormatRegistryInterface
  ): CheckFnType | undefined {
    const contentEnabled = this.appliesFormatAssertions(sem);
    const hasStringConstraint = sem.minLength !== undefined || sem.maxLength !== undefined
      || sem.pattern !== undefined || sem.format !== undefined
      || (contentEnabled && (sem.contentEncoding !== undefined || sem.contentMediaType !== undefined));

    if (!hasStringConstraint) {
      return undefined;
    }

    return context.compileStringCheck(
      sem.minLength,
      sem.maxLength,
      sem.pattern,
      sem.format,
      formatRegistry,
      sem
    );
  }

  private buildStringLengthPatternChecks(
    minLength: number | undefined,
    maxLength: number | undefined,
    pattern: string | undefined
  ): Array<(str: string) => boolean> {
    const checks: Array<(str: string) => boolean> = [];

    if (minLength !== undefined) {
      checks.push((str: string): boolean => {
        return Predicates.satisfiesMinLength(str, minLength);
      });
    }
    if (maxLength !== undefined) {
      checks.push((str: string): boolean => {
        return Predicates.satisfiesMaxLength(str, maxLength);
      });
    }
    if (pattern !== undefined) {
      const regex = this.regexFor(pattern);

      checks.push((str: string): boolean => {
        return Predicates.satisfiesPattern(str, regex);
      });
    }

    return checks;
  }

  private buildStringNumberChecks(
    context: SchemaCompilerCheckExecutionContextType,
    sem: SchemaGraphSemanticsType,
    formatRegistry: FormatRegistryInterface
  ): CheckFnType[] {
    const checks: CheckFnType[] = [];
    const stringCheck = this.buildStringCheckFromSem(context, sem, formatRegistry);

    if (stringCheck !== undefined) {
      checks.push(stringCheck);
    }

    const numCheck = this.buildNumberCheckFromSem(context, sem);

    if (numCheck !== undefined) {
      checks.push(numCheck);
    }

    return checks;
  }

  private buildStructureChecks(
    buildCtx: NodeCheckBuildContextType,
    graphNode: SchemaGraphNodeType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    const {
      context, formatRegistry, graph, lookupSchema
    } = buildCtx;
    const checks: CheckFnType[] = [];

    if (typeof sem.ref === 'string') {
      const refCheck = context.compileRefCheck(sem.ref, formatRegistry, graph, lookupSchema);

      if (refCheck !== undefined) {
        checks.push(refCheck);
      }
    }

    return [
      ...checks,
      ...this.buildObjectStructureChecks(buildCtx, graphNode, sem),
      ...this.buildArrayStructureChecks(buildCtx, graphNode, sem)
    ];
  }

  private buildTypeEnumConstChecks(
    context: SchemaCompilerCheckExecutionContextType,
    sem: SchemaGraphSemanticsType
  ): CheckFnType[] {
    const checks: CheckFnType[] = [];
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

    return checks;
  }

  private buildValidatePlanContext(): SchemaCompilerValidatePlanContextType {
    const ctx: SchemaCompilerValidatePlanContextType = {
      'activeCustomKeywords': this.activeCustomKeywords,
      'appliesFormatAssertions': (semantics: SchemaGraphSemanticsType): boolean => {
        return this.appliesFormatAssertions(semantics);
      },
      'compileNodeCheck': (
        targetNode: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        schemaGraph: SchemaGraphInterface,
        schemaLookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType => {
        return this.compileNodeCheck(targetNode, fmtReg, schemaGraph, schemaLookup);
      },
      'compileNodeOrBooleanCheck': (
        targetNode: SchemaGraphNodeType,
        fmtReg: FormatRegistryInterface,
        schemaGraph: SchemaGraphInterface,
        schemaLookup?: (id: string) => Record<string, unknown> | undefined
      ): CheckFnType => {
        return this.compileNodeOrBooleanCheck(targetNode, fmtReg, schemaGraph, schemaLookup);
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
      allOfValidators, anyOfChecks, complementCheck, dynamicScopeEntry,
      ifCheck, oneOfChecks,
      rdfsRangeValidator, unevaluatedItemsValidator, unevaluatedPropertiesValidator
    } = plan;

    const hasComposition
      = (allOfValidators !== undefined && allOfValidators.length > 0)
      || (anyOfChecks !== undefined && anyOfChecks.length > 0)
      || (oneOfChecks !== undefined && oneOfChecks.length > 0)
      || complementCheck !== undefined
      || ifCheck !== undefined
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

  private compileDependentSchemaChecks(
    buildCtx: NodeCheckBuildContextType,
    sem: SchemaGraphSemanticsType
  ): DepSchemaEntryType[] {
    const {
      context, formatRegistry, graph, lookupSchema
    } = buildCtx;
    const depSchemaChecks: DepSchemaEntryType[] = [];

    for (const [
      trigger,
      node
    ] of sem.dependentSchemaEntries) {
      let depCheck: CheckFnType;

      if (typeof node.schema === 'boolean') {
        depCheck = node.schema
          ? (_v: unknown): boolean => {
            return true;
          }
          : (_v: unknown): boolean => {
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

    return depSchemaChecks;
  }

  /**
   * Node-native check compilation. Accepts a SchemaGraphNodeType directly.
   */
  private compileNodeCheck(
    graphNode: SchemaGraphNodeType,
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
    node: SchemaGraphNodeType,
    formatRegistry: FormatRegistryInterface,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? (_v: unknown): boolean => {
          return true;
        }
        : (_v: unknown): boolean => {
          return false;
        };
    }

    return this.compileNodeCheck(node, formatRegistry, graph, lookupSchema);
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

      // Compile value-producing validators for anyOf/oneOf members so that
      // defaults and coercion applied inside a branch are propagated forward,
      // matching the interpreted path (VisitComposition.anyOf/oneOf) semantics.
      const sem = graph.semantics(graphNode);
      let anyOfValidators: undefined | ValidateWithErrorsFnType[];

      if (sem.anyOf.length > 0) {
        anyOfValidators = sem.anyOf.map((node: SchemaGraphNodeType): ValidateWithErrorsFnType => {
          return this.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema);
        });
      }

      let oneOfValidators: undefined | ValidateWithErrorsFnType[];

      if (sem.oneOf.length > 0) {
        oneOfValidators = sem.oneOf.map((node: SchemaGraphNodeType): ValidateWithErrorsFnType => {
          return this.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema);
        });
      }

      const baseExecutor = this.buildValidateWithErrorsExecution(plan);

      resolved = anyOfValidators === undefined && oneOfValidators === undefined
        ? baseExecutor
        : this.wrapWithValueProducingComposition(baseExecutor, anyOfValidators, oneOfValidators);

      return resolved;
    } finally {
      this.compilingValidateNodes.delete(graphNode);
    }
  }

  private compileNumberCheck(
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ): CheckFnType | undefined {
    const checks = this.buildNumericRangeChecks(minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf);

    if (checks.length === 0) {
      return undefined;
    }

    return (value: unknown): boolean => {
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
    sem: SchemaGraphSemanticsType
  ): CheckFnType | undefined {
    const checks = this.buildStringLengthPatternChecks(minLength, maxLength, pattern);
    const formatCheck = this.resolveFormatCheck(format, formatRegistry, sem);
    const contentAssertionsEnabled = this.appliesFormatAssertions(sem);
    const contentEncoding = contentAssertionsEnabled ? sem.contentEncoding : undefined;
    const contentMediaType = contentAssertionsEnabled ? sem.contentMediaType : undefined;

    if (checks.length === 0 && formatCheck === undefined && contentEncoding === undefined && contentMediaType === undefined) {
      return undefined;
    }

    return this.buildStringCheckClosure(checks, formatCheck, contentEncoding, contentMediaType);
  }

  private compileTypeCheck(types: string[]): CheckFnType {
    if (types.length === 1) {
      const singleType = types[0];

      return (value: unknown): boolean => {
        return Predicates.matchesType(singleType, value);
      };
    }

    return (value: unknown): boolean => {
      return Predicates.matchesAnyType(types, value);
    };
  }

  private compileValidateMutating(
    schema: Record<string, unknown>,
    graph: SchemaGraphInterface,
    validateWithErrors: ValidateWithErrorsFnType,
    checkFn: CheckFnType,
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
    checkFn: CheckFnType,
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
  ): boolean {
    const {
      collectErrors, errors
    } = ctx;
    let valid = true;

    if (plan.anyOfValidators !== undefined) {
      if (!Composition.validateAnyOfWithEvaluated(path, workingValue, plan.anyOfValidators, ctx)) {
        if (!collectErrors) {
          return false;
        }
        valid = false;
      }
    } else if (!Composition.validateAnyOf(path, workingValue, plan.anyOfChecks, errors)) {
      if (!collectErrors) {
        return false;
      }
      valid = false;
    }

    if (plan.oneOfValidators !== undefined) {
      if (!Composition.validateOneOfWithEvaluated(path, workingValue, plan.oneOfValidators, ctx)) {
        if (!collectErrors) {
          return false;
        }
        valid = false;
      }
    } else if (!Composition.validateOneOf(path, workingValue, plan.oneOfChecks, errors)) {
      if (!collectErrors) {
        return false;
      }
      valid = false;
    }

    if (!Composition.validateNot(path, workingValue, plan.complementCheck, errors)) {
      if (!collectErrors) {
        return false;
      }
      valid = false;
    }

    return valid;
  }

  private executeComposedBoolLogic(
    plan: CompiledNodeValidationPlanType,
    initialValue: unknown,
    path: string,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = ctx;
    const allOfResult = this.executeComposedAllOf(plan, initialValue, path, ctx);

    if (allOfResult.earlyExit) {
      return allOfResult;
    }

    const workingValue = allOfResult.value;
    const anyOneNotValid = this.executeComposedAnyOneNot(plan, workingValue, path, ctx);

    if (!anyOneNotValid && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': workingValue
      };
    }

    return {
      'earlyExit': false,
      'valid': allOfResult.valid && anyOneNotValid,
      'value': workingValue
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
      elseValidator, ifCheck, thenValidator
    } = plan;
    const validateIfThenElse = Composition.validateIfThenElse;
    const ifResult = validateIfThenElse(
      workingValue,
      path,
      ifCheck,
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
    checkFn: CheckFnType,
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

  private regexFor(pattern: string): RegExp {
    let cached = this.regexCache.get(pattern);

    if (cached === undefined) {
      cached = new RegExp(pattern, 'u');
      this.regexCache.set(pattern, cached);
    }

    return cached;
  }

  private resolveFormatCheck(
    format: string | undefined,
    formatRegistry: FormatRegistryInterface,
    sem: SchemaGraphSemanticsType
  ): CheckFnType | undefined {
    if (format === undefined) {
      return undefined;
    }

    const hasFormatAssertion = this.appliesFormatAssertions(sem);

    if (!hasFormatAssertion) {
      return undefined;
    }

    return formatRegistry.get(format);
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

    const scalarResult = this.validatePlanScalars(plan, refResult.value, path, errors, collectErrors);

    if (scalarResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': refResult.value
      };
    }

    return {
      'earlyExit': false,
      'valid': refResult.valid && scalarResult.valid,
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
    ctx: ExecContextType,
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    let valid = true;

    if (isRecord(workingValue)) {
      const objResult = this.validateObjectPlan(plan, workingValue, path, ctx, runOpts);

      if (objResult.earlyExit) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (!objResult.valid) {
        valid = false;
      }
      if (ctx.trackEvaluated) {
        this.accumulateEvaluatedProperties(plan, workingValue, ctx);
      }
    }

    if (Array.isArray(workingValue)) {
      const arrResult = this.validateArrayPlan(plan, workingValue, path, ctx, runOpts);

      if (arrResult.earlyExit) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (!arrResult.valid) {
        valid = false;
      }
      if (ctx.trackEvaluated) {
        this.accumulateEvaluatedItems(plan, workingValue, ctx);
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private runPlanStructureAndTail(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    ctx: ExecContextType,
    runOpts: ValidationRunOptionsType,
    initialValid: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    let valid = initialValid;
    const structResult = this.runPlanStructure(plan, workingValue, path, ctx, runOpts);

    if (structResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': workingValue
      };
    }
    if (!structResult.valid) {
      valid = false;
    }

    const tailResult = this.validatePlanTail(plan, workingValue, path, ctx.errors, runOpts);

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
    runOpts: ValidationRunOptionsType,
    arrOpts: ArrayValidationOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const { collectErrors } = runOpts;
    const { errors } = ctx;
    const {
      containsCheck, maxContains, maxItems, minContains, minItems, uniqueItems
    } = arrOpts;

    if (!Arrays.validateBounds(path, arr, minItems, maxItems, uniqueItems, errors) && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    const itemsResult = this.validateArrayItemsAndPrefix(arr, path, ctx, runOpts, arrOpts);

    if (itemsResult.earlyExit) {
      return itemsResult;
    }

    if (!Arrays.validateContains(path, arr, containsCheck, minContains, maxContains, errors) && !collectErrors) {
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
    runOpts: ValidationRunOptionsType,
    arrOpts: ArrayValidationOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const { stripUnknown } = runOpts;
    const {
      itemValidator, prefixValidators
    } = arrOpts;

    // Inherit depth from parent ctx so the depth guard in item validators can detect
    // cyclic data. Use a fresh refStack scoped per item-validation context.
    const arrCtx: ExecContextType = {
      ...ctx,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'refStack': new Set(),
      'stripUnknown': stripUnknown
    };

    const validatePrefixItems = Arrays.validatePrefixItems;
    const prefixResult = validatePrefixItems(path, arr, prefixValidators, arrCtx);

    if (prefixResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    const validateItems = Arrays.validateItems;
    const itemsResult = validateItems(path, arr, itemValidator, prefixValidators, arrCtx);

    if (itemsResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    return {
      'earlyExit': false,
      'valid': prefixResult.valid && itemsResult.valid
    };
  }

  private validateArrayPlan(
    plan: CompiledNodeValidationPlanType,
    arr: unknown[],
    path: string,
    ctx: ExecContextType,
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const {
      containsCheck, itemValidator, maxContains, maxItems, minContains, minItems,
      prefixValidators, uniqueItems
    } = plan;
    const arrOpts: ArrayValidationOptionsType = {
      containsCheck,
      itemValidator,
      maxContains,
      maxItems,
      minContains,
      minItems,
      prefixValidators,
      uniqueItems
    };

    return this.validateArrayFields(arr, path, ctx, runOpts, arrOpts);
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
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
      allowedKeys, jtExtra, maxProperties, minProperties
    } = objOpts;
    let valid = initialValid;

    if (jtExtra === 'forbid' && allowedKeys !== undefined) {
      const forbidResult = this.validateForbidExtra(obj, path, allowedKeys, errors, collectErrors);

      if (forbidResult.earlyExit) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (!forbidResult.valid) {
        valid = false;
      }
    }

    if (!Objects.validatePropertyCount(path, obj, minProperties, maxProperties, errors, count)) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      valid = false;
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  private validateObjectFields(
    obj: Record<string, unknown>,
    path: string,
    ctx: ExecContextType,
    runOpts: ValidationRunOptionsType,
    objOpts: ObjectValidationOptionsType
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const { stripUnknown } = runOpts;
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip,
      jtExtra, patternPropValidators, propertyDefaults, propValidators
    } = objOpts;

    const prelude = this.validateObjectPrelude(obj, path, ctx.errors, runOpts, objOpts, ctx);

    if (prelude.earlyExit) {
      return {
        'count': 0,
        'earlyExit': true,
        'valid': false
      };
    }

    const effectiveStrip = jtExtra === 'allow' || jtExtra === 'forbid' ? false : stripUnknown;
    // Inherit depth from parent ctx so the depth guard in property validators can detect
    // cyclic data (accumulating depth across property traversals). Use a fresh refStack
    // so schema-level ref-cycle detection is scoped per ref-resolution path, not shared
    // across sibling property validators.
    const propsCtx: ExecContextType = {
      ...ctx,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'refStack': new Set(),
      'stripUnknown': effectiveStrip
    };
    const validateProperties = Objects.validateProperties;
    const propsResult = validateProperties(
      path,
      obj,
      propValidators,
      patternPropValidators,
      additionalIsFalse,
      additionalValidator,
      allowedKeys,
      effectiveStrip,
      propertyDefaults,
      propsCtx,
      allowedKeysForStrip
    );

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
    const extraResult = this.validateObjectCountAndExtra(obj, path, errors, collectErrors, count, baseValid, objOpts);

    return {
      count,
      'earlyExit': extraResult.earlyExit,
      'valid': extraResult.valid
    };
  }

  private validateObjectPlan(
    plan: CompiledNodeValidationPlanType,
    obj: Record<string, unknown>,
    path: string,
    ctx: ExecContextType,
    runOpts: ValidationRunOptionsType
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip,
      jtExtra, maxProperties, minProperties, patternPropValidators, propertyAliases,
      propertyDefaults, propertyZeroValueSynthesizers, propValidators, required
    } = plan;
    const objOpts: ObjectValidationOptionsType = {
      additionalIsFalse,
      additionalValidator,
      allowedKeys,
      allowedKeysForStrip,
      jtExtra,
      maxProperties,
      minProperties,
      patternPropValidators,
      propertyAliases,
      propertyDefaults,
      propertyZeroValueSynthesizers,
      propValidators,
      required
    };

    return this.validateObjectFields(obj, path, ctx, runOpts, objOpts);
  }

  private validateObjectPrelude(
    obj: Record<string, unknown>,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    objOpts: ObjectValidationOptionsType,
    ctx: ExecContextType
  ): { 'earlyExit': boolean;
    'requiredValid': boolean } {
    const {
      applyDefaults, collectErrors
    } = runOpts;
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
    const runOpts: ValidationRunOptionsType = {
      'applyDefaults': ctx.applyDefaults,
      'collectErrors': ctx.collectErrors,
      'doCoerce': ctx.doCoerce,
      'stripUnknown': ctx.stripUnknown
    };
    const workingValue = this.applyPlanDefaults(initialValue, plan, runOpts);

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

    return this.runPlanStructureAndTail(plan, dynRefResult.value, path, ctx, runOpts, baseValid);
  }

  private validatePlanDependent(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
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

    const {
      applyDefaults, collectErrors, doCoerce, stripUnknown
    } = runOpts;

    const depCtx: ExecContextType = {
      'applyDefaults': applyDefaults,
      'collectErrors': collectErrors,
      'depth': 0,
      'doCoerce': doCoerce,
      'dynamicScope': [],
      errors,
      'evaluatedItems': undefined,
      'evaluatedProperties': undefined,
      'ignoreAdditionalProperties': false,
      'maxDepth': 100,
      'refStack': new Set(),
      'stripUnknown': stripUnknown,
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
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const tecResult = this.validateTypeEnumConst(plan, workingValue, path, errors, collectErrors);

    if (tecResult.earlyExit) {
      return tecResult;
    }

    const snResult = this.validateStringNumberFormat(plan, workingValue, path, errors, collectErrors);

    if (snResult.earlyExit) {
      return snResult;
    }

    return {
      'earlyExit': false,
      'valid': tecResult.valid && snResult.valid
    };
  }

  private validatePlanTail(
    plan: CompiledNodeValidationPlanType,
    initialValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown; } {
    const { collectErrors } = runOpts;

    const depResult = this.validatePlanDependent(plan, initialValue, path, errors, runOpts);

    if (depResult.earlyExit) {
      return {
        'earlyExit': true,
        'valid': false,
        'value': initialValue
      };
    }

    const workingValue = depResult.value;
    const tailValid = depResult.valid;
    const pnKwResult = this.validatePlanPropNamesAndKeywords(plan, workingValue, path, errors, collectErrors);

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
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const strResult = this.validateStringPart(plan, value, path, errors, collectErrors);

    if (strResult.earlyExit) {
      return strResult;
    }

    const {
      exclusiveMaximum, exclusiveMinimum, maximum, minimum, multipleOf
    } = plan;

    const numberInvalid = typeof value === 'number'
      && !Scalars.validateNumber(path, value, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, errors);

    if (numberInvalid) {
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
      'valid': strResult.valid
    };
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
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
      contentAssertionsEnabled, contentEncoding, contentMediaType,
      format, formatValidator, maxLength, minLength, pattern, patternRegex
    } = plan;

    if (typeof value === 'string'
      && !Scalars.validateString(path, value, minLength, maxLength, patternRegex, pattern, errors)) {
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

    if (!Scalars.validateFormat(path, value, format, formatValidator, errors)) {
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

    if (contentAssertionsEnabled && typeof value === 'string') {
      if (!Scalars.validateContentEncoding(path, value, contentEncoding, errors)) {
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

      if (!Scalars.validateContentMediaType(path, value, contentMediaType, contentEncoding, errors)) {
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
    }

    return {
      'earlyExit': false,
      'valid': true
    };
  }

  private validateTypeEnumConst(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const {
      constVal, enumSet, enumValues, hasConst, types
    } = plan;
    let valid = true;

    if (!Scalars.validateType(path, types, value, errors)) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      valid = false;
    }

    if (!Scalars.validateEnum(path, value, enumValues, enumSet, errors)) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      valid = false;
    }

    if (!Scalars.validateConst(path, value, hasConst, constVal, errors)) {
      if (!collectErrors) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      valid = false;
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  // ---------------------------------------------------------------------------
  // Validate execution (inlined from SchemaCompilerValidateExec)
  // ---------------------------------------------------------------------------

  /**
   * Wraps a base validator with value-producing anyOf/oneOf composition logic.
   * Replaces the boolean-only anyOf/oneOf check path with full validators that
   * propagate the winning branch's mutated value (defaults, coercion).
   */
  private wrapWithValueProducingComposition(
    baseExecutor: ValidateWithErrorsFnType,
    anyOfValidators: undefined | ValidateWithErrorsFnType[],
    oneOfValidators: undefined | ValidateWithErrorsFnType[]
  ): ValidateWithErrorsFnType {
    return (
      value: unknown,
      path: string,
      ctx: ExecContextType
    ): ValidateWithErrorsResultType => {
      const baseResult = baseExecutor(value, path, ctx);

      // Run value-producing anyOf — this replaces the boolean anyOf check in the base executor.
      // The base executor already validated and returned any anyOf errors; here we re-run
      // with full validators to propagate the winner's value when applyDefaults or doCoerce is active.
      if (!ctx.applyDefaults && !ctx.doCoerce) {
        return baseResult;
      }

      if (!baseResult.valid) {
        return baseResult;
      }

      let workingValue = baseResult.value;

      if (anyOfValidators !== undefined) {
        const anyResult = Composition.validateAnyOfWithValues(
          path,
          workingValue,
          anyOfValidators,
          ctx,
          <T>(candidate: T): T => {
            return GraphEngineSupport.cloneCandidate(candidate);
          }
        );

        if (!anyResult.valid) {
          return {
            'valid': false,
            'value': anyResult.value
          };
        }
        workingValue = anyResult.value;
      }

      if (oneOfValidators !== undefined) {
        const oneResult = Composition.validateOneOfWithValues(
          path,
          workingValue,
          oneOfValidators,
          ctx,
          <T>(candidate: T): T => {
            return GraphEngineSupport.cloneCandidate(candidate);
          }
        );

        if (!oneResult.valid) {
          return {
            'valid': false,
            'value': oneResult.value
          };
        }
        workingValue = oneResult.value;
      }

      return {
        'valid': true,
        'value': workingValue
      };
    };
  }
}
