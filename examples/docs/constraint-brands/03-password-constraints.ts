import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const PasswordSchema = {
  '$id': 'urn:brands:Password',
  'maxLength': 128,
  'minLength': 8,
  'pattern': '^(?=.*[A-Z])(?=.*[0-9])',
  'type': 'string'
} as const;

type Password = InferType<typeof PasswordSchema>;
// string & MinLengthBrandType<8> & MaxLengthBrandType<128> & PatternBrandType<'^(?=.*[A-Z])(?=.*[0-9])'>

const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [PasswordSchema]
});

// Valid password: meets minLength 8, has uppercase and digit.
const pw: Password = jt.instantiate(PasswordSchema.$id, 'Secret42!');

console.log('Branded password value:', pw);
console.log('Branded password is string:', typeof pw === 'string');

// Validation rejects a plain string that fails the pattern.
const errors = JsonTology.validate(PasswordSchema, 'weak');

console.log('Validation errors for "weak":', errors.items.map((err) => {
  return err.message;
}));
