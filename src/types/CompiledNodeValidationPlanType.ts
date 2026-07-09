import type { CustomKeywordEntryType } from './CustomKeywordEntryType.js';
import type { ValidateWithErrorsFnType } from '../types/Validation.js';
import type { JtExtraType } from '../types/JtConfig.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntryType.js';
import type { ArrayValidationOptionsType } from './ArrayValidationOptionsType.js';
import type { ObjectValidationOptionsType } from './ObjectValidationOptionsType.js';

export type CompiledNodeValidationPlanType = {
  'additionalIsFalse': boolean;
  'additionalValidator': undefined | ValidateWithErrorsFnType;
  'allOfValidators': undefined | ValidateWithErrorsFnType[];
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'anyOfValidators': undefined | ValidateWithErrorsFnType[];
  /** Precomputed array validation options bag (compile-time constant from plan fields). */
  'arrOpts': ArrayValidationOptionsType;
  'complementValidator': undefined | ValidateWithErrorsFnType;
  'constVal': unknown;
  'containsValidator': undefined | ValidateWithErrorsFnType;
  'contentAssertionsEnabled': boolean;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'customKeywordEntries': CustomKeywordEntryType[] | undefined;
  'defaultValue': unknown;
  'depRequiredEntries': Array<[string, string[]]>;
  'depSchemaValidators': Array<{ 'trigger': string;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  /** Compiled validator for `$dynamicRef`, or `undefined` if absent. */
  'dynamicRefValidator': undefined | ValidateWithErrorsFnType;
  /** Pre-built dynamic scope entry for `$dynamicAnchor` on this node, or `undefined` if absent. */
  'dynamicScopeEntry': DynamicScopeEntryType | undefined;
  'elseValidator': undefined | ValidateWithErrorsFnType;
  'enumSet': Set<boolean | null | number | string> | undefined;
  'enumValues': undefined | unknown[];
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'format': string | undefined;
  'formatValidator': ((value: unknown) => boolean) | undefined;
  'hasConst': boolean;
  'hasDefault': boolean;
  'ifValidator': undefined | ValidateWithErrorsFnType;
  'itemValidator': undefined | ValidateWithErrorsFnType;
  'jtExtra': JtExtraType | undefined;
  'jtStrictPerField': Map<string, boolean> | undefined;
  'maxContains': number | undefined;
  'maximum': number | undefined;
  'maxItems': number | undefined;
  'maxLength': number | undefined;
  'maxProperties': number | undefined;
  'minContains': number | undefined;
  'minimum': number | undefined;
  'minItems': number | undefined;
  'minLength': number | undefined;
  'minProperties': number | undefined;
  'multipleOf': number | undefined;
  /** Precomputed object validation options bag (compile-time constant from plan fields). */
  'objOpts': ObjectValidationOptionsType;
  'oneOfValidators': undefined | ValidateWithErrorsFnType[];
  'pattern': string | undefined;
  'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  'patternRegex': RegExp | undefined;
  'prefixValidators': undefined | ValidateWithErrorsFnType[];
  'propertyAliases': Map<string, string>;
  'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  'propertyNamesValidator': undefined | ValidateWithErrorsFnType;
  'propertyZeroValueSynthesizers': Map<string, () => unknown>;
  'propValidators': Map<string, ValidateWithErrorsFnType>;
  'rdfsRangeValidator': undefined | ValidateWithErrorsFnType;
  'refValidator': undefined | ValidateWithErrorsFnType;
  'required': string[] | undefined;
  'thenValidator': undefined | ValidateWithErrorsFnType;
  /**
   * Precompiled type predicate (compile-time constant).
   * - `undefined` when `types` is empty (no type constraint).
   * - For single-type schemas: a monomorphic `(v) => boolean` avoiding Map.get dispatch.
   * - For multi-type schemas: a multi-matcher that chains the per-type predicates.
   */
  'typePredicate': ((v: unknown) => boolean) | undefined;
  'types': string[];
  /**
   * Compiled validator for `unevaluatedItems` node, or `false` when
   * `unevaluatedItems: false` (reject all), or `undefined` when absent.
   */
  'unevaluatedItemsValidator': false | undefined | ValidateWithErrorsFnType;
  /**
   * Compiled validator for `unevaluatedProperties` node, or `false` when
   * `unevaluatedProperties: false` (reject all), or `undefined` when absent.
   */
  'unevaluatedPropertiesValidator': false | undefined | ValidateWithErrorsFnType;
  'uniqueItems': boolean;
};
