/**
 * EnumValuesType — Example 1: Currency enum from an inline schema.
 *
 * Demonstrates extracting a union of literal strings from a schema's
 * `enum` array. The union stays in sync with the schema literal at
 * compile time.
 */

import type { EnumValuesType } from '../../../src/types/index.js';

const _CurrencySchema = {
  '$id': 'https://bookstore.example/Currency',
  'enum': [
    'USD',
    'EUR',
    'GBP',
    'JPY'
  ],
  'type': 'string'
} as const;

type Currency = EnumValuesType<typeof _CurrencySchema>;
// 'USD' | 'EUR' | 'GBP' | 'JPY'

const eur: Currency = 'EUR';

void eur;
