import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';

const _EmailSchema = {
  'format': 'email',
  'type': 'string'
} as const;

// string & FormatBrandInterface<'email'>
type Email = InferType<typeof _EmailSchema>;
// string
type Input = LooseInputType<Email>;
void 0 as unknown as Input;
