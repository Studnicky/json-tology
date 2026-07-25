import type { CustomKeywordEntryType } from './CustomKeywordEntryType.js';
import type { ValidateWithErrorsFunctionType } from '../types/Validation.js';
import type { JtExtraType } from '../types/JtConfig.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntryType.js';
import type { ArrayValidationOptionsType } from './ArrayValidationOptionsType.js';
import type { ObjectValidationOptionsType } from './ObjectValidationOptionsType.js';

export type CompiledNodeValidationPlanType = {
  'additionalIsFalse': boolean;
  'additionalValidator': undefined | ValidateWithErrorsFunctionType;
  'allOfValidators': undefined | ValidateWithErrorsFunctionType[];
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'anyOfValidators': undefined | ValidateWithErrorsFunctionType[];
  /** Precomputed array validation options bag (compile-time constant from plan fields). */
  'arrOpts': ArrayValidationOptionsType;
  'complementValidator': undefined | ValidateWithErrorsFunctionType;
  'constVal': unknown;
  'containsValidator': undefined | ValidateWithErrorsFunctionType;
  'contentAssertionsEnabled': boolean;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'customKeywordEntries': CustomKeywordEntryType[] | undefined;
  'defaultValue': unknown;
  'depRequiredEntries': Array<[string, string[]]>;
  'depSchemaValidators': Array<{ 'trigger': string;
    'validator': ValidateWithErrorsFunctionType; }> | undefined;
  /** Compiled validator for `$dynamicRef`, or `undefined` if absent. */
  'dynamicRefValidator': undefined | ValidateWithErrorsFunctionType;
  /** Pre-built dynamic scope entry for `$dynamicAnchor` on this node, or `undefined` if absent. */
  'dynamicScopeEntry': DynamicScopeEntryType | undefined;
  'elseValidator': undefined | ValidateWithErrorsFunctionType;
  'enumSet': Set<boolean | null | number | string> | undefined;
  'enumValues': undefined | unknown[];
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'format': string | undefined;
  'formatValidator': ((value: unknown) => boolean) | undefined;
  'hasConst': boolean;
  'hasDefault': boolean;
  'ifValidator': undefined | ValidateWithErrorsFunctionType;
  'itemValidator': undefined | ValidateWithErrorsFunctionType;
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
  'oneOfValidators': undefined | ValidateWithErrorsFunctionType[];
  'pattern': string | undefined;
  'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFunctionType; }> | undefined;
  'patternRegex': RegExp | undefined;
  'prefixValidators': undefined | ValidateWithErrorsFunctionType[];
  'propertyAliases': Map<string, string>;
  'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  'propertyNamesValidator': undefined | ValidateWithErrorsFunctionType;
  'propertyZeroValueSynthesizers': Map<string, () => unknown>;
  'propValidators': Map<string, ValidateWithErrorsFunctionType>;
  'rdfsRangeValidator': undefined | ValidateWithErrorsFunctionType;
  'refValidator': undefined | ValidateWithErrorsFunctionType;
  'required': string[] | undefined;
  'thenValidator': undefined | ValidateWithErrorsFunctionType;
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
  'unevaluatedItemsValidator': false | undefined | ValidateWithErrorsFunctionType;
  /**
   * Compiled validator for `unevaluatedProperties` node, or `false` when
   * `unevaluatedProperties: false` (reject all), or `undefined` when absent.
   */
  'unevaluatedPropertiesValidator': false | undefined | ValidateWithErrorsFunctionType;
  'uniqueItems': boolean;
};
