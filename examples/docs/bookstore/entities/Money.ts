import { AmountSchema } from './Amount.js';
import { CurrencyCodeSchema } from './CurrencyCode.js';

export const MoneySchema = {
  '$id': 'urn:bookstore:Money',
  'properties': {
    'amount': { '$ref': AmountSchema.$id },
    'currency': { '$ref': CurrencyCodeSchema.$id }
  },
  'required': [
    'amount',
    'currency'
  ],
  'type': 'object'
} as const;
