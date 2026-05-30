/**
 * Compose.partial — Example 2: Draft Review form initial state
 *
 * `Compose.partial` strips the `required` array from the canonical
 * ReviewSchema so a draft form can validate at any intermediate point
 * — even with zero fields filled in.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  ReviewSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const DraftReviewSchema = Compose.partial(
  ReviewSchema,
  'https://bookstore.example/DraftReview'
);

const jt2 = jt.set(DraftReviewSchema);

// An empty draft passes — every field is optional.
const empty = jt2.validate(DraftReviewSchema.$id, {});

console.assert(empty.ok);

// A partial draft also passes.
const partial = jt2.validate(DraftReviewSchema.$id, { 'rating': 4 });

console.assert(partial.ok);
