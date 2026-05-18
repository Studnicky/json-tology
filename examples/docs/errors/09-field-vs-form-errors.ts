import type { ValidationErrorType } from '../../../src/types/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  const fieldErrors: ValidationErrorType[] = [];
  const formErrors: ValidationErrorType[] = [];

  for (const err of errs) {
    if (err.path) {
      fieldErrors.push(err);
    } else {
      formErrors.push(err);
    }
  }

  console.assert(
    fieldErrors.length + formErrors.length === errs.items.length,
    'All errors should be classified'
  );
}
