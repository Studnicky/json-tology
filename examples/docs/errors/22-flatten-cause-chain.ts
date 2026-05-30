/**
 * Inspecting the cause chain via `flatten()`.
 *
 * `InstantiationError.flatten()` walks the cause chain and appends
 * every item in the embedded `errors` collection. A single call
 * surfaces both the wrapper and each underlying validation issue.
 */

import { InstantiationError } from '../../../src/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

try {
  bookstoreEntities.instantiate(ReviewSchema.$id, {
    'body': 'no',
    'rating': 12
  });
} catch (error) {
  if (error instanceof InstantiationError) {
    const entries = error.flatten();

    console.assert(entries.length > 0);

    console.log('flatten() entry count:', entries.length);
    for (const entry of entries) {
      console.log(`  code=${entry.code}  retryable=${entry.retryable}  message=${entry.message}`);
    }
  }
}
