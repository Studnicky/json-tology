import type { CustomKeywordEntryType } from './CustomKeywordEntry.js';
import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';
import type { JtExtraType } from '../types/JtConfig.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntry.js';

export type CompiledNodeValidationPlanType = {
  readonly 'additionalIsFalse': boolean;
  readonly 'additionalValidator': undefined | ValidateWithErrorsFnType;
  readonly 'allOfValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'allowedKeys': Set<string> | undefined;
  readonly 'allowedKeysForStrip': Set<string> | undefined;
  readonly 'anyOfChecks': CheckFnType[] | undefined;
  readonly 'anyOfValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'complementCheck': CheckFnType | undefined;
  readonly 'constVal': unknown;
  readonly 'containsCheck': CheckFnType | undefined;
  readonly 'contentAssertionsEnabled': boolean;
  readonly 'contentEncoding': string | undefined;
  readonly 'contentMediaType': string | undefined;
  readonly 'customKeywordEntries': CustomKeywordEntryType[] | undefined;
  readonly 'defaultValue': unknown;
  readonly 'depRequiredEntries': Array<[string, string[]]>;
  readonly 'depSchemaValidators': Array<{ 'trigger': string;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  /** Compiled validator for `$dynamicRef`, or `undefined` if absent. */
  readonly 'dynamicRefValidator': undefined | ValidateWithErrorsFnType;
  /** Pre-built dynamic scope entry for `$dynamicAnchor` on this node, or `undefined` if absent. */
  readonly 'dynamicScopeEntry': DynamicScopeEntryType | undefined;
  readonly 'elseValidator': undefined | ValidateWithErrorsFnType;
  readonly 'enumSet': Set<boolean | null | number | string> | undefined;
  readonly 'enumValues': undefined | unknown[];
  readonly 'exclusiveMaximum': number | undefined;
  readonly 'exclusiveMinimum': number | undefined;
  readonly 'format': string | undefined;
  readonly 'formatValidator': ((value: unknown) => boolean) | undefined;
  readonly 'hasConst': boolean;
  readonly 'hasDefault': boolean;
  readonly 'ifCheck': CheckFnType | undefined;
  readonly 'itemValidator': undefined | ValidateWithErrorsFnType;
  readonly 'jtExtra': JtExtraType | undefined;
  readonly 'jtStrictPerField': Map<string, boolean> | undefined;
  readonly 'maxContains': number | undefined;
  readonly 'maximum': number | undefined;
  readonly 'maxItems': number | undefined;
  readonly 'maxLength': number | undefined;
  readonly 'maxProperties': number | undefined;
  readonly 'minContains': number | undefined;
  readonly 'minimum': number | undefined;
  readonly 'minItems': number | undefined;
  readonly 'minLength': number | undefined;
  readonly 'minProperties': number | undefined;
  readonly 'multipleOf': number | undefined;
  readonly 'oneOfChecks': CheckFnType[] | undefined;
  readonly 'oneOfValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'pattern': string | undefined;
  readonly 'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  readonly 'patternRegex': RegExp | undefined;
  readonly 'prefixValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'propertyAliases': Map<string, string>;
  readonly 'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  readonly 'propertyNamesValidator': undefined | ValidateWithErrorsFnType;
  readonly 'propValidators': Map<string, ValidateWithErrorsFnType>;
  readonly 'rdfsRangeValidator': undefined | ValidateWithErrorsFnType;
  readonly 'refValidator': undefined | ValidateWithErrorsFnType;
  readonly 'required': string[] | undefined;
  readonly 'thenValidator': undefined | ValidateWithErrorsFnType;
  readonly 'types': string[];
  /**
   * Compiled validator for `unevaluatedItems` node, or `false` when
   * `unevaluatedItems: false` (reject all), or `undefined` when absent.
   */
  readonly 'unevaluatedItemsValidator': false | undefined | ValidateWithErrorsFnType;
  /**
   * Compiled validator for `unevaluatedProperties` node, or `false` when
   * `unevaluatedProperties: false` (reject all), or `undefined` when absent.
   */
  readonly 'unevaluatedPropertiesValidator': false | undefined | ValidateWithErrorsFnType;
  readonly 'uniqueItems': boolean;
};
