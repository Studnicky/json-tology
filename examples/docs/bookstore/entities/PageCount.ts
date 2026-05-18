/**
 * PageCount — non-negative integer for pagination totals.
 *
 * Used for `total` (total matching records) and `totalPages` in paginated
 * responses. A count is always a whole number ≥ 0.
 *
 * Distinct from Amount (a currency-bearing decimal) and PageSize (items per page).
 */

export const PageCountSchema = {
  '$id': 'urn:bookstore:PageCount',
  'minimum': 0,
  'type': 'integer'
} as const;
