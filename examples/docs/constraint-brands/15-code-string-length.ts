import type { InferType } from '../../../src/types/index.js';

const CodeSchema = {
  'maxLength': 10,
  'minLength': 3,
  'type': 'string'
} as const;

type Code = InferType<typeof CodeSchema>;
void 0 as unknown as Code;
