/**
 * DownloadUrl — URI string pointing to an e-book download endpoint.
 *
 * The `format: 'uri'` constraint ensures the value is a syntactically valid
 * absolute URI. No scheme restriction is applied at the schema level; API
 * policy governs which schemes (https, s3, etc.) are accepted.
 *
 * `x-jt-iriRef: true` instructs `toQuads` to emit the value as a
 * `NamedNode` rather than a plain `xsd:string` literal — the download URL
 * is itself a dereferenceable resource, not merely a string value.
 *
 * Used by EBook.downloadUrl.
 */

export const DownloadUrlSchema = {
  '$id': 'urn:bookstore:DownloadUrl',
  'format': 'uri',
  'type': 'string',
  'x-jt-iriRef': true
} as const;
