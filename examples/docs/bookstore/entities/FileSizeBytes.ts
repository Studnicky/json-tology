/**
 * FileSizeBytes — non-negative integer byte count for a digital file.
 *
 * Used for EBook.fileSizeBytes. A file size is a whole number of bytes ≥ 0.
 * Zero is valid for empty or placeholder entries.
 *
 * Distinct from RatingCount (a histogram bucket count with identical shape
 * but different domain semantics) and Amount (a currency-bearing decimal).
 */

export const FileSizeBytesSchema = {
  '$id': 'urn:bookstore:FileSizeBytes',
  'minimum': 0,
  'type': 'integer'
} as const;
