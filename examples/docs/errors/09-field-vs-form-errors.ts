import type { ValidationErrorEntity } from '../../../src/types/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  const fieldErrors: ValidationErrorEntity.Type[] = [];
  const formErrors: ValidationErrorEntity.Type[] = [];

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

  console.log('field errors:', fieldErrors.length);
  console.log('form errors:', formErrors.length);
  for (const err of fieldErrors) {
    console.log(`  field  path=${err.path}  message=${err.message}`);
  }
  for (const err of formErrors) {
    console.log(`  form   message=${err.message}`);
  }
}
