import { Compose } from '../../../../src/index.js';
import type { ValidateSchemaType } from '../../../../src/types/SchemaValidation.js';
import { BookSchema } from './Book.js';
import { CustomerIdSchema } from './CustomerId.js';
import { IsbnSchema } from './Isbn.js';
import { Iso8601Schema } from './Iso8601.js';
import { RatingScoreSchema } from './RatingScore.js';
import { ReviewBodySchema } from './ReviewBody.js';
import { ReviewIdSchema } from './ReviewId.js';
import { VerifiedPurchaseSchema } from './VerifiedPurchase.js';

/**
 * ReviewsBook — RDF-star annotated edge from a Review individual to a Book
 * individual. Carries two annotations at the edge level:
 *
 *   - `ratingGiven` — the numeric rating score, predicate grounded to
 *     `https://schema.org/ratingValue` via `x-jt-predicate`.
 *   - `verifiedPurchase` — boolean flag indicating the reviewer purchased
 *     the item, predicate grounded to `https://schema.org/verified` via
 *     `x-jt-predicate`.
 *
 * This is the bookstore demonstration of `Compose.annotatedEdge` /
 * `jt:annotatedEdge` with explicit predicate grounding. The base triple is:
 *   <review-iri> <https://bookstore.example/reviews> <book-iri>
 *
 * The annotation quads (triple-term form) are:
 *   << <review-iri> <https://bookstore.example/reviews> <book-iri> >>
 *     <https://schema.org/ratingValue>  "5"^^xsd:integer .
 *   << <review-iri> <https://bookstore.example/reviews> <book-iri> >>
 *     <https://schema.org/verified>  "true"^^xsd:boolean .
 *
 * The property is OPTIONAL so existing Review fixtures (which supply
 * `bookIsbn` for the ISBN) continue to validate unchanged.
 */
export const ReviewsBookEdge = Compose.annotatedEdge({
  'annotations': {
    'ratingGiven': {
      '$ref': RatingScoreSchema.$id,
      'x-jt-predicate': 'https://schema.org/ratingValue'
    },
    'verifiedPurchase': {
      '$ref': VerifiedPurchaseSchema.$id,
      'x-jt-predicate': 'https://schema.org/verified'
    }
  },
  'predicate': 'https://bookstore.example/reviews',
  'targetRef': BookSchema.$id
});

export const ReviewSchema = {
  '$id': 'urn:bookstore:Review',
  'properties': {
    'body': { '$ref': ReviewBodySchema.$id },
    'bookIsbn': { '$ref': IsbnSchema.$id },
    // functional: true — each Review has at most one customer (a review is
    // written by exactly one person; the customerId property maps to a single
    // Customer individual). OWL 2: owl:FunctionalProperty on customerId.
    'customerId': {
      '$ref': CustomerIdSchema.$id,
      'functional': true
    },
    'postedAt': { '$ref': Iso8601Schema.$id },
    'rating': { '$ref': RatingScoreSchema.$id },
    'reviewId': { '$ref': ReviewIdSchema.$id },
    // reviewsBook — optional RDF-star annotated edge to the Book individual.
    // When populated in a fixture, `toQuads` must receive a `graphIri` option.
    // Demonstrates jt:annotatedEdge: the ratingGiven annotation rides the
    // edge triple itself, not just as a scalar property on the Review.
    'reviewsBook': ReviewsBookEdge
  },
  'required': [
    'reviewId',
    'bookIsbn',
    'customerId',
    'rating',
    'body',
    'postedAt'
  ],
  'type': 'object'
} as const;

// Compile-time self-check: every `required` entry must be in `properties`.
const _reviewShapeOk: ValidateSchemaType<typeof ReviewSchema> = ReviewSchema;

void _reviewShapeOk;
