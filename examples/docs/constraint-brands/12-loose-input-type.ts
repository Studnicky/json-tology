import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';

const EmailSchema = {
  'format': 'email',
  'type': 'string'
} as const;

type Email = InferType<typeof EmailSchema>; // string & FormatBrandInterface<'email'>
type Input = LooseInputType<Email>; // string
void 0 as unknown as Input;
