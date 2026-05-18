/**
 * PageSize — number of items per page (must be ≥ 1).
 *
 * Requesting zero or negative items per page is not meaningful. Consumers
 * typically cap this to a maximum via API policy, not schema.
 *
 * Distinct from PageNumber (the current page index) and PageCount (total results).
 */

export const PageSizeSchema = {
  '$id': 'urn:bookstore:PageSize',
  'minimum': 1,
  'type': 'integer'
} as const;
