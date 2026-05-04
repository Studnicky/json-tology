export const CurrencyCodeSchema = {
  '$id': 'urn:bookstore:CurrencyCode',
  'enum': [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CAD',
    'AUD'
  ],
  'type': 'string'
} as const;
