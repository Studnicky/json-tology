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

const _CurrencySchema = {
  'enum': [
    'USD',
    'EUR',
    'GBP'
  ],
  'type': 'string'
} as const;

type Currency = EnumValuesType<typeof _CurrencySchema>;

function currencySymbol(cur: Currency): string {
  switch (cur) {
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'USD': return '$';
    default: {
      // Adding 'JPY' to the enum without adding a case here becomes a compile error
      const _: ExhaustiveType<typeof cur> = cur;

      return _;
    }
  }
}

// Test the switch
const usd = currencySymbol('USD');

void usd;
