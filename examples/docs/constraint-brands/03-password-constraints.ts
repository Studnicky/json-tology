import type { InferType } from '../../../src/types/index.js';

const PasswordSchema = {
  'maxLength': 128,
  'minLength': 8,
  'pattern': '^(?=.*[A-Z])(?=.*[0-9])',
  'type': 'string'
} as const;

type Password = InferType<typeof PasswordSchema>;
// string & MinLengthBrandInterface<8> & MaxLengthBrandInterface<128> & PatternBrandInterface<'^(?=.*[A-Z])(?=.*[0-9])'>

const raw = 'hello';
const pw: Password = raw; // compile error  - must go through validation

void 0 as unknown as typeof pw;
