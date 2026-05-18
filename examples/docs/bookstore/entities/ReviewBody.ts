/**
 * ReviewBody — review text content with a minimum meaningful length.
 *
 * A review body must be at least 10 characters to prevent single-character
 * placeholder submissions. There is no maximum enforced at the schema level
 * (API policy may apply a practical cap).
 */

export const ReviewBodySchema = {
  '$id': 'urn:bookstore:ReviewBody',
  'minLength': 10,
  'type': 'string'
} as const;
