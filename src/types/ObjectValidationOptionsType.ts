import type { ValidateWithErrorsFunctionType } from '../types/Validation.js';

/** Options passed to the object-fields validation helper. */
export type ObjectValidationOptionsType = {
  'additionalIsFalse': boolean;
  'additionalValidator': undefined | ValidateWithErrorsFunctionType;
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'jtExtra': 'allow' | 'forbid' | 'ignore' | undefined;
  'maxProperties': number | undefined;
  'minProperties': number | undefined;
  'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFunctionType; }> | undefined;
  'propertyAliases': Map<string, string>;
  'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  'propertyZeroValueSynthesizers': Map<string, () => unknown>;
  'propValidators': Map<string, ValidateWithErrorsFunctionType>;
  'required': string[] | undefined;
};
