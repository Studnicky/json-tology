/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type { ValidationErrorSchema } from '../constants/SCHEMAS.js';
import type { CustomKeywordEntryType } from '../types/CustomKeywordEntry.js';
import type { ExecContextType } from '../types/ExecContext.js';

export type { AllowedKeysResultType } from '../types/AllowedKeysResult.js';

import type { PatternPropCheckEntryType } from '../types/PatternPropCheckEntry.js';
import type { PatternPropValidatorEntryType } from '../types/PatternPropValidatorEntry.js';
import type { DependentSchemaValidatorEntryType } from '../types/DependentSchemaValidatorEntry.js';
import type { RefTargetType } from '../types/RefTarget.js';

export type { CompositionValidatorsResultType } from '../types/CompositionValidatorsResult.js';
export type { ConditionalValidatorsResultType } from '../types/ConditionalValidatorsResult.js';
export type { DependentSchemaValidatorEntryType } from '../types/DependentSchemaValidatorEntry.js';
export type { ExecContextType } from '../types/ExecContext.js';
export type { KeyPatternCheckResultType } from '../types/KeyPatternCheckResult.js';
export type { PatternPropCheckEntryType } from '../types/PatternPropCheckEntry.js';
export type { PatternPropValidatorEntryType } from '../types/PatternPropValidatorEntry.js';
export type { PlanArrayValidatorsType } from '../types/PlanArrayValidators.js';

/**
 * A predicate function that tests a single value for schema compliance.
 *
 * @remarks
 * Used throughout the validation engine as the fast-path check type.
 * Returns `true` when the value satisfies the compiled constraint and `false`
 * otherwise. Receives `unknown` so callers need not narrow before passing.
 *
 * @example
 * ```ts
 * const isString: CheckFnType = (value: unknown) => typeof value === 'string';
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link OptionalCheckFnType}
 * @group Validation
 */
export type CheckFnType = (value: unknown) => boolean;

/**
 * Result of a boolean coercion attempt — `undefined` when the value is unrecognised.
 *
 * @remarks
 * Returned by the boolean coercion path of the validation engine.
 * `undefined` signals that the value could not be interpreted as a boolean
 * (e.g. an object or symbol), distinct from `false` which is a valid result.
 *
 * @example
 * ```ts
 * const result: CoerceToBooleanResultType = coerceBoolean('true'); // true
 * const unknown: CoerceToBooleanResultType = coerceBoolean({}); // undefined
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CoerceToNumberResultType}
 * @group Validation
 */
export type CoerceToBooleanResultType = boolean | undefined;

/**
 * Result of a numeric coercion attempt — `undefined` when the value is not finite.
 *
 * @remarks
 * Returned by the numeric coercion path of the validation engine.
 * `undefined` signals that the value could not be coerced to a finite number
 * (e.g. `NaN`, `Infinity`, or a non-numeric string), distinct from `0`.
 *
 * @example
 * ```ts
 * const result: CoerceToNumberResultType = coerceNumber('42'); // 42
 * const bad: CoerceToNumberResultType = coerceNumber('abc'); // undefined
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CoerceToBooleanResultType}
 * @group Validation
 */
export type CoerceToNumberResultType = number | undefined;

/**
 * A check function or `undefined` when no check applies for the node.
 *
 * @remarks
 * Used in compiled validation plans to represent an optional fast-path predicate.
 * When `undefined`, the validation engine skips the corresponding fast-path branch
 * and falls through to the full validator.
 *
 * @example
 * ```ts
 * const check: OptionalCheckFnType = node.hasMinLength ? compiledCheck : undefined;
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CheckFnType}
 * @group Validation
 */
export type OptionalCheckFnType = CheckFnType | undefined;

/**
 * Named result type for custom keyword entry collections.
 *
 * @remarks
 * Returned by custom keyword registry lookups. `undefined` signals that no
 * custom keyword entries are registered for the node, allowing callers to
 * skip custom keyword processing entirely.
 *
 * @example
 * ```ts
 * const entries: CustomKeywordEntriesResultType = registry.getEntries(node);
 * if (entries !== undefined) { /* process entries *\/ }
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link OptionalCheckFnType}
 * @group Validation
 */
