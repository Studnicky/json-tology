import type { InferType } from '../../../src/types/index.js';

const _ScoreSchema = {
  'maximum': 100,
  'minimum': 0,
  'type': 'number'
} as const;

type Score = InferType<typeof _ScoreSchema>;
void 0 as unknown as Score;
