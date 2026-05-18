/**
 * Anti-pattern: Floating-point bounds.
 *
 * IntegerRangeType expects non-negative integer literal bounds. Passing
 * floats produces undefined results — the utility is integer-only.
 * For floating-point ranges, model the constraint with a branded
 * `number` and a runtime check.
 */

import type { IntegerRangeType } from '../../../src/types/index.js';

// ⊥ Don't do this — bounds must be non-negative integer literals.
type PriceRange = IntegerRangeType<0.5, 9.99>;
// Produces unexpected results; the exact resolution is implementation-
// defined for non-integer bounds.

// Use the integer form, then narrow with multiplication/division at the
// boundary, or carry a branded number with a runtime range check.
type PriceCents = IntegerRangeType<50, 999>;
// 50 | 51 | ... | 999 — falls back to `number` past the cap, but is
// at least integer-correct.

const cents: PriceCents = 199;

void (null as unknown as PriceRange);
console.assert(cents === 199);
