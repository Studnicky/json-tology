import type { InferType } from '../../../src/types/index.js';

const EvenDiceSchema = {
  'maximum': 6,
  'minimum': 1,
  'multipleOf': 2,
  'type': 'integer'
} as const;

type EvenDice = InferType<typeof EvenDiceSchema>;
// 2 | 4 | 6
void 0 as unknown as EvenDice;
