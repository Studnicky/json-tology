import type { InferType } from '../../../src/types/index.js';

const ThreeCharSchema = {
  'maxLength': 3,
  'minLength': 3,
  'type': 'string'
} as const;

type ThreeChar = InferType<typeof ThreeCharSchema>;
// `${string}${string}${string}` — exactly 3 characters
void 0 as unknown as ThreeChar;
