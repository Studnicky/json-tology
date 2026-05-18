/**
 * WeightGrams — non-negative physical weight measurement in grams.
 *
 * Used for PrintBook.weightGrams. Physical weight is a continuous (non-integer)
 * measurement and must be ≥ 0. Zero is valid for items weighed as negligible.
 *
 * Distinct from Amount (a currency-bearing monetary value that carries
 * economic semantics — currency, precision, rounding modes).
 */

export const WeightGramsSchema = {
  '$id': 'urn:bookstore:WeightGrams',
  'minimum': 0,
  'type': 'number'
} as const;
