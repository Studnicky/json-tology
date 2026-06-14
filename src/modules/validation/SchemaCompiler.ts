/**
 * Schema Compiler — compiles JSON Schema into optimized closure validators.
 *
 * Each schema node becomes a captured closure with all constants pre-resolved.
 * Falls back to GraphEngine for unsupported constructs.
 *
 * All field reads come from graph semantics — never from schema[key].
 */

import type { ValidationErrorType } from '../../types/Validation.js';
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
import {
  DEFAULT_DIALECT_URI, VOCABULARY_FORMAT_ASSERTION
} from '../../constants/DIALECT.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
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
  nodeSupportsCompilation,
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
  private readonly graphContext: SchemaCompilerGraphContextType;
  private readonly logger: LoggerInterface;
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorType | undefined) | undefined;
  private readonly regexCache = new Map<string, RegExp>();

  private readonly validatePlanContext: SchemaCompilerValidatePlanContextType;

  /**
   * Create a SchemaCompiler with an optional cross-schema lookup for compiled validators.
   *
   * @param options - Optional lookup function and logger for resolving already-compiled validators by schema ID
   */
  public constructor(options?: {
    'logger'?: LoggerInterface;
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorType | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
    this.logger = options?.logger ?? SILENT_LOGGER;
    this.graphContext = this.buildGraphContext();
    this.checkExecContext = this.buildCheckExecContext();
    this.validatePlanContext = this.buildValidatePlanContext();
  }

  private appliesFormatAssertions(sem: SchemaGraphSemanticsType): boolean {
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

  // ---------------------------------------------------------------------------
  // buildNodeCheckExecution helpers
  // ---------------------------------------------------------------------------

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
    formatCheck: CheckFnType | undefined
  ): CheckFnType {
    return (value: unknown): boolean => {
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

  private buildStringCheckFromSem(
    context: SchemaCompilerCheckExecutionContextType,
    sem: SchemaGraphSemanticsType,
    formatRegistry: FormatRegistryInterface
  ): CheckFnType | undefined {
    const hasStringConstraint = sem.minLength !== undefined || sem.maxLength !== undefined
      || sem.pattern !== undefined || sem.format !== undefined;

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

  // ---------------------------------------------------------------------------
  // buildValidateWithErrorsExecution helpers
  // ---------------------------------------------------------------------------

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
      allOfValidators, anyOfChecks, complementCheck, ifCheck, oneOfChecks
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
      ): ValidateWithErrorsResultType => {
        return this.executeValidateSimple(plan, value, path, errors, {
          applyDefaults,
          collectErrors,
          doCoerce,
          stripUnknown
        });
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
    ): ValidateWithErrorsResultType => {
      return this.executeValidateComposed(plan, value, path, errors, {
        applyDefaults,
        collectErrors,
        doCoerce,
        stripUnknown
      });
    };
  }

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
        'validate': (data: unknown, options?: CompiledValidateOptionsType): CompiledValidationResultType => {
          return this.dispatchValidate(data, options, validateFn, checkFn, validateWithErrorsFn);
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
          'errors': [BaseError.validationError('', 'falseSchema', 'must not match false schema')],
          'valid': false,
          'value': data
        };
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Shared object/array sub-validators
  // ---------------------------------------------------------------------------

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
      return (_value: unknown): boolean => {
        return true;
      };
    }

    return this.compileNodeCheck(graphNode, formatRegistry, graph, lookupSchema);
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
          errors: ValidationErrorType[],
          collect: boolean
        ): ValidateWithErrorsResultType => {
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
   * Node-native validate-with-errors compilation. Accepts a SchemaGraphNodeType directly.
   */
  private compileNodeValidateWithErrors(
    graphNode: SchemaGraphNodeType,
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

    if (checks.length === 0 && formatCheck === undefined) {
      return undefined;
    }

    if (checks.length === 0 && formatCheck !== undefined) {
      return formatCheck;
    }

    return this.buildStringCheckClosure(checks, formatCheck);
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
    checkFn: CheckFnType
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
        rootDefaultValue
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
      return (value: unknown): ValidateWithErrorsResultType => {
        return {
          'valid': true,
          'value': value
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
    validateWithErrorsFn: ValidateWithErrorsFnType
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
    const result = validateWithErrorsFn(data, '', errors, true, false, false, false);

    return {
      errors,
      'valid': result.valid,
      'value': result.value
    };
  }

  private engineFallback(engine: GraphEngineInterface): CompiledValidatorType {
    return {
      'check': (data: unknown): boolean => {
        return engine.execute(data, { 'overrides': { 'collectErrors': false } }).valid;
      },
      'compiled': false,
      'validate': (data: unknown, options?: CompiledValidateOptionsType): CompiledValidationResultType => {
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

  private executeComposedAllOf(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const {
      applyDefaults, collectErrors, doCoerce
    } = runOpts;
    const { allOfValidators } = plan;
    const fn = Composition.validateAllOf;

    return fn(workingValue, path, allOfValidators, errors, collectErrors, applyDefaults, doCoerce);
  }

  private executeComposedAnyOneNot(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): boolean {
    let valid = true;

    if (!Composition.validateAnyOf(path, workingValue, plan.anyOfChecks, errors)) {
      if (!collectErrors) {
        return false;
      }
      valid = false;
    }

    if (!Composition.validateOneOf(path, workingValue, plan.oneOfChecks, errors)) {
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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = runOpts;
    const allOfResult = this.executeComposedAllOf(plan, initialValue, path, errors, runOpts);

    if (allOfResult.earlyExit) {
      return allOfResult;
    }

    const workingValue = allOfResult.value;
    const anyOneNotValid = this.executeComposedAnyOneNot(plan, workingValue, path, errors, collectErrors);

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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    initialValid: boolean
  ): ValidateWithErrorsResultType {
    const {
      applyDefaults, collectErrors, doCoerce, stripUnknown
    } = runOpts;
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

    return {
      'valid': initialValid && ifResult.valid,
      'value': ifResult.value
    };
  }

  private executeMutatingFullValidation(
    workingValue: unknown,
    options: CompiledValidateOptionsType,
    validateWithErrors: ValidateWithErrorsFnType
  ): CompiledValidationResultType {
    const errors: ValidationErrorType[] = [];
    const stripUnk = (options.enforceSchemaProperties ?? false) || (options.removeAdditionalProperties ?? false);
    const result = validateWithErrors(workingValue, '', errors, options.collectErrors ?? true, options.applyDefaults ?? false, options.castTypes ?? false, stripUnk);

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
    rootDefaultValue: unknown
  ): CompiledValidationResultType {
    const workingValue = this.applyRootCoercionAndDefaults(data, options, rootTypes, rootHasDefault, rootDefaultValue);

    if (options !== undefined
      && (options.applyDefaults === true || options.castTypes === true
        || options.enforceSchemaProperties === true || options.removeAdditionalProperties === true)) {
      return this.executeMutatingFullValidation(workingValue, options, validateWithErrors);
    }

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
  }

  private executeValidateComposed(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): ValidateWithErrorsResultType {
    const baseResult = this.validatePlanBase(plan, value, path, errors, runOpts);

    if (baseResult.earlyExit) {
      return {
        'valid': false,
        'value': baseResult.value
      };
    }

    const boolResult = this.executeComposedBoolLogic(plan, baseResult.value, path, errors, runOpts);

    if (boolResult.earlyExit) {
      return {
        'valid': false,
        'value': boolResult.value
      };
    }

    const composed = baseResult.valid && boolResult.valid;

    return this.executeComposedIfThenElse(plan, boolResult.value, path, errors, runOpts, composed);
  }

  private executeValidateSimple(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): ValidateWithErrorsResultType {
    const baseResult = this.validatePlanBase(plan, value, path, errors, runOpts);

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

  /**
   * Internal result type for the shared plan-base validation step.
   * earlyExit signals callers to return immediately with `valid: false`.
   */
  private runPlanRefAndScalars(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const { collectErrors } = runOpts;

    const refResult = this.runPlanRefValidator(plan, workingValue, path, errors, runOpts);

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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const {
      applyDefaults, collectErrors, doCoerce, stripUnknown
    } = runOpts;

    if (plan.refValidator === undefined) {
      return {
        'earlyExit': false,
        'valid': true,
        'value': workingValue
      };
    }

    const { refValidator } = plan;
    const refResult = refValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

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

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private runPlanStructure(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    let valid = true;

    if (isRecord(workingValue)) {
      const objResult = this.validateObjectPlan(plan, workingValue, path, errors, runOpts);

      if (objResult.earlyExit) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (!objResult.valid) {
        valid = false;
      }
    }

    if (Array.isArray(workingValue)) {
      const arrResult = this.validateArrayPlan(plan, workingValue, path, errors, runOpts);

      if (arrResult.earlyExit) {
        return {
          'earlyExit': true,
          'valid': false
        };
      }
      if (!arrResult.valid) {
        valid = false;
      }
    }

    return {
      'earlyExit': false,
      valid
    };
  }

  private runPlanStructureAndTail(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    initialValid: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    let valid = initialValid;
    const structResult = this.runPlanStructure(plan, workingValue, path, errors, runOpts);

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

    const tailResult = this.validatePlanTail(plan, workingValue, path, errors, runOpts);

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

  private validateArrayFields(
    arr: unknown[],
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    arrOpts: ArrayValidationOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean; } {
    const { collectErrors } = runOpts;
    const {
      containsCheck, maxContains, maxItems, minContains, minItems, uniqueItems
    } = arrOpts;

    if (!Arrays.validateBounds(path, arr, minItems, maxItems, uniqueItems, errors) && !collectErrors) {
      return {
        'earlyExit': true,
        'valid': false
      };
    }

    const itemsResult = this.validateArrayItemsAndPrefix(arr, path, errors, runOpts, arrOpts);

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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    arrOpts: ArrayValidationOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
      applyDefaults, collectErrors, doCoerce, stripUnknown
    } = runOpts;
    const {
      itemValidator, prefixValidators
    } = arrOpts;

    const validatePrefixItems = Arrays.validatePrefixItems;
    const prefixResult = validatePrefixItems(
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
        'earlyExit': true,
        'valid': false
      };
    }

    const validateItems = Arrays.validateItems;
    const itemsResult = validateItems(
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
    errors: ValidationErrorType[],
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

    return this.validateArrayFields(arr, path, errors, runOpts, arrOpts);
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
        errors.push(BaseError.validationError(childPath, 'EXTRA_FORBIDDEN', `must NOT have additional property '${key}'`));
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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    objOpts: ObjectValidationOptionsType
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const {
      applyDefaults, collectErrors, doCoerce, stripUnknown
    } = runOpts;
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip,
      jtExtra, patternPropValidators, propertyDefaults, propValidators
    } = objOpts;

    const prelude = this.validateObjectPrelude(obj, path, errors, runOpts, objOpts);

    if (prelude.earlyExit) {
      return {
        'count': 0,
        'earlyExit': true,
        'valid': false
      };
    }

    const effectiveStrip = jtExtra === 'allow' || jtExtra === 'forbid' ? false : stripUnknown;
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
      errors,
      collectErrors,
      applyDefaults,
      doCoerce,
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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'count': number;
    'earlyExit': boolean;
    'valid': boolean; } {
    const {
      additionalIsFalse, additionalValidator, allowedKeys, allowedKeysForStrip,
      jtExtra, maxProperties, minProperties, patternPropValidators, propertyAliases,
      propertyDefaults, propValidators, required
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
      propValidators,
      required
    };

    return this.validateObjectFields(obj, path, errors, runOpts, objOpts);
  }

  private validateObjectPrelude(
    obj: Record<string, unknown>,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType,
    objOpts: ObjectValidationOptionsType
  ): { 'earlyExit': boolean;
    'requiredValid': boolean } {
    const {
      applyDefaults, collectErrors
    } = runOpts;
    const {
      propertyAliases, propertyDefaults, required
    } = objOpts;

    if (propertyAliases.size > 0) {
      Objects.applyAliases(obj, propertyAliases);
    }

    if (applyDefaults) {
      Objects.applyDefaults(obj, propertyDefaults);
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
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown; } {
    const workingValue = this.applyPlanDefaults(initialValue, plan, runOpts);
    const earlyResult = this.runPlanRefAndScalars(plan, workingValue, path, errors, runOpts);

    if (earlyResult.earlyExit) {
      return earlyResult;
    }

    return this.runPlanStructureAndTail(plan, earlyResult.value, path, errors, runOpts, earlyResult.valid);
  }


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validatePlanDependent(
    plan: CompiledNodeValidationPlanType,
    workingValue: unknown,
    path: string,
    errors: ValidationErrorType[],
    runOpts: ValidationRunOptionsType
  ): { 'earlyExit': boolean;
    'valid': boolean;
    'value': unknown } {
    const {
      applyDefaults, collectErrors, doCoerce, stripUnknown
    } = runOpts;

    const { depRequiredEntries } = plan;
    const validateDepReq = Objects.validateDependentRequired;
    const depReqResult = validateDepReq(path, workingValue, depRequiredEntries, errors, collectErrors);

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
      errors,
      collectErrors,
      applyDefaults,
      doCoerce,
      stripUnknown
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
    const pnResult = Objects.validatePropertyNames(path, workingValue, propertyNamesValidator, errors, collectErrors);

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

  // ---------------------------------------------------------------------------
  // Check execution (inlined from SchemaCompilerCheckExec)
  // ---------------------------------------------------------------------------

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

  private validateStringPart(
    plan: CompiledNodeValidationPlanType,
    value: unknown,
    path: string,
    errors: ValidationErrorType[],
    collectErrors: boolean
  ): { 'earlyExit': boolean;
    'valid': boolean } {
    const {
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

    return {
      'earlyExit': false,
      'valid': true
    };
  }

  // ---------------------------------------------------------------------------
  // Validate execution (inlined from SchemaCompilerValidateExec)
  // ---------------------------------------------------------------------------

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
}
