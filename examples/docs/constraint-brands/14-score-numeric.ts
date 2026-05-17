import type { InferType } from '../../../src/types/index.js';

const ScoreSchema = {
  'maximum': 100,
  'minimum': 0,
  'type': 'number'
} as const;

type Score = InferType<typeof ScoreSchema>;
void 0 as unknown as Score;
