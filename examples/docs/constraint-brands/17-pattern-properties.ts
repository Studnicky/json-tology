import type { InferType } from '../../../src/types/index.js';

const _MetadataSchema = {
  'patternProperties': {
    '^data_': { 'type': 'string' },
    '^meta_': { 'type': 'number' }
  },
  'type': 'object'
} as const;

type Metadata = InferType<typeof _MetadataSchema>;

// compiles
const _ok: Metadata = {
  'data_name': 'Bastian',
  'meta_version': 1
};
// compile error — must be string
const _bad: Metadata = { 'data_age': 99 };

void 0 as unknown as [typeof _ok, typeof _bad];
