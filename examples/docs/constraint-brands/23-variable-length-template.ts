import type { InferType } from '../../../src/types/index.js';

const _OneToThreeSchema = {
  'maxLength': 3,
  'minLength': 1,
  'type': 'string'
} as const;

type OneToThree = InferType<typeof _OneToThreeSchema>;
// `${string}` | `${string}${string}` | `${string}${string}${string}`
void 0 as unknown as OneToThree;
