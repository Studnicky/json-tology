import type { InferType } from '../../../src/types/index.js';

const MetadataSchema = {
  'patternProperties': {
    '^data_': { 'type': 'string' },
    '^meta_': { 'type': 'number' }
  },
  'type': 'object'
} as const;

type Metadata = InferType<typeof MetadataSchema>;

const ok: Metadata = {
  'data_name': 'Bastian',
  'meta_version': 1
}; // compiles
const bad: Metadata = { 'data_age': 99 }; // compile error  - must be string

void 0 as unknown as [typeof ok, typeof bad];