export type CustomKeywordEntriesResultType = CustomKeywordEntryType[] | undefined;

/**
 * A single error entry in an RFC 7807 Problem Details response.
 *
 * @remarks
 * Each entry describes one validation failure: the JSON Schema keyword that
 * triggered it, a human-readable message, structured keyword-specific
 * parameters, and the JSON Pointer path to the offending value.
 *
 * @example
 * ```ts
 * const entry: ProblemDetailsErrorEntryType = {
 *   keyword: 'minLength',
 *   message: 'must be at least 3 characters',
 *   params: { limit: 3 },
 *   path: '/username',
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ProblemDetailsType}
 * @group Validation
 */
export type ProblemDetailsErrorEntryType = {
  'keyword': string;
  'message': string;
  'params': Record<string, unknown>;
  'path': string;
};


/**
 * Aggregate summary of all validation errors for a single value.
 *
 * @remarks
 * Provides a denormalised view of the error collection: the total failure
 * count, the distinct keywords that fired, and the distinct JSON Pointer paths
 * that failed. Consumers can use this for quick dashboard-style reporting
 * without iterating individual error entries.
 *
 * @example
 * ```ts
 * const view: AggregateViewType = {
 *   count: 3,
 *   keywords: ['minLength', 'pattern'],
 *   paths: ['/username', '/email'],
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ProblemDetailsType}
 * @group Validation
 */
export type AggregateViewType = {
  'count': number;
  'keywords': string[];
  'paths': string[];
};

/**
 * RFC 7807 Problem Details response shape for validation failures.
 *
 * @remarks
 * Returned by `JsonTology.validate` and related methods when validation fails.
 * The `type` field identifies the error category as a URI, `status` mirrors
 * an HTTP status code (typically 422), `title` is a short human-readable
 * summary, `detail` elaborates the failure, `instance` (optional) is the JSON
 * Pointer to the root value, and `errors` lists individual keyword failures.
 *
 * @example
 * ```ts
 * const problem: ProblemDetailsType = {
 *   type: 'https://json-tology.dev/errors/validation',
 *   status: 422,
 *   title: 'Validation Failed',
 *   detail: '2 errors found',
 *   errors: [{ keyword: 'required', message: "must have 'id'", params: {}, path: '' }],
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ProblemDetailsErrorEntryType}
 * @group Validation
 */
export type ProblemDetailsType = {
  'detail': string;
  'errors': ProblemDetailsErrorEntryType[];
  'instance'?: string;
  'status': number;
  'title': string;
  'type': string;
};

/**
 * The TypeScript type inferred from `ValidationErrorSchema`.
 *
 * @remarks
 * Describes a single validation error record as produced by the compiled
 * validator: the JSON Schema `keyword` that fired, a `message`, structured
 * `params`, and the `instancePath` (JSON Pointer) to the offending value.
 * The shape is derived from the canonical schema constant so it stays in sync
 * with the runtime representation.
 *
 * @example
 * ```ts
 * const err: ValidationErrorType = {
 *   keyword: 'type',
 *   message: 'must be string',
 *   params: { type: 'string' },
 *   instancePath: '/name',
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ValidateWithErrorsFnType}
 * @group Validation
 */
export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;

/**
 * Named result type returned by every validate-with-errors call — validity flag and (potentially mutated) value.
 *
 * @remarks
 * When `applyDefaults`, `doCoerce`, or `stripUnknown` flags are set, the
 * validator may mutate or replace the value in place. Callers must use the
 * returned `value` rather than the original argument after the call.
 *
 * @example
 * ```ts
 * const result: ValidateWithErrorsResultType = validator(input, '', errors, true, true, false, false);
 * if (result.valid) { use(result.value); }
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ValidateWithErrorsFnType}
 * @group Validation
 */
export type ValidateWithErrorsResultType = {
  'valid': boolean;
  'value': unknown;
};

