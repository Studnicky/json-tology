import type { InferType } from '../../../src/types/index.js';

const _DuplicateConstTuple = {
  'prefixItems': [
    { 'const': 'red' },
    // duplicate — same literal type
    { 'const': 'red' }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;

type DuplicateTuple = InferType<typeof _DuplicateConstTuple>;
// never — the pairwise check detected the overlap at compile time
void 0 as unknown as DuplicateTuple;
