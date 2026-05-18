/**
 * PageNumber — 1-based page index for paginated requests and responses.
 *
 * Page numbering starts at 1; 0 is not a valid page number.
 *
 * Distinct from PageCount (total records / pages) and PageSize (items per page).
 */

export const PageNumberSchema = {
  '$id': 'urn:bookstore:PageNumber',
  'minimum': 1,
  'type': 'integer'
} as const;
