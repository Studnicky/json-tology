/**
 * DownloadUrl — URI string pointing to an e-book download endpoint.
 *
 * The `format: 'uri'` constraint ensures the value is a syntactically valid
 * absolute URI. No scheme restriction is applied at the schema level; API
 * policy governs which schemes (https, s3, etc.) are accepted.
 *
 * Used by EBook.downloadUrl.
 */

export const DownloadUrlSchema = {
  '$id': 'urn:bookstore:DownloadUrl',
  'format': 'uri',
  'type': 'string'
} as const;
