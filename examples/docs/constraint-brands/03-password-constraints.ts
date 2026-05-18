import type { InferType } from '../../../src/types/index.js';

const _PasswordSchema = {
  'maxLength': 128,
  'minLength': 8,
  'pattern': '^(?=.*[A-Z])(?=.*[0-9])',
  'type': 'string'
} as const;

type Password = InferType<typeof _PasswordSchema>;
// string & MinLengthBrandInterface<8> & MaxLengthBrandInterface<128> & PatternBrandInterface<'^(?=.*[A-Z])(?=.*[0-9])'>

const raw = 'hello';
// compile error - must go through validation
const _pw: Password = raw as unknown as Password;

void 0 as unknown as typeof _pw;
