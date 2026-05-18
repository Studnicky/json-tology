/**
 * Anti-pattern: Using `never` directly instead of the named alias.
 *
 * Both `const _: never = s;` and `const _: ExhaustiveType<typeof s> = s;`
 * compile identically — the runtime behaviour is the same. The named
 * alias is preferred because it communicates intent: "this default
 * branch exists to enforce exhaustiveness."
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

function describeBare(status: Status): string {
  switch (status) {
    case 'pending': return 'Awaiting confirmation';
    case 'shipped': return 'In transit';
    default: {
      // Works, but intent is less clear.
      const _: never = status;

      return _;
    }
  }
}

function describeNamed(status: Status): string {
  switch (status) {
    case 'pending': return 'Awaiting confirmation';
    case 'shipped': return 'In transit';
    default: {
      // ✓ Prefer the named form — communicates exhaustiveness intent.
      const _: ExhaustiveType<typeof status> = status;

      return _;
    }
  }
}

console.assert(describeBare('pending') === describeNamed('pending'));