/**
 * The compiled validator function signature used throughout the validation engine.
 *
 * @remarks
 * Every schema node compiles to a function matching this signature. All
 * execution flags (collectErrors, applyDefaults, doCoerce, stripUnknown) are
 * bundled in the `ExecContextType` context object. The context also carries
 * the accumulated error list, ref-cycle guard stack, and dynamic scope.
 *
 * @example
 * ```ts
 * const validate: ValidateWithErrorsFnType = registry.compile(schema);
 * const ctx: ExecContextType = { errors: [], collectErrors: true, applyDefaults: false, doCoerce: false, stripUnknown: false, refStack: new Set(), dynamicScope: [], evaluatedItems: undefined, evaluatedProperties: undefined, depth: 0, maxDepth: 100 };
 * const { valid } = validate(data, '', ctx);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link OptionalValidateWithErrorsFnType}
 * @group Validation
 */
export type ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  ctx: ExecContextType
) => ValidateWithErrorsResultType;

/**
 * A validate-with-errors function or `undefined` when no validator applies.
 *
 * @remarks
 * Used in compiled validation plans to represent an optional branch validator.
 * When `undefined`, the validation engine skips the corresponding branch
 * (e.g. a missing `then` or `else` clause).
 *
 * @example
 * ```ts
 * const thenValidator: OptionalValidateWithErrorsFnType = hasThen ? compileFn(thenSchema) : undefined;
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ValidateWithErrorsFnType}
 * @group Validation
 */
export type OptionalValidateWithErrorsFnType = undefined | ValidateWithErrorsFnType;

/**
 * A map from property name to its compiled validator function.
 *
 * @remarks
 * Built once per object schema node during compilation. Keyed by property name
 * as it appears in the JSON Schema `properties` object. At validation time the
 * engine looks up each property's validator in O(1) and invokes it.
 *
 * @example
 * ```ts
 * const map: PropValidatorsMapType = new Map([['id', idValidator], ['name', nameValidator]]);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ObjectPropValidatorsMapType}
 * @group Validation
 */
export type PropValidatorsMapType = Map<string, ValidateWithErrorsFnType>;

/**
 * A map from property name to its default value descriptor.
 *
 * @remarks
 * Built once per object schema node. Each entry carries `hasDefault` (whether
 * a schema-declared default exists) and `defaultValue` (the default value).
 * When `applyDefaults` is enabled the engine iterates this map to fill missing
 * properties before further validation.
 *
 * @example
 * ```ts
 * const defaults: PropertyDefaultsMapType = new Map([
 *   ['active', { hasDefault: true, defaultValue: true }],
 * ]);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PropValidatorsMapType}
 * @group Validation
 */
export type PropertyDefaultsMapType = Map<string, { 'defaultValue': unknown;
  'hasDefault': boolean; }>;

/**
 * A map from property name to its `jtStrict` override flag — `undefined` when no field-level overrides exist.
 *
 * @remarks
 * When `undefined`, strict-mode behaviour is determined by the top-level
 * `JtConfig.strict` option. When present, individual property entries override
 * that default, allowing fine-grained control over which fields must be
 * exactly typed.
 *
 * @example
 * ```ts
 * const overrides: JtStrictPerFieldMapType = new Map([['payload', false]]);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PropValidatorsMapType}
 * @group Validation
 */
export type JtStrictPerFieldMapType = Map<string, boolean> | undefined;

/**
 * A set of inherited property key names collected from `allOf` traversal.
 *
 * @remarks
 * Populated during compilation of object schemas that use `allOf` composition.
 * The engine uses this set to determine which properties are inherited from
 * ancestor schemas so that `additionalProperties` and `unevaluatedProperties`
 * can be evaluated correctly.
 *
 * @example
 * ```ts
 * const inherited: InheritedPropertyKeySetType = new Set(['id', 'createdAt']);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ConditionalPropertyKeySetType}
 * @group Validation
 */
export type InheritedPropertyKeySetType = Set<string>;

/**
 * A set of conditional branch property key names from `if`/`then`/`else` traversal.
 *
 * @remarks
 * Populated during compilation of object schemas that use `if`/`then`/`else`.
 * The engine uses this set to exclude conditional-branch properties from
 * `additionalProperties` checks, preventing false negatives when a property
 * is only declared inside a conditional branch.
 *
 * @example
 * ```ts
 * const conditional: ConditionalPropertyKeySetType = new Set(['discountRate']);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link InheritedPropertyKeySetType}
 * @group Validation
 */
export type ConditionalPropertyKeySetType = Set<string>;

