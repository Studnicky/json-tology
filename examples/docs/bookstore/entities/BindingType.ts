/**
 * BindingType — physical binding style of a printed book.
 *
 * Either 'hardcover' (case-bound, rigid boards) or 'paperback' (perfect-bound,
 * flexible cover). Modelling as a named enum primitive keeps the allowed values
 * in a single canonical location and makes the OWL TBox enumerate them as a
 * controlled vocabulary.
 */

export const BindingTypeSchema = {
  '$id': 'urn:bookstore:BindingType',
  'enum': [
    'hardcover',
    'paperback'
  ],
  'type': 'string'
} as const;
