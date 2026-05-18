import type { InferType } from '../../../src/types/index.js';

const _TagSetSchema = {
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

type TagSet = InferType<typeof _TagSetSchema>;
// readonly string[] & UniqueItemsBrandInterface

const _NumberArraySchema = {
  'contains': { 'type': 'number' },
  'type': 'array'
} as const;

type NumberArray = InferType<typeof _NumberArraySchema>;
// readonly number[] & ContainsBrandInterface<number>
void 0 as unknown as [TagSet, NumberArray];
