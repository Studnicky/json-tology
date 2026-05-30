/**
 * Anti-pattern: Unsafe index access on `enum`.
 *
 * `(typeof Schema)['enum'][number]` breaks when the enum is not a
 * const array and ignores edge cases that EnumValuesType handles
 * (single-element enums, mixed types). Use the utility — it has been
 * designed for these shapes.
 */

import type { EnumValuesType } from '../../../src/types/index.js';

const _CurrencySchema = {
  'enum': [
    'USD',
    'EUR',
    'GBP'
  ],
  'type': 'string'
} as const;

// ⊥ Don't do this — fragile and edge-case-sensitive.
type CurrencyUnsafe = (typeof _CurrencySchema)['enum'][number];

// ✓ Do this — robust across enum shapes.
type Currency = EnumValuesType<typeof _CurrencySchema>;

const unsafe: CurrencyUnsafe = 'USD';
const derived: Currency = 'USD';

// Both resolve to the same runtime value; the difference is that
// CurrencyUnsafe via index access is fragile for non-const arrays and
// mixed-type enums, while EnumValuesType handles those shapes correctly.
console.log('unsafe (index access):', unsafe);
console.log('derived (EnumValuesType):', derived);
