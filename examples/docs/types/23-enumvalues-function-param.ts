/**
 * EnumValuesType — Example: As a function parameter type.
 *
 * Using EnumValuesType as a function argument keeps the parameter
 * surface in sync with the schema's `enum` declaration. Adding a new
 * currency to the schema automatically widens the parameter type.
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

type Currency = EnumValuesType<typeof _CurrencySchema>;

function formatPrice(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = {
    'EUR': '€',
    'GBP': '£',
    'USD': '$'
  };

  return `${symbols[currency]}${amount.toFixed(2)}`;
}

const eur = formatPrice(19.99, 'EUR');
const gbp = formatPrice(19.99, 'GBP');

console.assert(eur === '€19.99');
console.assert(gbp === '£19.99');
