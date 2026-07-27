import type { CustomKeywordEntryInterface } from './CustomKeywordEntryInterface.js';
import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';
import type { JtExtraEntity } from '../entities/JtExtraEntity.js';
import type { DynamicScopeEntryInterface } from './DynamicScopeEntryInterface.js';
import type { ArrayValidationOptionsInterface } from './ArrayValidationOptionsInterface.js';
import type { ObjectValidationOptionsInterface } from './ObjectValidationOptionsInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';

export interface CompiledNodeValidationPlanInterface {
  'additionalIsFalse': BooleanValueEntity.Type;
  'additionalValidator': undefined | ValidateWithErrorsFunctionInterface;
  'allOfValidators': undefined | ValidateWithErrorsFunctionInterface[];
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'anyOfValidators': undefined | ValidateWithErrorsFunctionInterface[];
  /** Precomputed array validation options bag (compile-time constant from plan fields). */
  'arrOpts': ArrayValidationOptionsInterface;
  'complementValidator': undefined | ValidateWithErrorsFunctionInterface;
  'constVal': unknown;
  'containsValidator': undefined | ValidateWithErrorsFunctionInterface;
  'contentAssertionsEnabled': BooleanValueEntity.Type;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'customKeywordEntries': CustomKeywordEntryInterface[] | undefined;
  'defaultValue': unknown;
  'depRequiredEntries': Array<[string, string[]]>;
  'depSchemaValidators': Array<{ 'trigger': string;
    'validator': ValidateWithErrorsFunctionInterface; }> | undefined;
  /** Compiled validator for `$dynamicRef`, or `undefined` if absent. */
  'dynamicRefValidator': undefined | ValidateWithErrorsFunctionInterface;
  /** Pre-built dynamic scope entry for `$dynamicAnchor` on this node, or `undefined` if absent. */
  'dynamicScopeEntry': DynamicScopeEntryInterface | undefined;
  'elseValidator': undefined | ValidateWithErrorsFunctionInterface;
  'enumSet': Set<boolean | null | number | string> | undefined;
  'enumValues': undefined | unknown[];
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'format': string | undefined;
  'formatValidator': ((value: unknown) => boolean) | undefined;
  'hasConst': BooleanValueEntity.Type;
  'hasDefault': BooleanValueEntity.Type;
  'ifValidator': undefined | ValidateWithErrorsFunctionInterface;
  'itemValidator': undefined | ValidateWithErrorsFunctionInterface;
  'jtExtra': JtExtraEntity.Type | undefined;
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
  'objOpts': ObjectValidationOptionsInterface;
  'oneOfValidators': undefined | ValidateWithErrorsFunctionInterface[];
  'pattern': string | undefined;
  'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFunctionInterface; }> | undefined;
  'patternRegex': RegExp | undefined;
  'prefixValidators': undefined | ValidateWithErrorsFunctionInterface[];
  'propertyAliases': Map<string, string>;
  'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  'propertyNamesValidator': undefined | ValidateWithErrorsFunctionInterface;
  'propertyZeroValueSynthesizers': Map<string, () => unknown>;
  'propValidators': Map<string, ValidateWithErrorsFunctionInterface>;
  'rdfsRangeValidator': undefined | ValidateWithErrorsFunctionInterface;
  'refValidator': undefined | ValidateWithErrorsFunctionInterface;
  'required': string[] | undefined;
  'thenValidator': undefined | ValidateWithErrorsFunctionInterface;
  /**
   * Precompiled type predicate (compile-time constant).
   * - `undefined` when `types` is empty (no type constraint).
   * - For single-type schemas: a monomorphic `(v) => boolean` avoiding Map.get dispatch.
   * - For multi-type schemas: a multi-matcher that chains the per-type predicates.
   */
  'typePredicate': ((v: unknown) => boolean) | undefined;
  'types': StringArrayEntity.Type;
  /**
   * Compiled validator for `unevaluatedItems` node, or `undefined` when
   * absent. When `unevaluatedItems: false` (reject all), this is a validator
   * that always fails — see `UnevaluatedRejectValidator` in
   * `SchemaCompilerPlan.ts` — rather than the sentinel `false`, so this field
   * never mixes a callable constituent with a data one.
   */
  'unevaluatedItemsValidator': undefined | ValidateWithErrorsFunctionInterface;
  /**
   * Compiled validator for `unevaluatedProperties` node, or `undefined` when
   * absent. Same reject-all-as-validator convention as
   * {@link CompiledNodeValidationPlanInterface.unevaluatedItemsValidator}.
   */
  'unevaluatedPropertiesValidator': undefined | ValidateWithErrorsFunctionInterface;
  'uniqueItems': BooleanValueEntity.Type;
}
