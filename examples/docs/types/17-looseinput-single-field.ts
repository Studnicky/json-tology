/**
 * LooseInputType — Example: Stripping brands from a single field type.
 *
 * `Review['body']` carries a `MinLengthBrand<10>` intersection.
 * `LooseInputType<…>` returns plain `string` so input-boundary code can
 * accept any string before validation.
 */

import type { LooseInputType } from '../../../src/types/index.js';
import type { Review } from '../bookstore/index.js';

// Review is exported from bookstore/index.ts inferred with the registry's
// reference map, so `body` resolves to its branded named datatype.
type ReviewBody = Review['body'];
// string & MinLengthBrand<10>

type LooseBody = LooseInputType<ReviewBody>;
// string — plain string, no brand.

const draftBody: LooseBody
  = 'A sweeping tale of Bastian and Fantastica, told with rare warmth.';

console.assert(typeof draftBody === 'string');
console.assert(draftBody.length >= 10);

console.log('ReviewBody branded type -> LooseInputType strips brand to plain string');
console.log('draftBody type:', typeof draftBody, '| length:', draftBody.length);
