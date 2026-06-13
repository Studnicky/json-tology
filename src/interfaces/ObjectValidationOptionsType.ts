import type { ValidateWithErrorsFnType } from '../types/Validation.js';

/** Options passed to the object-fields validation helper. */
export interface ObjectValidationOptionsType {
  'additionalIsFalse': boolean;
  'additionalValidator': undefined | ValidateWithErrorsFnType;
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'jtExtra': 'allow' | 'forbid' | 'ignore' | undefined;
  'maxProperties': number | undefined;
  'minProperties': number | undefined;
  'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFnType; }> | undefined;
  'propertyAliases': Map<string, string>;
  'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  'propValidators': Map<string, ValidateWithErrorsFnType>;
  'required': string[] | undefined;
}
