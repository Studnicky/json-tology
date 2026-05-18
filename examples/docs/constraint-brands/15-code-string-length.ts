import type { InferType } from '../../../src/types/index.js';

const _CodeSchema = {
  'maxLength': 10,
  'minLength': 3,
  'type': 'string'
} as const;

type Code = InferType<typeof _CodeSchema>;
void 0 as unknown as Code;
