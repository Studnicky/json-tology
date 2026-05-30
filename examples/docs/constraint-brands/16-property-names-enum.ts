import type {
  InferType, ValidationErrorType
} from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const ConfigSchema = {
  '$id': 'urn:brands:Config',
  'additionalProperties': { 'type': 'string' },
  'propertyNames': {
    'enum': [
      'host',
      'port',
      'debug'
    ]
  },
  'type': 'object'
} as const;

type Config = InferType<typeof ConfigSchema>;
// { readonly host?: string; readonly port?: string; readonly debug?: string }

// The inferred type only permits the three enum keys.
const config: Config = {
  'host': 'localhost',
  'port': '8080'
};

console.log('Config with narrowed keys:', config);

// An unknown key fails runtime validation.
const unknownKeyErrors = JsonTology.validate(ConfigSchema, { 'timeout': '30' });

console.log('Errors for unknown key "timeout":', unknownKeyErrors.items.map((err: ValidationErrorType) => {
  return err.message;
}));
