/**
 * Anti-pattern: Hand-rolled duplicate union.
 *
 * Typing the union by hand drifts from the schema the instant someone
 * adds a new value. Derive the union from the schema with
 * `EnumValuesType<typeof Schema>` so the type follows the data.
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

// ⊥ Don't do this — drifts from CurrencySchema.enum the moment 'JPY' is added.
type CurrencyManual = 'EUR' | 'GBP' | 'USD';

// ✓ Do this — derived from the schema literal.
type Currency = EnumValuesType<typeof _CurrencySchema>;

const manual: CurrencyManual = 'USD';
const derived: Currency = 'USD';

void manual;
void derived;
