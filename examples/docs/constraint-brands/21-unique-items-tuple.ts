import type { InferType } from '../../../src/types/index.js';

const DuplicateConstTuple = {
  'prefixItems': [
    { 'const': 'red' },
    { 'const': 'red' } // duplicate — same literal type
  ],
  'type': 'array',
  'uniqueItems': true
} as const;

type DuplicateTuple = InferType<typeof DuplicateConstTuple>;
// never — the pairwise check detected the overlap at compile time
void 0 as unknown as DuplicateTuple;
