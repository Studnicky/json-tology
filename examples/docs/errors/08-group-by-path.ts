import type { ValidationErrorType } from '../../../src/types/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  const grouped: Partial<Record<string, ValidationErrorType[]>> = {};

  for (const err of errs) {
    (grouped[err.path || '_root'] ??= []).push(err);
  }
  console.assert(Object.keys(grouped).length > 0, 'Should have grouped errors');
  console.assert(
    grouped['/rating'] !== undefined || grouped['/body'] !== undefined,
    'Should have field-level errors'
  );
}
