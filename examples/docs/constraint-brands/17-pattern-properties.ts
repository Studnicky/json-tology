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
// compile error — `data_`-prefixed keys must be string, not number.
// @ts-expect-error number is not assignable to the string-typed `data_` pattern key
const _bad: Metadata = { 'data_age': 99 };

console.log('patternProperties — valid object:', _ok);
// _bad is held via @ts-expect-error — the runtime value is { data_age: 99 }.
console.log('patternProperties — invalid (number under data_ key):', _bad);
