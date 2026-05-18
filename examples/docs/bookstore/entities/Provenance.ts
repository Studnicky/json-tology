/**
 * Provenance — non-empty string describing the chain of custody for a rare book.
 *
 * At least 1 character is required to prevent empty provenance records.
 * Used for SignedFirstEdition.provenance.
 *
 * Example: "Purchased from Estate of Carl Conrad Coreander, München, 1994.
 *           Signed 'M.E.' in blue ink on half-title page."
 */

export const ProvenanceSchema = {
  '$id': 'urn:bookstore:Provenance',
  'minLength': 1,
  'type': 'string'
} as const;
