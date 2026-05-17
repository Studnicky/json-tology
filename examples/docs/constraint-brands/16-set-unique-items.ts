import type { InferType } from '../../../src/types/index.js';

const SetSchema = {
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

type Set = InferType<typeof SetSchema>;
void 0 as unknown as Set;
