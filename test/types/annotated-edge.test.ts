/**
 * Compile-time assertions for `Compose.annotatedEdge` inference (RDF 1.2
 * triple-term / edge-annotation pattern, Addition B of the rdf12-triple-term
 * emission plan).
 *
 * `InferType` of an annotated-edge schema must resolve to:
 *   {
 *     readonly target: <branded target>;
 *     readonly annotations: { <key>: <branded range>; ... };
 *   }
 *
 * The target and each annotation range are `$ref`s to named primitives, so
 * once resolved against a references map they must surface as their branded
 * types — NOT `unknown`.
 *
 * This file has no runtime assertions; it validates by compiling under
 * `npm run type-check:tests` (failing on the `@ts-expect-error` lines and on
 * any unsatisfied `assert<...>()`).
 */

import type { InferType } from '../../src/types/Schema.js';
import type {
  FormatBrandInterface
} from '../../src/types/ConstraintBrands.js';
import { Compose } from '../../src/modules/composition/Compose.js';

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

type AssertEqual<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Referenced named primitives — each carries a constraint that produces a brand
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'urn:bookstore:Book',
  'properties': { 'title': { 'type': 'string' } },
  'required': ['title'],
  'type': 'object'
} as const;

void BookSchema;

// A branded datatype: string with a format → FormatBrandInterface<'…'>.
const ReviewIdSchema = {
  '$id': 'urn:bookstore:ReviewId',
  'format': 'uuid',
  'type': 'string'
} as const;

void ReviewIdSchema;

// A numeric datatype: integer with a 0..100 span. The span exceeds the tight
// integer-range cap (50), so it resolves to plain `number` (a precise datatype,
// not `unknown`) rather than a literal union.
const RatingScoreSchema = {
  '$id': 'urn:bookstore:RatingScore',
  'maximum': 100,
  'minimum': 0,
  'type': 'integer'
} as const;

void RatingScoreSchema;

interface RefsMap {
  readonly 'urn:bookstore:Book': typeof BookSchema;
  readonly 'urn:bookstore:RatingScore': typeof RatingScoreSchema;
  readonly 'urn:bookstore:ReviewId': typeof ReviewIdSchema;
}

// ---------------------------------------------------------------------------
// The annotated-edge schema under test
// ---------------------------------------------------------------------------

const ReviewsBookSchema = Compose.annotatedEdge({
  'annotations': {
    'ratingGiven': { '$ref': 'urn:bookstore:RatingScore' },
    'reviewIdRef': { '$ref': 'urn:bookstore:ReviewId' }
  },
  'predicate': 'https://bookstore.example/reviews',
  'targetRef': 'urn:bookstore:Book'
});

void ReviewsBookSchema;

type ReviewsBook = InferType<typeof ReviewsBookSchema, RefsMap>;

// ---------------------------------------------------------------------------
// Shape: { target; annotations: { ratingGiven; reviewIdRef } }
// ---------------------------------------------------------------------------

assert<AssertAssignable<ReviewsBook, { readonly 'target': unknown }>>();
assert<AssertAssignable<ReviewsBook, { readonly 'annotations': unknown }>>();

// ---------------------------------------------------------------------------
// Target resolves to the branded Book class (has a required `title: string`)
// ---------------------------------------------------------------------------

type Target = ReviewsBook['target'];
assert<AssertAssignable<Target, { readonly 'title': string }>>();

// ---------------------------------------------------------------------------
// Annotation ranges resolve to branded datatypes — NOT `unknown`.
// ---------------------------------------------------------------------------

type Annotations = ReviewsBook['annotations'];

type ReviewIdRange = Annotations['reviewIdRef'];
type RatingRange = Annotations['ratingGiven'];

// The reviewId range carries the format brand (string is branded).
assert<AssertAssignable<ReviewIdRange, FormatBrandInterface<'uuid'>>>();
assert<AssertAssignable<ReviewIdRange, string>>();

// The rating range resolves to a precise numeric datatype — NOT `unknown`.
// The 0..100 span exceeds the tight integer-range cap (50), so it resolves to
// plain `number` rather than a literal union or numeric brands.
assert<AssertAssignable<RatingRange, number>>();
assert<AssertEqual<RatingRange, number>>();

// A bare `unknown` value must NOT be assignable to a branded range.
// @ts-expect-error — unknown is not a branded ReviewId range
assert<AssertAssignable<unknown, ReviewIdRange>>();

// ---------------------------------------------------------------------------
// Predicate-binding keys (x-jt-predicate / $id) are accepted on an annotation
// alongside the required range `$ref`, and do not disturb range inference. The
// annotation predicate IRI is grounded from these keys at projection/lift time
// via PredicateResolver; authoring them must type-check.
// ---------------------------------------------------------------------------

const GroundedEdgeSchema = Compose.annotatedEdge({
  'annotations': {
    'ratingGiven': {
      '$ref': 'urn:bookstore:RatingScore',
      'x-jt-predicate': 'https://schema.org/ratingValue'
    }
  },
  'predicate': 'https://bookstore.example/reviews',
  'targetRef': 'urn:bookstore:Book'
});

void GroundedEdgeSchema;

type GroundedEdge = InferType<typeof GroundedEdgeSchema, RefsMap>;

// The binding key does not leak into the inferred annotation range: ratingGiven
// still resolves to the branded numeric datatype, not `unknown`.
assert<AssertEqual<GroundedEdge['annotations']['ratingGiven'], number>>();
