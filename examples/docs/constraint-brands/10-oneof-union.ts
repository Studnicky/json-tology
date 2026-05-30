import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const IdSchema = {
  '$id': 'urn:brands:Id',
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

const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [IdSchema]
});

// oneOf preserves each branch's brand independently as a union.
const stringId: Id = jt.instantiate(IdSchema.$id, '550e8400-e29b-41d4-a716-446655440000');
const numberId: Id = jt.instantiate(IdSchema.$id, 42);

console.log('String branch (uuid brand):', stringId);
console.log('Number branch (minimum 1 brand):', numberId);
