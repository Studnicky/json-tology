/**
 * EnumValuesType + ExhaustiveType — Exhaustive switch with compile-time safety
 *
 * Demonstrates pairing EnumValuesType with ExhaustiveType to ensure
 * all enum cases are handled; adding a case without handling it
 * becomes a compile error.
 */

import type {
  EnumValuesType, ExhaustiveType
} from '../../../src/types/index.js';

const CurrencySchema = {
  'enum': [
    'USD',
    'EUR',
    'GBP'
  ],
  'type': 'string'
} as const;

type Currency = EnumValuesType<typeof CurrencySchema>;

function currencySymbol(c: Currency): string {
  switch (c) {
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'USD': return '$';
    default: {
      const _: ExhaustiveType<typeof c> = c;

      return _;
      // Adding 'JPY' to the enum without adding a case here becomes a compile error
    }
  }
}

// Test the switch
const usd = currencySymbol('USD');

void usd;
