import type { InferType } from '../../../src/types/index.js';

const _ThreeCharSchema = {
  'maxLength': 3,
  'minLength': 3,
  'type': 'string'
} as const;

type ThreeChar = InferType<typeof _ThreeCharSchema>;
// `${string}${string}${string}` — exactly 3 characters

// A 3-character literal satisfies the template literal type.
const code: ThreeChar = 'ABC' as ThreeChar;

console.log('ThreeChar value:', code);

// The inferred type requires tightStringLengths opt-in; log the schema bounds.
console.log('minLength:', _ThreeCharSchema.minLength, 'maxLength:', _ThreeCharSchema.maxLength);
