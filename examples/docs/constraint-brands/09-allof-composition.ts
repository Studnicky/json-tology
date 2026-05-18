import type { InferType } from '../../../src/types/index.js';

const _ValidatedEmail = {
  'allOf': [
    {
      'format': 'email',
      'type': 'string'
    },
    {
      'minLength': 5,
      'type': 'string'
    }
  ]
} as const;

type VEmail = InferType<typeof _ValidatedEmail>;
// string & FormatBrandInterface<'email'> & string & MinLengthBrandInterface<5>
// simplifies to: string & FormatBrandInterface<'email'> & MinLengthBrandInterface<5>
void 0 as unknown as VEmail;
