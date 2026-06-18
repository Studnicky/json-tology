/**
 * Anti-pattern: Omitting the default branch entirely.
 *
 * With both cases of the current union handled and no default branch,
 * the function compiles. The catch is that adding a new value to the
 * schema's `enum` (and therefore to the derived union) re-introduces
 * an implicit fallthrough — and without the `ExhaustiveType` check in
 * a default branch, the compiler cannot warn about it.
 */

import type {
  EnumValuesType, ExhaustiveType
} from '../../../src/types/index.js';

const _StatusSchema = {
  'enum': [
    'pending',
    'shipped'
  ],
  'type': 'string'
} as const;

type Status = EnumValuesType<typeof _StatusSchema>;

// ⊥ Don't do this — no default exhaustiveness check.
// Adding a new union member (e.g. 'cancelled') silently falls through
// to the implicit gap; the compiler emits no error.
function describeUnsafe(status: Status): string {
  switch (status) {
    case 'pending': return 'Awaiting confirmation';
    case 'shipped': return 'In transit';
    default: return 'unknown';
  }
}

// ✓ Do this — adding 'cancelled' to the enum without a case here is
// caught by the compiler.
function describeSafe(status: Status): string {
  switch (status) {
    case 'pending': return 'Awaiting confirmation';
    case 'shipped': return 'In transit';
    default: {
      const _: ExhaustiveType<typeof status> = status;

      return _;
    }
  }
}

console.assert(describeUnsafe('pending') === describeSafe('pending'));
console.assert(describeUnsafe('shipped') === describeSafe('shipped'));
