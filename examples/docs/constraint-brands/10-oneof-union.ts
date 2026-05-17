import type { InferType } from '../../../src/types/index.js';

const IdSchema = {
  'oneOf': [
    {
      'format': 'uuid',
      'type': 'string'
    },
    {
      'minimum': 1,
      'type': 'number'
    }
  ]
} as const;

type Id = InferType<typeof IdSchema>;
// (string & FormatBrandInterface<'uuid'>) | (number & MinimumBrandInterface<1>)
void 0 as unknown as Id;
