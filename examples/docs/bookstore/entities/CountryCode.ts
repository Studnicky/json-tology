export const CountryCodeSchema = {
  '$id': 'urn:bookstore:CountryCode',
  'pattern': '^[A-Z]{2}$',
  'type': 'string'
} as const;
