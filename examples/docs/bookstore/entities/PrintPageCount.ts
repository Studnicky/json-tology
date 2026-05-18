/**
 * PrintPageCount — positive integer number of physical pages in a printed book.
 *
 * Used for PrintBook.pageCount. A physical book must have at least one page.
 *
 * Distinct from PageCount (pagination total of records), PageNumber (current
 * page index in a paginated response), and PageSize (items per page).
 */

export const PrintPageCountSchema = {
  '$id': 'urn:bookstore:PrintPageCount',
  'minimum': 1,
  'type': 'integer'
} as const;
