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

// DuplicateTuple is never: two identical const literals in a uniqueItems tuple
// are incompatible at the type level. The extends-never check confirms this.
type IsDuplicateTupleNever = [DuplicateTuple] extends [never] ? true : false;
const check: IsDuplicateTupleNever = true;

console.log('Duplicate const tuple collapses to never:', check);
