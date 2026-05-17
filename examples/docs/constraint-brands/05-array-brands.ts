import type { InferType } from '../../../src/types/index.js';

const TagSetSchema = {
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

type TagSet = InferType<typeof TagSetSchema>;
// readonly string[] & UniqueItemsBrandInterface

const NumberArraySchema = {
  'contains': { 'type': 'number' },
  'type': 'array'
} as const;

type NumberArray = InferType<typeof NumberArraySchema>;
// readonly number[] & ContainsBrandInterface<number>
void 0 as unknown as [TagSet, NumberArray];