/**
 * A map from property name to its fast-path compiled check function.
 *
 * @remarks
 * The fast-path check is a lightweight boolean predicate that avoids allocating
 * an error array. Used when `collectErrors` is `false` and only a pass/fail
 * result is needed, improving throughput for high-frequency validation calls.
 *
 * @example
 * ```ts
 * const checks: ObjectPropValidatorsMapType = new Map([['id', isString]]);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PropValidatorsMapType}
 * @group Validation
 */
export type ObjectPropValidatorsMapType = Map<string, CheckFnType>;

/**
 * An optional list of pattern-property check entries.
 *
 * @remarks
 * `undefined` when the schema declares no `patternProperties`, allowing the
 * validation engine to skip the pattern-property fast-path branch entirely
 * without iterating an empty array.
 *
 * @example
 * ```ts
 * const checks: PatternPropChecksResultType = schema.patternProperties
 *   ? compilePatternChecks(schema.patternProperties)
 *   : undefined;
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PatternPropCheckEntryType}
 * @group Validation
 */
export type PatternPropChecksResultType = PatternPropCheckEntryType[] | undefined;

/**
 * The set of primitive enum values compiled to a `Set` for O(1) membership testing.
 *
 * @remarks
 * `undefined` when the schema declares no `enum` or the enum contains only
 * non-primitive values (which require deep equality and are handled separately).
 * When present, the fast-path check uses `Set.has` to test membership before
 * falling through to the full enum validator.
 *
 * @example
 * ```ts
 * const primitives: EnumPrimitiveSetType = new Set(['red', 'green', 'blue']);
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PatternPropChecksResultType}
 * @group Validation
 */
export type EnumPrimitiveSetType = Set<boolean | null | number | string> | undefined;

/**
 * An optional list of pattern-property validator entries.
 *
 * @remarks
 * `undefined` when the schema declares no `patternProperties`, allowing the
 * validation engine to skip the full pattern-property validation path when
 * `collectErrors` is `true`.
 *
 * @example
 * ```ts
 * const validators: PatternPropValidatorsResultType = schema.patternProperties
 *   ? compilePatternValidators(schema.patternProperties)
 *   : undefined;
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PatternPropValidatorEntryType}
 * @group Validation
 */
export type PatternPropValidatorsResultType = PatternPropValidatorEntryType[] | undefined;

/**
 * An optional list of dependent-schema validator entries.
 *
 * @remarks
 * `undefined` when the schema declares no `dependentSchemas`, allowing the
 * validation engine to skip dependent-schema processing entirely.
 *
 * @example
 * ```ts
 * const deps: DependentSchemaValidatorsResultType = schema.dependentSchemas
 *   ? compileDependentSchemas(schema.dependentSchemas)
 *   : undefined;
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link DependentSchemaValidatorEntryType}
 * @group Validation
 */
export type DependentSchemaValidatorsResultType = DependentSchemaValidatorEntryType[] | undefined;

/**
 * Optional branch ref result — `undefined` when the `$ref` cannot be resolved.
 *
 * @remarks
 * The resolver returns `undefined` when a `$ref` target is not registered,
 * allowing the validation engine to emit a `REF_UNRESOLVED` error rather than
 * throwing unconditionally.
 *
 * @example
 * ```ts
 * const result: BranchRefResultType = resolver.resolve(ref);
 * if (result === undefined) { errors.push({ keyword: '$ref', ... }); }
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link BranchRefResultType}
 * @group Validation
 */
export type BranchRefResultType = RefTargetType | undefined;

/**
 * Filtered `dependentRequired` entries — only those with non-empty value arrays.
 *
 * @remarks
 * Produced during compilation of `dependentRequired` schema keywords. Each
 * tuple is `[triggerProperty, requiredProperties[]]`. Entries with an empty
 * required-properties array are filtered out during compilation to avoid
 * redundant iteration at validation time.
 *
 * @example
 * ```ts
 * const entries: DepRequiredEntriesType = [
 *   ['creditCard', ['billingAddress', 'cvv']],
 * ];
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link DependentSchemaValidatorsResultType}
 * @group Validation
 */
export type DepRequiredEntriesType = Array<[string, string[]]>;
