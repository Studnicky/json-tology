import type { InferType } from '../../../src/types/index.js';

const _OneToThreeSchema = {
  'maxLength': 3,
  'minLength': 1,
  'type': 'string'
} as const;

type OneToThree = InferType<typeof _OneToThreeSchema>;
// `${string}` | `${string}${string}` | `${string}${string}${string}`

// Each length within the 1..3 bound produces a separate template literal member.
const one: OneToThree = 'A' as OneToThree;
const two: OneToThree = 'AB' as OneToThree;
const three: OneToThree = 'ABC' as OneToThree;

console.log('1-char member:', one);
console.log('2-char member:', two);
console.log('3-char member:', three);
console.log('minLength:', _OneToThreeSchema.minLength, 'maxLength:', _OneToThreeSchema.maxLength);
