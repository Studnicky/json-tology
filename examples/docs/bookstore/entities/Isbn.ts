export const IsbnSchema = {
  '$id': 'urn:bookstore:Isbn',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;
