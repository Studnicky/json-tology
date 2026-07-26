import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';

/** Options passed to the object-fields validation helper. */
export interface ObjectValidationOptionsInterface {
  'additionalIsFalse': BooleanValueEntity.Type;
  'additionalValidator': undefined | ValidateWithErrorsFunctionInterface;
  'allowedKeys': Set<string> | undefined;
  'allowedKeysForStrip': Set<string> | undefined;
  'jtExtra': 'allow' | 'forbid' | 'ignore' | undefined;
  'maxProperties': number | undefined;
  'minProperties': number | undefined;
  'patternPropValidators': Array<{ 'regex': RegExp;
    'validator': ValidateWithErrorsFunctionInterface; }> | undefined;
  'propertyAliases': Map<string, string>;
  'propertyDefaults': Map<string, { 'defaultValue': unknown;
    'hasDefault': boolean; }>;
  'propertyZeroValueSynthesizers': Map<string, () => unknown>;
  'propValidators': Map<string, ValidateWithErrorsFunctionInterface>;
  'required': string[] | undefined;
}
