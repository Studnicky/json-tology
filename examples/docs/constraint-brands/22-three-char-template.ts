import type { InferType } from '../../../src/types/index.js';

const _ThreeCharSchema = {
  'maxLength': 3,
  'minLength': 3,
  'type': 'string'
} as const;

type ThreeChar = InferType<typeof _ThreeCharSchema>;
// `${string}${string}${string}` — exactly 3 characters
void 0 as unknown as ThreeChar;
