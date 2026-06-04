/**
 * VerifiedPurchase — boolean flag indicating the reviewer purchased the item
 * through the bookstore before submitting their review. Defaults to `false`
 * (unverified).
 *
 * Used as an annotation on the ReviewsBook annotated edge, with its predicate
 * grounded to `https://schema.org/verified` via `x-jt-predicate`.
 */
export const VerifiedPurchaseSchema = {
  '$id': 'urn:bookstore:VerifiedPurchase',
  'default': false,
  'type': 'boolean'
} as const;
